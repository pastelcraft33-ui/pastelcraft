import { Boxes, CalendarDays, ClipboardList } from "lucide-react";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getCurrentEmployee } from "@/lib/auth/session";

export const metadata = { title: "직원 로그인 | 파스텔 입고 완삭" };

export default async function LogisticsLogin({ searchParams }: { searchParams: Promise<{ ipgo?: string }> }) {
  const { ipgo } = await searchParams;
  const destination = ipgo && /^[A-Za-z0-9_-]{43}$/.test(ipgo)
    ? "/api/auth/ipgo?challenge=" + ipgo
    : new URL("/auth/start", process.env.IPGO_ORIGIN || "https://ipgo.vercel.app").href;
  if (await getCurrentEmployee()) redirect(destination);

  return <main className="grid min-h-svh bg-white lg:grid-cols-[47%_53%]">
    <section className="relative flex flex-col justify-center overflow-hidden bg-gradient-to-br from-[#102d67] via-[#154990] to-[#2164bf] px-7 py-9 text-white sm:px-12 lg:px-[12%]">
      <div aria-hidden className="pointer-events-none absolute -left-32 top-1/3 size-80 rounded-full border border-white/10" />
      <div className="relative">
        <h1 className="break-keep text-[clamp(3rem,10vw,7.5rem)] leading-[1.05] font-black tracking-[-.06em] lg:text-[clamp(4rem,6.8vw,8rem)]">파스텔 <span className="block">입고 완삭</span></h1>
        <p className="mt-5 text-sm leading-6 text-blue-100 lg:text-base">파스텔크래프트 직원의 입고요청과 물류 일정을 관리합니다.</p>
        <ul className="mt-9 hidden divide-y divide-blue-100 rounded-2xl bg-white px-5 text-sm font-bold text-blue-950 shadow-xl lg:block">
          {[{ Icon: ClipboardList, title: "입고요청 작성" }, { Icon: Boxes, title: "입고요청 기록" }, { Icon: CalendarDays, title: "입고 캘린더" }].map(({ Icon, title }) => {
            return <li key={title} className="flex items-center gap-3 py-4"><Icon size={20} className="text-blue-600" />{title}</li>;
          })}
        </ul>
      </div>
    </section>
    <section className="flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-[410px] [&_button[type=submit]]:bg-blue-700 [&_button[type=submit]:hover]:bg-blue-800 [&_form_a]:text-blue-700 [&_label>span:focus-within]:border-blue-400 [&_label>span:focus-within]:ring-blue-100">
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">직원 로그인</h2>
        <p className="mt-2 text-sm text-slate-600">워크스페이스에서 사용하는 아이디와 비밀번호를 입력해 주세요.</p>
        <LoginForm destination={destination} />
      </div>
    </section>
  </main>;
}
