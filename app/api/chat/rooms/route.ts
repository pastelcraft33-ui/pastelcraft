import { NextResponse } from "next/server";

import { hasValidMutationOrigin, invalidOriginResponse, requireApiEmployee } from "@/lib/auth/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { chatEmployeeIdSchema } from "@/schemas/chat";

export async function POST(request: Request) {
  if (!hasValidMutationOrigin(request)) return invalidOriginResponse();
  const auth = await requireApiEmployee();
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => null) as { employeeId?: unknown } | null;
  const parsed = chatEmployeeIdSchema.safeParse(body?.employeeId);
  if (!parsed.success) {
    return NextResponse.json({ message: "대화할 직원을 확인해 주세요." }, { status: 400 });
  }
  if (parsed.data === auth.employee.id) {
    return NextResponse.json({ message: "본인과는 채팅방을 만들 수 없습니다." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: target } = await supabase
    .from("employees")
    .select("id")
    .eq("id", parsed.data)
    .eq("account_status", "active")
    .maybeSingle();
  if (!target) {
    return NextResponse.json({ message: "대화할 직원을 찾을 수 없습니다." }, { status: 404 });
  }

  const directKey = [auth.employee.id, target.id].sort().join(":");
  let { data: room, error } = await supabase
    .from("chat_rooms")
    .select("id")
    .eq("direct_key", directKey)
    .maybeSingle();
  if (error) {
    return NextResponse.json(
      { message: error.code === "PGRST205" || error.code === "42P01" ? "파스텔 메신저 데이터베이스 설정이 필요합니다." : "채팅방을 확인하지 못했습니다." },
      { status: 500 },
    );
  }

  let created = false;
  if (!room) {
    const insertResult = await supabase
      .from("chat_rooms")
      .insert({ direct_key: directKey, created_by: auth.employee.id })
      .select("id")
      .single();
    if (insertResult.error) {
      const retry = await supabase.from("chat_rooms").select("id").eq("direct_key", directKey).maybeSingle();
      room = retry.data;
      error = retry.error;
    } else {
      room = insertResult.data;
      created = true;
    }
  }
  if (error || !room) {
    return NextResponse.json({ message: "채팅방을 만들지 못했습니다." }, { status: 500 });
  }

  const { error: memberError } = await supabase
    .from("chat_room_members")
    .upsert(
      [auth.employee.id, target.id].map((employeeId) => ({ room_id: room.id, employee_id: employeeId })),
      { onConflict: "room_id,employee_id", ignoreDuplicates: true },
    );
  if (memberError) {
    if (created) await supabase.from("chat_rooms").delete().eq("id", room.id);
    return NextResponse.json({ message: "채팅 참여자를 등록하지 못했습니다." }, { status: 500 });
  }
  if (created) {
    await supabase.from("activity_logs").insert({
      employee_id: auth.employee.id,
      action_type: "chat.room.create",
      target_type: "chat_room",
      target_id: room.id,
      changed_data: { participant_id: target.id },
    });
  }
  return NextResponse.json({ roomId: room.id });
}

