import type { Metadata } from "next";
import { CalendarDays, Check } from "lucide-react";
import Image from "next/image";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { Avatar } from "@/components/ui/avatar";
import { getCurrentEmployee } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "로그인",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ registered?: string; reason?: string; ipgo?: string }>;
}) {
  const employee = await getCurrentEmployee();
  const { registered, reason, ipgo } = await searchParams;
  const destination = ipgo && /^[A-Za-z0-9_-]{43}$/.test(ipgo)
    ? "/api/auth/ipgo?challenge=" + ipgo : "/calendar";
  if (employee) redirect(destination);

  return (
    <main className="min-h-screen bg-white lg:grid lg:grid-cols-[minmax(440px,0.94fr)_minmax(520px,1.06fr)]">
      <section className="relative hidden min-h-screen overflow-hidden bg-[#315f47] p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
        <div className="pointer-events-none absolute -left-20 top-1/3 size-72 rounded-full border border-white/5" />
        <div className="pointer-events-none absolute -right-28 -top-24 size-96 rounded-full bg-[#80cfa5]/10 blur-2xl" />
        <div className="pointer-events-none absolute bottom-12 right-10 size-40 rounded-full bg-[#f6d978]/10 blur-2xl" />

        <div aria-hidden className="relative z-10 h-[66px]" />

        <div className="relative z-10 mx-auto w-full max-w-[570px]">
          <h1 className="text-[60px] font-extrabold leading-[0.96] tracking-[-0.065em] xl:text-[76px] 2xl:text-[86px]">
            Pastelcraft
            <br />
            Workspace
          </h1>
          <p className="mt-5 max-w-[440px] text-[14px] leading-7 text-[#c8ddd0]">
            팀의 일정을 공유하고 휴가를 신청·승인하는
            <br />
            파스텔크래프트 임직원 전용 워크스페이스입니다.
          </p>

          <CalendarPreview />
        </div>

        <p className="relative z-10 text-[11px] text-[#9fbeac]">
          © 2026 Pastelcraft. 임직원 전용 서비스
        </p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-[410px]">
          <div className="mb-10 lg:hidden">
            <Image
              src="/brand/pastelplay-logo.png"
              alt="파스텔크래프트 회사 로고"
              width={363}
              height={108}
              priority
              className="h-auto w-[190px] object-contain"
            />
          </div>

          <h2 className="text-[30px] font-extrabold tracking-[-0.045em] text-[#28342d]">직원 로그인</h2>
          <p className="mt-2 text-[14px] leading-6 text-[#7b857f]">
            등록한 로그인 아이디와 비밀번호를 입력해 주세요.
          </p>

          <LoginForm
            destination={destination}
            registered={registered === "1"}
            sessionMessage={getSessionMessage(reason)}
          />
        </div>
      </section>
    </main>
  );
}

function getSessionMessage(reason?: string) {
  if (reason === "session-expired") {
    return "로그인 세션이 만료되었습니다. 다시 로그인해 주세요.";
  }
  if (reason === "account-disabled") {
    return "사용이 중지되었거나 승인되지 않은 계정입니다. 관리자에게 문의해 주세요.";
  }
  if (reason === "invalid-session") {
    return "로그인 상태가 유효하지 않습니다. 다시 로그인해 주세요.";
  }
  return null;
}

function CalendarPreview() {
  return (
    <div className="mt-10 overflow-hidden rounded-[20px] border border-white/15 bg-white/[0.96] p-4 text-[#334039] shadow-[0_25px_60px_rgba(10,29,18,0.22)] xl:p-5">
      <div className="flex items-center justify-between border-b border-[#edf0ee] pb-3">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-[9px] bg-[#e8f6ed] text-[#397153]">
            <CalendarDays className="size-4" />
          </span>
          <div>
            <p className="text-xs font-extrabold">오늘의 팀 일정</p>
            <p className="text-[9px] text-[#9aa29d]">8월 4일 화요일</p>
          </div>
        </div>
        <span className="rounded-full bg-[#fff4c5] px-2 py-1 text-[9px] font-bold text-[#765f1d]">4개 일정</span>
      </div>

      <div className="mt-3 grid grid-cols-5 gap-2">
        {["월", "화", "수", "목", "금"].map((day, index) => (
          <div key={day} className="text-center">
            <p className="text-[9px] font-bold text-[#9aa29d]">{day}</p>
            <p className={`mx-auto mt-1 flex size-6 items-center justify-center rounded-full text-[10px] font-bold ${index === 1 ? "bg-[#315f47] text-white" : "text-[#606b64]"}`}>
              {index + 3}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-3 space-y-2">
        <PreviewItem name="김하늘" text="브랜드 사이트 2차 시안" color="bg-[#e6f0ff] text-[#35689e]" />
        <PreviewItem name="박준호" text="입출고 데이터 정리" color="bg-[#eef0ef] text-[#5b655f]" />
        <PreviewItem name="이서윤" text="오후 반차" color="bg-[#fff3c5] text-[#786019]" />
      </div>

      <div className="mt-3 flex items-center gap-1.5 text-[9px] font-bold text-[#58806a]">
        <Check className="size-3" /> 모든 팀 일정이 공유되고 있어요
      </div>
    </div>
  );
}

function PreviewItem({ name, text, color }: { name: string; text: string; color: string }) {
  return (
    <div className={`flex items-center gap-2 rounded-[9px] px-2.5 py-2 ${color}`}>
      <Avatar name={name} size="sm" className="size-5 bg-white/80 text-[8px]" />
      <span className="min-w-0 flex-1 truncate text-[10px] font-bold">{text}</span>
      <span className="text-[8px] opacity-70">{name}</span>
    </div>
  );
}
