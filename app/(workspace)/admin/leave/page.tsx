import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LeaveApprovalManager } from "@/components/leave/leave-approval-manager";
import { requireCurrentEmployee } from "@/lib/auth/session";
import { departmentLabel, positionLabel } from "@/lib/employees/constants";
import { isSameDepartmentGroup } from "@/lib/employees/constants";
import {
  leaveDayTypeLabel,
  leaveProgressLabel,
} from "@/lib/leave/constants";
import { createProfileImageSignedUrlMap } from "@/lib/storage/profile-image";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "휴가 승인" };
export default async function AdminLeavePage() {
  const currentEmployee = await requireCurrentEmployee();
  const isTeamLead = currentEmployee.positionCode === "team_lead";
  if (currentEmployee.role !== "admin" && !isTeamLead) redirect("/calendar");

  const supabase = createAdminClient();
  const { data: requests, error } = await supabase
    .from("leave_requests")
    .select(
      "*",
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error("휴가 승인 목록을 불러오지 못했습니다.");

  const employeeIds = [
    ...new Set(
      (requests ?? []).flatMap((request) =>
        [
          request.employee_id,
          request.team_lead_reviewed_by,
          request.representative_reviewed_by,
        ].filter((value): value is string => Boolean(value)),
      ),
    ),
  ];
  const { data: employees } = employeeIds.length
    ? await supabase
        .from("employees")
        .select("id, name, position, department, profile_image_url")
        .in("id", employeeIds)
    : { data: [] };
  const profileImageUrlByValue = await createProfileImageSignedUrlMap(
    supabase,
    (employees ?? []).map((employee) => employee.profile_image_url),
  );
  const employeeEntries = (employees ?? []).map((employee) => [
      employee.id,
      {
        id: employee.id,
        name: employee.name,
        position: employee.position,
        positionLabel: positionLabel(employee.position),
        department: employee.department,
        departmentLabel: departmentLabel(employee.department),
        imageUrl: employee.profile_image_url
          ? (profileImageUrlByValue.get(employee.profile_image_url) ?? null)
          : null,
      },
    ] as const);
  const employeeById = new Map(employeeEntries);

  const visibleRequests = (requests ?? []).filter((request) => {
    if (currentEmployee.role === "admin") return true;
    return (
      isSameDepartmentGroup(
        employeeById.get(request.employee_id)?.department ?? "",
        currentEmployee.departmentCode,
      )
    );
  });

  return (
    <LeaveApprovalManager
      currentEmployee={{
        id: currentEmployee.id,
        role: currentEmployee.role,
        loginId: currentEmployee.loginId,
        positionCode: currentEmployee.positionCode,
        departmentCode: currentEmployee.departmentCode,
      }}
      requests={visibleRequests.map((request) => {
        const applicant = employeeById.get(request.employee_id);
        const teamLeadApprovalSkipped =
          applicant?.position === "team_lead" ||
          (request.team_lead_status === "approved" &&
            (request.team_lead_reviewed_by === null ||
              request.team_lead_reviewed_by === request.representative_reviewed_by) &&
            request.representative_status !== "pending");
        const effectiveTeamLeadStatus =
          teamLeadApprovalSkipped && request.team_lead_status === "pending"
            ? "approved"
            : request.team_lead_status;
        return {
          id: request.id,
          applicant: {
            id: request.employee_id,
            name: applicant?.name ?? "알 수 없는 직원",
            position: applicant?.positionLabel ?? "직원",
            departmentCode: applicant?.department ?? "",
            department: applicant?.departmentLabel ?? "부서 없음",
            imageUrl: applicant?.imageUrl ?? null,
          },
          dayType: request.day_type,
          dayTypeLabel: leaveDayTypeLabel(request.day_type),
          startDate: [request.start_date, request.start_time?.slice(0, 5)].filter(Boolean).join(" "),
          endDate: [request.end_date, request.end_time?.slice(0, 5)].filter(Boolean).join(" "),
          reason: request.reason,
          handoverNote: request.handover_note,
          attachment: request.attachment_url
            ? {
                fileName: request.attachment_name ?? "첨부파일",
                fileSizeBytes: request.attachment_size_bytes ?? 0,
                downloadUrl: `/api/leave/${request.id}/attachment`,
              }
            : null,
          status: request.status,
          statusLabel: leaveProgressLabel({
            status: request.status,
            teamLeadStatus: effectiveTeamLeadStatus,
            representativeStatus: request.representative_status,
          }),
          teamLeadStatus: effectiveTeamLeadStatus,
          teamLeadApprovalSkipped,
          teamLeadReviewer: request.team_lead_reviewed_by
            ? employeeById.get(request.team_lead_reviewed_by)?.name ?? "담당 팀장"
            : null,
          teamLeadReviewedAt: request.team_lead_reviewed_at,
          representativeStatus: request.representative_status,
          representativeReviewer: request.representative_reviewed_by
            ? employeeById.get(request.representative_reviewed_by)?.name ?? "대표자"
            : null,
          representativeReviewedAt: request.representative_reviewed_at,
          rejectionReason:
            request.representative_rejection_reason ??
            request.team_lead_rejection_reason ??
            request.rejection_reason,
          createdAt: request.created_at,
        };
      })}
    />
  );
}
