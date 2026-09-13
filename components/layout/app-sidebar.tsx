"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

import {
  adminNavigation,
  leaveApprovalNavigation,
  mainNavigation,
} from "@/config/navigation";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import type { WorkspaceUser } from "@/components/layout/workspace-user";

type AppSidebarProps = {
  user: WorkspaceUser;
};

const NEW_CONTENT_CATEGORIES = [
  "calendar",
  "dailyReports",
  "employees",
  "meetings",
  "announcements",
] as const;
type NewContentCategory = (typeof NEW_CONTENT_CATEGORIES)[number];
type NewContentCounts = Record<NewContentCategory, number>;

const emptyNewContentCounts = (): NewContentCounts => ({
  calendar: 0,
  dailyReports: 0,
  employees: 0,
  meetings: 0,
  announcements: 0,
});

function newContentCategoryForPath(path: string): NewContentCategory | null {
  if (path === "/calendar") return "calendar";
  if (path === "/daily-reports") return "dailyReports";
  if (path === "/employees" || path.startsWith("/employees/")) return "employees";
  if (path === "/meetings") return "meetings";
  if (path === "/announcements") return "announcements";
  return null;
}

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname();
  const [pendingNavigation, setPendingNavigation] = useState<{
    href: string;
    fromPath: string;
  } | null>(null);
  const pendingHref =
    pendingNavigation?.fromPath === pathname ? pendingNavigation.href : null;
  const isAdmin = user.role === "admin";
  const canApproveLeave = isAdmin || user.positionCode === "team_lead";
  const [pendingLeaveCount, setPendingLeaveCount] = useState<number | null>(null);
  const [unreadChatCount, setUnreadChatCount] = useState<number | null>(null);
  const [newContentCounts, setNewContentCounts] =
    useState<NewContentCounts>(emptyNewContentCounts);
  const seenAtRef = useRef<Partial<Record<NewContentCategory, string>>>({});
  const latestServerTimeRef = useRef<string | null>(null);
  const storageLoadedRef = useRef(false);

  const markNewContentSeen = (path: string) => {
    const category = newContentCategoryForPath(path);
    if (!category) return;
    const seenAt = latestServerTimeRef.current ?? new Date().toISOString();
    seenAtRef.current = { ...seenAtRef.current, [category]: seenAt };
    setNewContentCounts((current) => ({ ...current, [category]: 0 }));
    try {
      localStorage.setItem(
        `pc-navigation-seen:${user.id}`,
        JSON.stringify(seenAtRef.current),
      );
    } catch {
      // 브라우저 저장소를 사용할 수 없어도 현재 화면의 숫자는 정상 처리합니다.
    }
  };

  useEffect(() => {
    let active = true;
    const storageKey = `pc-navigation-seen:${user.id}`;

    if (!storageLoadedRef.current) {
      try {
        const stored = JSON.parse(localStorage.getItem(storageKey) ?? "{}") as Record<
          string,
          unknown
        >;
        seenAtRef.current = Object.fromEntries(
          NEW_CONTENT_CATEGORIES.flatMap((category) => {
            const value = stored[category];
            return typeof value === "string" && !Number.isNaN(Date.parse(value))
              ? [[category, value]]
              : [];
          }),
        );
      } catch {
        seenAtRef.current = {};
      }
      storageLoadedRef.current = true;
    }

    const loadNewContentCounts = async () => {
      try {
        const params = new URLSearchParams();
        NEW_CONTENT_CATEGORIES.forEach((category) => {
          const seenAt = seenAtRef.current[category];
          if (seenAt) params.set(`${category}Since`, seenAt);
        });
        const response = await fetch(`/api/navigation/new-counts?${params}`, {
          cache: "no-store",
        });
        if (!response.ok) return;
        const result = (await response.json()) as {
          counts?: Partial<NewContentCounts>;
          checkedAt?: string;
        };
        if (!active || !result.checkedAt || !result.counts) return;

        latestServerTimeRef.current = result.checkedAt;
        const activeCategory = newContentCategoryForPath(pathname);
        NEW_CONTENT_CATEGORIES.forEach((category) => {
          if (!seenAtRef.current[category] || category === activeCategory) {
            seenAtRef.current[category] = result.checkedAt;
          }
        });
        localStorage.setItem(storageKey, JSON.stringify(seenAtRef.current));
        setNewContentCounts({
          calendar: activeCategory === "calendar" ? 0 : (result.counts.calendar ?? 0),
          dailyReports:
            activeCategory === "dailyReports" ? 0 : (result.counts.dailyReports ?? 0),
          employees: activeCategory === "employees" ? 0 : (result.counts.employees ?? 0),
          meetings: activeCategory === "meetings" ? 0 : (result.counts.meetings ?? 0),
          announcements:
            activeCategory === "announcements"
              ? 0
              : (result.counts.announcements ?? 0),
        });
      } catch {
        // 일시적인 오류가 발생하면 마지막으로 확인한 숫자를 유지합니다.
      }
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void loadNewContentCounts();
    };
    void loadNewContentCounts();
    const intervalId = window.setInterval(loadNewContentCounts, 30_000);
    window.addEventListener("focus", loadNewContentCounts);
    window.addEventListener("workspace-content-created", loadNewContentCounts);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", loadNewContentCounts);
      window.removeEventListener("workspace-content-created", loadNewContentCounts);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [pathname, user.id]);

  useEffect(() => {
    let active = true;
    const loadUnreadChatCount = async () => {
      try {
        const response = await fetch("/api/chat/unread-count", { cache: "no-store" });
        if (!response.ok) return;
        const result = (await response.json()) as { count?: number };
        if (active && typeof result.count === "number") setUnreadChatCount(result.count);
      } catch {
        // 일시적인 네트워크 오류가 발생하면 기존 표시를 유지합니다.
      }
    };
    void loadUnreadChatCount();
    const intervalId = window.setInterval(loadUnreadChatCount, 30_000);
    window.addEventListener("chat-message-received", loadUnreadChatCount);
    window.addEventListener("chat-read-state-changed", loadUnreadChatCount);
    window.addEventListener("focus", loadUnreadChatCount);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener("chat-message-received", loadUnreadChatCount);
      window.removeEventListener("chat-read-state-changed", loadUnreadChatCount);
      window.removeEventListener("focus", loadUnreadChatCount);
    };
  }, []);

  useEffect(() => {
    if (!canApproveLeave) return;

    let active = true;
    const loadPendingLeaveCount = async () => {
      try {
        const response = await fetch("/api/leave/pending-count", {
          cache: "no-store",
        });
        if (!response.ok) return;
        const result = (await response.json()) as { count?: number };
        if (active && typeof result.count === "number") {
          setPendingLeaveCount(result.count);
        }
      } catch {
        // 일시적인 네트워크 오류가 발생하면 기존 표시를 유지합니다.
      }
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void loadPendingLeaveCount();
    };
    void loadPendingLeaveCount();
    const intervalId = window.setInterval(loadPendingLeaveCount, 30_000);
    window.addEventListener("focus", loadPendingLeaveCount);
    window.addEventListener("leave-requests-changed", loadPendingLeaveCount);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", loadPendingLeaveCount);
      window.removeEventListener("leave-requests-changed", loadPendingLeaveCount);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [canApproveLeave]);
  const beginNavigation = (href: string) => {
    markNewContentSeen(href);
    if (href !== pathname) {
      flushSync(() => setPendingNavigation({ href, fromPath: pathname }));
    }
  };

  return (
    <aside className="fixed inset-x-0 bottom-0 z-40 flex h-[calc(72px+env(safe-area-inset-bottom))] flex-row border-t border-[#e2e7e3] bg-[#f8faf8] pb-[env(safe-area-inset-bottom)] lg:inset-y-0 lg:left-0 lg:right-auto lg:h-auto lg:w-[244px] lg:flex-col lg:border-r lg:border-t-0 lg:pb-0">
      {pendingHref && (
        <div className="fixed left-0 right-0 top-[72px] z-50 h-1 overflow-hidden bg-[#dce9df] lg:left-[244px]">
          <div className="h-full w-1/2 animate-pulse rounded-r-full bg-[#58a873]" />
          <span className="sr-only">새 화면을 불러오고 있습니다.</span>
        </div>
      )}
      <div className="hidden h-[72px] items-center justify-center border-b border-[#e8ece9] px-2 lg:flex lg:px-5">
        <Link
          href="/calendar"
          prefetch
          onClick={() => beginNavigation("/calendar")}
          aria-label="파스텔크래프트 캘린더로 이동"
          className="flex h-10 w-[56px] items-center justify-center overflow-hidden rounded-[9px] border border-[#e5e9e6] bg-white px-1.5 shadow-sm lg:h-12 lg:w-full lg:px-3"
        >
          <Image
            src="/brand/pastelplay-logo.png"
            alt="파스텔크래프트 회사 로고"
            width={363}
            height={108}
            priority
            className="h-auto w-full object-contain"
          />
        </Link>
      </div>

      <nav aria-label="주 메뉴" className="flex flex-1 items-center overflow-x-auto overflow-y-hidden px-2 py-1.5 lg:block lg:overflow-x-hidden lg:overflow-y-auto lg:px-4 lg:py-5">
        <NavGroup
          items={mainNavigation}
          pathname={pathname}
          pendingHref={pendingHref}
          onNavigate={beginNavigation}
          badgeByHref={{
            "/calendar": newContentCounts.calendar,
            "/messenger": unreadChatCount,
            "/daily-reports": newContentCounts.dailyReports,
            "/employees": newContentCounts.employees,
            "/meetings": newContentCounts.meetings,
            "/announcements": newContentCounts.announcements,
          }}
        />

        {canApproveLeave && (
          <div className="contents lg:mt-7 lg:block lg:border-t lg:border-[#e5e9e6] lg:pt-5">
            <p className="mb-2 hidden px-3 text-[11px] font-bold tracking-[0.08em] text-[#9aa39e] lg:block">
              승인
            </p>
            <NavGroup
              items={leaveApprovalNavigation}
              pathname={pathname}
              pendingHref={pendingHref}
              onNavigate={beginNavigation}
              badgeByHref={{
                "/admin/leave": pendingLeaveCount,
              }}
            />
          </div>
        )}

        {isAdmin && (
          <div className="contents lg:mt-7 lg:block lg:border-t lg:border-[#e5e9e6] lg:pt-5">
            <p className="mb-2 hidden px-3 text-[11px] font-bold tracking-[0.08em] text-[#9aa39e] lg:block">
              관리자
            </p>
            <NavGroup
              items={adminNavigation}
              pathname={pathname}
              pendingHref={pendingHref}
              onNavigate={beginNavigation}
            />
          </div>
        )}
      </nav>

      <Link
        href="/my-profile"
        prefetch
        onClick={() => beginNavigation("/my-profile")}
        className="m-3 hidden items-center gap-3 rounded-[14px] border border-[#e2e7e3] bg-white p-3 transition hover:border-[#cbd8cf] hover:bg-[#fbfdfb] lg:flex"
      >
        <Avatar name={user.name} imageUrl={user.imageUrl} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-xs font-extrabold text-[#354139]">{user.name}</span>
            {isAdmin && (
              <span className="rounded-full bg-[#fff3bd] px-1.5 py-0.5 text-[8px] font-extrabold text-[#735c17]">
                관리자
              </span>
            )}
          </span>
          <span className="mt-0.5 block truncate text-[10px] text-[#87918b]">
            {user.department} · {user.position}
          </span>
        </span>
      </Link>
    </aside>
  );
}

type NavItem = {
  readonly href: string;
  readonly label: string;
  readonly icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
};

function NavGroup({
  items,
  pathname,
  pendingHref,
  onNavigate,
  badgeByHref,
}: {
  items: readonly NavItem[];
  pathname: string;
  pendingHref: string | null;
  onNavigate: (href: string) => void;
  badgeByHref?: Partial<Record<string, number | null>>;
}) {
  return (
    <div className="flex h-full shrink-0 items-center gap-1 lg:block lg:h-auto lg:space-y-1">
      {items.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== "/calendar" && pathname.startsWith(`${item.href}/`));
        const Icon = item.icon;
        const isPending = pendingHref === item.href;
        const badgeCount = badgeByHref?.[item.href];

        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch
            onClick={() => onNavigate(item.href)}
            title={item.label}
            className={cn(
              "group relative flex h-[58px] min-w-[62px] flex-col items-center justify-center gap-1 rounded-[11px] px-2 text-[10px] font-semibold transition-colors lg:h-11 lg:min-w-0 lg:flex-row lg:gap-3 lg:px-3 lg:text-base lg:justify-start",
              isActive
                ? "bg-[#e3f5ea] text-[#285d40]"
                : "text-[#66716a] hover:bg-[#edf1ee] hover:text-[#36423b]",
            )}
          >
            {isPending ? (
              <span className="size-[19px] shrink-0 animate-spin rounded-full border-2 border-[#b7d2c0] border-t-[#2f7650]" />
            ) : (
              <Icon className="size-[19px] shrink-0" strokeWidth={isActive ? 2.35 : 1.9} />
            )}
            <span className="block max-w-[58px] truncate leading-none lg:min-w-0 lg:max-w-none lg:flex-1 lg:leading-normal">{item.label}</span>
            {typeof badgeCount === "number" && badgeCount > 0 && (
              <span
                aria-label={`${item.label} 새 알림 ${badgeCount}건`}
                className="absolute right-1 top-1 flex min-w-5 items-center justify-center rounded-full bg-[#f1c84c] px-1.5 py-0.5 text-[10px] font-black leading-4 text-[#594708] shadow-sm lg:static lg:text-[11px]"
              >
                {badgeCount > 99 ? "99+" : badgeCount}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
