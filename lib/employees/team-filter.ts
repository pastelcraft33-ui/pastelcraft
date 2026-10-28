import { departmentGroup } from "./constants";

export const employeeTeamOptions = [
  { value: "all", label: "전체" },
  { value: "web", label: "웹팀" },
  { value: "namdaemun", label: "남대문팀" },
  { value: "logistics", label: "물류팀" },
] as const;

export type EmployeeTeam = (typeof employeeTeamOptions)[number]["value"];

export function filterEmployeesByTeam<T extends { department: string }>(employees: T[], team: EmployeeTeam): T[] {
  return team === "all" ? employees : employees.filter(employee => departmentGroup(employee.department) === team);
}
