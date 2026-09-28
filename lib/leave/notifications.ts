import "server-only";

import type { CurrentEmployee } from "@/lib/auth/session";
import { getWorkspaceEmployees } from "@/lib/employees/data";
import { isSameDepartmentGroup } from "@/lib/employees/constants";
import { leaveDayTypeLabel, leaveTypeLabel } from "@/lib/leave/constants";
import { canReceiveLeaveNotifications } from "@/lib/leave/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

export type LeaveNotificationItem = {
  id: string;
  type: "approval" | "cancelled" | "deleted";
  title: string;
  description: string;
  createdAt: string;
  href: string;
};

type LeaveLogData = {
  employee_id?: string;
  employee_name?: string;
  employee_department?: string;
  employee_position?: string;
  leave_type?: string;
  start_date?: string;
  end_date?: string;
  day_type?: string;
  team_lead_approval_skipped?: boolean;
};

export async function getLeaveNotifications(
  currentEmployee: CurrentEmployee,
  since: string,
) {
  if (!canReceiveLeaveNotifications(currentEmployee)) {
    return { items: [] as LeaveNotificationItem[], pendingCount: 0, changeCount: 0 };
  }

  const isTeamLead = currentEmployee.positionCode === "team_lead";
  const isRepresentative =
    currentEmployee.role === "admin" &&
    currentEmployee.positionCode === "representative";
  const employees = await getWorkspaceEmployees();
  const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
  const supabase = createAdminClient();

  const [{ data: pendingRequests, error: pendingError }, { data: changeLogs, error: logError }] =
    await Promise.all([
      supabase
        .from("leave_requests")
        .select(
          "id, employee_id, leave_type, start_date, end_date, day_type, status, team_lead_status, representative_status, created_at",
        )
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabase
        .from("activity_logs")
        .select("id, action_type, target_id, changed_data, created_at")
        .in("action_type", ["leave.cancel", "leave.delete"])
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

  if (pendingError || logError) {
    throw new Error("휴가 알림을 불러오지 못했습니다.");
  }

  const approvalItems: LeaveNotificationItem[] = [];
  for (const request of pendingRequests ?? []) {
    const applicant = employeeById.get(request.employee_id);
    if (!applicant || applicant.id === currentEmployee.id) continue;

    const needsTeamLeadReview =
      isTeamLead &&
      isSameDepartmentGroup(applicant.department, currentEmployee.departmentCode) &&
      applicant.position !== "team_lead" &&
      request.team_lead_status === "pending";
    const needsRepresentativeReview =
      isRepresentative &&
      request.representative_status === "pending" &&
      (request.team_lead_status === "approved" || applicant.position === "team_lead");

    if (!needsTeamLeadReview && !needsRepresentativeReview) continue;
    approvalItems.push({
      id: `approval:${request.id}`,
      type: "approval",
      title: `${applicant.name}님의 휴가 승인이 필요합니다`,
      description: `${leaveTypeLabel(request.leave_type)} · ${formatDateRange(request.start_date, request.end_date)} · ${leaveDayTypeLabel(request.day_type)}`,
      createdAt: request.created_at,
      href: "/admin/leave",
    });
  }

  const changeItems: LeaveNotificationItem[] = [];
  for (const log of changeLogs ?? []) {
    const changedData = asLeaveLogData(log.changed_data);
    if (!changedData.employee_id || changedData.employee_id === currentEmployee.id) continue;

    const visibleToTeamLead =
      isTeamLead &&
      isSameDepartmentGroup(
        changedData.employee_department ?? "",
        currentEmployee.departmentCode,
      ) &&
      changedData.team_lead_approval_skipped !== true;
    if (!visibleToTeamLead && !isRepresentative) continue;

    const deleted = log.action_type === "leave.delete";
    changeItems.push({
      id: `change:${log.id}`,
      type: deleted ? "deleted" : "cancelled",
      title: `${changedData.employee_name ?? "직원"}님이 휴가를 ${deleted ? "삭제" : "취소"}했습니다`,
      description: `${leaveTypeLabel(changedData.leave_type ?? "")} · ${formatDateRange(changedData.start_date ?? "", changedData.end_date ?? "")}`,
      createdAt: log.created_at,
      href: "/admin/leave",
    });
  }

  return {
    items: [...approvalItems, ...changeItems].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    ),
    pendingCount: approvalItems.length,
    changeCount: changeItems.length,
  };
}

function asLeaveLogData(value: unknown): LeaveLogData {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as LeaveLogData)
    : {};
}

function formatDateRange(start: string, end: string) {
  if (!start) return "기간 정보 없음";
  return !end || start === end ? start : `${start} ~ ${end}`;
}
