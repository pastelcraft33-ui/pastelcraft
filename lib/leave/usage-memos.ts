import { validDate } from "./balance";

export type UsageMemo = { month: number; cell: string; text: string };
export type UsageMemoDetail = { month: number; cell: string; startDate: string | null; endDate: string | null; text: string };

/** Evidence only: never feeds accrual or usage arithmetic. */
export function usageMemoDetails(account?: { reason?: string; opening_date: string } | null): UsageMemoDetail[] {
  if (!account) return [];
  let source: { usage_memos?: UsageMemo[] };
  try { source = JSON.parse(account.reason ?? "{}"); } catch { return []; }
  if (!Array.isArray(source.usage_memos)) return [];
  const year = account.opening_date.slice(0, 4);
  const result: UsageMemoDetail[] = [];
  for (const memo of source.usage_memos) {
    if (!Number.isInteger(memo.month) || memo.month < 1 || memo.month > 12 || typeof memo.text !== "string") continue;
    for (const raw of memo.text.split(/\r?\n/)) {
      const line = raw.trim().replace(/^\d+[.)]\s*(?=\d{1,2}[./]\d{1,2})/, "");
      // Date ranges support 1/20~21 and 8/13~8/14. Numbers in parentheses
      // such as "연차(2025)" are entitlement-year notes, not the leave date.
      const matches = [...line.matchAll(/(?<!\d)(\d{1,2})[./](\d{1,2})(?!\d)(?:\s*(?:[월화수목금토일](?:요일)?\s*)?[~–-]\s*(?:(\d{1,2})[./])?(\d{1,2})(?!\d))?/g)];
      if (!matches.length) {
        if (/(연차|반차|반반차|휴가|병가)/.test(line)) result.push({ month: memo.month, cell: memo.cell, startDate: null, endDate: null, text: line });
        continue;
      }
      for (const [i, match] of matches.entries()) {
        const date = (m: string, d: string) => `${year}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`;
        const startDate = date(match[1],match[2]);
        const endDate = match[4] ? date(match[3] ?? match[1],match[4]) : startDate;
        if (!validDate(startDate) || !validDate(endDate) || endDate < startDate) {
          result.push({ month:memo.month,cell:memo.cell,startDate:null,endDate:null,text:line });
          continue;
        }
        if (startDate > account.opening_date) continue;
        const text = line.slice(i === 0 ? 0 : match.index, matches[i+1]?.index).replace(/[,\s]+$/, "");
        result.push({ month:memo.month,cell:memo.cell,startDate,endDate:endDate > account.opening_date ? account.opening_date : endDate,text });
      }
    }
  }
  return result.sort((a,b) => (a.startDate ?? `${year}-${String(a.month).padStart(2,"0")}-99`).localeCompare(b.startDate ?? `${year}-${String(b.month).padStart(2,"0")}-99`));
}
