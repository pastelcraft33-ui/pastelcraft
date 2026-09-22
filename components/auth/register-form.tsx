"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  BriefcaseBusiness,
  Building2,
  Camera,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Phone,
  ShieldQuestion,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { securityQuestionOptions } from "@/lib/auth/security-questions";
import { departmentOptions } from "@/lib/employees/constants";
import { cn, formatPhone } from "@/lib/utils";
import { registerSchema, type RegisterInput } from "@/schemas/auth";

const MAX_IMAGE_SIZE = 4 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function RegisterForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      loginId: "",
      password: "",
      passwordConfirm: "",
      name: "",
      position: "staff",
      department: "web",
      phone: "",
      securityQuestion: "high_school",
      securityAnswer: "",
    },
  });
  const name = useWatch({ control, name: "name" });

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setImageError(null);

    if (!file) {
      setProfileImage(null);
      setPreviewUrl(null);
      return;
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      event.target.value = "";
      setImageError("JPG, PNG, WEBP 파일만 등록할 수 있습니다.");
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      event.target.value = "";
      setImageError("프로필 이미지는 최대 4MB까지 등록할 수 있습니다.");
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setProfileImage(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  const onSubmit = handleSubmit(async (input) => {
    if (imageError) return;
    setServerError(null);

    const formData = new FormData();
    Object.entries(input).forEach(([key, value]) => formData.set(key, value));
    if (profileImage) formData.set("profileImage", profileImage);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        body: formData,
      });
      const result = (await response.json()) as { message?: string };

      if (!response.ok) {
        setServerError(result.message ?? "가입 신청에 실패했습니다.");
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      router.replace("/login?registered=1");
    } catch {
      setServerError("서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.");
    }
  });

  const phoneField = register("phone");

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
      {serverError && (
        <div role="alert" className="flex items-start gap-2.5 rounded-[12px] border border-[#f1cbc8] bg-[#fff3f2] px-3.5 py-3 text-[13px] leading-5 text-[#974843]">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{serverError}</span>
        </div>
      )}

      <div className="flex items-center gap-4 rounded-[14px] border border-[#e2e7e3] bg-[#f8faf8] p-4">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="프로필 이미지 미리보기" className="size-16 rounded-full object-cover ring-2 ring-white" />
        ) : (
          <Avatar name={name || "직원"} size="lg" className="size-16 text-lg ring-2 ring-white" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-[#465149]">프로필 이미지 <span className="font-medium text-[#9aa29d]">(선택)</span></p>
          <p className="mt-1 text-[11px] text-[#89928c]">JPG, PNG, WEBP · 최대 4MB</p>
          <label className="mt-2 inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[8px] border border-[#d9e0db] bg-white px-2.5 text-[11px] font-bold text-[#59645d] transition hover:bg-[#f2f5f3] focus-within:ring-3 focus-within:ring-emerald-100">
            <Camera className="size-3.5" /> 이미지 선택
            <input type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={handleImageChange} className="sr-only" />
          </label>
        </div>
      </div>
      {imageError && <p className="-mt-3 text-[11px] font-medium text-[#b55853]">{imageError}</p>}

      <InputField label="로그인 아이디" error={errors.loginId?.message} icon={<UserRound className="size-[18px]" />} hint="영문, 숫자, 마침표, 밑줄, 하이픈 사용 가능">
        <input {...register("loginId")} type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="사용할 로그인 아이디" className="auth-input" />
      </InputField>

      <div className="grid gap-5 sm:grid-cols-2">
        <InputField label="비밀번호" error={errors.password?.message} icon={<LockKeyhole className="size-[18px]" />}>
          <input {...register("password")} type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="영문·숫자 포함 10자 이상" className="auth-input pr-10" />
          <VisibilityButton visible={showPassword} onClick={() => setShowPassword((value) => !value)} />
        </InputField>
        <InputField label="비밀번호 확인" error={errors.passwordConfirm?.message} icon={<Check className="size-[18px]" />}>
          <input {...register("passwordConfirm")} type={showPasswordConfirm ? "text" : "password"} autoComplete="new-password" placeholder="비밀번호 다시 입력" className="auth-input pr-10" />
          <VisibilityButton visible={showPasswordConfirm} onClick={() => setShowPasswordConfirm((value) => !value)} />
        </InputField>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <InputField label="이름" error={errors.name?.message} icon={<UserRound className="size-[18px]" />}>
          <input {...register("name")} type="text" autoComplete="name" placeholder="이름 입력" className="auth-input" />
        </InputField>
        <InputField label="연락처" error={errors.phone?.message} icon={<Phone className="size-[18px]" />}>
          <input
            {...phoneField}
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="010-1234-5678"
            onChange={(event) => {
              event.target.value = formatPhone(event.target.value);
              phoneField.onChange(event);
            }}
            className="auth-input"
          />
        </InputField>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField label="직급" error={errors.position?.message} icon={<BriefcaseBusiness className="size-[18px]" />}>
          <select {...register("position")} className="auth-input appearance-none pr-10">
            <option value="staff">사원</option>
            <option value="assistant_manager">대리</option>
            <option value="section_chief">계장</option>
            <option value="manager">과장</option>
            <option value="deputy_general_manager">차장</option>
            <option value="general_manager">부장</option>
            <option value="team_lead">팀장</option>
          </select>
        </SelectField>
        <SelectField label="부서" error={errors.department?.message} icon={<Building2 className="size-[18px]" />}>
          <select {...register("department")} className="auth-input appearance-none pr-10">
            {departmentOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </SelectField>
      </div>

      <div className="rounded-[14px] border border-[#dfe7e1] bg-[#f8faf8] p-4 sm:p-5">
        <div className="mb-4 flex items-start gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[#e5f4ea] text-[#3b7252]">
            <ShieldQuestion className="size-[18px]" />
          </span>
          <div>
            <p className="text-[13px] font-extrabold text-[#3f4b43]">비밀번호 찾기 보안 질문</p>
            <p className="mt-0.5 text-[11px] leading-5 text-[#7f8983]">답변은 비밀번호처럼 암호화하여 저장되며 관리자도 확인할 수 없습니다.</p>
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField label="보안 질문" error={errors.securityQuestion?.message} icon={<ShieldQuestion className="size-[18px]" />}>
            <select {...register("securityQuestion")} className="auth-input appearance-none pr-10">
              {securityQuestionOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </SelectField>
          <InputField label="질문 답변" error={errors.securityAnswer?.message} icon={<LockKeyhole className="size-[18px]" />}>
            <input {...register("securityAnswer")} type="text" autoComplete="off" placeholder="기억하기 쉬운 답변 입력" className="auth-input" />
          </InputField>
        </div>
      </div>

      <div className="rounded-[12px] border border-[#eee2ad] bg-[#fff9dd] px-4 py-3 text-[12px] leading-5 text-[#756221]">
        가입 신청 후 관리자가 승인해야 로그인할 수 있습니다. 입력한 직원 정보는 승인된 직원에게만 공개됩니다.
      </div>

      <Button type="submit" className="h-12 w-full rounded-[12px] text-[14px]" disabled={isSubmitting}>
        {isSubmitting ? <><Loader2 className="size-[18px] animate-spin" /> 가입 신청 중</> : "직원 가입 신청"}
      </Button>
    </form>
  );
}

function InputField({ label, error, icon, hint, children }: { label: string; error?: string; icon: React.ReactNode; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center justify-between gap-2 text-[13px] font-bold text-[#47524b]">
        {label}
        {hint && <span className="text-right text-[9px] font-medium text-[#9aa39d]">{hint}</span>}
      </span>
      <span className={cn("relative flex h-12 items-center rounded-[12px] border bg-white transition focus-within:ring-3", error ? "border-[#e4aaa6] focus-within:border-[#d78681] focus-within:ring-red-100" : "border-[#dce2de] hover:border-[#cbd4ce] focus-within:border-[#8fc9a7] focus-within:ring-emerald-100")}>
        <span className="flex w-11 shrink-0 items-center justify-center text-[#7d8982]">{icon}</span>
        {children}
      </span>
      {error && <span className="mt-1.5 block text-[11px] font-medium text-[#b55853]">{error}</span>}
    </label>
  );
}

function SelectField(props: Parameters<typeof InputField>[0]) {
  return (
    <div className="relative">
      <InputField {...props} />
      <ChevronDown className="pointer-events-none absolute bottom-[17px] right-3.5 size-4 text-[#8c958f]" />
    </div>
  );
}

function VisibilityButton({ visible, onClick }: { visible: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="absolute right-1.5 flex size-9 items-center justify-center rounded-[9px] text-[#8a948e] transition hover:bg-[#eff3f0] focus:outline-none focus:ring-3 focus:ring-emerald-100" aria-label={visible ? "비밀번호 숨기기" : "비밀번호 보기"}>
      {visible ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
    </button>
  );
}
