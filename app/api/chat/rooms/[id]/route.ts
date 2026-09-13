import { NextResponse } from "next/server";

import { hasValidMutationOrigin, invalidOriginResponse, requireApiEmployee } from "@/lib/auth/api";
import { CHAT_ATTACHMENT_BUCKET } from "@/lib/chat/files";
import { createAdminClient } from "@/lib/supabase/admin";
import { chatRoomIdSchema } from "@/schemas/chat";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasValidMutationOrigin(request)) return invalidOriginResponse();
  const auth = await requireApiEmployee();
  if (auth.response) return auth.response;

  const { id } = await params;
  const roomId = chatRoomIdSchema.safeParse(id);
  if (!roomId.success) {
    return NextResponse.json({ message: "채팅방 정보를 확인해 주세요." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: membership, error: membershipError } = await supabase
    .from("chat_room_members")
    .select("room_id")
    .eq("room_id", roomId.data)
    .eq("employee_id", auth.employee.id)
    .maybeSingle();
  if (membershipError || !membership) {
    return NextResponse.json({ message: "채팅방 나가기 권한을 확인하지 못했습니다." }, { status: 403 });
  }

  // 1:1 대화는 나갈 때 기록까지 정리합니다. 같은 직원을 다시 선택하면
  // direct_key가 없는 새 방이 생성되어 과거 메시지가 이어지지 않습니다.
  const { data: attachments } = await supabase
    .from("chat_messages")
    .select("attachment_path")
    .eq("room_id", roomId.data)
    .not("attachment_path", "is", null);
  const attachmentPaths = (attachments ?? [])
    .map((message) => message.attachment_path)
    .filter((path): path is string => Boolean(path));
  const { error: roomDeleteError } = await supabase
    .from("chat_rooms")
    .delete()
    .eq("id", roomId.data);
  if (roomDeleteError) {
    return NextResponse.json({ message: "채팅방을 삭제하지 못했습니다." }, { status: 500 });
  }
  if (attachmentPaths.length) {
    await supabase.storage.from(CHAT_ATTACHMENT_BUCKET).remove(attachmentPaths);
  }

  await supabase.from("activity_logs").insert({
    employee_id: auth.employee.id,
    action_type: "chat.room.leave",
    target_type: "chat_room",
    target_id: roomId.data,
    changed_data: { deleted_for_everyone: true },
  });

  return NextResponse.json({
    ok: true,
    deletedForEveryone: true,
  });
}
