import type { SupabaseClient } from "@supabase/supabase-js";
import { hireDateOpeningDays, leaveImportDate, validDate } from "./balance";

// Explicit employee-specific exclusion requested by the company.
// Use the immutable employee ID, not a name that could change or be shared.
const AUTO_INITIALIZATION_EXCLUDED_EMPLOYEE_IDS = new Set([
  "47976346-153e-4778-acb4-6c0af45cabc9", // 구교환
]);

/** Existing accounts are never recalculated or overwritten by hire-date edits. */
export function initialLeaveAccount(employeeId: string, hireDate: string, actorId: string, department = "") {
  if (!validDate(hireDate)) throw new Error("입사일을 확인해 주세요.");
  const cutoff = leaveImportDate(department);
  const openingDate = hireDate > cutoff ? hireDate : cutoff;
  return {
    employee_id: employeeId,
    opening_date: openingDate,
    opening_days: hireDateOpeningDays(hireDate, openingDate),
    monthly_enabled: true,
    work_days: [1, 2, 3, 4, 5],
    exclude_holidays: true,
    reason: JSON.stringify({
      type: "no_ledger_zero_usage",
      source: "hire_date_auto_initialization",
      hire_date: hireDate,
      previous_usage: 0,
      policy: "초기 설정 없는 직원: 이관 기준일 이전 사용량 0일. 첫해 매월 1일, 이후 입사기념일 연간 부여. 기준일 이후 승인 휴가는 별도 차감.",
    }),
    created_by: actorId,
  };
}

export async function ensureInitialLeaveAccount(
  db: SupabaseClient, employeeId: string, hireDate: string | null, actorId: string,
  department = "",
) {
  if (!hireDate || AUTO_INITIALIZATION_EXCLUDED_EMPLOYEE_IDS.has(employeeId)) return false;
  // ON CONFLICT DO NOTHING also protects manual/imported balances under concurrent requests.
  const { data, error } = await db.from("leave_balance_accounts")
    .upsert(initialLeaveAccount(employeeId, hireDate, actorId, department), {
      onConflict: "employee_id", ignoreDuplicates: true,
    }).select("employee_id");
  if (error) throw error;
  return Boolean(data?.length);
}
