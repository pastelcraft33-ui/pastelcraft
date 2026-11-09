import test from "node:test";
import assert from "node:assert/strict";
import { matchesLeaveApprovalSearch } from "../lib/leave/approval-search";
import { leaveDayTypeOptions } from "../lib/leave/constants";

test("휴가 승인 검색은 전일·반차·반반차의 실제 단위를 검색", () => {
  for (const option of leaveDayTypeOptions) {
    const request = { applicant: { name: "홍길동", department: "웹디자인팀" }, dayType: option.value, leaveTypeLabel: "연차" };
    assert.equal(matchesLeaveApprovalSearch(request, option.label), true);
    assert.equal(matchesLeaveApprovalSearch(request, "연차"), false);
  }
});

test("승인 목록의 직원·부서 검색과 공백 검색을 유지", () => {
  const request = { applicant: { name: "홍길동", department: "남대문팀" }, dayType: "full_day" };
  assert.equal(matchesLeaveApprovalSearch(request, " 홍길동 "), true);
  assert.equal(matchesLeaveApprovalSearch(request, "남대문"), true);
  assert.equal(matchesLeaveApprovalSearch(request, "   "), true);
  assert.equal(matchesLeaveApprovalSearch(request, "오후 반차"), false);
});
