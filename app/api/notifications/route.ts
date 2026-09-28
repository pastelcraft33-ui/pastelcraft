import { NextResponse } from "next/server";

import {
  hasValidMutationOrigin,
  invalidOriginResponse,
  requireApiEmployee,
} from "@/lib/auth/api";
import { getLeaveNotifications } from "@/lib/leave/notifications";
import { getMeetingNotifications } from "@/lib/meetings/notifications";
import { getProductDesignNotifications } from "@/lib/product-design/notifications";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiEmployee();
  if (auth.response) return auth.response;

  const requestedSince = new URL(request.url).searchParams.get("since");
  const since = normalizeSince(requestedSince);

  try {
    const [leaveNotifications, meetingNotifications, productDesignNotifications] = await Promise.all([
      getLeaveNotifications(auth.employee, since),
      getMeetingNotifications(auth.employee, since),
      getProductDesignNotifications(auth.employee),
    ]);
    const notifications = {
      ...leaveNotifications,
      ...meetingNotifications,
      ...productDesignNotifications,
      items: [
        ...leaveNotifications.items,
        ...meetingNotifications.items,
        ...productDesignNotifications.items,
      ].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    };
    return NextResponse.json(
      { ...notifications, checkedAt: new Date().toISOString() },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { message: "알림을 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  if (!hasValidMutationOrigin(request)) return invalidOriginResponse();

  const auth = await requireApiEmployee();
  if (auth.response) return auth.response;

  const { error } = await createAdminClient()
    .from("employee_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("employee_id", auth.employee.id)
    .eq("notification_type", "product_design_assignment")
    .is("read_at", null);
  if (error) {
    return NextResponse.json(
      { message: "알림을 확인 처리하지 못했습니다." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}

function normalizeSince(value: string | null) {
  const now = Date.now();
  const maximumLookback = now - 30 * 24 * 60 * 60 * 1000;
  if (!value) return new Date(now).toISOString();

  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return new Date(now).toISOString();
  return new Date(Math.min(now, Math.max(timestamp, maximumLookback))).toISOString();
}
