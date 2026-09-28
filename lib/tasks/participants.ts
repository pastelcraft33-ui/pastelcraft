import type { SupabaseClient } from "@supabase/supabase-js";

import type { CurrentEmployee } from "@/lib/auth/session";
import { canViewDepartment } from "@/lib/employees/permissions";
import { isSameDepartmentGroup } from "@/lib/employees/constants";

export async function validateTaskParticipants(
  supabase: SupabaseClient,
  currentEmployee: CurrentEmployee,
  participantIds: string[],
  taskDepartment: string,
) {
  if (!participantIds.length) return null;

  const { data: participants, error } = await supabase
    .from("employees")
    .select("id, department")
    .in("id", participantIds)
    .eq("account_status", "active");

  if (error || (participants ?? []).length !== participantIds.length) {
    return "선택한 참여 직원 중 확인할 수 없는 계정이 있습니다.";
  }

  if (
    (participants ?? []).some(
      (participant) => !canViewDepartment(currentEmployee, participant.department),
    )
  ) {
    return "다른 부서 직원을 이 업무에 추가할 권한이 없습니다.";
  }

  if (
    (participants ?? []).some(
      (participant) => !isSameDepartmentGroup(participant.department, taskDepartment),
    )
  ) {
    return "업무 소속 팀의 직원만 참여자로 추가할 수 있습니다.";
  }

  return null;
}
