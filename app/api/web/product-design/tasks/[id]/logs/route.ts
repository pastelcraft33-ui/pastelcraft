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
    .select("id, current_stage")
    .eq("id", id)
    .maybeSingle();
  if (!task) {
    return NextResponse.json(
      { message: "제품 디자인 작업을 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  const previousStage = task.current_stage?.trim() || "미입력";
  const stageChanged = previousStage !== parsed.data.currentStage;
  const changeSummary = [
    stageChanged
      ? `현재 단계: ${previousStage} → ${parsed.data.currentStage}`
      : `현재 단계: ${parsed.data.currentStage}`,
    `오늘 작업: ${parsed.data.workContent}`,
  ].join(" · ");
  const now = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("product_design_tasks")
    .update({ current_stage: parsed.data.currentStage, updated_at: now })
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
      work_content: parsed.data.workContent,
      change_summary: changeSummary,
      created_at: now,
    })
    .select("id, created_at")
    .single();
  if (logError || !log) {
    await supabase
      .from("product_design_tasks")
      .update({ current_stage: task.current_stage, updated_at: now })
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
      work_content: parsed.data.workContent,
      log_id: log.id,
    },
  });

  return NextResponse.json({ ok: true, logId: log.id }, { status: 201 });
}
