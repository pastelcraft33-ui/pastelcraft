import test from "node:test";
import assert from "node:assert/strict";
import type { CurrentEmployee } from "../lib/auth/session";
import { canUseProductDesignWorkspace } from "../lib/product-design/permissions";
import { canViewDepartment } from "../lib/employees/permissions";
import { filterLeaveReportingTeam } from "../lib/leave/departments";
import { adminUpdateEmployeeSchema } from "../schemas/admin-employees";

const representative = {
  id: "rep", loginId: "pastelcraft", role: "admin",
  positionCode: "representative", departmentCode: "unassigned",
} as CurrentEmployee;

test("미소속 대표는 모든 팀 조회 및 웹 업무 공간 접근 가능", () => {
  assert.equal(canUseProductDesignWorkspace(representative), true);
  for (const department of ["web_design", "web_marketing", "logistics", "namdaemun"]) {
    assert.equal(canViewDepartment(representative, department), true);
  }
  assert.equal(canUseProductDesignWorkspace({
    ...representative, role: "employee", positionCode: "staff", departmentCode: "logistics",
  }), false);
});

test("미소속 대표는 팀별 엑셀 대상에서 제외, 전체 조회에는 유지", () => {
  const rows = [
    { id: "rep", department: "unassigned", departmentLabel: "부서 미소속" },
    { id: "staff", department: "web_design", departmentLabel: "웹디자인팀" },
  ];
  assert.deepEqual(filterLeaveReportingTeam(rows, "web").map(row => row.id), ["staff"]);
  assert.equal(filterLeaveReportingTeam(rows, "").length, 2);
});

test("미소속 부서 저장은 대표 관리자만 허용", () => {
  const input = { name: "김도아", position: "representative", role: "admin", department: "unassigned", phone: "010-1234-5678" };
  assert.equal(adminUpdateEmployeeSchema.safeParse(input).success, true);
  assert.equal(adminUpdateEmployeeSchema.safeParse({ ...input, position: "staff" }).success, false);
});
