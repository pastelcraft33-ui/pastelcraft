import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

import {
  hasValidMutationOrigin,
  invalidOriginResponse,
  requireApiAdmin,
} from "@/lib/auth/admin";
import { SESSION_CACHE_TAG } from "@/lib/auth/session";
import { CHAT_ATTACHMENT_BUCKET } from "@/lib/chat/files";
import { DAILY_REPORT_BUCKET } from "@/lib/daily-reports/files";
import { EMPLOYEES_CACHE_TAG } from "@/lib/employees/data";
import { LEAVE_ATTACHMENT_BUCKET } from "@/lib/leave/storage";
import { PRODUCT_DESIGN_IMAGE_BUCKET } from "@/lib/product-design/storage";
import { getProfileImagePath } from "@/lib/storage/profile-image";
import { createAdminClient } from "@/lib/supabase/admin";
import { TASK_ATTACHMENT_BUCKET } from "@/lib/tasks/storage";
import {
  adminDeleteEmployeeSchema,
  adminUpdateEmployeeSchema,
} from "@/schemas/admin-employees";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasValidMutationOrigin(request)) return invalidOriginResponse();

  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  const { id } = await params;
  const input = await request.json().catch(() => null);
  const parsed = adminUpdateEmployeeSchema.safeParse(input);

  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "직원 정보를 확인해 주세요." },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const { data: before } = await supabase
    .from("employees")
    .select("id, login_id, name, position, department, phone, role, account_status")
    .eq("id", id)
    .maybeSingle();

  if (!before) {
    return NextResponse.json(
      { message: "직원 계정을 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  if (id === auth.employee.id && parsed.data.role !== "admin") {
    return NextResponse.json(
      { message: "현재 로그인한 계정의 관리자 권한은 해제할 수 없습니다." },
      { status: 400 },
    );
  }

  if (
    before.login_id === "pastelcraft" &&
    (parsed.data.role !== "admin" || parsed.data.position !== "representative")
  ) {
    return NextResponse.json(
      { message: "대표 계정의 직급과 관리자 권한은 해제할 수 없습니다." },
      { status: 400 },
    );
  }

  const updates = {
    name: parsed.data.name,
    position: parsed.data.position,
    department: parsed.data.department,
    phone: parsed.data.phone,
    role: parsed.data.role,
  };
  const { error } = await supabase.from("employees").update(updates).eq("id", id);

  if (error) {
    const isMissingDepartmentValue =
      error.code === "22P02" &&
      error.message.includes("employee_department");

    return NextResponse.json(
      {
        message: isMissingDepartmentValue
          ? "새 부서를 사용하려면 Supabase SQL을 먼저 적용해 주세요."
          : "직원 정보를 수정하지 못했습니다.",
      },
      { status: 500 },
    );
  }

  const changedData = Object.fromEntries(
    Object.entries(updates)
      .filter(([key, value]) => before[key as keyof typeof before] !== value)
      .map(([key, value]) => [
        key,
        { before: before[key as keyof typeof before], after: value },
      ]),
  );

  await supabase.from("activity_logs").insert({
    employee_id: auth.employee.id,
    action_type: "admin.employee.update",
    target_type: "employee",
    target_id: id,
    changed_data: changedData,
  });
  revalidateTag(EMPLOYEES_CACHE_TAG, { expire: 0 });
  revalidateTag(SESSION_CACHE_TAG, { expire: 0 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasValidMutationOrigin(request)) return invalidOriginResponse();

  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  const { id } = await params;
  const input = await request.json().catch(() => null);
  const parsed = adminDeleteEmployeeSchema.safeParse(input);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "삭제 확인 정보를 확인해 주세요." },
      { status: 400 },
    );
  }

  if (id === auth.employee.id) {
    return NextResponse.json(
      { message: "현재 로그인한 관리자 계정은 삭제할 수 없습니다." },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const { data: target } = await supabase
    .from("employees")
    .select("id, login_id, name, account_status, profile_image_url")
    .eq("id", id)
    .maybeSingle();
  if (!target) {
    return NextResponse.json(
      { message: "직원 계정을 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  if (target.login_id === "pastelcraft") {
    return NextResponse.json(
      { message: "대표 계정은 삭제할 수 없습니다." },
      { status: 400 },
    );
  }

  if (parsed.data.confirmationName !== target.name) {
    return NextResponse.json(
      { message: "삭제 확인 이름이 일치하지 않습니다." },
      { status: 400 },
    );
  }

  const storageFiles = await collectEmployeeStorageFiles(supabase, target.id);
  const { error: deleteError } = await supabase.rpc("hard_delete_employee", {
    target_employee_id: target.id,
    actor_employee_id: auth.employee.id,
  });

  if (deleteError) {
    console.error("직원 영구 삭제 실패", {
      employeeId: target.id,
      code: deleteError.code,
      message: deleteError.message,
      details: deleteError.details,
      hint: deleteError.hint,
    });
    return NextResponse.json(
      {
        message:
          deleteError.code === "PGRST202" || deleteError.code === "42883"
            ? "직원 영구 삭제 SQL을 먼저 적용해 주세요."
            : "직원을 데이터베이스에서 삭제하지 못했습니다.",
      },
      { status: 500 },
    );
  }

  const profileImagePath = getProfileImagePath(target.profile_image_url);
  if (profileImagePath) storageFiles["profile-images"].add(profileImagePath);
  await Promise.all(
    Object.entries(storageFiles).map(async ([bucket, paths]) => {
      if (paths.size > 0) await supabase.storage.from(bucket).remove([...paths]);
    }),
  );

  revalidateTag(EMPLOYEES_CACHE_TAG, { expire: 0 });
  revalidateTag(SESSION_CACHE_TAG, { expire: 0 });

  return NextResponse.json({ ok: true, message: "직원을 영구 삭제했습니다." });
}

async function collectEmployeeStorageFiles(
  supabase: ReturnType<typeof createAdminClient>,
  employeeId: string,
) {
  const [ownedTasks, uploadedAttachments, leaves, dailyReports, roomMemberships, productTasks] =
    await Promise.all([
      supabase.from("tasks").select("id").eq("owner_id", employeeId),
      supabase.from("task_attachments").select("file_url").eq("uploaded_by", employeeId),
      supabase.from("leave_requests").select("attachment_url").eq("employee_id", employeeId),
      supabase.from("daily_work_reports").select("image_path").eq("employee_id", employeeId),
      supabase.from("chat_room_members").select("room_id").eq("employee_id", employeeId),
      supabase.from("product_design_tasks").select("representative_image_path").eq("assigned_to", employeeId),
    ]);

  const taskIds = (ownedTasks.data ?? []).map((task) => task.id);
  const roomIds = (roomMemberships.data ?? []).map((member) => member.room_id);
  const [ownedTaskAttachments, chatAttachments] = await Promise.all([
    taskIds.length
      ? supabase.from("task_attachments").select("file_url").in("task_id", taskIds)
      : Promise.resolve({ data: [] as { file_url: string }[] }),
    roomIds.length
      ? supabase.from("chat_messages").select("attachment_path").in("room_id", roomIds)
      : Promise.resolve({ data: [] as { attachment_path: string | null }[] }),
  ]);

  return {
    "profile-images": new Set<string>(),
    [TASK_ATTACHMENT_BUCKET]: new Set(
      [...(uploadedAttachments.data ?? []), ...(ownedTaskAttachments.data ?? [])]
        .map((file) => file.file_url)
        .filter(Boolean),
    ),
    [LEAVE_ATTACHMENT_BUCKET]: new Set(
      (leaves.data ?? []).map((leave) => leave.attachment_url).filter(Boolean) as string[],
    ),
    [DAILY_REPORT_BUCKET]: new Set(
      (dailyReports.data ?? []).map((report) => report.image_path).filter(Boolean) as string[],
    ),
    [CHAT_ATTACHMENT_BUCKET]: new Set(
      (chatAttachments.data ?? []).map((message) => message.attachment_path).filter(Boolean) as string[],
    ),
    [PRODUCT_DESIGN_IMAGE_BUCKET]: new Set(
      (productTasks.data ?? []).map((task) => task.representative_image_path).filter(Boolean) as string[],
    ),
  };
}
