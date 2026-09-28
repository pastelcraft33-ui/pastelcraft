import { NextResponse } from "next/server";

import {
  hasValidMutationOrigin,
  invalidOriginResponse,
  requireApiEmployee,
} from "@/lib/auth/api";
import { validateProductDesignImage } from "@/lib/product-design/files";
import { canUseProductDesignWorkspace } from "@/lib/product-design/permissions";
import {
  PRODUCT_DESIGN_IMAGE_BUCKET,
  uploadProductDesignImage,
} from "@/lib/product-design/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  productDesignTaskInputFromFormData,
  productDesignTaskSchema,
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

  const parsed = productDesignTaskSchema.safeParse(
    productDesignTaskInputFromFormData(formData),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "작업 정보를 확인해 주세요." },
      { status: 400 },
    );
  }

  const imageValue = formData.get("representativeImage");
  const image = imageValue instanceof File && imageValue.size > 0 ? imageValue : null;
  const imageError = validateProductDesignImage(image);
  if (imageError || !image) {
    return NextResponse.json(
      { message: imageError ?? "대표 이미지를 등록해 주세요." },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const { data: task, error } = await supabase
    .from("product_design_tasks")
    .insert({
      product_name: parsed.data.productName,
      work_type: parsed.data.workType,
      detailed_work_content: parsed.data.detailedWorkContent,
      created_by: auth.employee.id,
    })
    .select("id, started_at")
    .single();

  if (error || !task) {
    return NextResponse.json(
      {
        message:
          error?.code === "PGRST205" || error?.code === "42P01"
            ? "제품 디자인 데이터베이스 설정이 필요합니다. 새 SQL을 먼저 적용해 주세요."
            : "제품 디자인 작업을 등록하지 못했습니다.",
      },
      { status: 500 },
    );
  }

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

  const { error: updateError } = await supabase
    .from("product_design_tasks")
    .update({ representative_image_path: upload.path })
    .eq("id", task.id);
  if (updateError) {
    await Promise.all([
      supabase.storage.from(PRODUCT_DESIGN_IMAGE_BUCKET).remove([upload.path]),
      supabase.from("product_design_tasks").delete().eq("id", task.id),
    ]);
    return NextResponse.json(
      { message: "대표 이미지 정보를 저장하지 못했습니다." },
      { status: 500 },
    );
  }

  await supabase.from("activity_logs").insert({
    employee_id: auth.employee.id,
    action_type: "product_design.task.create",
    target_type: "product_design_task",
    target_id: task.id,
    changed_data: {
      product_name: parsed.data.productName,
      work_type: parsed.data.workType,
      started_at: task.started_at,
    },
  });

  return NextResponse.json({ ok: true, id: task.id }, { status: 201 });
}
