import { NextResponse } from "next/server";

import {
  hasValidMutationOrigin,
  invalidOriginResponse,
  requireApiEmployee,
} from "@/lib/auth/api";
import { DAILY_REPORT_BUCKET } from "@/lib/daily-reports/files";
import { createAdminClient } from "@/lib/supabase/admin";
import { dailyReportIdSchema } from "@/schemas/daily-reports";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!hasValidMutationOrigin(request)) return invalidOriginResponse();
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
    .select("id, employee_id, image_path, report_date")
    .eq("id", idResult.data)
    .maybeSingle();
  if (!report) {
    return NextResponse.json({ message: "업무일지를 찾을 수 없습니다." }, { status: 404 });
  }
  if (auth.employee.role !== "admin" && report.employee_id !== auth.employee.id) {
    return NextResponse.json({ message: "업무일지를 삭제할 권한이 없습니다." }, { status: 403 });
  }

  const { error: deleteError } = await supabase
    .from("daily_work_reports")
    .delete()
    .eq("id", report.id);
  if (deleteError) {
    return NextResponse.json({ message: "업무일지를 삭제하지 못했습니다." }, { status: 500 });
  }
  if (report.image_path) {
    await supabase.storage.from(DAILY_REPORT_BUCKET).remove([report.image_path]);
  }
  await supabase.from("activity_logs").insert({
    employee_id: auth.employee.id,
    action_type: "daily_report.delete",
    target_type: "daily_work_report",
    target_id: report.id,
    changed_data: { report_date: report.report_date, employee_id: report.employee_id },
  });
  return NextResponse.json({ ok: true });
}
