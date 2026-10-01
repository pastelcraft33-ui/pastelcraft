import type { CurrentEmployee } from "@/lib/auth/session";
import { departmentGroup } from "@/lib/employees/constants";

export function canUseProductDesignWorkspace(employee: CurrentEmployee) {
  return departmentGroup(employee.departmentCode) === "web";
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
