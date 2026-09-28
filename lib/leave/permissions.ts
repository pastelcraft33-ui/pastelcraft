import type { CurrentEmployee } from "@/lib/auth/session";
import { isSameDepartmentGroup } from "@/lib/employees/constants";

export function canReviewAsTeamLead(
  employee: CurrentEmployee,
  applicant: { id: string; departmentCode: string },
) {
  return (
    employee.positionCode === "team_lead" &&
    isSameDepartmentGroup(employee.departmentCode, applicant.departmentCode) &&
    employee.id !== applicant.id
  );
}

export function canReviewAsRepresentative(
  employee: CurrentEmployee,
  applicantId: string,
) {
  return (
    employee.role === "admin" &&
    employee.positionCode === "representative" &&
    employee.loginId === "pastelcraft" &&
    employee.id !== applicantId
  );
}

export function isPastelcraftRepresentative(employee: CurrentEmployee) {
  return (
    employee.role === "admin" &&
    employee.positionCode === "representative" &&
    employee.loginId === "pastelcraft"
  );
}

export function canViewLeaveDetails(
  employee: CurrentEmployee,
  applicant: { id: string; departmentCode: string },
) {
  return (
    employee.id === applicant.id ||
    employee.role === "admin" ||
    employee.positionCode === "team_lead"
  );
}

export function canCancelLeave(
  employee: CurrentEmployee,
  leave: { employeeId: string; status: string },
) {
  return (
    leave.status !== "cancelled" &&
    (employee.id === leave.employeeId || employee.role === "admin")
  );
}

export function canDeleteLeave(
  employee: CurrentEmployee,
  applicantId: string,
) {
  return employee.id === applicantId || employee.role === "admin";
}

export function canReceiveLeaveNotifications(employee: CurrentEmployee) {
  return (
    employee.positionCode === "team_lead" ||
    (employee.role === "admin" && employee.positionCode === "representative")
  );
}
