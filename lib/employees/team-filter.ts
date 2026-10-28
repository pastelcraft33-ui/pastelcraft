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

/** ISO date-only values sort chronologically; never mutate server-provided rows. */
export function sortEmployeesByHireDate<T extends { hireDate: string | null }>(employees: T[]): T[] {
  return [...employees].sort((left, right) => {
    if (!left.hireDate) return right.hireDate ? 1 : 0;
    if (!right.hireDate) return -1;
    return left.hireDate.localeCompare(right.hireDate);
  });
}
