import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LeaveRequestForm } from "@/components/leave/leave-request-form";
import { requireCurrentEmployee } from "@/lib/auth/session";
import { leaveProgressLabel } from "@/lib/leave/constants";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "휴가 신청" };
const leaveSelect =
  "id, employee_id, leave_type, start_date, end_date, day_type, reason, handover_note, attachment_url, attachment_name, attachment_size_bytes, status, rejection_reason, team_lead_status, team_lead_reviewed_by, team_lead_reviewed_at, team_lead_rejection_reason, representative_status, representative_reviewed_at, representative_rejection_reason, created_at, updated_at";

export default async function LeaveNewPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; saved?: string }>;
}) {
  const currentEmployee = await requireCurrentEmployee();
  const { edit: editId, saved } = await searchParams;
  const supabase = createAdminClient();

  const { data: ownRequests, error } = await supabase
    .from("leave_requests")
    .select(leaveSelect)
    .eq("employee_id", currentEmployee.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error("휴가 신청 내역을 불러오지 못했습니다.");

  let editRequest = editId
    ? (ownRequests ?? []).find((request) => request.id === editId) ?? null
    : null;
  if (editId && !editRequest && currentEmployee.role === "admin") {
    const { data } = await supabase
      .from("leave_requests")
      .select(leaveSelect)
      .eq("id", editId)
      .maybeSingle();
    editRequest = data;
  }
  if (editId && !editRequest) notFound();

  if (editRequest) {
    const ownerCanEdit =
      editRequest.employee_id === currentEmployee.id &&
      editRequest.status === "pending";
    const adminCanEdit =
      currentEmployee.role === "admin" && editRequest.status !== "cancelled";
    if (!ownerCanEdit && !adminCanEdit) notFound();
  }

  const rows = ownRequests ?? [];
  const initialRequest = editRequest
    ? {
        id: editRequest.id,
        leaveType: editRequest.leave_type,
        startDate: editRequest.start_date,
        endDate: editRequest.end_date,
        dayType: editRequest.day_type,
        reason: editRequest.reason,
        handoverNote: editRequest.handover_note ?? "",
        status: editRequest.status,
        attachment: editRequest.attachment_url
          ? {
              fileName: editRequest.attachment_name ?? "첨부파일",
              fileSizeBytes: editRequest.attachment_size_bytes ?? 0,
              downloadUrl: `/api/leave/${editRequest.id}/attachment`,
            }
          : null,
      }
    : null;

  return (
    <LeaveRequestForm
      initialRequest={initialRequest}
      saved={saved === "1"}
      isAdmin={currentEmployee.role === "admin"}
      requests={rows.map((request) => ({
        id: request.id,
        leaveType: request.leave_type,
        startDate: request.start_date,
        endDate: request.end_date,
        dayType: request.day_type,
        status: request.status,
        statusLabel: leaveProgressLabel({
          status: request.status,
          teamLeadStatus: request.team_lead_status,
          representativeStatus: request.representative_status,
        }),
        teamLeadStatus: request.team_lead_status,
        teamLeadApprovalSkipped:
          currentEmployee.positionCode === "team_lead" ||
          (request.team_lead_status === "approved" &&
            request.team_lead_reviewed_by === null &&
            request.representative_status !== "pending"),
        representativeStatus: request.representative_status,
        rejectionReason:
          request.representative_rejection_reason ??
          request.team_lead_rejection_reason ??
          request.rejection_reason,
        createdAt: request.created_at,
      }))}
    />
  );
}
