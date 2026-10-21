import type { CurrentEmployee } from "@/lib/auth/session";
import { departmentGroup } from "@/lib/employees/constants";

export function canUseProductDesignWorkspace(employee: Pick<CurrentEmployee, "role" | "positionCode" | "departmentCode">) {
  return (employee.role === "admin" && employee.positionCode === "representative") ||
    departmentGroup(employee.departmentCode) === "web";
}

export function canManageProductDesignTask(
  employee: Pick<CurrentEmployee, "id" | "role">,
  assigneeId: string,
) {
  return employee.role === "admin" || employee.id === assigneeId;
}

export function canDeleteProductDesignTask(
  employee: Pick<CurrentEmployee, "id" | "role">,
  assigneeId: string,
) {
  return canManageProductDesignTask(employee, assigneeId);
}
