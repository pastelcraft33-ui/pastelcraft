import { z } from "zod";

export const productDesignWorkTypeValues = [
  "new_product",
  "existing_product_update",
  "renewal",
  "banner",
  "html",
] as const;

export const designWorkspaceTypeValues = ["product_design", "web_design"] as const;

export const productDesignWorkflowStatusValues = [
  "planned",
  "in_progress",
  "in_production",
  "on_hold",
  "awaiting_approval",
  "completed",
] as const;

export const productDesignTaskSchema = z.object({
  productName: z
    .string()
    .trim()
    .min(1, "상품명을 입력해 주세요.")
    .max(150, "상품명은 150자 이하로 입력해 주세요."),
  workType: z.enum(productDesignWorkTypeValues, {
    message: "작업 구분을 선택해 주세요.",
  }),
  detailedWorkContent: z
    .string()
    .trim()
    .min(1, "세부 작업내용을 입력해 주세요.")
    .max(10_000, "세부 작업내용은 10,000자 이하로 입력해 주세요."),
});

export const webDesignTaskSchema = productDesignTaskSchema.extend({
  productName: z
    .string()
    .trim()
    .min(1, "작업명을 입력해 주세요.")
    .max(150, "작업명은 150자 이하로 입력해 주세요."),
});

export const productDesignLogSchema = z.object({
  workflowStatus: z.enum(productDesignWorkflowStatusValues, {
    message: "작업 상태를 선택해 주세요.",
  }),
  currentStage: z
    .string()
    .trim()
    .min(1, "현재 단계를 입력해 주세요.")
    .max(100, "현재 단계는 100자 이하로 입력해 주세요."),
  workContent: z
    .string()
    .trim()
    .min(1, "오늘 작업내용을 입력해 주세요.")
    .max(5_000, "오늘 작업내용은 5,000자 이하로 입력해 주세요."),
  note: z
    .string()
    .trim()
    .max(1_000, "비고는 1,000자 이하로 입력해 주세요."),
});

export const productDesignTransferSchema = z.object({
  assigneeId: z.string().uuid("이관할 담당자를 선택해 주세요."),
});

export type ProductDesignTaskInput = z.infer<typeof productDesignTaskSchema>;
export type ProductDesignLogInput = z.infer<typeof productDesignLogSchema>;
export type ProductDesignTransferInput = z.infer<typeof productDesignTransferSchema>;

export function productDesignTaskInputFromFormData(formData: FormData) {
  return {
    productName: formData.get("productName"),
    workType: formData.get("workType"),
    detailedWorkContent: formData.get("detailedWorkContent"),
  };
}
