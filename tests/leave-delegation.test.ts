import test from "node:test";
import assert from "node:assert/strict";
import { canManageEmployeeLeave, canDeleteLeave, canReviewAsRepresentative } from "../lib/leave/permissions";
import type { CurrentEmployee } from "../lib/auth/session";

const employee = (role:string,positionCode:string) => ({id:"actor",role,positionCode,loginId:"test"} as CurrentEmployee);
test("관리자와 팀장만 다른 직원 휴가 등록·삭제 가능",()=>{
  for(const user of [employee("admin","staff"),employee("employee","team_lead")]){
    assert.equal(canManageEmployeeLeave(user),true);
    assert.equal(canDeleteLeave(user,"other"),true);
    assert.equal(canReviewAsRepresentative(user,"other"),false);
  }
  for(const position of ["staff","assistant_manager","manager","representative"]){
    const user=employee("employee",position);
    assert.equal(canManageEmployeeLeave(user),false);
    assert.equal(canDeleteLeave(user,"other"),false);
    assert.equal(canDeleteLeave(user,"actor"),true);
  }
});
