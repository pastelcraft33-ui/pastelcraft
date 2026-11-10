import { NextResponse } from "next/server";

import { requireApiEmployee } from "@/lib/auth/api";
import { getChatUnreadCount } from "@/lib/chat/unread-count";

export async function GET() {
  const auth = await requireApiEmployee();
  if (auth.response) return auth.response;
  try {
    const result = await getChatUnreadCount(auth.employee.id);
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ message: "읽지 않은 메시지를 확인하지 못했습니다." }, { status: 500 });
  }
}

