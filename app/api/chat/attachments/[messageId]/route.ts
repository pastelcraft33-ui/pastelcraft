import { NextResponse } from "next/server";

import { requireApiEmployee } from "@/lib/auth/api";
import { CHAT_ATTACHMENT_BUCKET } from "@/lib/chat/files";
import { createAdminClient } from "@/lib/supabase/admin";
import { chatRoomIdSchema } from "@/schemas/chat";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ messageId: string }> },
) {
  const auth = await requireApiEmployee();
  if (auth.response) return auth.response;
  const { messageId } = await params;
  const parsed = chatRoomIdSchema.safeParse(messageId);
  if (!parsed.success) return NextResponse.json({ message: "첨부파일 정보를 확인해 주세요." }, { status: 400 });
  const supabase = createAdminClient();
  const { data: message } = await supabase
    .from("chat_messages")
    .select("room_id, attachment_path, attachment_name")
    .eq("id", parsed.data)
    .maybeSingle();
  if (!message?.attachment_path) return NextResponse.json({ message: "첨부파일을 찾을 수 없습니다." }, { status: 404 });
  const { data: membership } = await supabase
    .from("chat_room_members")
    .select("room_id")
    .eq("room_id", message.room_id)
    .eq("employee_id", auth.employee.id)
    .maybeSingle();
  if (!membership) return NextResponse.json({ message: "첨부파일을 받을 권한이 없습니다." }, { status: 403 });
  const inline = new URL(request.url).searchParams.get("inline") === "1";
  const { data, error } = await supabase.storage
    .from(CHAT_ATTACHMENT_BUCKET)
    .createSignedUrl(
      message.attachment_path,
      60 * 5,
      inline ? undefined : { download: message.attachment_name ?? true },
    );
  if (error || !data?.signedUrl) return NextResponse.json({ message: "첨부파일을 열지 못했습니다." }, { status: 500 });
  return NextResponse.redirect(data.signedUrl);
}
