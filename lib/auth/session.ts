import "server-only";

import { createHash } from "node:crypto";
import { cache } from "react";

import { cookies } from "next/headers";
import { unstable_cache } from "next/cache";
import { redirect } from "next/navigation";

import { getServerEnv } from "@/lib/env";
import { departmentLabel, positionLabel } from "@/lib/employees/constants";
import { createProfileImageSignedUrl } from "@/lib/storage/profile-image";
import { createAdminClient } from "@/lib/supabase/admin";

export const SESSION_COOKIE_NAME =
  process.env.SESSION_COOKIE_NAME || "pc_session";
export const SESSION_CACHE_TAG = "workspace-sessions";

export type CurrentEmployee = {
  id: string;
  loginId: string;
  name: string;
  position: string;
  positionCode: string;
  department: string;
  departmentCode: string;
  imageUrl: string | null;
  role: "employee" | "admin";
  sessionExpiresAt: string;
};

export type SessionFailureReason =
  | "missing"
  | "invalid"
  | "expired"
  | "account-disabled";

export type CurrentSessionResult =
  | { employee: CurrentEmployee; reason: null }
  | { employee: null; reason: SessionFailureReason };

type CachedEmployee = CurrentEmployee & {
  profileImageStoredValue: string | null;
};

type CachedSessionResult =
  | { employee: CachedEmployee; reason: null }
  | { employee: null; reason: SessionFailureReason };

export function hashSessionToken(token: string, pepper: string) {
  return createHash("sha256").update(token).update(pepper).digest("hex");
}

const getSessionByTokenHash = unstable_cache(
  async (tokenHash: string): Promise<CachedSessionResult> => {
    const supabase = createAdminClient();
    const { data: session } = await supabase
      .from("sessions")
      .select(
        "id, employee_id, expires_at, employee:employees!sessions_employee_id_fkey(id, login_id, name, position, department, profile_image_url, role, account_status)",
      )
      .eq("session_token_hash", tokenHash)
      .maybeSingle();

    if (!session) return { employee: null, reason: "invalid" };

    if (new Date(session.expires_at).getTime() <= Date.now()) {
      await supabase.from("sessions").delete().eq("id", session.id);
      return { employee: null, reason: "expired" };
    }

    const employee = Array.isArray(session.employee)
      ? session.employee[0]
      : session.employee;

    if (!employee) {
      await supabase.from("sessions").delete().eq("id", session.id);
      return { employee: null, reason: "invalid" };
    }

    if (employee.account_status !== "active") {
      await supabase.from("sessions").delete().eq("employee_id", employee.id);
      return { employee: null, reason: "account-disabled" };
    }

    return {
      employee: {
        id: employee.id,
        loginId: employee.login_id,
        name: employee.name,
        position: positionLabel(employee.position),
        positionCode: employee.position,
        department: departmentLabel(employee.department),
        departmentCode: employee.department,
        imageUrl: null,
        profileImageStoredValue: employee.profile_image_url,
        role: employee.role,
        sessionExpiresAt: session.expires_at,
      },
      reason: null,
    };
  },
  ["current-session-by-token-v2"],
  { revalidate: 15, tags: [SESSION_CACHE_TAG] },
);

const getCurrentSessionCached = cache(async (): Promise<CachedSessionResult> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) return { employee: null, reason: "missing" };

  try {
    const env = getServerEnv();
    const tokenHash = hashSessionToken(token, env.SESSION_TOKEN_PEPPER);
    return getSessionByTokenHash(tokenHash);
  } catch {
    return { employee: null, reason: "invalid" };
  }
});

export async function getCurrentSession({
  includeProfileImage = false,
}: {
  includeProfileImage?: boolean;
} = {}): Promise<CurrentSessionResult> {
  const session = await getCurrentSessionCached();
  if (!session.employee) return session;

  const { profileImageStoredValue, ...employee } = session.employee;
  if (!includeProfileImage || !profileImageStoredValue) {
    return { employee, reason: null };
  }

  const imageUrl = await createProfileImageSignedUrl(
    createAdminClient(),
    profileImageStoredValue,
  );
  return { employee: { ...employee, imageUrl }, reason: null };
}

export async function getCurrentEmployee(): Promise<CurrentEmployee | null> {
  const session = await getCurrentSession();
  return session.employee;
}

export async function requireCurrentEmployee(options?: {
  includeProfileImage?: boolean;
}) {
  const session = await getCurrentSession(options);
  if (!session.employee) {
    const reason =
      session.reason === "expired"
        ? "session-expired"
        : session.reason === "account-disabled"
          ? "account-disabled"
          : session.reason === "invalid"
            ? "invalid-session"
            : null;
    redirect(reason ? `/login?reason=${reason}` : "/login");
  }
  return session.employee;
}
