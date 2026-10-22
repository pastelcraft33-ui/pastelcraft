import test from "node:test";
import assert from "node:assert/strict";
import { usageMemoDetails } from "../lib/leave/usage-memos";
import { calculateBalance, type BalanceAccount } from "../lib/leave/balance";
import { buildLeaveWorkbook } from "../lib/leave/export-workbook";

const account: BalanceAccount = {employee_id:"a",opening_date:"2026-10-15",opening_days:7,monthly_enabled:false,work_days:[1,2,3,4,5],exclude_holidays:false,reason:JSON.stringify({monthly_usage:{10:0.25},usage_memos:[
  {month:1,cell:"M7",text:"1. 1/20~21 연차(2025)"},
  {month:6,cell:"R7",text:"2.6/17 연차"},
  {month:9,cell:"U7",text:"여름휴가 3일"},
  {month:10,cell:"V7",text:"1)10/8 오전 반반차\n2)10/21 오전 반반차"},
]})};
test("메모 날짜·축약 범위·붙은 번호를 읽고 기준일 이후 날짜는 제외",()=>{
 const rows=usageMemoDetails(account);
 assert.ok(rows.some(r=>r.startDate==="2026-01-20"&&r.endDate==="2026-01-21"));
 assert.ok(rows.some(r=>r.startDate==="2026-06-17"));
 assert.ok(rows.some(r=>r.startDate===null&&r.text==="여름휴가 3일"));
 assert.ok(rows.some(r=>r.startDate==="2026-10-08"));
 assert.ok(!rows.some(r=>r.startDate==="2026-10-21"));
 assert.deepEqual(usageMemoDetails({opening_date:"2026-10-15",reason:"invalid"}),[]);
});
test("메모는 잔액에 영향 없이 엑셀 날짜 셀로 표시하고 일수는 중복 합산하지 않음",async()=>{
 const result=calculateBalance(account,"2020-01-01",[],[],new Set(),"2026-10-22","2026-11");
 assert.equal(result.current,7);
 const book=buildLeaveWorkbook([{id:"a",name:"검증 직원",department:"logistics",departmentLabel:"물류팀",hire_date:"2020-01-01",account,result,leaveDetails:[],issue:null}],"2026-10-22","2026-11",false);
 const sheet=book.getWorksheet("휴가 상세 내역")!;
 let found=false;
 sheet.eachRow(row=>{if(row.getCell(3).value==="엑셀 사용일 메모"){
  assert.equal(row.getCell(6).value,null);
  const date=row.getCell(4).value;
  if(date instanceof Date&&date.toISOString().startsWith("2026-10-08"))found=true;
 }});
 assert.equal(found,true);
});
