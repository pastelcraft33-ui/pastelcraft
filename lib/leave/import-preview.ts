import ExcelJS from "exceljs";
import { addMonths, hireDateOpeningDays, LEAVE_IMPORT_DATE } from "./balance";

export type LeaveImportDraft = {
  name: string;
  hireDate: string | null;
  openingDays: number | null;
  used: number;
  accrued: number | null;
  carry: number;
  warnings: string[];
};
function numeric(cell: ExcelJS.Cell): number | null {
  const value = cell.value;
  if (value == null || value === "" || value === " ") return 0;
  if (typeof value === "number") return value;
  if (
    typeof value === "object" &&
    "result" in value &&
    typeof value.result === "number"
  )
    return value.result;
  return null;
}
function cellDate(cell: ExcelJS.Cell): string | null {
  return cell.value instanceof Date
    ? cell.value.toISOString().slice(0, 10)
    : null;
}
// These supplied ledgers contain monthly totals, not individual leave dates.
// The output is a review draft only; never writes employee balances automatically.
export function previewLeaveWorkbook(
  workbook: ExcelJS.Workbook,
): LeaveImportDraft[] {
  const sheet = workbook.getWorksheet("2026");
  if (!sheet)
    throw new Error("2026 시트가 있는 기존 연차 사용대장을 선택해 주세요.");
  const columns: number[] = [];
  for (let c = 1; c <= Math.min(sheet.columnCount, 100); c++) {
    if (/^([1-9]|10)월$/.test(sheet.getCell(5, c).text.trim())) columns.push(c);
  }
  if (columns.length !== 10)
    throw new Error("1월~10월 사용량 열을 찾지 못했습니다.");
  const replacementColumn = columns[9] + 4; // Two remaining months, subtotal, then substitute usage.
  const drafts: LeaveImportDraft[] = [];
  for (let r = 6; r <= Math.min(sheet.rowCount, 500); r++) {
    if (sheet.getCell(r, 1).text.trim().startsWith("※")) break;
    const name = sheet.getCell(r, 2).text.trim();
    if (!name || !/^\d+$/.test(sheet.getCell(r, 1).text.trim())) continue;
    const hireDate = cellDate(sheet.getCell(r, 3));
    const warnings: string[] = [
      "월별 합계를 사용합니다. 10월분이 10월 15일까지 확정된 내역인지 확인해 주세요.",
    ];
    const usage = columns.map((c) => numeric(sheet.getCell(r, c)));
    const used = usage.reduce<number>((sum, n) => sum + (n ?? 0), 0);
    const carry = numeric(sheet.getCell(r, 11));
    const substitute = numeric(sheet.getCell(r, replacementColumn));
    let accrued = numeric(sheet.getCell(r, 10));
    if (!hireDate) {
      accrued = null;
      warnings.push("입사일이 없어 자동 계산할 수 없습니다.");
    } else if (addMonths(hireDate, 12) > LEAVE_IMPORT_DATE) {
      accrued = hireDateOpeningDays(hireDate, LEAVE_IMPORT_DATE);
      warnings.push("회사 정책: 입사 후 한 달을 채울 때마다 1일씩 계산했습니다. 엑셀의 미사용일수·미래 발생분·개인별 미발생 기록은 부여 기준으로 사용하지 않습니다. 직원 관리 입사일과 대조해 주세요.");
    } else if (
      !sheet.getCell(r + 1, 2).text.trim() &&
      (cellDate(sheet.getCell(r + 1, 3)) === hireDate ||
        sheet.getCell(r + 1, 6).text.includes("최대11일"))
    ) {
      const extra = numeric(sheet.getCell(r + 1, 10));
      accrued = accrued == null || extra == null ? null : accrued + extra;
      warnings.push("다음 행의 첫해 월별 부여분을 합산했습니다.");
    }
    if (usage.some((n) => n == null) || carry == null || substitute == null) {
      warnings.push(
        "계산 결과가 없는 셀이 있습니다. 원본을 확인해 잔액을 직접 입력하세요.",
      );
      accrued = null;
    }
    if (sheet.getCell(r, 4).text.trim())
      warnings.push("퇴사일이 기록된 직원입니다. 재직 여부를 확인하세요.");
    drafts.push({
      name,
      hireDate,
      accrued,
      carry: carry ?? 0,
      used,
      openingDays:
        accrued == null
          ? null
          : accrued + (carry ?? 0) - used - (substitute ?? 0),
      warnings,
    });
  }
  return drafts;
}

// Bound decompression before handing user-uploaded XLSX ZIPs to the parser.
export function validateLedgerArchive(bytes: ArrayBuffer) {
  const data = Buffer.from(bytes);
  let end = -1;
  for (let p = data.length - 22; p >= Math.max(0, data.length - 65557); p--) {
    if (data.readUInt32LE(p) === 0x06054b50) {
      end = p;
      break;
    }
  }
  if (end < 0) throw new Error("올바른 XLSX 파일이 아닙니다.");
  const count = data.readUInt16LE(end + 10);
  let cursor = data.readUInt32LE(end + 16);
  let total = 0;
  if (count > 2000 || count === 0 || cursor >= data.length)
    throw new Error("파일 구조를 확인해 주세요.");
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > data.length || data.readUInt32LE(cursor) !== 0x02014b50)
      throw new Error("잘못된 압축 파일입니다.");
    total += data.readUInt32LE(cursor + 24);
    if (total > 30 * 1024 * 1024)
      throw new Error("압축 해제 크기가 너무 큽니다.");
    cursor +=
      46 +
      data.readUInt16LE(cursor + 28) +
      data.readUInt16LE(cursor + 30) +
      data.readUInt16LE(cursor + 32);
  }
}
