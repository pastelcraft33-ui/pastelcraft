import { z } from "zod";

export const productDesignWorkTypeValues = [
  "new_product",
  "existing_product_update",
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

export const productDesignLogSchema = z.object({
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
});

export type ProductDesignTaskInput = z.infer<typeof productDesignTaskSchema>;
export type ProductDesignLogInput = z.infer<typeof productDesignLogSchema>;

export function productDesignTaskInputFromFormData(formData: FormData) {
  return {
    productName: formData.get("productName"),
    workType: formData.get("workType"),
    detailedWorkContent: formData.get("detailedWorkContent"),
  };
}
