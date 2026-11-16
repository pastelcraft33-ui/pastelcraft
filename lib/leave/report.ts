import type { LeaveBalanceData } from "./balance-data";
import { leaveDays, monthlyLeaveUsage, reportingPeriod } from "./balance";
import { leaveDayTypeLabel } from "./constants";
import { usageMemoDetails } from "./usage-memos";

export type ReportRow = LeaveBalanceData["rows"][number];
export type ReportMode = "month" | "year";
const days = (n: number | null) => n === null ? "확인 필요" : n + "일";

export function employeeReport(row: ReportRow, month: string, today: string, mode: ReportMode, holidays: Set<string>) {
  const period = reportingPeriod(month, row.department);
  const start = mode === "month" ? period.start : month.slice(0,4) + "-01-01";
  const limit = mode === "month" ? period.end : month.slice(0,4) + "-12-31";
  const end = limit < today ? limit : today;
  const account = row.account;
  const valid = !!(account && row.result && account.opening_date <= end && start <= end);
  const movements = (row.result?.movements ?? []).filter(m => m.date <= end);
  const within = movements.filter(m => m.date >= start);
  const sum = (kind: string) => within.filter(m => m.kind === kind).reduce((s,m) => s+m.days,0);
  const balance = valid ? Number(account!.opening_days) + movements.reduce((s,m)=>s+m.days,0) : null;
  const imported = !account || account.opening_date < start ? 0 : !valid ? null :
    monthlyLeaveUsage(account, [], end, row.department)
      .filter(m => mode === "month" ? m.month === Number(month.slice(5)) : !m.future)
      .reduce<number|null>((s,m)=>s === null || m.imported === null ? null : s+m.imported,0);
  const pending = (row.leaveDetails ?? []).filter(l=>l.status === "pending" && account)
    .flatMap(l=>leaveDays(l,account!,holidays)).filter(m=>m.date>=start && m.date<=limit)
    .reduce((s,m)=>s-m.days,0);
  const details: string[] = [];
  for (const m of usageMemoDetails(account)) {
    if (m.startDate && m.endDate && m.startDate<=end && m.endDate>=start)
      details.push(m.startDate + (m.startDate===m.endDate ? "" : " ~ "+m.endDate) + "  ·  대장 메모: "+m.text);
    else if (!m.startDate && account?.opening_date.startsWith(month.slice(0,4)) && (mode==="year" || m.month===Number(month.slice(5))))
      details.push(m.month+"월 · 실제 날짜 확인 필요: "+m.text);
  }
  for (const m of within.filter(m=>m.kind==="use").reverse()) {
    const leave = row.leaveDetails?.find(l=>l.id===m.source);
    details.push(m.date+"  ·  "+(leave ? leaveDayTypeLabel(leave.day_type) : "승인 연차")+"  ·  "+days(-m.days));
  }
  if (imported) details.push("이관 대장 사용 합계 "+days(imported)+" (메모는 참고 내역이며 중복 차감하지 않습니다.)");
  if (!details.length) details.push(valid ? "확인된 사용 기록 없음" : "사용 내역 확인 필요");
  const used = valid && imported!==null ? imported-sum("use") : null;
  return {start,end,details, cells:[row.name, days(balance!==null && used!==null ? balance+used : null), days(valid ? sum("grant") : null), days(valid && account!.opening_date>=start ? Number(account!.opening_days) : valid ? Number(account!.opening_days)+movements.filter(m=>m.date<start).reduce((s,m)=>s+m.days,0) : null), days(valid ? sum("adjustment") : null),days(used),days(balance),days(valid && row.leaveDetails && start.slice(0,4)===today.slice(0,4) ? pending : null)]};
}
