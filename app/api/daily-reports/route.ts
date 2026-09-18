import { NextResponse } from "next/server";

import {
  hasValidMutationOrigin,
  invalidOriginResponse,
  requireApiEmployee,
} from "@/lib/auth/api";
import { DAILY_REPORT_BUCKET } from "@/lib/daily-reports/files";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  dailyReportDateSchema,
  dailyReportInputSchema,
  dailyReportWorkItemSchema,
} from "@/schemas/daily-reports";

export async function GET(request: Request) {
  const auth = await requireApiEmployee();
  if (auth.response) return auth.response;

  const beforeResult = dailyReportDateSchema.safeParse(
    new URL(request.url).searchParams.get("before"),
  );
  if (!beforeResult.success) {
    return NextResponse.json(
      { message: "이전 업무를 불러올 기준 날짜를 확인해 주세요." },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("daily_work_reports")
    .select("report_date, work_items")
    .eq("employee_id", auth.employee.id)
    .lt("report_date", beforeResult.data)
    .order("report_date", { ascending: false })
    .limit(50);
  if (error) {
    return NextResponse.json(
      {
        message:
          error.code === "PGRST204"
            ? "구조화 업무일지 SQL을 먼저 적용해 주세요."
            : "이전 업무를 불러오지 못했습니다.",
      },
      { status: 500 },
    );
  }

  for (const report of data ?? []) {
    const workItems = dailyReportWorkItemSchema.array().safeParse(report.work_items);
    if (workItems.success && workItems.data.length > 0) {
      return NextResponse.json({
        reportDate: report.report_date,
        workItems: workItems.data,
      });
    }
  }

  return NextResponse.json(
    { message: "불러올 이전 업무일지가 없습니다." },
    { status: 404 },
  );
}

export async function POST(request: Request) {
  if (!hasValidMutationOrigin(request)) return invalidOriginResponse();
  const auth = await requireApiEmployee();
  if (auth.response) return auth.response;

  const parsed = dailyReportInputSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "업무일지 내용을 확인해 주세요." },
      { status: 400 },
    );
  }
  if (parsed.data.reportDate > currentKoreanDate()) {
    return NextResponse.json(
      { message: "미래 날짜에는 일일업무일지를 등록할 수 없습니다." },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const { data: previous } = await supabase
    .from("daily_work_reports")
    .select("id, image_path")
    .eq("employee_id", auth.employee.id)
    .eq("report_date", parsed.data.reportDate)
    .maybeSingle();

  const { data: report, error: saveError } = await supabase
    .from("daily_work_reports")
    .upsert(
      {
        employee_id: auth.employee.id,
        report_date: parsed.data.reportDate,
        work_items: parsed.data.workItems,
        image_path: null,
        mime_type: null,
        file_size_bytes: null,
      },
      { onConflict: "employee_id,report_date" },
    )
    .select("id, report_date, work_items, updated_at")
    .single();
  if (saveError) {
    return NextResponse.json(
      {
        message:
          saveError.code === "PGRST204"
            ? "구조화 업무일지 SQL을 먼저 적용해 주세요."
            : saveError.code === "PGRST205" || saveError.code === "42P01"
              ? "일일업무일지 데이터베이스 설정이 필요합니다."
              : "일일업무일지를 등록하지 못했습니다.",
      },
      { status: 500 },
    );
  }

  if (previous?.image_path) {
    await supabase.storage.from(DAILY_REPORT_BUCKET).remove([previous.image_path]);
  }
  await supabase.from("activity_logs").insert({
    employee_id: auth.employee.id,
    action_type: previous ? "daily_report.update" : "daily_report.create",
    target_type: "daily_work_report",
    target_id: report.id,
    changed_data: {
      report_date: parsed.data.reportDate,
      item_count: parsed.data.workItems.length,
    },
  });

  return NextResponse.json({
    report: {
      id: report.id,
      employeeId: auth.employee.id,
      employeeName: auth.employee.name,
      employeePosition: auth.employee.position,
      department: auth.employee.department,
      reportDate: report.report_date,
      updatedAt: report.updated_at,
      workItems: parsed.data.workItems,
      hasLegacyImage: false,
      canDelete: true,
    },
  });
}

function currentKoreanDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
