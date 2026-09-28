import type { CurrentEmployee } from "@/lib/auth/session";
import { departmentGroup } from "@/lib/employees/constants";

export function canUseProductDesignWorkspace(employee: CurrentEmployee) {
  return departmentGroup(employee.departmentCode) === "web";
}
