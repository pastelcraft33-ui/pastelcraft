import { NextResponse } from "next/server";

import { hasValidMutationOrigin, invalidOriginResponse, requireApiAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { storageDeleteSchema } from "@/schemas/admin-settings";

export async function DELETE(request: Request) {
  if (!hasValidMutationOrigin(request)) return invalidOriginResponse();
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;
  const parsed = storageDeleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "파일 정보를 확인해 주세요." }, { status: 400 });
  const supabase = createAdminClient();

  const referenceQuery = parsed.data.bucket === "profile-images"
    ? supabase.from("employees").select("id", { count: "exact", head: true }).eq("profile_image_url", parsed.data.path)
    : parsed.data.bucket === "task-attachments"
      ? supabase.from("task_attachments").select("id", { count: "exact", head: true }).eq("file_url", parsed.data.path)
      : parsed.data.bucket === "leave-attachments"
        ? supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("attachment_url", parsed.data.path)
        : parsed.data.bucket === "daily-work-reports"
          ? supabase.from("daily_work_reports").select("id", { count: "exact", head: true }).eq("image_path", parsed.data.path)
          : supabase.from("chat_messages").select("id", { count: "exact", head: true }).eq("attachment_path", parsed.data.path);
  const { count, error: referenceError } = await referenceQuery;
  if (referenceError) return NextResponse.json({ message: "파일 참조 상태를 확인하지 못했습니다." }, { status: 500 });
  if ((count ?? 0) > 0) return NextResponse.json({ message: "업무·휴가·프로필·일일업무일지·메신저에서 사용 중인 파일은 삭제할 수 없습니다." }, { status: 409 });

  const { error } = await supabase.storage.from(parsed.data.bucket).remove([parsed.data.path]);
  if (error) return NextResponse.json({ message: "Storage 파일을 삭제하지 못했습니다." }, { status: 500 });
  await supabase.from("activity_logs").insert({ employee_id: auth.employee.id, action_type: "admin.storage.delete", target_type: "storage_object", target_id: null, changed_data: parsed.data });
  return NextResponse.json({ ok: true });
}
