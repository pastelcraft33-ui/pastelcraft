import { z } from "zod";

import { securityQuestionValues } from "@/lib/auth/security-questions";
import {
  departmentValues,
  newPasswordSchema,
  securityAnswerSchema,
} from "@/schemas/auth";

const adminPositionValues = [
  "staff",
  "assistant_manager",
  "section_chief",
  "manager",
  "deputy_general_manager",
  "general_manager",
  "team_lead",
  "representative",
] as const;

const employeeDetailsSchema = z.object({
  name: z.string().trim().min(2, "이름은 2자 이상 입력해 주세요.").max(50),
  position: z.enum(adminPositionValues, { message: "직급을 선택해 주세요." }),
  department: z.enum(departmentValues, { message: "부서를 선택해 주세요." }),
  phone: z.string().regex(/^010-\d{4}-\d{4}$/, "010-1234-5678 형식으로 입력해 주세요."),
  role: z.enum(["employee", "admin"]),
});

export const adminCreateEmployeeSchema = employeeDetailsSchema
  .extend({
    loginId: z
      .string()
      .trim()
      .min(4, "로그인 아이디는 4자 이상 입력해 주세요.")
      .max(32)
      .regex(/^[a-zA-Z0-9._-]+$/, "영문, 숫자, 마침표, 밑줄, 하이픈만 사용할 수 있습니다."),
    password: z
      .string()
      .min(10, "비밀번호는 10자 이상 입력해 주세요.")
      .max(64)
      .regex(/[A-Za-z]/, "비밀번호에 영문을 포함해 주세요.")
      .regex(/[0-9]/, "비밀번호에 숫자를 포함해 주세요."),
    passwordConfirm: z.string().min(1, "비밀번호를 다시 입력해 주세요."),
    securityQuestion: z.enum(securityQuestionValues, {
      message: "보안 질문을 선택해 주세요.",
    }),
    securityAnswer: securityAnswerSchema,
  })
  .refine((data) => data.password === data.passwordConfirm, {
    path: ["passwordConfirm"],
    message: "비밀번호가 일치하지 않습니다.",
  })
  .refine((data) => data.position !== "representative" || data.role === "admin", {
    path: ["role"],
    message: "대표 직급에는 관리자 권한이 필요합니다.",
  });

export const adminUpdateEmployeeSchema = employeeDetailsSchema.refine(
  (data) => data.position !== "representative" || data.role === "admin",
  {
    path: ["role"],
    message: "대표 직급에는 관리자 권한이 필요합니다.",
  },
);

export const employeeStatusActionSchema = z
  .object({
    action: z.enum(["approve", "reject", "suspend", "activate"]),
    reason: z.string().trim().max(500, "사유는 500자 이하로 입력해 주세요.").optional(),
  })
  .refine((data) => data.action !== "reject" || Boolean(data.reason), {
    path: ["reason"],
    message: "반려 사유를 입력해 주세요.",
  });

export const adminResetPasswordSchema = z
  .object({
    password: newPasswordSchema,
    passwordConfirm: z.string().min(1, "비밀번호를 다시 입력해 주세요."),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    path: ["passwordConfirm"],
    message: "비밀번호가 일치하지 않습니다.",
  });

export const adminDeleteEmployeeSchema = z.object({
  confirmationName: z.string().trim().min(1, "삭제할 직원 이름을 입력해 주세요."),
});

export type AdminCreateEmployeeInput = z.infer<typeof adminCreateEmployeeSchema>;
export type AdminUpdateEmployeeInput = z.infer<typeof adminUpdateEmployeeSchema>;
export type AdminResetPasswordInput = z.infer<typeof adminResetPasswordSchema>;
export type AdminDeleteEmployeeInput = z.infer<typeof adminDeleteEmployeeSchema>;
