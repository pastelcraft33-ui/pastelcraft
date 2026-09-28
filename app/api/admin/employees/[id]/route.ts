import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

import {
  hasValidMutationOrigin,
  invalidOriginResponse,
  requireApiAdmin,
} from "@/lib/auth/admin";
import { hashPassword } from "@/lib/auth/password";
import { SESSION_CACHE_TAG } from "@/lib/auth/session";
import { getServerEnv } from "@/lib/env";
import { EMPLOYEES_CACHE_TAG } from "@/lib/employees/data";
import { createAdminClient } from "@/lib/supabase/admin";
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
    .select("id, login_id, name, account_status")
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

  if (target.login_id.startsWith("deleted-")) {
    return NextResponse.json(
      { message: "이미 삭제 처리된 직원입니다." },
      { status: 409 },
    );
  }

  if (parsed.data.confirmationName !== target.name) {
    return NextResponse.json(
      { message: "삭제 확인 이름이 일치하지 않습니다." },
      { status: 400 },
    );
  }

  const deletedLoginId = `deleted-${target.id.replaceAll("-", "").slice(0, 24)}`;
  const replacementPasswordHash = await hashPassword(
    crypto.randomUUID(),
    getServerEnv().PASSWORD_PEPPER,
  );
  const deletionUpdates = {
    login_id: deletedLoginId,
    password_hash: replacementPasswordHash,
    name: "삭제된 직원",
    phone: "010-0000-0000",
    profile_image_url: null,
    role: "employee" as const,
    failed_login_count: 0,
    locked_until: null,
    security_question: null,
    security_answer_hash: null,
  };
  const { error: updateError } = await supabase
    .from("employees")
    .update(deletionUpdates)
    .eq("id", target.id);

  if (updateError) {
    console.error("직원 삭제 처리 업데이트 실패", {
      employeeId: target.id,
      code: updateError.code,
      message: updateError.message,
      details: updateError.details,
      hint: updateError.hint,
    });
    return NextResponse.json(
      { message: "직원 삭제 처리를 완료하지 못했습니다." },
      { status: 500 },
    );
  }

  const { error: sessionError } = await supabase
    .from("sessions")
    .delete()
    .eq("employee_id", target.id);
  if (sessionError) {
    return NextResponse.json(
      { message: "삭제 처리는 됐지만 기존 로그인 종료에 실패했습니다. 다시 시도해 주세요." },
      { status: 500 },
    );
  }

  const { error: logError } = await supabase.from("activity_logs").insert({
    employee_id: auth.employee.id,
    action_type: "admin.employee.delete",
    target_type: "employee",
    target_id: target.id,
    changed_data: {
      name: target.name,
      login_id: target.login_id,
      previous_account_status: target.account_status,
      account_deleted: true,
      credentials_revoked: true,
    },
  });
  if (logError) {
    return NextResponse.json(
      { message: "삭제 처리는 됐지만 활동 기록 저장에 실패했습니다." },
      { status: 500 },
    );
  }

  revalidateTag(EMPLOYEES_CACHE_TAG, { expire: 0 });
  revalidateTag(SESSION_CACHE_TAG, { expire: 0 });

  return NextResponse.json({ ok: true, message: "직원을 삭제 처리했습니다." });
}
