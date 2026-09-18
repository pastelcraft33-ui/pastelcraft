import { z } from "zod";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const dailyReportDateSchema = z
  .string()
  .regex(datePattern, "업무일지 날짜를 확인해 주세요.");

export const dailyReportIdSchema = z.uuid("업무일지 정보를 확인해 주세요.");

export const dailyReportWorkItemSchema = z.object({
  workContent: z
    .string()
    .trim()
    .min(1, "업무 내용을 입력해 주세요.")
    .max(500, "업무 내용은 항목당 500자 이하로 입력해 주세요."),
  details: z
    .string()
    .trim()
    .max(1000, "사항은 항목당 1,000자 이하로 입력해 주세요."),
  notes: z
    .string()
    .trim()
    .max(1000, "특이사항은 항목당 1,000자 이하로 입력해 주세요."),
});

export const dailyReportInputSchema = z.object({
  reportDate: dailyReportDateSchema,
  workItems: z
    .array(dailyReportWorkItemSchema)
    .min(1, "업무 항목을 한 개 이상 입력해 주세요.")
    .max(50, "업무 항목은 최대 50개까지 등록할 수 있습니다."),
});

export type DailyReportWorkItem = z.infer<typeof dailyReportWorkItemSchema>;
export type DailyReportInput = z.infer<typeof dailyReportInputSchema>;
