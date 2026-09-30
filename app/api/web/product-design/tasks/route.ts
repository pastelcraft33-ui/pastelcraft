import { NextResponse } from "next/server";

import {
  hasValidMutationOrigin,
  invalidOriginResponse,
  requireApiEmployee,
} from "@/lib/auth/api";
import {
  validateProductDesignImage,
  validateProductDesignSpreadsheet,
} from "@/lib/product-design/files";
import { canUseProductDesignWorkspace } from "@/lib/product-design/permissions";
import { createProductDesignAssignmentNotification } from "@/lib/product-design/notifications";
import { departmentGroup } from "@/lib/employees/constants";
import {
  PRODUCT_DESIGN_FILE_BUCKET,
  PRODUCT_DESIGN_IMAGE_BUCKET,
  uploadProductDesignImage,
  uploadProductDesignSpreadsheet,
} from "@/lib/product-design/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  productDesignTransferSchema,
  productDesignTaskInputFromFormData,
  productDesignTaskSchema,
  webDesignTaskSchema,
} from "@/schemas/product-design";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!hasValidMutationOrigin(request)) return invalidOriginResponse();

  const auth = await requireApiEmployee();
  if (auth.response) return auth.response;
  if (!canUseProductDesignWorkspace(auth.employee)) {
    return NextResponse.json(
      { message: "웹팀 직원만 제품 디자인 작업을 등록할 수 있습니다." },
      { status: 403 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { message: "작업 등록 정보를 읽을 수 없습니다." },
      { status: 400 },
    );
  }

  const workspaceType = formData.get("workspaceType");
  if (workspaceType !== "product_design" && workspaceType !== "web_design") {
    return NextResponse.json(
      { message: "작업 영역을 확인해 주세요." },
      { status: 400 },
    );
  }
  const parsed = (
    workspaceType === "product_design" ? productDesignTaskSchema : webDesignTaskSchema
  ).safeParse(productDesignTaskInputFromFormData(formData));
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "작업 정보를 확인해 주세요." },
      { status: 400 },
    );
  }
  const validWorkTypes =
    workspaceType === "product_design"
      ? ["new_product", "existing_product_update"]
      : ["new_product", "renewal", "banner", "html"];
  if (!validWorkTypes.includes(parsed.data.workType)) {
    return NextResponse.json(
      { message: "선택한 팀에서 사용할 수 없는 작업 구분입니다." },
      { status: 400 },
    );
  }

  const registrationMode = formData.get("registrationMode");
  if (registrationMode !== "start_now" && registrationMode !== "planned") {
    return NextResponse.json(
      { message: "작업 등록 구분을 확인해 주세요." },
      { status: 400 },
    );
  }
  if (registrationMode === "planned" && auth.employee.role !== "admin") {
    return NextResponse.json(
      { message: "관리자만 예정 작업을 등록할 수 있습니다." },
      { status: 403 },
    );
  }
  if (registrationMode === "planned" && workspaceType === "web_design") {
    return NextResponse.json(
      { message: "웹 디자인팀은 예정 작업 등록을 지원하지 않습니다." },
      { status: 400 },
    );
  }

  const imageValue = formData.get("representativeImage");
  const image = imageValue instanceof File && imageValue.size > 0 ? imageValue : null;
  const imageError = validateProductDesignImage(image);
  if (imageError) {
    return NextResponse.json(
      { message: imageError },
      { status: 400 },
    );
  }

  const spreadsheetValue = formData.get("spreadsheet");
  const spreadsheet =
    workspaceType === "web_design" && spreadsheetValue instanceof File && spreadsheetValue.size > 0
      ? spreadsheetValue
      : null;
  if (spreadsheetValue instanceof File && spreadsheetValue.size > 0 && workspaceType !== "web_design") {
    return NextResponse.json(
      { message: "엑셀 자료는 웹 디자인팀 작업에만 첨부할 수 있습니다." },
      { status: 400 },
    );
  }
  const spreadsheetError = await validateProductDesignSpreadsheet(spreadsheet);
  if (spreadsheetError) {
    return NextResponse.json({ message: spreadsheetError }, { status: 400 });
  }

  const supabase = createAdminClient();
  let assigneeId = auth.employee.id;
  if (registrationMode === "planned") {
    const assignee = productDesignTransferSchema.safeParse({
      assigneeId: formData.get("assigneeId"),
    });
    if (!assignee.success) {
      return NextResponse.json(
        { message: "예정 작업 담당자를 선택해 주세요." },
        { status: 400 },
      );
    }
    const { data: employee } = await supabase
      .from("employees")
      .select("id, department, account_status, login_id, name")
      .eq("id", assignee.data.assigneeId)
      .maybeSingle();
    if (
      !employee ||
      employee.account_status !== "active" ||
      employee.login_id.startsWith("deleted-") ||
      employee.name === "삭제된 직원" ||
      departmentGroup(employee.department) !== "web"
    ) {
      return NextResponse.json(
        { message: "담당자로 지정할 수 있는 웹팀 직원을 선택해 주세요." },
        { status: 400 },
      );
    }
    assigneeId = employee.id;
  }
  const { data: task, error } = await supabase
    .from("product_design_tasks")
    .insert({
      product_name: parsed.data.productName,
      work_type: parsed.data.workType,
      detailed_work_content: parsed.data.detailedWorkContent,
      workflow_status: registrationMode === "planned" ? "planned" : "in_progress",
      created_by: auth.employee.id,
      assigned_to: assigneeId,
      workspace_type: workspaceType,
    })
    .select("id, started_at")
    .single();

  if (error || !task) {
    return NextResponse.json(
      {
        message:
          error?.code === "PGRST205" || error?.code === "PGRST204" || error?.code === "42P01"
            ? "디자인 작업 데이터베이스 설정이 필요합니다. 새 SQL을 먼저 적용해 주세요."
            : "디자인 작업을 등록하지 못했습니다.",
      },
      { status: 500 },
    );
  }

  let imagePath: string | null = null;
  let spreadsheetPath: string | null = null;
  if (image) {
    const upload = await uploadProductDesignImage({
      supabase,
      taskId: task.id,
      file: image,
    });
    if (upload.error) {
      await supabase.from("product_design_tasks").delete().eq("id", task.id);
      return NextResponse.json(
        { message: "대표 이미지를 저장하지 못해 작업 등록을 취소했습니다." },
        { status: 500 },
      );
    }
    imagePath = upload.path;
  }
  if (spreadsheet) {
    const upload = await uploadProductDesignSpreadsheet({
      supabase,
      taskId: task.id,
      file: spreadsheet,
    });
    if (upload.error) {
      await Promise.all([
        imagePath ? supabase.storage.from(PRODUCT_DESIGN_IMAGE_BUCKET).remove([imagePath]) : Promise.resolve(),
        supabase.from("product_design_tasks").delete().eq("id", task.id),
      ]);
      return NextResponse.json(
        { message: "엑셀 자료를 저장하지 못해 작업 등록을 취소했습니다." },
        { status: 500 },
      );
    }
    spreadsheetPath = upload.path;
  }

  if (imagePath || spreadsheetPath) {
    const updateData: Record<string, string | number> = {};
    if (imagePath) updateData.representative_image_path = imagePath;
    if (spreadsheetPath && spreadsheet) {
      updateData.spreadsheet_path = spreadsheetPath;
      updateData.spreadsheet_file_name = spreadsheet.name.split(/[\\/]/).pop()?.slice(0, 255) || "업무자료.xlsx";
      updateData.spreadsheet_size_bytes = spreadsheet.size;
    }
    const { error: updateError } = await supabase
      .from("product_design_tasks")
      .update(updateData)
      .eq("id", task.id);
    if (updateError) {
      await Promise.all([
        imagePath ? supabase.storage.from(PRODUCT_DESIGN_IMAGE_BUCKET).remove([imagePath]) : Promise.resolve(),
        spreadsheetPath ? supabase.storage.from(PRODUCT_DESIGN_FILE_BUCKET).remove([spreadsheetPath]) : Promise.resolve(),
        supabase.from("product_design_tasks").delete().eq("id", task.id),
      ]);
      return NextResponse.json(
        { message: "첨부파일 정보를 저장하지 못해 작업 등록을 취소했습니다. 데이터베이스 변경 SQL을 적용했는지 확인해 주세요." },
        { status: 500 },
      );
    }
  }

  if (assigneeId !== auth.employee.id) {
    const { error: notificationError } = await createProductDesignAssignmentNotification({
      supabase,
      employeeId: assigneeId,
      taskId: task.id,
      productName: parsed.data.productName,
      assignedByName: auth.employee.name,
      assignmentKind: "assigned",
      workspaceType,
    });
    if (notificationError) {
      console.error("제품 디자인 작업 배정 알림 저장 실패", notificationError);
    }
  }

  await supabase.from("activity_logs").insert({
    employee_id: auth.employee.id,
    action_type: "product_design.task.create",
    target_type: "product_design_task",
    target_id: task.id,
    changed_data: {
      product_name: parsed.data.productName,
      work_type: parsed.data.workType,
      workflow_status: registrationMode === "planned" ? "planned" : "in_progress",
      assigned_to: assigneeId,
      started_at: task.started_at,
      workspace_type: workspaceType,
      spreadsheet_file_name: spreadsheet ? spreadsheet.name.split(/[\\/]/).pop()?.slice(0, 255) ?? null : null,
    },
  });

  return NextResponse.json({ ok: true, id: task.id }, { status: 201 });
}
