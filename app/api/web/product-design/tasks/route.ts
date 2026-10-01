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
  if (
    workspaceType !== "product_design" &&
    workspaceType !== "web_design" &&
    workspaceType !== "web_marketing"
  ) {
    return NextResponse.json(
      { message: "작업 영역을 확인해 주세요." },
      { status: 400 },
    );
  }
  const submittedTaskInput = productDesignTaskInputFromFormData(formData);
  const parsed = (
    workspaceType === "product_design" ? productDesignTaskSchema : webDesignTaskSchema
  ).safeParse(
    workspaceType === "web_marketing"
      ? { ...submittedTaskInput, workType: "new_product" }
      : submittedTaskInput,
  );
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "작업 정보를 확인해 주세요." },
      { status: 400 },
    );
  }
  const validWorkTypes =
  workspaceType === "product_design"
      ? ["new_product", "existing_product_update", "planned"]
      : workspaceType === "web_design"
        ? ["new_product", "renewal", "banner", "html"]
        : ["new_product", "renewal", "banner"];
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
  if (registrationMode === "planned" && workspaceType !== "product_design") {
    return NextResponse.json({ message: "이 팀은 예정 작업 등록을 지원하지 않습니다." }, { status: 400 });
  }

  const imageValue = formData.get("representativeImage");
  const image =
    workspaceType !== "web_marketing" && imageValue instanceof File && imageValue.size > 0
      ? imageValue
      : null;
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
      // The shared table keeps work_type NOT NULL. Marketing hides this field in
      // its form, so persist the neutral internal value accepted by its constraint.
      work_type: parsed.data.workType,
      detailed_work_content: parsed.data.detailedWorkContent,
      workflow_status:
        workspaceType === "product_design" || registrationMode === "planned"
          ? "planned"
          : "in_progress",
      created_by: auth.employee.id,
      assigned_to: assigneeId,
      workspace_type: workspaceType,
    })
    .select("id, started_at")
    .single();

  if (error || !task) {
    if (error) {
      // 입력값이나 파일명은 로그에 남기지 않고 DB 오류 식별자만 남깁니다.
      console.error("작업 등록 DB 오류", {
        workspaceType,
        code: error.code,
        message: error.message,
      });
    }
    const databaseErrorMessage =
      error?.code === "23514" && workspaceType === "web_marketing"
        ? "마케팅 팀 업무 저장 설정이 필요합니다. Supabase SQL Editor에서 202609300002_marketing_workspace.sql을 먼저 실행해 주세요."
        : error?.code === "23503"
          ? "담당자 계정 정보를 확인하지 못해 작업을 저장하지 못했습니다. 다시 로그인한 뒤 시도해 주세요."
          : error?.code === "23502"
            ? "데이터베이스 필수 항목이 누락되어 저장하지 못했습니다. 오류 코드 23502를 관리자에게 알려 주세요."
            : error?.code === "PGRST205" || error?.code === "PGRST204" || error?.code === "42P01"
              ? "디자인 작업 데이터베이스 설정이 필요합니다. 필요한 Supabase SQL을 먼저 적용해 주세요."
              : error?.code
                ? `작업 저장 중 데이터베이스 오류가 발생했습니다. 오류 코드 ${error.code}를 알려 주세요.`
                : "작업을 등록하지 못했습니다.";
    return NextResponse.json(
      {
        message: databaseErrorMessage,
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
      workflow_status:
        workspaceType === "product_design" || registrationMode === "planned"
          ? "planned"
          : "in_progress",
      assigned_to: assigneeId,
      started_at: task.started_at,
      workspace_type: workspaceType,
      spreadsheet_file_name: spreadsheet ? spreadsheet.name.split(/[\\/]/).pop()?.slice(0, 255) ?? null : null,
    },
  });

  return NextResponse.json({ ok: true, id: task.id }, { status: 201 });
}
