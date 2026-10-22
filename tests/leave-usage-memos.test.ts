import test from "node:test";
import assert from "node:assert/strict";
import { usageMemoDetails } from "../lib/leave/usage-memos";
import { calculateBalance, type BalanceAccount } from "../lib/leave/balance";
import { buildLeaveWorkbook } from "../lib/leave/export-workbook";

test("소수 사용량과 합계는 날짜로 해석하거나 실제 날짜 메모를 잘라내지 않음",()=>{
 const text="10.14 오후반차 (0.5)\n10.1 오전 반반차 0.25\n6/18 목 반반차 (0.25)\n1/16 금 조퇴 (-0.5시간)\n(총 1.25일)\n총 1.5일\n(총 2.5일)\n(총 -1.5시간)\n합게: 0.5\n(0.25)";
 const rows=usageMemoDetails({opening_date:"2026-10-15",reason:JSON.stringify({usage_memos:[{month:10,cell:"V7",text}]})});
 assert.equal(rows.length,4);
 assert.ok(rows.every(row=>row.startDate!==null));
 assert.deepEqual(rows.map(row=>row.startDate),["2026-01-16","2026-06-18","2026-10-01","2026-10-14"]);
 assert.ok(rows.some(row=>row.text==="10.14 오후반차 (0.5)"));
 assert.ok(rows.some(row=>row.text==="6/18 목 반반차 (0.25)"));
});

const account: BalanceAccount = {employee_id:"a",opening_date:"2026-10-15",opening_days:7,monthly_enabled:false,work_days:[1,2,3,4,5],exclude_holidays:false,reason:JSON.stringify({monthly_usage:{10:0.25},usage_memos:[
  {month:1,cell:"M7",text:"1. 1/20~21 연차(2025)"},
  {month:6,cell:"R7",text:"2.6/17 연차"},
  {month:9,cell:"U7",text:"여름휴가 3일"},
  {month:10,cell:"V7",text:"1)10/8 오전 반반차\n2)10/21 오전 반반차"},
]})};
test("날짜 미기재 여름휴가 보완은 세 날짜와 기존 월말 연차를 유지하고 재차감하지 않음",()=>{
 const updated={...account,opening_days:6.5,reason:JSON.stringify({type:"excel_opening_import",monthly_usage:Object.fromEntries(Array.from({length:12},(_,i)=>[String(i+1),i===8?4:0])),usage_memos:[{month:9,cell:"T8",text:"9/2 여름휴가 1일\n9/3 여름휴가 1일\n9/4 여름휴가 1일\n9.30 연차 1일"}]})};
 assert.deepEqual(usageMemoDetails(updated).map(m=>m.startDate),["2026-09-02","2026-09-03","2026-09-04","2026-09-30"]);
 const result=calculateBalance(updated,"2023-04-10",[],[],new Set(),"2026-10-22","2026-11");
 assert.equal(result.current,6.5);
 assert.equal(result.monthlyUsage[8].total,4);
});
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
