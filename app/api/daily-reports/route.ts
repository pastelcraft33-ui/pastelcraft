import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import {
  hasValidMutationOrigin,
  invalidOriginResponse,
  requireApiEmployee,
} from "@/lib/auth/api";
import {
  DAILY_REPORT_BUCKET,
  dailyReportImageExtension,
  hasValidDailyReportImageSignature,
  validateDailyReportImage,
} from "@/lib/daily-reports/files";
import { createAdminClient } from "@/lib/supabase/admin";
import { dailyReportDateSchema } from "@/schemas/daily-reports";

export async function POST(request: Request) {
  if (!hasValidMutationOrigin(request)) return invalidOriginResponse();
  const auth = await requireApiEmployee();
  if (auth.response) return auth.response;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { message: "업무일지 이미지를 읽을 수 없습니다." },
      { status: 400 },
    );
  }

  const dateResult = dailyReportDateSchema.safeParse(formData.get("reportDate"));
  if (!dateResult.success) {
    return NextResponse.json(
      { message: dateResult.error.issues[0]?.message },
      { status: 400 },
    );
  }
  if (dateResult.data > currentKoreanDate()) {
    return NextResponse.json(
      { message: "미래 날짜에는 일일업무일지를 등록할 수 없습니다." },
      { status: 400 },
    );
  }

  const imageValue = formData.get("image");
  const image = imageValue instanceof File && imageValue.size > 0 ? imageValue : null;
  if (!image) {
    return NextResponse.json(
      { message: "엑셀에서 복사한 이미지를 붙여넣어 주세요." },
      { status: 400 },
    );
  }
  const imageError = validateDailyReportImage(image);
  if (imageError) return NextResponse.json({ message: imageError }, { status: 400 });
  if (!(await hasValidDailyReportImageSignature(image))) {
    return NextResponse.json(
      { message: "파일 내용과 이미지 형식이 일치하지 않습니다." },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const { data: previous } = await supabase
    .from("daily_work_reports")
    .select("id, image_path")
    .eq("employee_id", auth.employee.id)
    .eq("report_date", dateResult.data)
    .maybeSingle();

  const extensionByMime: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  const extension = extensionByMime[image.type] ?? dailyReportImageExtension(image.name);
  const imagePath = `${auth.employee.id}/${dateResult.data}-${randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from(DAILY_REPORT_BUCKET)
    .upload(imagePath, image, {
      contentType: image.type,
      upsert: false,
    });
  if (uploadError) {
    return NextResponse.json(
      {
        message:
          uploadError.message.includes("Bucket not found")
            ? "일일업무일지 Storage 설정이 필요합니다."
            : "업무일지 이미지를 저장하지 못했습니다.",
      },
      { status: 500 },
    );
  }

  const { data: report, error: saveError } = await supabase
    .from("daily_work_reports")
    .upsert(
      {
        employee_id: auth.employee.id,
        report_date: dateResult.data,
        image_path: imagePath,
        mime_type: image.type,
        file_size_bytes: image.size,
      },
      { onConflict: "employee_id,report_date" },
    )
    .select("id, report_date, updated_at")
    .single();
  if (saveError) {
    await supabase.storage.from(DAILY_REPORT_BUCKET).remove([imagePath]);
    return NextResponse.json(
      {
        message:
          saveError.code === "PGRST205" || saveError.code === "42P01"
            ? "일일업무일지 데이터베이스 설정이 필요합니다."
            : "일일업무일지를 등록하지 못했습니다.",
      },
      { status: 500 },
    );
  }

  if (previous?.image_path && previous.image_path !== imagePath) {
    await supabase.storage.from(DAILY_REPORT_BUCKET).remove([previous.image_path]);
  }
  await supabase.from("activity_logs").insert({
    employee_id: auth.employee.id,
    action_type: previous ? "daily_report.update" : "daily_report.create",
    target_type: "daily_work_report",
    target_id: report.id,
    changed_data: { report_date: dateResult.data },
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
