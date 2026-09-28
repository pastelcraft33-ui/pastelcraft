import { NextResponse } from "next/server";

import { requireApiEmployee } from "@/lib/auth/api";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireApiEmployee();
  if (auth.response) return auth.response;

  const { count, error } = await createAdminClient()
    .from("employee_notifications")
    .select("id", { count: "exact", head: true })
    .eq("employee_id", auth.employee.id)
    .eq("notification_type", "product_design_assignment")
    .is("read_at", null);
  if (error) {
    if (error.code === "PGRST205" || error.code === "42P01") {
      return NextResponse.json({ count: 0 });
    }
    return NextResponse.json(
      { message: "미확인 알림 수를 불러오지 못했습니다." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { count: count ?? 0 },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
