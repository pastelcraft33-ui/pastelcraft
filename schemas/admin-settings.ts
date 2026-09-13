import { z } from "zod";

export const holidaySchema = z.object({
  title: z.string().trim().min(1, "휴무일 이름을 입력해 주세요.").max(100, "휴무일 이름은 100자 이하로 입력해 주세요."),
  holidayDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "휴무일 날짜를 확인해 주세요."),
  description: z.string().trim().max(2000, "설명은 2,000자 이하로 입력해 주세요.").optional().default(""),
});

export const maintenanceActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("cleanup_expired_sessions") }),
  z.object({ action: z.literal("unlock_employee"), employeeId: z.string().uuid("직원 정보를 확인해 주세요.") }),
]);

export const storageDeleteSchema = z.object({
  bucket: z.enum(["profile-images", "task-attachments", "leave-attachments", "daily-work-reports", "chat-attachments"]),
  path: z.string().trim().min(1).max(1024).refine((value) => !value.includes("..") && !value.includes("\\") && !value.startsWith("/"), "올바르지 않은 파일 경로입니다."),
});

export const operatingSettingsSchema = z.object({
  companyName: z.string().trim().min(1, "회사명을 입력해 주세요.").max(100),
  defaultCalendarTab: z.enum(["task", "leave"]),
  weekStartsOn: z.union([z.literal(0), z.literal(1)]),
  sessionTtlHours: z.number().int().min(1, "세션 시간은 1시간 이상이어야 합니다.").max(720, "세션 시간은 최대 720시간입니다."),
});

export type HolidayInput = z.infer<typeof holidaySchema>;
export type OperatingSettingsInput = z.infer<typeof operatingSettingsSchema>;
