import test from "node:test";
import assert from "node:assert/strict";
import { calculateBalance, tenureGroup, type BalanceAccount, type BalanceLeave } from "../lib/leave/balance";
const account: BalanceAccount = {employee_id:"a",opening_date:"2026-10-15",opening_days:5.25,monthly_enabled:true,work_days:[1,2,3,4,5],exclude_holidays:true,reason:JSON.stringify({type:"excel_opening_import",monthly_usage:{1:1.5,2:null,3:3,4:1,5:null,6:2.25,7:null,8:2,9:null,10:null}})};
const leave = (start_date:string,status="approved"): BalanceLeave => ({id:start_date,employee_id:"a",start_date,end_date:start_date,status,leave_type:"annual",day_type:"full_day"});
test("남대문 10월 27일 사용은 11월 대장, 이관·대기·미래 사용은 중복 합산하지 않음",()=>{
 const a={...account,opening_date:"2026-10-25",monthly_enabled:false};
 const result=calculateBalance(a,"2022-05-01",[],[leave("2026-10-23"),leave("2026-10-27"),leave("2026-10-26","pending"),leave("2026-10-28")],new Set(),"2026-10-27","2026-11","namdaemun");
 assert.equal(result.monthlyUsage[9].subsequent,0);
 assert.equal(result.monthlyUsage[10].total,1);
 assert.equal(result.monthlyUsage[10].future,false);
 assert.equal(result.monthlyUsage[11].total,null);
 assert.equal(result.current,4.25);
 assert.equal(result.yearUsed,10.75);
 const other=calculateBalance(a,"2022-05-01",[],[leave("2026-10-27")],new Set(),"2026-10-27","2026-11","logistics");
 assert.equal(other.monthlyUsage[9].subsequent,1);
 assert.equal(other.monthlyUsage[10].total,null);
});
test("남대문 25일/26일 경계와 새해 대장, 올해 사용은 실제 연도 유지",()=>{
 const a={...account,opening_date:"2026-10-25",monthly_enabled:false,work_days:[0,1,2,3,4,5,6]};
 const leaves=[leave("2026-11-25"),leave("2026-11-26"),leave("2026-12-26")];
 const result=calculateBalance(a,"2022-05-01",[],leaves,new Set(),"2026-12-27","2026-12","namdaemun");
 assert.equal(result.monthlyUsage[10].subsequent,1);
 assert.equal(result.monthlyUsage[11].subsequent,1);
 assert.equal(result.yearUsed,12.75);
 const next=calculateBalance(a,"2022-05-01",[],leaves,new Set(),"2027-01-01","2027-01","namdaemun");
 assert.equal(next.monthlyUsage[0].total,1);
 assert.equal(next.yearUsed,0);
});
test("올해 사용량은 이관 사용량과 지난 승인 휴가만 합산",()=>{
 const result=calculateBalance(account,"2025-02-17",[],[leave("2026-10-14"),leave("2026-10-20"),leave("2026-10-28"),leave("2026-10-21","pending"),leave("2026-10-19","cancelled")],new Set(),"2026-10-21","2026-11");
 assert.equal(result.yearUsed,10.75);
 assert.equal(result.current,4.25);
 assert.equal(result.available,3.25);
 assert.equal(result.pending,1);
 assert.equal(result.monthlyUsage[0].total,1.5);
 assert.equal(result.monthlyUsage[9].subsequent,1);
 assert.equal(result.monthlyUsage[10].total,null);
});
test("직접 정정한 월별 사용량이 우선이며 연간 합계와 일치",()=>{
 const reason=JSON.stringify({type:"hire_date_monthly_import",correction:{source:"사용자"},monthly_usage:{1:null,2:null,3:null,4:1,5:3,6:2,7:1,8:null,9:null,10:1,11:null,12:null}});
 const result=calculateBalance({...account,opening_days:-2,reason},"2026-03-16",[],[],new Set(),"2026-10-21","2026-11");
 assert.equal(result.yearUsed,8);
 assert.equal(result.monthlyUsage[4].total,3);
 assert.equal(result.monthlyUsage[9].total,1);
 assert.equal(result.monthlyUsage[4].corrected,true);
});
test("새해에는 이전 연도 사용량 초기화, 수동 잔액의 과거 사용량은 미확정",()=>{
 assert.equal(calculateBalance(account,"2025-02-17",[],[],new Set(),"2027-01-01","2027-01").yearUsed,0);
 assert.equal(calculateBalance({...account,reason:"수동 잔액"},"2025-02-17",[],[],new Set(),"2026-10-21","2026-11").yearUsed,null);
});
test("입사 1주년 당일부터 자동으로 1년 이상 분류",()=>{
 assert.equal(tenureGroup("2025-10-22","2026-10-21"),"1년 미만");
 assert.equal(tenureGroup("2025-10-22","2026-10-22"),"1년 이상");
 assert.equal(tenureGroup(null,"2026-10-22"),"미확인");
});
