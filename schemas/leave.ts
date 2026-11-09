import { z } from "zod";

import {
  leaveDayTypeValues,
  leaveTypeValues,
} from "@/lib/leave/constants";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const leaveFormSchema = z
  .object({
    leaveType: z.enum(leaveTypeValues, { message: "휴가 종류를 선택해 주세요." }),
    startDate: z.string().regex(datePattern, "시작일을 선택해 주세요."),
    endDate: z.string().regex(datePattern, "종료일을 선택해 주세요."),
    dayType: z.enum(leaveDayTypeValues, { message: "휴가 단위를 선택해 주세요." }),
    reason: z
      .string()
      .trim()
      .min(1, "휴가 사유를 입력해 주세요.")
      .max(3000, "휴가 사유는 3,000자 이하로 입력해 주세요."),
    handoverNote: z
      .string()
      .trim()
      .max(5000, "인수인계 내용은 5,000자 이하로 입력해 주세요."),
  })
  .refine((data) => data.endDate >= data.startDate, {
    path: ["endDate"],
    message: "종료일은 시작일보다 빠를 수 없습니다.",
  })
  .refine(
    (data) => data.dayType === "full_day" || data.startDate === data.endDate,
    {
      path: ["endDate"],
      message: "반차는 시작일과 종료일이 같아야 합니다.",
    },
  )
  .refine(
    (data) => data.leaveType !== "morning_half" || data.dayType === "morning_half",
    { path: ["dayType"], message: "오전 반차 단위를 선택해 주세요." },
  )
  .refine(
    (data) => data.leaveType !== "afternoon_half" || data.dayType === "afternoon_half",
    { path: ["dayType"], message: "오후 반차 단위를 선택해 주세요." },
  )
  .refine(
    (data) =>
      data.leaveType !== "morning_quarter" ||
      data.dayType === "morning_quarter",
    { path: ["dayType"], message: "오전 반반차 단위를 선택해 주세요." },
  )
  .refine(
    (data) =>
      data.leaveType !== "afternoon_quarter" ||
      data.dayType === "afternoon_quarter",
    { path: ["dayType"], message: "오후 반반차 단위를 선택해 주세요." },
  );

export const leaveReviewSchema = z
  .object({
    stage: z.enum(["team_lead", "representative"]),
    decision: z.enum(["approve", "reject"]),
    reason: z.string().trim().max(500, "반려 사유는 500자 이하로 입력해 주세요.").optional(),
  })
  .refine((data) => data.decision !== "reject" || Boolean(data.reason), {
    path: ["reason"],
    message: "반려 사유를 입력해 주세요.",
  });

export type LeaveFormInput = z.infer<typeof leaveFormSchema>;

export function leaveInputFromFormData(formData: FormData) {
  return {
    leaveType: formData.get("leaveType") ?? "annual",
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    dayType: formData.get("dayType"),
    reason: formData.get("reason"),
    handoverNote: formData.get("handoverNote") ?? "",
  };
}
