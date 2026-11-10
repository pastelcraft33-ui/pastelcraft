import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { hashSessionToken, SESSION_CACHE_TAG, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerEnv } from "@/lib/env";

const keyPattern = /^[a-zA-Z0-9_-]{43}$/;
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
const callback = new URL("/auth/callback", process.env.IPGO_ORIGIN || "https://ipgo.vercel.app");

function signature(sessionId: string, challenge: string) {
  return createHmac("sha256", getServerEnv().SESSION_TOKEN_PEPPER)
    .update(`ipgo/v1/${sessionId}/${challenge}`).digest("base64url");
}

export async function GET(request: NextRequest) {
  const challenge = request.nextUrl.searchParams.get("challenge") || "";
  if (!keyPattern.test(challenge)) return new Response(null, { status: 400, headers });
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const { data, error } = token ? await createAdminClient().from("sessions").select("id")
    .eq("session_token_hash", hashSessionToken(token, getServerEnv().SESSION_TOKEN_PEPPER))
    .gt("expires_at", new Date().toISOString()).maybeSingle() : { data: null, error: null };
  if (error) return new Response(null, { status: 503, headers });
  const target = data ? new URL(callback) : new URL("/logistics-login", request.url);
  if (data) target.searchParams.set("grant", data.id + "." + signature(data.id, challenge));
  else target.searchParams.set("ipgo", challenge);
  return NextResponse.redirect(target, { headers });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const grant = typeof body?.grant === "string" ? body.grant : "";
  const match = /^([0-9a-f-]{36})\.([A-Za-z0-9_-]{43})$/.exec(grant);
  if (!match || typeof body.verifier !== "string" || !keyPattern.test(body.verifier)) return new Response(null, { status: 401, headers });
  const challenge = createHash("sha256").update(body.verifier).digest("base64url");
  if (!timingSafeEqual(Buffer.from(signature(match[1], challenge)), Buffer.from(match[2]))) return new Response(null, { status: 401, headers });
  if (body.action === "logout") {
    const { error } = await createAdminClient().from("sessions").delete().eq("id", match[1]);
    if (error) return new Response(null, { status: 503, headers });
    revalidateTag(SESSION_CACHE_TAG, { expire: 0 });
    return new Response(null, { status: 204, headers });
  }
  const { data, error } = await createAdminClient().from("sessions")
    .select("expires_at, employee:employees!sessions_employee_id_fkey(name, account_status)")
    .eq("id", match[1]).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (error) return new Response(null, { status: 503, headers });
  const employee = Array.isArray(data?.employee) ? data.employee[0] : data?.employee;
  if (!employee || employee.account_status !== "active") return new Response(null, { status: 401, headers });
  return NextResponse.json({ name: employee.name, expiresAt: data!.expires_at }, { headers });
}
