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
    .delete()
    .eq("room_id", roomId.data)
    .eq("employee_id", auth.employee.id)
    .select("room_id")
    .maybeSingle();
  if (membershipError || !membership) {
    return NextResponse.json({ message: "채팅방 나가기 권한을 확인하지 못했습니다." }, { status: 403 });
  }

  const { data: remainingMembers, error: remainingError } = await supabase
    .from("chat_room_members")
    .select("employee_id")
    .eq("room_id", roomId.data);
  if (remainingError) {
    return NextResponse.json({ message: "채팅방을 정리하지 못했습니다." }, { status: 500 });
  }

  // 마지막 참여자까지 나간 대화는 기록과 비공개 첨부파일을 함께 정리합니다.
  if ((remainingMembers ?? []).length === 0) {
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
      return NextResponse.json({ message: "비어 있는 채팅방을 삭제하지 못했습니다." }, { status: 500 });
    }
    if (attachmentPaths.length) {
      await supabase.storage.from(CHAT_ATTACHMENT_BUCKET).remove(attachmentPaths);
    }
  }

  await supabase.from("activity_logs").insert({
    employee_id: auth.employee.id,
    action_type: "chat.room.leave",
    target_type: "chat_room",
    target_id: roomId.data,
    changed_data: { deleted_for_everyone: (remainingMembers ?? []).length === 0 },
  });

  return NextResponse.json({
    ok: true,
    deletedForEveryone: (remainingMembers ?? []).length === 0,
  });
}
