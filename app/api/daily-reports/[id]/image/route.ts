import { NextResponse } from "next/server";

import { requireApiEmployee } from "@/lib/auth/api";
import { DAILY_REPORT_BUCKET } from "@/lib/daily-reports/files";
import { canViewDepartment } from "@/lib/employees/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { dailyReportIdSchema } from "@/schemas/daily-reports";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiEmployee();
  if (auth.response) return auth.response;
  const { id: rawId } = await context.params;
  const idResult = dailyReportIdSchema.safeParse(rawId);
  if (!idResult.success) {
    return NextResponse.json({ message: "업무일지 정보를 확인해 주세요." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: report } = await supabase
    .from("daily_work_reports")
    .select("employee_id, image_path")
    .eq("id", idResult.data)
    .maybeSingle();
  if (!report?.image_path) {
    return NextResponse.json({ message: "이미지로 등록된 업무일지가 아닙니다." }, { status: 404 });
  }
  const { data: owner } = await supabase
    .from("employees")
    .select("department")
    .eq("id", report.employee_id)
    .maybeSingle();
  if (!owner || !canViewDepartment(auth.employee, owner.department)) {
    return NextResponse.json({ message: "업무일지를 볼 권한이 없습니다." }, { status: 403 });
  }

  const { data, error } = await supabase.storage
    .from(DAILY_REPORT_BUCKET)
    .createSignedUrl(report.image_path, 60 * 10);
  if (error || !data?.signedUrl) {
    return NextResponse.json({ message: "업무일지 이미지를 열지 못했습니다." }, { status: 500 });
  }
  return NextResponse.redirect(data.signedUrl);
}
