import test from "node:test";
import assert from "node:assert/strict";
import { leaveReportingDepartment, filterLeaveReportingTeam } from "../lib/leave/departments";
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
test("선택 팀만 추출: 웹 하위 부서와 과거 마감본도 통합",()=>{
 const rows=[{department:"web_design",departmentLabel:"디자인",id:1},{department:"web_marketing",departmentLabel:"마케팅",id:2},{department:"web",departmentLabel:"웹",id:3},{department:"logistics",departmentLabel:"물류",id:4}];
 assert.deepEqual(filterLeaveReportingTeam(rows,"web").map(r=>r.id),[1,2,3]);
 assert.deepEqual(filterLeaveReportingTeam(rows,"logistics").map(r=>r.id),[4]);
 assert.equal(filterLeaveReportingTeam(rows,"").length,4);
 assert.equal(filterLeaveReportingTeam(rows,"namdaemun").length,0);
});
