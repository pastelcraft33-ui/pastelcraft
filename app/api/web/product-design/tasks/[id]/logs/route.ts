import { NextResponse } from "next/server";

import {
  hasValidMutationOrigin,
  invalidOriginResponse,
  requireApiEmployee,
} from "@/lib/auth/api";
import { canUseProductDesignWorkspace } from "@/lib/product-design/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { productDesignLogSchema } from "@/schemas/product-design";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasValidMutationOrigin(request)) return invalidOriginResponse();

  const auth = await requireApiEmployee();
  if (auth.response) return auth.response;
  if (!canUseProductDesignWorkspace(auth.employee)) {
    return NextResponse.json(
      { message: "웹팀 직원만 제품 디자인 작업 기록을 작성할 수 있습니다." },
      { status: 403 },
    );
  }

  const input = await request.json().catch(() => null);
  const parsed = productDesignLogSchema.safeParse(input);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "작업 기록을 확인해 주세요." },
      { status: 400 },
    );
  }

  const { id } = await params;
  const supabase = createAdminClient();
  const { data: task } = await supabase
    .from("product_design_tasks")
    .select("id, assigned_to, current_stage, workflow_status, note, completed_at, workspace_type")
    .eq("id", id)
    .maybeSingle();
  if (!task) {
    return NextResponse.json(
      { message: "제품 디자인 작업을 찾을 수 없습니다." },
      { status: 404 },
    );
  }
  if (task.assigned_to !== auth.employee.id) {
    return NextResponse.json(
      { message: "현재 담당자인 작업만 기록할 수 있습니다." },
      { status: 403 },
    );
  }
  if (
    task.workspace_type !== "product_design" &&
    !(task.workspace_type === "web_education"
      ? ["planned", "in_progress", "revising", "completed"]
      : ["planned", "in_progress", "completed"]
    ).includes(parsed.data.workflowStatus)
  ) {
    return NextResponse.json(
      { message: "웹 디자인팀 작업 상태는 예정, 작업중, 완료만 선택할 수 있습니다." },
      { status: 400 },
    );
  }

  const previousStage = task.current_stage?.trim() || "미입력";
  const stageChanged = previousStage !== parsed.data.currentStage;
  const statusChanged = task.workflow_status !== parsed.data.workflowStatus;
  const noteChanged = (task.note ?? "") !== parsed.data.note;
  const changeSummary = [
    ...(statusChanged
      ? [`작업 상태: ${workflowStatusLabel(task.workflow_status, task.workspace_type)} → ${workflowStatusLabel(parsed.data.workflowStatus, task.workspace_type)}`]
      : []),
    stageChanged
      ? `현재 단계: ${previousStage} → ${parsed.data.currentStage}`
      : `현재 단계: ${parsed.data.currentStage}`,
    `오늘 작업: ${parsed.data.workContent}`,
    ...(noteChanged && parsed.data.note ? [`비고: ${parsed.data.note}`] : []),
  ].join(" · ");
  const now = new Date().toISOString();
  const completedAt =
    parsed.data.workflowStatus === "completed"
      ? task.completed_at ?? now
      : null;

  const { error: updateError } = await supabase
    .from("product_design_tasks")
    .update({
      current_stage: parsed.data.currentStage,
      workflow_status: parsed.data.workflowStatus,
      note: parsed.data.note || null,
      completed_at: completedAt,
      updated_at: now,
    })
    .eq("id", id);
  if (updateError) {
    return NextResponse.json(
      { message: "현재 단계를 변경하지 못했습니다." },
      { status: 500 },
    );
  }

  const { data: log, error: logError } = await supabase
    .from("product_design_work_logs")
    .insert({
      task_id: id,
      author_id: auth.employee.id,
      current_stage: parsed.data.currentStage,
      workflow_status: parsed.data.workflowStatus,
      work_content: parsed.data.workContent,
      change_summary: changeSummary,
      note_snapshot: parsed.data.note || null,
      created_at: now,
    })
    .select("id, created_at")
    .single();
  if (logError || !log) {
    await supabase
      .from("product_design_tasks")
      .update({
        current_stage: task.current_stage,
        workflow_status: task.workflow_status,
        note: task.note,
        completed_at: task.completed_at,
        updated_at: now,
      })
      .eq("id", id);
    return NextResponse.json(
      { message: "작업 기록을 저장하지 못했습니다." },
      { status: 500 },
    );
  }

  await supabase.from("activity_logs").insert({
    employee_id: auth.employee.id,
    action_type: "product_design.log.create",
    target_type: "product_design_task",
    target_id: id,
    changed_data: {
      current_stage: parsed.data.currentStage,
      previous_stage: task.current_stage,
      workflow_status: parsed.data.workflowStatus,
      previous_workflow_status: task.workflow_status,
      work_content: parsed.data.workContent,
      note: parsed.data.note || null,
      log_id: log.id,
    },
  });

  return NextResponse.json({ ok: true, logId: log.id }, { status: 201 });
}

function workflowStatusLabel(value: string, workspaceType?: string) {
  if (workspaceType !== "product_design" && value === "in_progress") return "작업중";
  return {
    planned: "예정",
    graphic_planned: "그래픽 예정",
    in_progress: "진행중",
    revising: "수정중",
    in_production: "생산중",
    on_hold: "보류중",
    awaiting_approval: "컨펌 필요",
    completed: "완료",
  }[value] ?? value;
}
