import { NextResponse } from "next/server";

import {
  hasValidMutationOrigin,
  invalidOriginResponse,
  requireApiEmployee,
} from "@/lib/auth/api";
import {
  canReviewAsRepresentative,
  canReviewAsTeamLead,
} from "@/lib/leave/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { leaveReviewSchema } from "@/schemas/leave";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasValidMutationOrigin(request)) return invalidOriginResponse();

  const auth = await requireApiEmployee();
  if (auth.response) return auth.response;
  const { id } = await params;
  const input = await request.json().catch(() => null);
  const parsed = leaveReviewSchema.safeParse(input);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "승인 내용을 확인해 주세요." },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const { data: leave } = await supabase
    .from("leave_requests")
    .select(
      "id, employee_id, status, team_lead_status, representative_status",
    )
    .eq("id", id)
    .maybeSingle();
  if (!leave) {
    return NextResponse.json(
      { message: "휴가 신청을 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  const { data: applicant } = await supabase
    .from("employees")
    .select("id, department, position")
    .eq("id", leave.employee_id)
    .maybeSingle();
  if (!applicant) {
    return NextResponse.json(
      { message: "신청 직원 정보를 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  if (leave.status !== "pending") {
    return NextResponse.json(
      { message: "이미 최종 처리된 휴가 신청입니다." },
      { status: 409 },
    );
  }

  const now = new Date().toISOString();
  let updates: Record<string, unknown>;
  let actionType: string;

  if (parsed.data.stage === "team_lead") {
    if (applicant.position === "team_lead") {
      return NextResponse.json(
        { message: "팀장 휴가 신청은 팀장 승인을 생략하고 대표자가 직접 처리합니다." },
        { status: 409 },
      );
    }
    if (
      !canReviewAsTeamLead(auth.employee, {
        id: applicant.id,
        departmentCode: applicant.department,
      })
    ) {
      return NextResponse.json(
        { message: "같은 부서 팀장만 1차 승인할 수 있습니다." },
        { status: 403 },
      );
    }
    if (leave.team_lead_status !== "pending") {
      return NextResponse.json(
        { message: "이미 팀장 검토가 완료된 신청입니다." },
        { status: 409 },
      );
    }

    const approved = parsed.data.decision === "approve";
    updates = {
      team_lead_status: approved ? "approved" : "rejected",
      team_lead_reviewed_by: auth.employee.id,
      team_lead_reviewed_at: now,
      team_lead_rejection_reason: approved ? null : parsed.data.reason,
      ...(approved
        ? {}
        : {
            status: "rejected",
            rejection_reason: parsed.data.reason,
          }),
    };
    actionType = approved ? "leave.team_lead.approve" : "leave.team_lead.reject";
  } else {
    if (!canReviewAsRepresentative(auth.employee, applicant.id)) {
      return NextResponse.json(
        { message: "대표자 권한이 있는 관리자만 최종 승인할 수 있습니다." },
        { status: 403 },
      );
    }
    const skipsTeamLeadApproval = leave.team_lead_status === "pending";
    if (leave.representative_status !== "pending") {
      return NextResponse.json(
        { message: "이미 대표자 검토가 완료된 신청입니다." },
        { status: 409 },
      );
    }

    const approved = parsed.data.decision === "approve";
    updates = {
      ...(skipsTeamLeadApproval
        ? {
            team_lead_status: "approved",
            team_lead_reviewed_by: null,
            team_lead_reviewed_at: now,
            team_lead_rejection_reason: null,
          }
        : {}),
      representative_status: approved ? "approved" : "rejected",
      representative_reviewed_by: auth.employee.id,
      representative_reviewed_at: now,
      representative_rejection_reason: approved ? null : parsed.data.reason,
      status: approved ? "approved" : "rejected",
      rejection_reason: approved ? null : parsed.data.reason,
      approved_by: approved ? auth.employee.id : null,
      approved_at: approved ? now : null,
    };
    actionType = approved
      ? "leave.representative.approve"
      : "leave.representative.reject";
  }

  const { error } = await supabase
    .from("leave_requests")
    .update(updates)
    .eq("id", id);
  if (error) {
    return NextResponse.json(
      { message: "휴가 승인 상태를 변경하지 못했습니다." },
      { status: 500 },
    );
  }

  await supabase.from("activity_logs").insert({
    employee_id: auth.employee.id,
    action_type: actionType,
    target_type: "leave_request",
    target_id: id,
    changed_data: {
      stage: parsed.data.stage,
      decision: parsed.data.decision,
      reason: parsed.data.reason ?? null,
      team_lead_approval_skipped:
        applicant.position === "team_lead",
    },
  });

  return NextResponse.json({ ok: true });
}
