import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

import {
  hasValidMutationOrigin,
  invalidOriginResponse,
  requireApiAdmin,
} from "@/lib/auth/admin";
import { SESSION_CACHE_TAG } from "@/lib/auth/session";
import { EMPLOYEES_CACHE_TAG } from "@/lib/employees/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { employeeStatusActionSchema } from "@/schemas/admin-employees";

const statusByAction = {
  approve: "active",
  reject: "rejected",
  suspend: "suspended",
  activate: "active",
} as const;

const actionLabels = {
  approve: "admin.employee.approve",
  reject: "admin.employee.reject",
  suspend: "admin.employee.suspend",
  activate: "admin.employee.activate",
} as const;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasValidMutationOrigin(request)) return invalidOriginResponse();

  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  const { id } = await params;
  const input = await request.json().catch(() => null);
  const parsed = employeeStatusActionSchema.safeParse(input);

  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "처리 내용을 확인해 주세요." },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const { data: target } = await supabase
    .from("employees")
    .select("id, login_id, name, account_status, role, department, position")
    .eq("id", id)
    .maybeSingle();

  if (!target) {
    return NextResponse.json(
      { message: "직원 계정을 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  if (
    target.login_id === "pastelcraft" &&
    (parsed.data.action === "suspend" || parsed.data.action === "reject")
  ) {
    return NextResponse.json(
      { message: "대표 계정은 사용 중지하거나 반려할 수 없습니다." },
      { status: 400 },
    );
  }

  if (
    id === auth.employee.id &&
    (parsed.data.action === "suspend" || parsed.data.action === "reject")
  ) {
    return NextResponse.json(
      { message: "현재 로그인한 관리자 계정은 중지하거나 반려할 수 없습니다." },
      { status: 400 },
    );
  }

  if (!isAllowedTransition(target.account_status, parsed.data.action)) {
    return NextResponse.json(
      { message: "현재 계정 상태에서는 해당 작업을 수행할 수 없습니다." },
      { status: 409 },
    );
  }

  const nextStatus = statusByAction[parsed.data.action];
  const isNamdaemunTeamLead =
    target.department === "namdaemun" && target.position === "team_lead";
  const updates = {
    account_status: nextStatus,
    ...(parsed.data.action === "approve" && isNamdaemunTeamLead
      ? { role: "admin" as const }
      : {}),
  };
  const { error } = await supabase
    .from("employees")
    .update(updates)
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      { message: "계정 상태를 변경하지 못했습니다." },
      { status: 500 },
    );
  }

  if (nextStatus !== "active") {
    await supabase.from("sessions").delete().eq("employee_id", id);
  }

  await supabase.from("activity_logs").insert({
    employee_id: auth.employee.id,
    action_type: actionLabels[parsed.data.action],
    target_type: "employee",
    target_id: id,
    changed_data: {
      account_status: { before: target.account_status, after: nextStatus },
      ...(updates.role ? { role: { before: target.role, after: "admin" } } : {}),
      reason: parsed.data.reason || null,
    },
  });
  revalidateTag(EMPLOYEES_CACHE_TAG, { expire: 0 });
  revalidateTag(SESSION_CACHE_TAG, { expire: 0 });

  return NextResponse.json({ ok: true });
}

function isAllowedTransition(current: string, action: keyof typeof statusByAction) {
  if (action === "approve") return current === "pending" || current === "rejected";
  if (action === "reject") return current === "pending";
  if (action === "suspend") return current === "active";
  if (action === "activate") return current === "suspended";
  return false;
}
