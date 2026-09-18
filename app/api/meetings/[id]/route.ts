import { NextResponse } from "next/server";

import {
  hasValidMutationOrigin,
  invalidOriginResponse,
  requireApiEmployee,
} from "@/lib/auth/api";
import { canDeleteMeeting } from "@/lib/meetings/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasValidMutationOrigin(request)) return invalidOriginResponse();

  const auth = await requireApiEmployee();
  if (auth.response) return auth.response;
  const { id } = await params;
  const supabase = createAdminClient();
  const { data: meeting } = await supabase
    .from("meetings")
    .select("id, subject, meeting_date, start_time, end_time, created_by")
    .eq("id", id)
    .maybeSingle();
  if (!meeting) {
    return NextResponse.json(
      { message: "회의를 찾을 수 없습니다." },
      { status: 404 },
    );
  }
  if (!canDeleteMeeting(auth.employee, meeting.created_by)) {
    return NextResponse.json(
      { message: "회의 등록자 또는 관리자만 회의를 종료할 수 있습니다." },
      { status: 403 },
    );
  }

  const { data: announcement, error } = await supabase
    .from("announcements")
    .delete()
    .eq("meeting_id", id)
    .select("id")
    .maybeSingle();
  if (error) {
    return NextResponse.json(
      { message: "회의를 종료하지 못했습니다." },
      { status: 500 },
    );
  }
  if (!announcement) {
    return NextResponse.json(
      { message: "이미 종료된 회의입니다." },
      { status: 409 },
    );
  }

  await supabase.from("activity_logs").insert({
    employee_id: auth.employee.id,
    action_type: "meeting.end",
    target_type: "meeting",
    target_id: id,
    changed_data: meeting,
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
  const { data: meeting } = await supabase
    .from("meetings")
    .select("id, subject, meeting_date, start_time, end_time, created_by")
    .eq("id", id)
    .maybeSingle();
  if (!meeting) {
    return NextResponse.json(
      { message: "회의를 찾을 수 없습니다." },
      { status: 404 },
    );
  }
  if (!canDeleteMeeting(auth.employee, meeting.created_by)) {
    return NextResponse.json(
      { message: "본인이 등록한 회의만 삭제할 수 있습니다." },
      { status: 403 },
    );
  }

  const { error } = await supabase.from("meetings").delete().eq("id", id);
  if (error) {
    return NextResponse.json(
      { message: "회의를 삭제하지 못했습니다." },
      { status: 500 },
    );
  }

  await supabase.from("activity_logs").insert({
    employee_id: auth.employee.id,
    action_type: "meeting.delete",
    target_type: "meeting",
    target_id: id,
    changed_data: meeting,
  });

  return NextResponse.json({ ok: true });
}
