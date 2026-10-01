import { NextResponse } from "next/server";

import {
  hasValidMutationOrigin,
  invalidOriginResponse,
  requireApiEmployee,
} from "@/lib/auth/api";
import { departmentCodesInSameGroup } from "@/lib/employees/constants";
import {
  canDeleteProductDesignTask,
  canUseProductDesignWorkspace,
} from "@/lib/product-design/permissions";
import { createProductDesignAssignmentNotification } from "@/lib/product-design/notifications";
import {
  PRODUCT_DESIGN_FILE_BUCKET,
  PRODUCT_DESIGN_IMAGE_BUCKET,
} from "@/lib/product-design/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { productDesignTransferSchema } from "@/schemas/product-design";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasValidMutationOrigin(request)) return invalidOriginResponse();

  const auth = await requireApiEmployee();
  if (auth.response) return auth.response;
  if (!canUseProductDesignWorkspace(auth.employee)) {
    return NextResponse.json({ message: "제품 디자인 작업에 접근할 수 없습니다." }, { status: 403 });
  }

  const input = await request.json().catch(() => null);
  const parsed = productDesignTransferSchema.safeParse(input);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "이관할 담당자를 확인해 주세요." },
      { status: 400 },
    );
  }

  const { id } = await params;
  const supabase = createAdminClient();
  const { data: task } = await supabase
    .from("product_design_tasks")
    .select("id, product_name, assigned_to, current_stage, workflow_status, note, workspace_type")
    .eq("id", id)
    .maybeSingle();
  if (!task) {
    return NextResponse.json({ message: "제품 디자인 작업을 찾을 수 없습니다." }, { status: 404 });
  }
  if (task.assigned_to !== auth.employee.id) {
    return NextResponse.json({ message: "현재 담당자인 작업만 이관할 수 있습니다." }, { status: 403 });
  }
  if (task.assigned_to === parsed.data.assigneeId) {
    return NextResponse.json({ message: "현재 담당자와 다른 직원을 선택해 주세요." }, { status: 400 });
  }

  const { data: employees, error: employeeError } = await supabase
    .from("employees")
    .select("id, name, department, account_status")
    .in("id", [task.assigned_to, parsed.data.assigneeId]);
  if (employeeError) {
    return NextResponse.json({ message: "담당자 정보를 확인하지 못했습니다." }, { status: 500 });
  }
  const previousAssignee = employees?.find((employee) => employee.id === task.assigned_to);
  const nextAssignee = employees?.find((employee) => employee.id === parsed.data.assigneeId);
  if (
    !nextAssignee ||
    nextAssignee.account_status !== "active" ||
    !departmentCodesInSameGroup(auth.employee.departmentCode).includes(
      nextAssignee.department as "web" | "web_design" | "web_marketing",
    )
  ) {
    return NextResponse.json({ message: "이관 가능한 웹팀 직원을 선택해 주세요." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("product_design_tasks")
    .update({ assigned_to: nextAssignee.id, updated_at: now })
    .eq("id", id)
    .eq("assigned_to", task.assigned_to);
  if (updateError) {
    return NextResponse.json({ message: "담당자를 이관하지 못했습니다." }, { status: 500 });
  }

  const changeSummary = `담당자 이관: ${previousAssignee?.name ?? "이전 담당자"} → ${nextAssignee.name}`;
  const { data: log, error: logError } = await supabase
    .from("product_design_work_logs")
    .insert({
      task_id: id,
      author_id: auth.employee.id,
      current_stage: task.current_stage?.trim() || "미입력",
      workflow_status: task.workflow_status,
      work_content: changeSummary,
      change_summary: changeSummary,
      note_snapshot: task.note,
      created_at: now,
    })
    .select("id")
    .single();
  if (logError || !log) {
    await supabase
      .from("product_design_tasks")
      .update({ assigned_to: task.assigned_to, updated_at: now })
      .eq("id", id);
    return NextResponse.json({ message: "이관 이력을 저장하지 못해 담당자 변경을 취소했습니다." }, { status: 500 });
  }

  await supabase.from("activity_logs").insert({
    employee_id: auth.employee.id,
    action_type: "product_design.task.transfer",
    target_type: "product_design_task",
    target_id: id,
    changed_data: {
      product_name: task.product_name,
      previous_assignee_id: task.assigned_to,
      previous_assignee_name: previousAssignee?.name ?? null,
      assignee_id: nextAssignee.id,
      assignee_name: nextAssignee.name,
      log_id: log.id,
    },
  });

  const { error: notificationError } = await createProductDesignAssignmentNotification({
    supabase,
    employeeId: nextAssignee.id,
    taskId: id,
    productName: task.product_name,
    assignedByName: auth.employee.name,
    assignmentKind: "transferred",
    workspaceType: task.workspace_type === "web_marketing"
      ? "web_marketing"
      : task.workspace_type === "web_design"
        ? "web_design"
        : "product_design",
  });
  if (notificationError) {
    console.error("제품 디자인 작업 이관 알림 저장 실패", notificationError);
  }

  return NextResponse.json({ ok: true, assigneeName: nextAssignee.name });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasValidMutationOrigin(request)) return invalidOriginResponse();

  const auth = await requireApiEmployee();
  if (auth.response) return auth.response;
  if (!canUseProductDesignWorkspace(auth.employee)) {
    return NextResponse.json({ message: "제품 디자인 작업에 접근할 수 없습니다." }, { status: 403 });
  }

  const { id } = await params;
  const supabase = createAdminClient();
  const { data: task } = await supabase
    .from("product_design_tasks")
    .select("id, product_name, assigned_to, representative_image_path, spreadsheet_path, workspace_type")
    .eq("id", id)
    .maybeSingle();
  if (!task) {
    return NextResponse.json({ message: "제품 디자인 작업을 찾을 수 없습니다." }, { status: 404 });
  }
  if (!canDeleteProductDesignTask(auth.employee, task.assigned_to)) {
    return NextResponse.json({ message: "담당자 또는 관리자만 작업을 삭제할 수 있습니다." }, { status: 403 });
  }

  let deleteQuery = supabase
    .from("product_design_tasks")
    .delete()
    .eq("id", id);
  if (auth.employee.role !== "admin") {
    deleteQuery = deleteQuery.eq("assigned_to", auth.employee.id);
  }
  const { error: deleteError } = await deleteQuery;
  if (deleteError) {
    return NextResponse.json({ message: "작업을 삭제하지 못했습니다." }, { status: 500 });
  }

  if (task.representative_image_path) {
    await supabase.storage
      .from(PRODUCT_DESIGN_IMAGE_BUCKET)
      .remove([task.representative_image_path]);
  }
  if (task.spreadsheet_path) {
    await supabase.storage
      .from(PRODUCT_DESIGN_FILE_BUCKET)
      .remove([task.spreadsheet_path]);
  }
  await supabase.from("activity_logs").insert({
    employee_id: auth.employee.id,
    action_type: "product_design.task.delete",
    target_type: "product_design_task",
    target_id: id,
    changed_data: {
      product_name: task.product_name,
      assigned_to: task.assigned_to,
    },
  });

  return NextResponse.json({ ok: true });
}
