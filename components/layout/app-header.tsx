"use client";

import { Building2, HelpCircle, Loader2, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LeaveNotificationCenter } from "@/components/layout/leave-notification-center";
import type { WorkspaceUser } from "@/components/layout/workspace-user";
import { departmentOptions, isDepartmentCode } from "@/lib/employees/constants";

const routeTitles: Record<string, { title: string; description: string }> = {
  "/calendar": { title: "캘린더", description: "팀의 업무와 휴가 일정을 확인하세요" },
  "/messenger": { title: "파스텔 메신저", description: "직원들과 실시간으로 대화하고 파일을 공유하세요" },
  "/daily-reports": { title: "일일업무일지", description: "날짜별 업무일지를 이미지로 등록하고 확인하세요" },
  "/announcements": { title: "공지사항", description: "회사 공지와 주요 안내를 확인하세요" },
  "/meetings": { title: "회의실", description: "회의를 등록하고 참여자를 선택하세요" },
  "/employees": { title: "직원 목록", description: "함께 일하는 동료를 확인하세요" },
  "/leave/new": { title: "휴가 신청", description: "새 휴가 신청서를 작성하세요" },
  "/tasks/new": { title: "업무 등록", description: "새 업무 일정을 등록하세요" },
  "/my-profile": { title: "내 정보", description: "프로필과 계정 정보를 관리하세요" },
  "/admin/employees": { title: "직원 관리", description: "직원 가입과 계정을 관리하세요" },
  "/admin/leave": { title: "휴가 승인", description: "대기 중인 휴가 신청을 검토하세요" },
  "/admin/settings": { title: "설정", description: "회사 휴무일과 기본 설정을 관리하세요" },
};

export function AppHeader({ user }: { user: WorkspaceUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const current = routeTitles[pathname] ?? routeTitles["/calendar"];
  const requestedDepartment = searchParams.get("department");
  const selectedDepartment = isDepartmentCode(requestedDepartment)
    ? requestedDepartment
    : "all";

  function handleDepartmentChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (isDepartmentCode(value)) {
      params.set("department", value);
    } else {
      params.delete("department");
    }
    const query = params.toString();
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
  }

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
    }
  }

  return (
    <header className="fixed inset-x-0 top-0 z-30 flex h-[72px] items-center justify-between border-b border-[#e3e8e4] bg-white/95 px-4 backdrop-blur lg:ml-[244px] lg:px-8">
      <div className="min-w-0">
        <h1 className="truncate text-lg font-extrabold tracking-[-0.03em] text-[#27332c]">
          {current.title}
        </h1>
        <p className="mt-0.5 hidden text-xs text-[#89918c] md:block">{current.description}</p>
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        {user.role === "admin" && (pathname === "/calendar" || pathname === "/daily-reports") && (
          <label className="relative hidden items-center sm:flex">
            <Building2 className="pointer-events-none absolute left-3 size-4 text-[#657269]" />
            <span className="sr-only">조회할 팀</span>
            <select
              aria-label="조회할 팀"
              value={selectedDepartment}
              onChange={(event) => handleDepartmentChange(event.target.value)}
              className="h-10 rounded-[11px] border border-[#dce3de] bg-[#f8faf8] py-0 pl-9 pr-8 text-[12px] font-bold text-[#455149] outline-none transition hover:border-[#c8d3cc] focus:border-[#8fc9a7] focus:ring-3 focus:ring-emerald-100"
            >
              <option value="all">전체 팀</option>
              {departmentOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        )}
        <Button variant="ghost" size="icon" aria-label="도움말" className="hidden sm:inline-flex">
          <HelpCircle className="size-[19px]" />
        </Button>
        <LeaveNotificationCenter user={user} />

        <Link
          href="/my-profile"
          aria-label={`${user.name} 내 정보로 이동`}
          className="ml-1 flex items-center gap-2 rounded-[12px] p-1.5 text-left transition hover:bg-[#f3f6f4]"
        >
          <Avatar name={user.name} imageUrl={user.imageUrl} />
          <span className="hidden min-w-0 sm:block">
            <span className="flex items-center gap-1.5">
              <span className="block truncate text-[13px] font-bold text-[#344039]">{user.name}</span>
              {user.role === "admin" && (
                <span className="rounded-full bg-[#fff3bd] px-1.5 py-0.5 text-[9px] font-extrabold text-[#735c17]">
                  관리자
                </span>
              )}
            </span>
            <span className="block truncate text-[11px] text-[#8b948f]">
              {user.department} · {user.position}
            </span>
          </span>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          aria-label="로그아웃"
          title="로그아웃"
          onClick={handleLogout}
          disabled={isLoggingOut}
        >
          {isLoggingOut ? <Loader2 className="size-[18px] animate-spin" /> : <LogOut className="size-[18px]" />}
        </Button>
      </div>
    </header>
  );
}
