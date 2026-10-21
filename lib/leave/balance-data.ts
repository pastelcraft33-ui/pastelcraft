import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getKoreanPublicHolidays } from "@/lib/holidays/korean-public-holidays";
import { departmentLabel } from "@/lib/employees/constants";
import {
  calculateBalance,
  koreanToday,
  type BalanceAccount,
  type BalanceEntry,
  type BalanceLeave,
} from "./balance";

export async function loadLeaveBalances(month: string, employeeId?: string) {
  const db = createAdminClient();
  const today = koreanToday();
  // Range paging prevents silently dropping leave records at Supabase's default 1,000-row limit.
  async function readRows<T>(
    table: string,
    select: string,
    scoped: boolean,
  ): Promise<{ rows: T[]; missing: boolean }> {
    const rows: T[] = [];
    for (let offset = 0; ; offset += 500) {
      let query = db
        .from(table)
        .select(select)
        .order(
          table === "employees"
            ? "id"
            : table === "leave_balance_accounts"
              ? "employee_id"
              : "id",
        )
        .range(offset, offset + 499);
      if (scoped && employeeId)
        query = query.eq(
          table === "employees" ? "id" : "employee_id",
          employeeId,
        );
      if (table === "employees") query = query.eq("account_status", "active");
      const { data, error } = await query;
      if (error) {
        if (
          ["42P01", "PGRST205"].includes(error.code) &&
          table.startsWith("leave_balance_")
        )
          return { rows: [], missing: true };
        throw new Error(
          "연차 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
        );
      }
      rows.push(...(data as unknown as T[]));
      if ((data?.length ?? 0) < 500) return { rows, missing: false };
    }
  }
  const [
    employees,
    accounts,
    entries,
    leaves,
    companyHolidays,
  ] = await Promise.all([
    readRows<{
      id: string;
      name: string;
      department: string;
      hire_date: string | null;
    }>("employees", "id,name,department,hire_date", true),
    readRows<BalanceAccount>("leave_balance_accounts", "*", true),
    readRows<BalanceEntry>("leave_balance_entries", "*", true),
    readRows<BalanceLeave>(
      "leave_requests",
      "id,employee_id,start_date,end_date,leave_type,day_type,status",
      true,
    ),
    readRows<{ holiday_date: string }>(
      "company_holidays",
      "id,holiday_date",
      false,
    ),
  ]);
  const currentYear = Number(today.slice(0, 4));
  const firstYear = Math.min(currentYear, ...accounts.rows.map((a) => Number(a.opening_date.slice(0, 4))));
  // Include historical years from the opening balance, not only the current calendar window.
  const years = Array.from({ length: currentYear + 3 - firstYear }, (_, i) => firstYear + i);
  const publicHolidays = accounts.rows.some((a) => a.exclude_holidays)
    ? await getKoreanPublicHolidays(years).then((rows) => ({ rows, ok: true })).catch(() => ({ rows: [], ok: false }))
    : { rows: [], ok: true };
  const holidays = new Set([
    ...companyHolidays.rows.map((h) => h.holiday_date),
    ...publicHolidays.rows.map((h) => h.date),
  ]);
  const ready = !accounts.missing && !entries.missing;
  const rows = employees.rows.map((employee) => {
    const account =
      accounts.rows.find((a) => a.employee_id === employee.id) ?? null;
    const holidayReady = !account?.exclude_holidays || publicHolidays.ok;
    const invalidLeaveRange = leaves.rows.some((l) => l.employee_id === employee.id && ["approved", "pending"].includes(l.status) && (Number(l.end_date.slice(0, 4)) > currentYear + 2 || Date.parse(l.end_date) - Date.parse(l.start_date) > 366 * 86_400_000));
    const result =
      account && employee.hire_date && holidayReady && !invalidLeaveRange
        ? calculateBalance(
            account,
            employee.hire_date,
            entries.rows,
            leaves.rows,
            holidays,
            today,
            month,
          )
        : null;
    return {
      ...employee,
      departmentLabel: departmentLabel(employee.department),
      account,
      result,
      leaveDetails: leaves.rows.filter(l => l.employee_id === employee.id && ["approved", "pending"].includes(l.status) && l.start_date <= `${today.slice(0, 4)}-12-31` && l.end_date >= `${today.slice(0, 4)}-01-01`),
      issue: invalidLeaveRange ? "휴가 기간 확인 필요 (1년 초과 또는 먼 미래 일정)" : !employee.hire_date
        ? "입사일 등록 필요"
        : !account
          ? "초기 잔액 확인 필요"
          : !holidayReady
            ? "공휴일 조회 실패 · 계산 보류"
            : null,
    };
  });
  return {
    ready,
    today,
    month,
    rows,
    holidayReady: publicHolidays.ok,
    holidays: [...holidays],
  };
}
export type LeaveBalanceData = Awaited<ReturnType<typeof loadLeaveBalances>>;
