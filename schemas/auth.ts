import { z } from "zod";

import { securityQuestionValues } from "@/lib/auth/security-questions";

export const loginSchema = z.object({
  loginId: z
    .string()
    .trim()
    .min(4, "로그인 아이디를 입력해 주세요.")
    .max(32, "로그인 아이디는 32자 이하로 입력해 주세요.")
    .regex(/^[a-zA-Z0-9._-]+$/, "영문, 숫자, 마침표, 밑줄, 하이픈만 사용할 수 있습니다."),
  password: z
    .string()
    .min(1, "비밀번호를 입력해 주세요.")
    .max(128, "비밀번호가 너무 깁니다."),
});

export type LoginInput = z.infer<typeof loginSchema>;

const nameSchema = z
  .string()
  .trim()
  .min(2, "이름은 2자 이상 입력해 주세요.")
  .max(50, "이름은 50자 이하로 입력해 주세요.");
const phoneSchema = z
  .string()
  .regex(/^010-\d{4}-\d{4}$/, "010-1234-5678 형식으로 입력해 주세요.");
export const securityAnswerSchema = z
  .string()
  .trim()
  .min(2, "보안 질문 답변은 2자 이상 입력해 주세요.")
  .max(100, "보안 질문 답변은 100자 이하로 입력해 주세요.");
export const newPasswordSchema = z
  .string()
  .min(10, "비밀번호는 10자 이상 입력해 주세요.")
  .max(64, "비밀번호는 64자 이하로 입력해 주세요.")
  .regex(/[A-Za-z]/, "비밀번호에 영문을 포함해 주세요.")
  .regex(/[0-9]/, "비밀번호에 숫자를 포함해 주세요.");

export const positionValues = [
  "staff",
  "assistant_manager",
  "section_chief",
  "manager",
  "deputy_general_manager",
  "general_manager",
  "team_lead",
] as const;

export const departmentValues = ["web", "logistics", "namdaemun"] as const;

export const registerSchema = z
  .object({
    loginId: z
      .string()
      .trim()
      .min(4, "로그인 아이디는 4자 이상 입력해 주세요.")
      .max(32, "로그인 아이디는 32자 이하로 입력해 주세요.")
      .regex(/^[a-zA-Z0-9._-]+$/, "영문, 숫자, 마침표, 밑줄, 하이픈만 사용할 수 있습니다."),
    password: newPasswordSchema,
    passwordConfirm: z.string().min(1, "비밀번호를 한 번 더 입력해 주세요."),
    name: nameSchema,
    position: z.enum(positionValues, { message: "직급을 선택해 주세요." }),
    department: z.enum(departmentValues, { message: "부서를 선택해 주세요." }),
    phone: phoneSchema,
    securityQuestion: z.enum(securityQuestionValues, {
      message: "보안 질문을 선택해 주세요.",
    }),
    securityAnswer: securityAnswerSchema,
  })
  .refine((data) => data.password === data.passwordConfirm, {
    path: ["passwordConfirm"],
    message: "비밀번호가 일치하지 않습니다.",
  });

export type RegisterInput = z.infer<typeof registerSchema>;

export const findLoginIdSchema = z.object({
  name: nameSchema,
  phone: phoneSchema,
});

export const recoveryIdentitySchema = z.object({
  loginId: loginSchema.shape.loginId,
  name: nameSchema,
  phone: phoneSchema,
});

export const resetPasswordSchema = z
  .object({
    securityAnswer: securityAnswerSchema,
    password: newPasswordSchema,
    passwordConfirm: z.string().min(1, "비밀번호를 다시 입력해 주세요."),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    path: ["passwordConfirm"],
    message: "비밀번호가 일치하지 않습니다.",
  });

export type FindLoginIdInput = z.infer<typeof findLoginIdSchema>;
export type RecoveryIdentityInput = z.infer<typeof recoveryIdentitySchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
