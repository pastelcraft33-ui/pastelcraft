import test from "node:test";
import assert from "node:assert/strict";
import { filterEmployeesByTeam, employeeTeamOptions } from "../lib/employees/team-filter";

const employees = [
  { id: "design", department: "web_design" },
  { id: "marketing", department: "web_marketing" },
  { id: "legacy", department: "web" },
  { id: "branch", department: "namdaemun" },
  { id: "logistics", department: "logistics" },
  { id: "representative", department: "unassigned" },
];

test("직원 관리 팀 버튼은 전체·웹팀·남대문팀·물류팀 순서", () => {
  assert.deepEqual(employeeTeamOptions.map(option => option.label), ["전체", "웹팀", "남대문팀", "물류팀"]);
});
test("웹팀은 세 부서 코드를 함께 표시하고 다른 팀과 미소속을 제외", () => {
  assert.deepEqual(filterEmployeesByTeam(employees, "web").map(employee => employee.id), ["design", "marketing", "legacy"]);
  assert.deepEqual(filterEmployeesByTeam(employees, "namdaemun").map(employee => employee.id), ["branch"]);
  assert.deepEqual(filterEmployeesByTeam(employees, "logistics").map(employee => employee.id), ["logistics"]);
});
test("전체는 대표자·미소속을 보존하며 팀 필터는 원본 데이터를 변경하지 않음", () => {
  assert.deepEqual(filterEmployeesByTeam(employees, "all"), employees);
  filterEmployeesByTeam(employees, "web");
  assert.equal(employees.length, 6);
  assert.deepEqual(filterEmployeesByTeam([], "web"), []);
});
