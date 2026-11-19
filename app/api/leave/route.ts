import { NextResponse } from "next/server";

import {
  hasValidMutationOrigin,
  invalidOriginResponse,
  requireApiEmployee,
} from "@/lib/auth/api";
import { validateLeaveAttachment } from "@/lib/leave/files";
import { loadLeaveBalances } from "@/lib/leave/balance-data";
import { currentReportingMonth, koreanToday } from "@/lib/leave/balance";
import { negativeBalanceApplicationData } from "@/lib/leave/negative-balance-alert";
import {
  leaveAttachmentFromFormData,
  LEAVE_ATTACHMENT_BUCKET,
  uploadLeaveAttachment,
} from "@/lib/leave/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { leaveFormSchema, leaveInputFromFormData } from "@/schemas/leave";
import { canManageEmployeeLeave } from "@/lib/leave/permissions";

export async function POST(request: Request) {
  if (!hasValidMutationOrigin(request)) return invalidOriginResponse();

  const auth = await requireApiEmployee();
  if (auth.response) return auth.response;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { message: "휴가 신청 정보를 읽을 수 없습니다." },
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

  const attachment = leaveAttachmentFromFormData(formData);
  const fileError = validateLeaveAttachment(attachment);
  if (fileError) return NextResponse.json({ message: fileError }, { status: 400 });

  const supabase = createAdminClient();
  const employeeId = formData.get("employeeId") || auth.employee.id;
  if (typeof employeeId !== "string" || (employeeId !== auth.employee.id && !canManageEmployeeLeave(auth.employee))) {
    return NextResponse.json({message:"다른 직원의 휴가를 등록할 권한이 없습니다."},{status:403});
  }
  const {data: applicant,error: applicantError} = await supabase.from("employees")
    .select("id,name,department,position").eq("id",employeeId).eq("account_status","active").maybeSingle();
  if(applicantError || !applicant) return NextResponse.json({message:"사용 가능한 직원 계정을 확인해 주세요."},{status:400});
  let balanceAtApplication: number | null = null;
  try {
    const balances = await loadLeaveBalances(
      currentReportingMonth(koreanToday(), applicant.department), applicant.id,
    );
    const row = balances.rows.find(employee => employee.id === applicant.id);
    // Accounts explicitly excluded from balance management may still apply for leave.
    if (row?.account && !row.result) throw new Error("연차 잔액 확인 실패");
    balanceAtApplication = row?.result?.current ?? null;
  } catch {
    return NextResponse.json({ message: "잔여 연차를 확인하지 못했습니다. 잠시 후 다시 신청해 주세요." }, { status: 503 });
  }
  const balanceAlert = negativeBalanceApplicationData(applicant.name, balanceAtApplication);
  let uploadedPath: string | null = null;
  const skipsTeamLeadApproval = applicant.position === "team_lead";
  const requestedAt = new Date().toISOString();
  const { data: leave, error } = await supabase
    .from("leave_requests")
    .insert({
      employee_id: applicant.id,
      leave_type: parsed.data.leaveType,
      start_date: parsed.data.startDate,
      end_date: parsed.data.endDate,
      day_type: parsed.data.dayType,
      ...(parsed.data.dayType === "outing" ? { start_time: parsed.data.startTime, end_time: parsed.data.endTime } : {}),
      reason: parsed.data.reason,
      handover_note: parsed.data.handoverNote || null,
      status: "pending",
      team_lead_status: skipsTeamLeadApproval ? "approved" : "pending",
      team_lead_reviewed_by: skipsTeamLeadApproval ? applicant.id : null,
      team_lead_reviewed_at: skipsTeamLeadApproval ? requestedAt : null,
      representative_status: "pending",
    })
    .select("id")
    .single();

  if (error || !leave) {
    return NextResponse.json(
      { message: "휴가 신청을 저장하지 못했습니다." },
      { status: 500 },
    );
  }

  if (attachment) {
    const upload = await uploadLeaveAttachment(supabase, leave.id, attachment);
    if (upload.error) {
      await supabase.from("leave_requests").delete().eq("id", leave.id);
      return NextResponse.json(
        { message: "첨부파일을 저장하지 못해 휴가 신청을 취소했습니다." },
        { status: 500 },
      );
    }
    uploadedPath = upload.path;

    const { error: metadataError } = await supabase
      .from("leave_requests")
      .update({
        attachment_url: upload.path,
        attachment_name: attachment.name,
        attachment_mime_type: attachment.type,
        attachment_size_bytes: attachment.size,
      })
      .eq("id", leave.id);
    if (metadataError) {
      await Promise.all([
        supabase.storage.from(LEAVE_ATTACHMENT_BUCKET).remove([upload.path]),
        supabase.from("leave_requests").delete().eq("id", leave.id),
      ]);
      return NextResponse.json(
        { message: "첨부파일 정보를 저장하지 못했습니다." },
        { status: 500 },
      );
    }
  }

  const { error: logError } = await supabase.from("activity_logs").insert({
    employee_id: auth.employee.id,
    action_type: "leave.create",
    target_type: "leave_request",
    target_id: leave.id,
    changed_data: {
      employee_id: applicant.id,
      employee_name: applicant.name,
      created_by: auth.employee.id,
      delegated: applicant.id !== auth.employee.id,
      ...balanceAlert,
      leave_type: parsed.data.leaveType,
      start_date: parsed.data.startDate,
      end_date: parsed.data.endDate,
      day_type: parsed.data.dayType,
      approval_flow: skipsTeamLeadApproval
        ? ["representative"]
        : ["team_lead", "representative"],
      team_lead_approval_skipped: skipsTeamLeadApproval,
      attachment: Boolean(attachment),
    },
  });

  if (logError && ("negative_balance" in balanceAlert || applicant.id !== auth.employee.id)) {
    // Do not report success if the representative's required alert was not persisted.
    const { error: rollbackError } = await supabase.from("leave_requests").delete().eq("id", leave.id);
    if (rollbackError) {
      return NextResponse.json({ ok: true, id: leave.id, warning: "휴가는 저장됐으나 대표자 알림 저장에 실패했습니다. 관리자에게 문의해 주세요." }, { status: 201 });
    }
    if (uploadedPath) await supabase.storage.from(LEAVE_ATTACHMENT_BUCKET).remove([uploadedPath]);
    return NextResponse.json({ message: "대표자 알림을 저장하지 못해 신청을 취소했습니다. 잠시 후 다시 신청해 주세요." }, { status: 503 });
  }

  return NextResponse.json({ ok: true, id: leave.id }, { status: 201 });
}
