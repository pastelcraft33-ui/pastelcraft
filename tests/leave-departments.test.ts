import test from "node:test";
import assert from "node:assert/strict";
import { leaveReportingDepartment } from "../lib/leave/departments";
test("연차 보고서에서만 웹 부서를 통합하며 원본은 보존", () => {
  for (const department of ["web", "web_design", "web_marketing"]) {
    const row = { department, departmentLabel: "원래 부서", id: "a" };
    assert.deepEqual(leaveReportingDepartment(row), { department: "web", departmentLabel: "웹팀", id: "a" });
    assert.equal(row.department, department);
    assert.equal(row.departmentLabel, "원래 부서");
  }
  const logistics = { department: "logistics", departmentLabel: "물류팀" };
  assert.deepEqual(leaveReportingDepartment(logistics), logistics);
});
