import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { previewLeaveWorkbook } from "../lib/leave/import-preview";
import { calculateBalance, type BalanceAccount } from "../lib/leave/balance";

function preview(note: string, days: number) {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("2026");
  for (let m = 1; m <= 12; m++) sheet.getCell(5, 12 + m).value = `${m}월`;
  sheet.getCell("A7").value = 1;
  sheet.getCell("B7").value = "테스트 직원";
  sheet.getCell("C7").value = new Date("2020-01-01T00:00:00Z");
  sheet.getCell("J7").value = 15;
  sheet.getCell("V7").value = days;
  sheet.getCell("V7").note = note;
  return previewLeaveWorkbook(book)[0];
}
test("이관 미리보기는 기준일 이후 메모 및 날짜 불명 사용량의 잔액 자동 제안을 차단", () => {
  assert.equal(preview("10/23 연차", 1).openingDays, null);
  assert.equal(preview("10/8 오전 반반차\n10/21 오전 반반차", 0.5).openingDays, null);
  assert.equal(preview("", 1).openingDays, null);
  assert.equal(preview("10.15 오후 반차", 0.5).openingDays, 14.5);
  assert.equal(preview("10/22 오전 반차", 0).openingDays, 15);
});
test("정정된 이관분 이후 승인 건은 한 번 차감하고 대기는 별도 집계", () => {
  const account: BalanceAccount = {employee_id:"a",opening_date:"2026-10-15",opening_days:17,monthly_enabled:false,work_days:[1,2,3,4,5],exclude_holidays:false};
  const leave = {id:"l",employee_id:"a",start_date:"2026-10-23",end_date:"2026-10-23",leave_type:"annual",day_type:"full_day",status:"approved"};
  const before = calculateBalance(account,"2013-02-12",[],[leave],new Set(),"2026-10-22","2026-11");
  assert.equal(before.current,17);
  assert.equal(before.available,16);
  assert.equal(calculateBalance(account,"2013-02-12",[],[leave],new Set(),"2026-10-23","2026-11").current,16);
  const pending = calculateBalance({...account,opening_days:3},"2026-07-13",[],[{...leave,status:"pending"}],new Set(),"2026-10-22","2026-11");
  assert.equal(pending.current,3);
  assert.equal(pending.pending,1);
});
