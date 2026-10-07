import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

import { hasValidMutationOrigin, invalidOriginResponse } from "@/lib/auth/admin";
import { getCurrentEmployee, SESSION_CACHE_TAG } from "@/lib/auth/session";
import { EMPLOYEES_CACHE_TAG } from "@/lib/employees/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { employeeHireDateSchema } from "@/schemas/admin-employees";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasValidMutationOrigin(request)) return invalidOriginResponse();

  const employee = await getCurrentEmployee();
  if (!employee) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }
  const canEditHireDate =
    employee.role === "admin" ||
    employee.positionCode === "team_lead" ||
    employee.positionCode === "representative";
  if (!canEditHireDate) {
    return NextResponse.json({ message: "팀장 또는 대표자 권한이 필요합니다." }, { status: 403 });
  }

  const input = await request.json().catch(() => null);
  const parsed = employeeHireDateSchema.safeParse(input);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "입사일을 확인해 주세요." },
      { status: 400 },
    );
  }

  const { id } = await params;
  const supabase = createAdminClient();
  const { data: before, error: readError } = await supabase
    .from("employees")
    .select("id, name, hire_date")
    .eq("id", id)
    .maybeSingle();
  if (readError) {
    return NextResponse.json(
      {
        message: readError.code === "42703" || readError.code === "PGRST204"
          ? "입사일 컬럼 설정이 필요합니다. Supabase SQL Editor에서 202610070001_employee_hire_date.sql을 실행해 주세요."
          : "직원 정보를 확인하지 못했습니다.",
      },
      { status: 500 },
    );
  }
  if (!before) {
    return NextResponse.json({ message: "직원을 찾을 수 없습니다." }, { status: 404 });
  }

  const { error: updateError } = await supabase
    .from("employees")
    .update({ hire_date: parsed.data.hireDate })
    .eq("id", id);
  if (updateError) {
    return NextResponse.json({ message: "입사일을 저장하지 못했습니다." }, { status: 500 });
  }

  if (before.hire_date !== parsed.data.hireDate) {
    await supabase.from("activity_logs").insert({
      employee_id: employee.id,
      action_type: "admin.employee.hire_date.update",
      target_type: "employee",
      target_id: id,
      changed_data: {
        name: before.name,
        hire_date: { before: before.hire_date, after: parsed.data.hireDate },
      },
    });
  }

  revalidateTag(EMPLOYEES_CACHE_TAG, { expire: 0 });
  revalidateTag(SESSION_CACHE_TAG, { expire: 0 });
  return NextResponse.json({ ok: true, hireDate: parsed.data.hireDate });
}
