import { validDate } from "./balance";

export type UsageMemo = { month: number; cell: string; text: string };
export type UsageMemoDetail = { month: number; cell: string; startDate: string | null; endDate: string | null; text: string };

function isDateToken(line: string, match: RegExpMatchArray) {
  // Slash dates are unambiguous. Dotted numbers also represent days/hours,
  // so accept them only with date/leave context, never an amount/unit.
  if (match[0].includes("/")) return true;
  const before = line.slice(0, match.index).trimEnd();
  const after = line.slice((match.index ?? 0) + match[0].length).trimStart();
  if (Number(match[1]) < 1 || Number(match[1]) > 12) return false;
  if (/[(-]$/.test(before) || /(?:총|합계|합게|소계|공제)\s*[:：]?\s*$/.test(before)) return false;
  if (/^(?:일|시간|분|개|\d|[.)])/.test(after)) return false;
  return /^(?:오전|오후|연차|반차|반반차|휴가|여름휴가|병가|지각|조퇴|외출|[월화수목금토일](?:요일)?(?:\s|$))/.test(after);
}

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
      if (/^\(?\s*(?:총|합계|합게|소계)\s*[:：]?\s*[\d.]+\s*(?:일|시간|분)?\s*\)?$/.test(line)) continue;
      // Date ranges support 1/20~21 and 8/13~8/14. Numbers in parentheses
      // such as "연차(2025)" are entitlement-year notes, not the leave date.
      const matches = [...line.matchAll(/(?<!\d)(\d{1,2})[./](\d{1,2})(?!\d)(?:\s*(?:[월화수목금토일](?:요일)?\s*)?[~–-]\s*(?:(\d{1,2})[./])?(\d{1,2})(?!\d))?/g)]
        .filter(match => isDateToken(line, match));
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
