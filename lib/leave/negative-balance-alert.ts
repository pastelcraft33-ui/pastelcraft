import { isPastelcraftRepresentative } from "./permissions";
import type { CurrentEmployee } from "@/lib/auth/session";

export function negativeBalanceApplicationData(name: string, current: number | null) {
  return typeof current === "number" && Number.isFinite(current) && current < 0
    ? { negative_balance: true, balance_at_application: current, employee_name: name }
    : {};
}

export function negativeBalanceAlertTitle(name: string) {
  return `잔여연차 마이너스 ${name}님이 휴가를 신청하였습니다.`;
}

export function canReceiveNegativeBalanceAlerts(employee: CurrentEmployee) {
  return isPastelcraftRepresentative(employee);
}

export type NegativeBalanceNotification = {
  id: string;
  type: "negative_balance";
  title: string;
  description: string;
  createdAt: string;
  href: string;
};

export function unreadNegativeBalanceNotifications(
  applications: { id: string; changed_data: unknown; created_at: string }[],
  readIds: ReadonlySet<string>,
): NegativeBalanceNotification[] {
  return applications.flatMap(application => {
    if (readIds.has(application.id)) return [];
    const value = application.changed_data as Record<string, unknown> | null;
    if (!value || value.negative_balance !== true || typeof value.balance_at_application !== "number" ||
      !Number.isFinite(value.balance_at_application) || value.balance_at_application >= 0) return [];
    return [{
      id: `negative-balance:${application.id}`, type: "negative_balance" as const,
      title: negativeBalanceAlertTitle(typeof value.employee_name === "string" ? value.employee_name : "직원"),
      description: `신청 당시 잔여 ${value.balance_at_application}일 · ${String(value.start_date ?? "")} ~ ${String(value.end_date ?? "")}`,
      createdAt: application.created_at, href: "/admin/leave",
    }];
  });
}
