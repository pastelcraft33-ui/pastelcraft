import { NextResponse } from "next/server";

import { hasValidMutationOrigin, invalidOriginResponse, requireApiEmployee } from "@/lib/auth/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { chatRoomIdSchema } from "@/schemas/chat";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasValidMutationOrigin(request)) return invalidOriginResponse();
  const auth = await requireApiEmployee();
  if (auth.response) return auth.response;
  const { id } = await params;
  const parsed = chatRoomIdSchema.safeParse(id);
  if (!parsed.success) return NextResponse.json({ message: "채팅방 정보를 확인해 주세요." }, { status: 400 });
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("chat_room_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("room_id", parsed.data)
    .eq("employee_id", auth.employee.id)
    .select("room_id")
    .maybeSingle();
  if (error || !data) return NextResponse.json({ message: "읽음 상태를 저장하지 못했습니다." }, { status: 403 });
  return NextResponse.json({ ok: true });
}

