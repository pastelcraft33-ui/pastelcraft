import { z } from "zod";

export const productDesignWorkTypeValues = [
  "new_product",
  "existing_product_update",
  "planned",
  "renewal",
  "banner",
  "main_banner",
  "popup_banner",
  "html",
  "other",
] as const;

export const webDesignWorkTypeOptions = [
  { value: "new_product", label: "신제품" },
  { value: "renewal", label: "리뉴얼" },
  { value: "main_banner", label: "메인배너" },
  { value: "popup_banner", label: "팝업배너" },
  { value: "html", label: "HTML" },
  { value: "other", label: "기타" },
] as const;

export const designWorkspaceTypeValues = ["product_design", "web_design", "web_marketing", "web_education"] as const;

export const productDesignWorkflowStatusValues = [
  "planned",
  "graphic_planned",
  "in_progress",
  "revising",
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
  workQuantity: z.number({ message: "수량을 숫자로 입력해 주세요." }).int("수량은 정수로 입력해 주세요.").min(1, "수량은 1 이상 입력해 주세요.").max(999999, "수량은 999,999 이하로 입력해 주세요.").optional(),
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

export const webDesignRegistrationSchema = webDesignTaskSchema.superRefine((value, context) => {
  if (value.workQuantity === undefined) {
    context.addIssue({ code: "custom", path: ["workQuantity"], message: "수량을 입력해 주세요." });
  }
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

export const webDesignLogSchema = productDesignLogSchema.extend({
  currentStage: z.string().trim().max(100, "현재 단계는 100자 이하로 입력해 주세요."),
}).superRefine((value, context) => {
  if (value.workflowStatus !== "in_progress" && value.workflowStatus !== "completed") {
    context.addIssue({ code: "custom", path: ["workflowStatus"], message: "작업 상태는 작업중 또는 완료를 선택해 주세요." });
  }
});

export type ProductDesignTaskInput = z.infer<typeof productDesignTaskSchema>;
export type ProductDesignLogInput = z.infer<typeof productDesignLogSchema>;
export type ProductDesignTransferInput = z.infer<typeof productDesignTransferSchema>;

export function productDesignTaskInputFromFormData(formData: FormData) {
  const quantity = formData.get("workQuantity");
  return {
    productName: formData.get("productName"),
    workType: formData.get("workType"),
    workQuantity: quantity === null ? undefined : Number(quantity),
    detailedWorkContent: formData.get("detailedWorkContent"),
  };
}
