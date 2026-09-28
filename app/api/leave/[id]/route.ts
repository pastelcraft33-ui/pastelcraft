import { NextResponse } from "next/server";

import {
  hasValidMutationOrigin,
  invalidOriginResponse,
  requireApiEmployee,
} from "@/lib/auth/api";
import { departmentLabel, positionLabel } from "@/lib/employees/constants";
import { canViewDepartment } from "@/lib/employees/permissions";
import {
  leaveDayTypeLabel,
  leaveProgressLabel,
  leaveTypeLabel,
} from "@/lib/leave/constants";
import { validateLeaveAttachment } from "@/lib/leave/files";
import {
  canDeleteLeave,
  canViewLeaveDetails,
} from "@/lib/leave/permissions";
import {
  leaveAttachmentFromFormData,
  LEAVE_ATTACHMENT_BUCKET,
  uploadLeaveAttachment,
} from "@/lib/leave/storage";
import { createProfileImageSignedUrl } from "@/lib/storage/profile-image";
import { createAdminClient } from "@/lib/supabase/admin";
import { leaveFormSchema, leaveInputFromFormData } from "@/schemas/leave";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiEmployee();
  if (auth.response) return auth.response;

  const { id } = await params;
  const supabase = createAdminClient();
  const { data: leave } = await supabase
    .from("leave_requests")
    .select(
      "id, employee_id, leave_type, start_date, end_date, day_type, reason, handover_note, attachment_url, attachment_name, attachment_size_bytes, status, rejection_reason, team_lead_status, team_lead_reviewed_by, team_lead_reviewed_at, team_lead_rejection_reason, representative_status, representative_reviewed_by, representative_reviewed_at, representative_rejection_reason, created_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (!leave) {
    return NextResponse.json(
      { message: "휴가 신청을 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  const employeeIds = [
    ...new Set(
      [
        leave.employee_id,
        leave.team_lead_reviewed_by,
        leave.representative_reviewed_by,
      ].filter((value): value is string => Boolean(value)),
    ),
  ];
  const { data: employees } = await supabase
    .from("employees")
    .select("id, name, position, department, profile_image_url")
    .in("id", employeeIds);
  const employeeById = new Map((employees ?? []).map((employee) => [employee.id, employee]));
  const applicant = employeeById.get(leave.employee_id);
  if (!applicant) {
    return NextResponse.json(
      { message: "신청 직원 정보를 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  if (!canViewDepartment(auth.employee, applicant.department)) {
    return NextResponse.json(
      { message: "다른 부서의 휴가 일정은 조회할 수 없습니다." },
      { status: 403 },
    );
  }

  const canViewDetail = canViewLeaveDetails(auth.employee, {
    id: applicant.id,
    departmentCode: applicant.department,
  });
  const canEdit =
    (auth.employee.id === applicant.id && leave.status === "pending") ||
    (auth.employee.role === "admin" && leave.status !== "cancelled");

  return NextResponse.json({
    leave: {
      id: leave.id,
      employee: {
        id: applicant.id,
        name: applicant.name,
        position: positionLabel(applicant.position),
        department: departmentLabel(applicant.department),
        imageUrl: await createProfileImageSignedUrl(
          supabase,
          applicant.profile_image_url,
        ),
      },
      leaveType: leave.leave_type,
      leaveTypeLabel: leaveTypeLabel(leave.leave_type),
      dayType: leave.day_type,
      dayTypeLabel: leaveDayTypeLabel(leave.day_type),
      startDate: leave.start_date,
      endDate: leave.end_date,
      status: leave.status,
      statusLabel: leaveProgressLabel({
        status: leave.status,
        teamLeadStatus: leave.team_lead_status,
        representativeStatus: leave.representative_status,
      }),
      teamLeadStatus: leave.team_lead_status,
      teamLeadApprovalSkipped:
        applicant.position === "team_lead" ||
        (leave.team_lead_status === "approved" &&
          (leave.team_lead_reviewed_by === null ||
            leave.team_lead_reviewed_by === leave.representative_reviewed_by) &&
          leave.representative_status !== "pending"),
      teamLeadReviewer: leave.team_lead_reviewed_by
        ? employeeById.get(leave.team_lead_reviewed_by)?.name ?? "담당 팀장"
        : null,
      teamLeadReviewedAt: leave.team_lead_reviewed_at,
      representativeStatus: leave.representative_status,
      representativeReviewer: leave.representative_reviewed_by
        ? employeeById.get(leave.representative_reviewed_by)?.name ?? "대표자"
        : null,
      representativeReviewedAt: leave.representative_reviewed_at,
      reason: canViewDetail ? leave.reason : null,
      handoverNote: canViewDetail ? leave.handover_note : null,
      rejectionReason: canViewDetail
        ? leave.representative_rejection_reason ??
          leave.team_lead_rejection_reason ??
          leave.rejection_reason
        : null,
      attachment:
        canViewDetail && leave.attachment_url
          ? {
              fileName: leave.attachment_name ?? "첨부파일",
              fileSizeBytes: leave.attachment_size_bytes ?? 0,
              downloadUrl: `/api/leave/${leave.id}/attachment`,
            }
          : null,
      canViewDetail,
      canEdit,
    },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasValidMutationOrigin(request)) return invalidOriginResponse();

  const auth = await requireApiEmployee();
  if (auth.response) return auth.response;

  const { id } = await params;
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { message: "휴가 수정 정보를 읽을 수 없습니다." },
      { status: 400 },
    );
  }

  const parsed = leaveFormSchema.safeParse(leaveInputFromFormData(formData));
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "휴가 신청 정보를 확인해 주세요." },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const { data: before } = await supabase
    .from("leave_requests")
    .select(
      "id, employee_id, status, team_lead_status, representative_status, attachment_url",
    )
    .eq("id", id)
    .maybeSingle();
  if (!before) {
    return NextResponse.json(
      { message: "휴가 신청을 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  const isOwnerPending =
    before.employee_id === auth.employee.id && before.status === "pending";
  const isAdminEditable =
    auth.employee.role === "admin" && before.status !== "cancelled";
  if (!isOwnerPending && !isAdminEditable) {
    return NextResponse.json(
      { message: "이 휴가 신청을 수정할 권한이 없습니다." },
      { status: 403 },
    );
  }

  const attachment = leaveAttachmentFromFormData(formData);
  const fileError = validateLeaveAttachment(attachment);
  if (fileError) return NextResponse.json({ message: fileError }, { status: 400 });
  const removeAttachment = formData.get("removeAttachment") === "true";
  let newPath: string | null = null;

  if (attachment) {
    const upload = await uploadLeaveAttachment(supabase, id, attachment);
    if (upload.error) {
      return NextResponse.json(
        { message: "새 첨부파일을 저장하지 못했습니다." },
        { status: 500 },
      );
    }
    newPath = upload.path;
  }

  const shouldResetApproval = before.status === "pending";
  const { data: applicantForApproval } = shouldResetApproval
    ? await supabase
        .from("employees")
        .select("id, position")
        .eq("id", before.employee_id)
        .maybeSingle()
    : { data: null };
  const skipsTeamLeadApproval =
    applicantForApproval?.position === "team_lead";
  const approvalResetAt = new Date().toISOString();
  const updates: Record<string, unknown> = {
    leave_type: parsed.data.leaveType,
    start_date: parsed.data.startDate,
    end_date: parsed.data.endDate,
    day_type: parsed.data.dayType,
    reason: parsed.data.reason,
    handover_note: parsed.data.handoverNote || null,
  };

  if (shouldResetApproval) {
    Object.assign(updates, {
      team_lead_status: skipsTeamLeadApproval ? "approved" : "pending",
      team_lead_reviewed_by: skipsTeamLeadApproval
        ? before.employee_id
        : null,
      team_lead_reviewed_at: skipsTeamLeadApproval ? approvalResetAt : null,
      team_lead_rejection_reason: null,
      representative_status: "pending",
      representative_reviewed_by: null,
      representative_reviewed_at: null,
      representative_rejection_reason: null,
      rejection_reason: null,
      approved_by: null,
      approved_at: null,
    });
  }

  if (attachment) {
    Object.assign(updates, {
      attachment_url: newPath,
      attachment_name: attachment.name,
      attachment_mime_type: attachment.type,
      attachment_size_bytes: attachment.size,
    });
  } else if (removeAttachment) {
    Object.assign(updates, {
      attachment_url: null,
      attachment_name: null,
      attachment_mime_type: null,
      attachment_size_bytes: null,
    });
  }

  const { error: updateError } = await supabase
    .from("leave_requests")
    .update(updates)
    .eq("id", id);
  if (updateError) {
    if (newPath) {
      await supabase.storage.from(LEAVE_ATTACHMENT_BUCKET).remove([newPath]);
    }
    return NextResponse.json(
      { message: "휴가 신청을 수정하지 못했습니다." },
      { status: 500 },
    );
  }

  if (before.attachment_url && (attachment || removeAttachment)) {
    await supabase.storage
      .from(LEAVE_ATTACHMENT_BUCKET)
      .remove([before.attachment_url]);
  }

  await supabase.from("activity_logs").insert({
    employee_id: auth.employee.id,
    action_type: "leave.update",
    target_type: "leave_request",
    target_id: id,
    changed_data: {
      approval_reset: shouldResetApproval,
      team_lead_approval_skipped: skipsTeamLeadApproval,
      edited_by_admin: auth.employee.role === "admin",
      attachment_replaced: Boolean(attachment),
      attachment_removed: removeAttachment && !attachment,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasValidMutationOrigin(request)) return invalidOriginResponse();

  const auth = await requireApiEmployee();
  if (auth.response) return auth.response;

  const { id } = await params;
  const supabase = createAdminClient();
  const { data: leave } = await supabase
    .from("leave_requests")
    .select(
      "id, employee_id, leave_type, start_date, end_date, day_type, status, attachment_url",
    )
    .eq("id", id)
    .maybeSingle();
  if (!leave) {
    return NextResponse.json(
      { message: "휴가 신청을 찾을 수 없습니다." },
      { status: 404 },
    );
  }
  if (!canDeleteLeave(auth.employee, leave.employee_id)) {
    return NextResponse.json(
      { message: "이 휴가 신청을 삭제할 권한이 없습니다." },
      { status: 403 },
    );
  }

  const { data: applicant } = await supabase
    .from("employees")
    .select("id, name, department, position")
    .eq("id", leave.employee_id)
    .maybeSingle();
  if (!applicant) {
    return NextResponse.json(
      { message: "신청 직원 정보를 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  const { error } = await supabase
    .from("leave_requests")
    .delete()
    .eq("id", id);
  if (error) {
    return NextResponse.json(
      { message: "휴가 신청을 삭제하지 못했습니다." },
      { status: 500 },
    );
  }

  if (leave.attachment_url) {
    await supabase.storage
      .from(LEAVE_ATTACHMENT_BUCKET)
      .remove([leave.attachment_url]);
  }

  await supabase.from("activity_logs").insert({
    employee_id: auth.employee.id,
    action_type: "leave.delete",
    target_type: "leave_request",
    target_id: id,
    changed_data: {
      employee_id: applicant.id,
      employee_name: applicant.name,
      employee_department: applicant.department,
      employee_position: applicant.position,
      leave_type: leave.leave_type,
      start_date: leave.start_date,
      end_date: leave.end_date,
      day_type: leave.day_type,
      previous_status: leave.status,
      team_lead_approval_skipped: applicant.position === "team_lead",
      deleted_by_admin: auth.employee.role === "admin",
      attachment_deleted: Boolean(leave.attachment_url),
    },
  });

  return NextResponse.json({ ok: true });
}
