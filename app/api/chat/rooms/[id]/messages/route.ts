import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { hasValidMutationOrigin, invalidOriginResponse, requireApiEmployee } from "@/lib/auth/api";
import { broadcastChatMessage } from "@/lib/chat/realtime";
import { CHAT_ATTACHMENT_BUCKET, chatFileExtension, hasValidChatAttachmentSignature, validateChatAttachment } from "@/lib/chat/files";
import { createAdminClient } from "@/lib/supabase/admin";
import { chatMessageContentSchema, chatRoomIdSchema } from "@/schemas/chat";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasValidMutationOrigin(request)) return invalidOriginResponse();
  const auth = await requireApiEmployee();
  if (auth.response) return auth.response;
  const { id: rawId } = await params;
  const roomId = chatRoomIdSchema.safeParse(rawId);
  if (!roomId.success) return NextResponse.json({ message: "채팅방 정보를 확인해 주세요." }, { status: 400 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ message: "메시지를 읽을 수 없습니다." }, { status: 400 });
  }
  const contentResult = chatMessageContentSchema.safeParse(formData.get("content") ?? "");
  if (!contentResult.success) {
    return NextResponse.json({ message: contentResult.error.issues[0]?.message }, { status: 400 });
  }
  const fileValue = formData.get("attachment");
  const attachment = fileValue instanceof File && fileValue.size > 0 ? fileValue : null;
  const fileError = validateChatAttachment(attachment);
  if (fileError) return NextResponse.json({ message: fileError }, { status: 400 });
  if (attachment && !(await hasValidChatAttachmentSignature(attachment))) {
    return NextResponse.json({ message: "첨부파일의 확장자와 실제 파일 형식이 일치하지 않습니다." }, { status: 400 });
  }
  if (!contentResult.data && !attachment) {
    return NextResponse.json({ message: "메시지나 첨부파일을 입력해 주세요." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: membership } = await supabase
    .from("chat_room_members")
    .select("room_id")
    .eq("room_id", roomId.data)
    .eq("employee_id", auth.employee.id)
    .maybeSingle();
  if (!membership) return NextResponse.json({ message: "이 채팅방에 참여할 권한이 없습니다." }, { status: 403 });

  let attachmentPath: string | null = null;
  if (attachment) {
    attachmentPath = `${roomId.data}/${randomUUID()}.${chatFileExtension(attachment.name)}`;
    const { error: uploadError } = await supabase.storage
      .from(CHAT_ATTACHMENT_BUCKET)
      .upload(attachmentPath, attachment, { contentType: attachment.type, upsert: false });
    if (uploadError) {
      return NextResponse.json(
        { message: uploadError.message.includes("Bucket not found") ? "메신저 첨부파일 Storage 설정이 필요합니다." : "첨부파일을 저장하지 못했습니다." },
        { status: 500 },
      );
    }
  }

  const createdAt = new Date().toISOString();
  const { data: message, error: insertError } = await supabase
    .from("chat_messages")
    .insert({
      room_id: roomId.data,
      sender_id: auth.employee.id,
      content: contentResult.data || null,
      attachment_path: attachmentPath,
      attachment_name: attachment?.name ?? null,
      attachment_mime_type: attachment?.type ?? null,
      attachment_size_bytes: attachment?.size ?? null,
      created_at: createdAt,
    })
    .select("id, created_at")
    .single();
  if (insertError || !message) {
    if (attachmentPath) await supabase.storage.from(CHAT_ATTACHMENT_BUCKET).remove([attachmentPath]);
    return NextResponse.json({ message: "메시지를 전송하지 못했습니다." }, { status: 500 });
  }

  await Promise.all([
    supabase.from("chat_rooms").update({ last_message_at: message.created_at }).eq("id", roomId.data),
    supabase.from("chat_room_members").update({ last_read_at: message.created_at }).eq("room_id", roomId.data).eq("employee_id", auth.employee.id),
  ]);
  const { data: members } = await supabase
    .from("chat_room_members")
    .select("employee_id")
    .eq("room_id", roomId.data)
    .neq("employee_id", auth.employee.id);
  await broadcastChatMessage(
    (members ?? []).map((member) => member.employee_id),
    {
      roomId: roomId.data,
      senderName: auth.employee.name,
      preview: contentResult.data || attachment?.name || "새 첨부파일",
      createdAt: message.created_at,
    },
  );

  return NextResponse.json({
    messageId: message.id,
    createdAt: message.created_at,
    attachmentName: attachment?.name ?? null,
    attachmentMimeType: attachment?.type ?? null,
    attachmentSizeBytes: attachment?.size ?? null,
  });
}
