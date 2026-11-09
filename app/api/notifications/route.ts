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
import { getNegativeBalanceNotifications } from "@/lib/leave/negative-balance-notifications";
import { canReceiveNegativeBalanceAlerts } from "@/lib/leave/negative-balance-alert";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiEmployee();
  if (auth.response) return auth.response;

  const requestedSince = new URL(request.url).searchParams.get("since");
  const since = normalizeSince(requestedSince);

  try {
    const [leaveNotifications, meetingNotifications, productDesignNotifications, negativeBalanceNotifications] = await Promise.all([
      getLeaveNotifications(auth.employee, since),
      getMeetingNotifications(auth.employee, since),
      getProductDesignNotifications(auth.employee),
      getNegativeBalanceNotifications(auth.employee),
    ]);
    const notifications = {
      ...leaveNotifications,
      ...meetingNotifications,
      ...productDesignNotifications,
      ...negativeBalanceNotifications,
      items: [
        ...leaveNotifications.items,
        ...meetingNotifications.items,
        ...productDesignNotifications.items,
        ...negativeBalanceNotifications.items,
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

  if (new URL(request.url).searchParams.get("type") === "negative_balance") {
    if (!canReceiveNegativeBalanceAlerts(auth.employee)) {
      return NextResponse.json({ message: "대표 계정만 확인할 수 있습니다." }, { status: 403 });
    }
    const parsed = z.object({ id: z.string().uuid() }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ message: "올바른 알림을 선택해 주세요." }, { status: 400 });
    const db = createAdminClient();
    const { data: application, error: lookupError } = await db.from("activity_logs")
      .select("id").eq("id", parsed.data.id).eq("action_type", "leave.create")
      .eq("changed_data->>negative_balance", "true").maybeSingle();
    if (lookupError) return NextResponse.json({ message: "알림 조회에 실패했습니다." }, { status: 500 });
    if (!application) return NextResponse.json({ message: "알림을 찾을 수 없습니다." }, { status: 404 });
    const { data: receipts, error: receiptError } = await db.from("activity_logs").select("id")
      .eq("employee_id", auth.employee.id).eq("action_type", "leave.negative_balance.read")
      .eq("target_id", application.id).limit(1);
    if (receiptError) return NextResponse.json({ message: "확인 내역 조회에 실패했습니다." }, { status: 500 });
    if (!receipts?.length) {
      const { error } = await db.from("activity_logs").insert({
        employee_id: auth.employee.id, action_type: "leave.negative_balance.read",
        target_type: "activity_log", target_id: application.id, changed_data: {},
      });
      if (error) return NextResponse.json({ message: "알림을 확인 처리하지 못했습니다." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

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
