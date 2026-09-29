"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { loginSchema, type LoginInput } from "@/schemas/auth";

export function LoginForm({
  registered = false,
  sessionMessage = null,
}: {
  registered?: boolean;
  sessionMessage?: string | null;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { loginId: "", password: "" },
  });

  useEffect(() => {
    if (sessionMessage) {
      void fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    }
  }, [sessionMessage]);

  const onSubmit = handleSubmit(async (input) => {
    setServerError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const result = (await response.json()) as { message?: string };

      if (!response.ok) {
        setServerError(result.message ?? "로그인에 실패했습니다.");
        return;
      }

      // 직원이 바뀌어도 이전 사용자의 App Router 캐시가 재사용되지 않도록
      // 로그인 성공 시 전체 문서를 새로 불러옵니다.
      window.location.replace("/calendar");
    } catch {
      setServerError("서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.");
    }
  });

  return (
    <form onSubmit={onSubmit} className="mt-9 space-y-5" noValidate>
      {registered && (
        <div role="status" className="flex items-start gap-2.5 rounded-[12px] border border-[#bfe1ca] bg-[#eff9f2] px-3.5 py-3 text-[13px] leading-5 text-[#3d7552]">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          <span>가입 신청이 완료되었습니다. 관리자 승인 후 로그인해 주세요.</span>
        </div>
      )}
      {sessionMessage && (
        <div role="alert" className="flex items-start gap-2.5 rounded-[12px] border border-[#ecdba9] bg-[#fff9e7] px-3.5 py-3 text-[13px] leading-5 text-[#785f20]">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{sessionMessage}</span>
        </div>
      )}
      {serverError && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-[12px] border border-[#f1cbc8] bg-[#fff3f2] px-3.5 py-3 text-[13px] leading-5 text-[#974843]"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{serverError}</span>
        </div>
      )}

      <Field
        label="로그인 아이디"
        error={errors.loginId?.message}
        icon={<UserRound className="size-[18px]" />}
      >
        <input
          {...register("loginId")}
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="로그인 아이디 입력"
          className="h-full w-full bg-transparent pr-4 text-[14px] font-medium text-[#313b35] outline-none placeholder:text-[#a6aea9]"
        />
      </Field>

      <Field
        label="비밀번호"
        error={errors.password?.message}
        icon={<LockKeyhole className="size-[18px]" />}
        trailing={
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="flex size-9 items-center justify-center rounded-[9px] text-[#8a948e] transition hover:bg-[#eff3f0] hover:text-[#4a554e] focus:outline-none focus:ring-3 focus:ring-emerald-100"
            aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
          >
            {showPassword ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
          </button>
        }
      >
        <input
          {...register("password")}
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          placeholder="비밀번호 입력"
          className="h-full w-full bg-transparent pr-2 text-[14px] font-medium text-[#313b35] outline-none placeholder:text-[#a6aea9]"
        />
      </Field>

      <div className="-mt-2 text-right">
        <Link href="/account-recovery" className="text-[12px] font-bold text-[#4f765d] transition hover:text-[#315f47] hover:underline">
          아이디 · 비밀번호 찾기
        </Link>
      </div>

      <Button type="submit" className="h-12 w-full rounded-[12px] text-[14px]" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="size-[18px] animate-spin" /> 로그인 확인 중
          </>
        ) : (
          <>
            로그인 <ArrowRight className="size-[18px]" />
          </>
        )}
      </Button>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-[#e6eae7]" />
        <span className="text-[11px] font-medium text-[#9aa29d]">처음 이용하시나요?</span>
        <span className="h-px flex-1 bg-[#e6eae7]" />
      </div>

      <Button asChild type="button" variant="secondary" className="h-11 w-full rounded-[12px]">
        <Link href="/register">직원 등록</Link>
      </Button>

      <div className="rounded-[12px] bg-[#f5f7f5] px-4 py-3 text-center text-[12px] leading-5 text-[#7d8781]">
        관리자 승인이 완료된 직원 계정만 로그인할 수 있습니다.
        <br />
        계정 문제가 있다면 사내 관리자에게 문의해 주세요.
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  icon,
  trailing,
  children,
}: {
  label: string;
  error?: string;
  icon: React.ReactNode;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[13px] font-bold text-[#47524b]">{label}</span>
      <span
        className={cn(
          "flex h-12 items-center rounded-[12px] border bg-white transition focus-within:ring-3",
          error
            ? "border-[#e4aaa6] focus-within:border-[#d78681] focus-within:ring-red-100"
            : "border-[#dce2de] hover:border-[#cbd4ce] focus-within:border-[#8fc9a7] focus-within:ring-emerald-100",
        )}
      >
        <span className="flex w-11 shrink-0 items-center justify-center text-[#7d8982]">{icon}</span>
        {children}
        {trailing && <span className="mr-1.5 shrink-0">{trailing}</span>}
      </span>
      {error && <span className="mt-1.5 block text-[11px] font-medium text-[#b55853]">{error}</span>}
    </label>
  );
}
