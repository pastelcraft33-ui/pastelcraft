import type { CurrentEmployee } from "@/lib/auth/session";
import {
  isDepartmentCode,
  type DepartmentCode,
} from "@/lib/employees/constants";

const detailedViewPositions = new Set([
  "manager",
  "deputy_general_manager",
  "general_manager",
  "team_lead",
]);

export function canViewEmployeeWorkDetails(
  employee: CurrentEmployee,
  targetEmployeeId: string,
  targetDepartmentCode?: string,
) {
  return (
    employee.role === "admin" ||
    employee.id === targetEmployeeId ||
    employee.positionCode === "team_lead" ||
    (detailedViewPositions.has(employee.positionCode) &&
      Boolean(targetDepartmentCode) &&
      employee.departmentCode === targetDepartmentCode)
  );
}

export function canViewAllDepartments(employee: CurrentEmployee) {
  return employee.role === "admin" || employee.positionCode === "team_lead";
}

export function canViewDepartment(
  employee: CurrentEmployee,
  departmentCode: string,
) {
  return (
    canViewAllDepartments(employee) ||
    employee.departmentCode === departmentCode
  );
}

export function resolveVisibleDepartment(
  employee: CurrentEmployee,
  requestedDepartment?: unknown,
): DepartmentCode | string | null {
  if (employee.role === "admin") {
    return isDepartmentCode(requestedDepartment) ? requestedDepartment : null;
  }
  if (canViewAllDepartments(employee)) return null;
  return employee.departmentCode;
}
