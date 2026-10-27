// Date-only calculations deliberately use UTC; the reporting day is supplied in Korea time.
export type BalanceAccount = {
  employee_id: string;
  opening_date: string;
  opening_days: number;
  monthly_enabled: boolean;
  work_days: number[];
  exclude_holidays: boolean;
  reason?: string;
};
export function hasAutomaticAnnualGrant(account: BalanceAccount) {
  try { return JSON.parse(account.reason ?? "{}").type === "no_ledger_zero_usage"; } catch { return false; }
}
export function hireDateOpeningDays(hireDate: string, cutoff: string) {
  if (hireDate > cutoff) return 0;
  let years = Number(cutoff.slice(0, 4)) - Number(hireDate.slice(0, 4));
  if (addMonths(hireDate, years * 12) > cutoff) years--;
  if (years >= 1) return Math.min(25, 15 + Math.floor((years - 1) / 2));
  return Array.from({ length: 11 }, (_, i) => addMonths(hireDate, i + 1)).filter(d => d <= cutoff).length;
}
export function tenureGroup(hireDate: string | null, today: string) {
  return !hireDate ? "미확인" : addMonths(hireDate, 12) <= today ? "1년 이상" : "1년 미만";
}

export function monthlyLeaveUsage(account: BalanceAccount, movements: BalanceMovement[], today: string, department = "") {
  let source: {type?: string; monthly_usage?: Record<string, number | null>; correction?: unknown} = {};
  try { source = JSON.parse(account.reason ?? "{}"); } catch { /* Unknown history stays unconfirmed. */ }
  const year = today.slice(0, 4);
  return Array.from({length: 12}, (_, i) => {
    const month = i + 1;
    const prefix = `${year}-${String(month).padStart(2, "0")}`;
    const period = department === "namdaemun" ? reportingPeriod(prefix, department) : {
      start: `${prefix}-01`, end: addDays(addMonths(`${prefix}-01`, 1), -1),
    };
    // A November ledger is already in progress on October 26, not a future month.
    const future = period.start > today;
    const includesOpening = period.start <= account.opening_date;
    let imported: number | null = 0;
    if (includesOpening) {
      if (today < account.opening_date || year !== account.opening_date.slice(0, 4)) imported = null;
      else if (source.type === "no_ledger_zero_usage") imported = 0;
      else if (["excel_opening_import", "hire_date_monthly_import"].includes(source.type ?? "") && source.monthly_usage && Object.hasOwn(source.monthly_usage, String(month))) {
        const value = source.monthly_usage[String(month)];
        imported = value === null ? 0 : typeof value === "number" && Number.isFinite(value) ? value : null;
      } else imported = null;
    }
    const subsequent = movements.filter(m => m.kind === "use" && m.date > account.opening_date && m.date >= period.start && m.date <= period.end && m.date <= today).reduce((sum, m) => sum - m.days, 0);
    return {month, future, imported, subsequent, total: future || imported === null ? null : imported + subsequent, corrected: !!source.correction};
  });
}
export type BalanceEntry = {
  id: string;
  employee_id: string;
  effective_date: string;
  days: number;
  kind: "grant" | "adjustment";
  reason: string;
  expires_on: string | null;
};
export type BalanceLeave = {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  leave_type: string;
  day_type: string;
  status: string;
};
export type BalanceMovement = {
  date: string;
  days: number;
  label: string;
  source: string;
  kind: "use" | "grant" | "adjustment";
};
export const LEAVE_IMPORT_DATE = "2026-10-15";
export function leaveImportDate(department = "") {
  return department === "namdaemun" ? "2026-10-25" : LEAVE_IMPORT_DATE;
}
export const annualTypes = new Set([
  "annual",
  "morning_half",
  "afternoon_half",
  "morning_quarter",
  "afternoon_quarter",
]);
export function koreanToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function validDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export function addDays(value: string, amount: number) {
  const d = new Date(`${value}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + amount);
  return d.toISOString().slice(0, 10);
}
export function addMonths(value: string, amount: number) {
  const [y, m, d] = value.split("-").map(Number);
  const last = new Date(Date.UTC(y, m + amount, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + amount, Math.min(d, last)))
    .toISOString()
    .slice(0, 10);
}
export function reportingPeriod(month: string, department = "") {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
    throw new Error("집계 월을 확인해 주세요.");
  const day = department === "namdaemun" ? 25 : 15;
  return { start: addMonths(`${month}-${day + 1}`, -1), end: `${month}-${day}` };
}
export function currentReportingMonth(today: string, department = "") {
  return (Number(today.slice(8)) > (department === "namdaemun" ? 25 : 15) ? addMonths(today, 1) : today).slice(
    0,
    7,
  );
}
export function leaveUnits(dayType: string) {
  return dayType.includes("quarter")
    ? 0.25
    : dayType.includes("half")
      ? 0.5
      : 1;
}
export function leaveDays(
  leave: BalanceLeave,
  account: BalanceAccount,
  holidays: Set<string>,
) {
  if (
    !annualTypes.has(leave.leave_type) ||
    !validDate(leave.start_date) ||
    !validDate(leave.end_date)
  )
    return [];
  // Reject unreasonable legacy ranges rather than iterating unbounded dates.
  if (Date.parse(leave.end_date) - Date.parse(leave.start_date) > 366 * 86_400_000) return [];
  const result: BalanceMovement[] = [];
  for (
    let date = leave.start_date;
    date <= leave.end_date;
    date = addDays(date, 1)
  ) {
    if (date <= account.opening_date) continue;
    if (!account.work_days.includes(new Date(`${date}T00:00:00Z`).getUTCDay()))
      continue;
    if (account.exclude_holidays && holidays.has(date)) continue;
    result.push({
      date,
      days: -leaveUnits(leave.day_type),
      label: "연차 사용",
      source: leave.id,
      kind: "use",
    });
  }
  return result;
}
export function balanceMovements(
  account: BalanceAccount,
  hireDate: string | null,
  entries: BalanceEntry[],
  leaves: BalanceLeave[],
  holidays: Set<string>,
  asOf = koreanToday(),
) {
  const movements: BalanceMovement[] = [];
  if (hireDate && account.monthly_enabled) {
    for (let n = 1; n <= 11; n++) {
      const date = addMonths(hireDate, n);
      if (date > account.opening_date)
        movements.push({
          date,
          days: 1,
          label: "월별 1일 부여",
          source: `monthly:${n}`,
          kind: "grant",
        });
    }
  }
  if (hireDate && hasAutomaticAnnualGrant(account)) {
    const maxYears = Math.max(1, Number(asOf.slice(0, 4)) - Number(hireDate.slice(0, 4)) + 1);
    for (let years = 1; years <= maxYears; years++) {
      const date = addMonths(hireDate, years * 12);
      if (date > account.opening_date) movements.push({ date, days: Math.min(25, 15 + Math.floor((years - 1) / 2)), label: "입사일 기준 연간 자동 부여", source: `annual:${years}`, kind: "grant" });
    }
  }
  for (const entry of entries.filter(
    (e) => e.employee_id === account.employee_id,
  )) {
    movements.push({
      date: entry.effective_date,
      days: Number(entry.days),
      label: entry.reason,
      source: entry.id,
      kind: entry.kind,
    });
  }
  for (const leave of leaves.filter(
    (l) => l.employee_id === account.employee_id && l.status === "approved",
  )) {
    movements.push(...leaveDays(leave, account, holidays));
  }
  return movements.sort(
    (a, b) => a.date.localeCompare(b.date) || a.source.localeCompare(b.source),
  );
}
export function calculateBalance(
  account: BalanceAccount,
  hireDate: string | null,
  entries: BalanceEntry[],
  leaves: BalanceLeave[],
  holidays: Set<string>,
  today: string,
  month: string,
  department = "",
) {
  const movements = balanceMovements(
    account,
    hireDate,
    entries,
    leaves,
    holidays,
    today,
  );
  const sum = (items: BalanceMovement[]) =>
    items.reduce((total, m) => total + m.days, 0);
  const at = (date: string) =>
    Number(account.opening_days) + sum(movements.filter((m) => m.date <= date));
  const reserved = Math.abs(
    sum(movements.filter((m) => m.kind === "use" && m.date > today)),
  );
  const pending = leaves
    .filter(
      (l) => l.employee_id === account.employee_id && l.status === "pending",
    )
    .flatMap((l) => leaveDays(l, account, holidays))
    .reduce((total, m) => total - m.days, 0);
  const period = reportingPeriod(month, department);
  const periodMovements = movements.filter(
    (m) => m.date >= period.start && m.date <= period.end && m.date <= today,
  );
  const covered = account.opening_date < period.start;
  const next = movements.find(
    (m) => (m.source.startsWith("monthly:") || m.source.startsWith("annual:")) && m.date > today,
  );
  const monthlyUsage = monthlyLeaveUsage(account, movements, today, department);
  // Annual actual usage remains Jan 1–Dec 31, regardless of ledger cutoff.
  const elapsedMonths = (department === "namdaemun"
    ? monthlyLeaveUsage(account, movements, today)
    : monthlyUsage).filter(m => !m.future);
  return {
    current: at(today),
    reserved,
    available: at(today) - reserved,
    pending,
    yearUsed: elapsedMonths.some(m => m.total === null) ? null : elapsedMonths.reduce((sum, m) => sum + (m.total ?? 0), 0),
    monthlyUsage,
    notYetAccrued: !!hireDate && today < addMonths(hireDate, 1) && at(today) === 0,
    nextAccrual: next?.date ?? null,
    nextAccrualDays: next?.days ?? null,
    period: {
      ...period,
      covered,
      opening: covered ? at(addDays(period.start, -1)) : null,
      added: sum(periodMovements.filter((m) => m.kind === "grant")),
      used: Math.abs(sum(periodMovements.filter((m) => m.kind === "use"))),
      adjusted: sum(periodMovements.filter((m) => m.kind === "adjustment")),
      closing: covered ? at(period.end < today ? period.end : today) : null,
      movements: periodMovements,
    },
    movements: movements.filter((m) => m.date <= today).reverse(),
  };
}
export type CalculatedBalance = ReturnType<typeof calculateBalance>;
