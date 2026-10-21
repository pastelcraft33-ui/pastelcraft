import test from "node:test";
import assert from "node:assert/strict";
import { calculateBalance, hireDateOpeningDays, type BalanceAccount } from "../lib/leave/balance";
test("대장 없는 직원은 미래 부여 제외, 근속 가산 및 상한 적용", () => {
  assert.equal(hireDateOpeningDays("2026-10-06", "2026-10-15"), 0);
  assert.equal(hireDateOpeningDays("2025-11-04", "2026-10-15"), 11);
  assert.equal(hireDateOpeningDays("2023-05-02", "2026-10-15"), 16);
  assert.equal(hireDateOpeningDays("1990-01-01", "2026-10-15"), 25);
});
test("자동 부여는 기준일 이후 입사 기념일에 한번 발생", () => {
 const account: BalanceAccount = { employee_id:"a",opening_date:"2026-10-15",opening_days:11,monthly_enabled:true,work_days:[1,2,3,4,5],exclude_holidays:true,reason:JSON.stringify({type:"no_ledger_zero_usage"}) };
 const calc=(day:string)=>calculateBalance(account,"2025-11-04",[],[],new Set(),day,"2026-11");
 assert.equal(calc("2026-11-03").current,11);
 assert.equal(calc("2026-11-04").current,26);
 assert.equal(calc("2026-11-05").current,26);
 assert.equal(calc("2026-11-03").nextAccrual,"2026-11-04");
 assert.equal(calculateBalance({...account,opening_days:0},"2026-10-06",[],[],new Set(),"2026-10-21","2026-11").notYetAccrued,true);
});
