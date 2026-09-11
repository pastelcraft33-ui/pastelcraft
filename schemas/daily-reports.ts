import { z } from "zod";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const dailyReportDateSchema = z
  .string()
  .regex(datePattern, "업무일지 날짜를 확인해 주세요.");

export const dailyReportIdSchema = z.uuid("업무일지 정보를 확인해 주세요.");
