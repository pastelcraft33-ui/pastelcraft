import test from "node:test";
import assert from "node:assert/strict";
import { filterEmployeesByTeam, employeeTeamOptions, sortEmployeesByHireDate } from "../lib/employees/team-filter";

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

test("입사일 오름차순, 미등록은 마지막, 동일 입사일은 기존 순서 유지", () => {
  const rows = [
    { id: "missing", hireDate: null },
    { id: "new", hireDate: "2026-10-28" },
    { id: "old", hireDate: "2013-08-19" },
    { id: "same", hireDate: "2026-10-28" },
    { id: "empty", hireDate: "" },
  ];
  assert.deepEqual(sortEmployeesByHireDate(rows).map(row => row.id), ["old", "new", "same", "missing", "empty"]);
  assert.equal(rows[0].id, "missing");
  assert.deepEqual(sortEmployeesByHireDate([]), []);
});

test("각 팀 필터와 검색에 사용할 목록도 입사일 순서를 유지", () => {
  const rows = [
    { id: "web-new", department: "web_design", hireDate: "2026-10-28" },
    { id: "web-missing", department: "web_marketing", hireDate: null },
    { id: "other", department: "namdaemun", hireDate: "2010-01-01" },
    { id: "web-old", department: "web_marketing", hireDate: "2025-02-17" },
  ];
  assert.deepEqual(sortEmployeesByHireDate(filterEmployeesByTeam(rows, "web")).map(row => row.id), ["web-old", "web-new", "web-missing"]);
});
