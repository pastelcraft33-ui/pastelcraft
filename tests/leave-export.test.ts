import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { buildLeaveWorkbook } from "../lib/leave/export-workbook";
import { calculateBalance, type BalanceAccount, type BalanceLeave } from "../lib/leave/balance";
import type { LeaveBalanceData } from "../lib/leave/balance-data";

test("다운로드는 네 항목·월별 사용 및 미확정 직원의 실제 휴가 날짜를 보존", async()=>{
 const account:BalanceAccount={employee_id:"a",opening_date:"2026-10-15",opening_days:-2,monthly_enabled:true,work_days:[1,2,3,4,5],exclude_holidays:true,reason:JSON.stringify({type:"hire_date_monthly_import",correction:{source:"사용자"},monthly_usage:{1:null,2:null,3:null,4:1,5:3,6:2,7:1,8:null,9:null,10:1,11:null,12:null}})};
 const pending:BalanceLeave={id:"l",employee_id:"b",start_date:"2026-10-28",end_date:"2026-10-28",leave_type:"afternoon_half",day_type:"afternoon_half",status:"pending"};
 const rows:LeaveBalanceData["rows"]=[
  {id:"a",name:"검증 직원",department:"web_design",departmentLabel:"웹디자인팀",hire_date:"2026-03-16",account,result:calculateBalance(account,"2026-03-16",[],[],new Set(),"2026-10-21","2026-11"),issue:null,leaveDetails:[]},
  {id:"b",name:"입사일 미등록 직원",department:"web_design",departmentLabel:"웹디자인팀",hire_date:null,account:null,result:null,issue:"입사일 등록 필요",leaveDetails:[pending]},
 ];
 const bytes=await buildLeaveWorkbook(rows,"2026-10-21","2026-11",false).xlsx.writeBuffer();
 const book=new ExcelJS.Workbook();await book.xlsx.load(bytes);
 const sheet=book.getWorksheet("연차 사용대장")!;
 assert.deepEqual([5,6,7,8].map(c=>sheet.getCell(3,c).value),["현재 잔여","사용 가능","승인 대기","올해 사용일수"]);
 assert.equal(sheet.getCell("E4").value,-1);
 assert.equal(sheet.getCell("B4").value,"웹팀");
 assert.equal(sheet.getCell("H4").value,8);
 assert.equal(sheet.getCell("M4").value,3);
 assert.equal(sheet.getCell("S4").value,null);
 assert.equal(sheet.getCell("E5").value,null);
 const detail=book.getWorksheet("휴가 상세 내역")!;
 const values:ExcelJS.CellValue[][]=[];detail.eachRow(r=>values.push((r.values as ExcelJS.CellValue[]).slice(1)));
 assert.ok(values.some(r=>r[0]==="입사일 미등록 직원"&&r[3] instanceof Date&&r[3].toISOString().startsWith("2026-10-28")&&r[6]==="승인 대기"));
 assert.ok(values.some(r=>r[3]==="2026년 5월"&&r[5]===3&&String(r[7]).includes("사용자 정정")));
 assert.ok(values.some(r=>String(r[7]).includes("날짜 확인 필요")));
 assert.equal(book.worksheets.length,3);
});
