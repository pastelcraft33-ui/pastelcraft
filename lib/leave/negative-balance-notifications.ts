import "server-only";

import type { CurrentEmployee } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { canReceiveNegativeBalanceAlerts, unreadNegativeBalanceNotifications, type NegativeBalanceNotification } from "./negative-balance-alert";

export async function getNegativeBalanceNotifications(employee: CurrentEmployee) {
  if (!canReceiveNegativeBalanceAlerts(employee)) {
    return { items: [] as NegativeBalanceNotification[], negativeBalanceCount: 0 };
  }
  const db = createAdminClient();
  const items: NegativeBalanceNotification[] = [];
  // Persisted application snapshots and per-representative read receipts survive logout.
  // Page past acknowledged rows so old alerts cannot hide newer unread alerts.
  for (let offset = 0; ; offset += 100) {
    const { data: applications, error } = await db.from("activity_logs")
      .select("id, changed_data, created_at")
      .eq("action_type", "leave.create")
      .eq("changed_data->>negative_balance", "true")
      .order("created_at", { ascending: false }).order("id", { ascending: false })
      .range(offset, offset + 99);
    if (error) throw new Error("잔여 연차 마이너스 알림을 불러오지 못했습니다.");
    if (!applications?.length) break;
    const { data: receipts, error: receiptError } = await db.from("activity_logs")
      .select("target_id")
      .eq("employee_id", employee.id)
      .eq("action_type", "leave.negative_balance.read")
      .in("target_id", applications.map(row => row.id));
    if (receiptError) throw new Error("연차 알림 확인 내역을 불러오지 못했습니다.");
    const readIds = new Set((receipts ?? []).map(row => row.target_id));
    items.push(...unreadNegativeBalanceNotifications(applications, readIds));
    if (applications.length < 100) break;
  }
  return { items, negativeBalanceCount: items.length };
}
