import test from "node:test";
import assert from "node:assert/strict";
import { canViewAllLeaveBalances } from "../lib/leave/balance-permissions";

test("관리자 및 팀장·대표만 전체 연차를 조회한다", () => {
  assert.equal(canViewAllLeaveBalances({ role: "admin", positionCode: "staff" }), true);
  for (const positionCode of ["team_lead", "representative"]) {
    assert.equal(canViewAllLeaveBalances({ role: "employee", positionCode }), true);
  }
  for (const positionCode of ["staff", "assistant_manager", "manager", "general_manager", "new_employee", ""]) {
    assert.equal(canViewAllLeaveBalances({ role: "employee", positionCode }), false);
  }
});
