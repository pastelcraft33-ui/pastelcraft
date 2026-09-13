import { NextResponse } from "next/server";

import { requireApiEmployee } from "@/lib/auth/api";
import { isMissingChatSchema } from "@/lib/chat/data";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const auth = await requireApiEmployee();
  if (auth.response) return auth.response;
  const supabase = createAdminClient();
  const membershipResult = await supabase
    .from("chat_room_members")
    .select("room_id, last_read_at")
    .eq("employee_id", auth.employee.id);
  if (isMissingChatSchema(membershipResult.error)) return NextResponse.json({ count: 0, schemaAvailable: false });
  if (membershipResult.error) return NextResponse.json({ message: "읽지 않은 메시지를 확인하지 못했습니다." }, { status: 500 });
  const memberships = membershipResult.data ?? [];
  if (!memberships.length) return NextResponse.json({ count: 0, schemaAvailable: true });
  const roomIds = memberships.map((membership) => membership.room_id);
  const oldestRead = memberships.reduce(
    (oldest, membership) => membership.last_read_at < oldest ? membership.last_read_at : oldest,
    new Date().toISOString(),
  );
  const { data: messages, error } = await supabase
    .from("chat_messages")
    .select("room_id, sender_id, created_at")
    .in("room_id", roomIds)
    .gt("created_at", oldestRead)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) return NextResponse.json({ message: "읽지 않은 메시지를 확인하지 못했습니다." }, { status: 500 });
  const readByRoom = new Map(memberships.map((membership) => [membership.room_id, membership.last_read_at]));
  const count = (messages ?? []).filter(
    (message) => message.sender_id !== auth.employee.id && message.created_at > (readByRoom.get(message.room_id) ?? oldestRead),
  ).length;
  return NextResponse.json({ count, schemaAvailable: true }, { headers: { "Cache-Control": "private, no-store" } });
}

