"use client";

import {
  Bell,
  CalendarCheck2,
  CalendarX2,
  Loader2,
  Palette,
  Trash2,
  UsersRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import type { WorkspaceUser } from "@/components/layout/workspace-user";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NotificationItem = {
  id: string;
  type: "approval" | "cancelled" | "deleted" | "meeting" | "product_design";
  title: string;
  description: string;
  createdAt: string;
  href: string;
};

type NotificationResponse = {
  items: NotificationItem[];
  pendingCount: number;
  changeCount: number;
  meetingCount: number;
  productDesignCount: number;
  checkedAt: string;
};

export function LeaveNotificationCenter({ user }: { user: WorkspaceUser }) {
  const canReceiveLeave =
    user.positionCode === "team_lead" ||
    (user.role === "admin" && user.positionCode === "representative");
  const storageKey = `pastelcraft-notifications-seen-v2:${user.id}`;
  const meetingPopupKey = `pastelcraft-meeting-popup-checked:${user.id}`;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [changeCount, setChangeCount] = useState(0);
  const [meetingCount, setMeetingCount] = useState(0);
  const [productDesignCount, setProductDesignCount] = useState(0);
  const [meetingPopup, setMeetingPopup] = useState<NotificationItem | null>(null);
  const [assignmentPopup, setAssignmentPopup] = useState<NotificationItem | null>(null);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const sinceRef = useRef<string | null>(null);
  const meetingPopupSinceRef = useRef<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const lastAssignmentNotificationIdRef = useRef<string | null>(null);

  const loadNotifications = useCallback(async () => {
    const since = sinceRef.current ?? new Date().toISOString();
    setLoading(true);
    try {
      const response = await fetch(
        `/api/notifications?since=${encodeURIComponent(since)}`,
        { cache: "no-store" },
      );
      if (!response.ok) return;
      const result = (await response.json()) as NotificationResponse;
      setItems(result.items);
      setPendingCount(result.pendingCount);
      setChangeCount(result.changeCount);
      setMeetingCount(result.meetingCount);
      setProductDesignCount(result.productDesignCount);
      setCheckedAt(result.checkedAt);
      if (result.productDesignCount > 0) {
        const assignment = result.items.find((item) => item.type === "product_design");
        if (
          assignment &&
          lastAssignmentNotificationIdRef.current !== assignment.id
        ) {
          lastAssignmentNotificationIdRef.current = assignment.id;
          setAssignmentPopup(assignment);
          window.dispatchEvent(
            new CustomEvent("product-design-assignment-received", {
              detail: { notificationId: assignment.id, href: assignment.href },
            }),
          );
        }
      }
      const popupSince = meetingPopupSinceRef.current ?? result.checkedAt;
      const newMeeting = result.items.find(
        (item) => item.type === "meeting" && item.createdAt > popupSince,
      );
      if (newMeeting) setMeetingPopup(newMeeting);
      meetingPopupSinceRef.current = result.checkedAt;
      window.localStorage.setItem(meetingPopupKey, result.checkedAt);
    } finally {
      setLoading(false);
    }
  }, [meetingPopupKey]);

  useEffect(() => {
    sinceRef.current = window.localStorage.getItem(storageKey) ?? new Date().toISOString();
    meetingPopupSinceRef.current =
      window.localStorage.getItem(meetingPopupKey) ?? new Date().toISOString();
    const initialLoad = window.setTimeout(() => void loadNotifications(), 0);

    const interval = window.setInterval(() => void loadNotifications(), 30_000);
    const handleFocus = () => void loadNotifications();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void loadNotifications();
    };
    const handleLeaveChange = () => void loadNotifications();
    const handleWorkspaceChange = () => void loadNotifications();
    window.addEventListener("focus", handleFocus);
    window.addEventListener("leave-requests-changed", handleLeaveChange);
    window.addEventListener("workspace-content-created", handleWorkspaceChange);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("leave-requests-changed", handleLeaveChange);
      window.removeEventListener("workspace-content-created", handleWorkspaceChange);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [loadNotifications, meetingPopupKey, storageKey]);

  useEffect(() => {
    if (!meetingPopup) return;
    const timeout = window.setTimeout(() => setMeetingPopup(null), 10_000);
    return () => window.clearTimeout(timeout);
  }, [meetingPopup]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [open]);

  const count = pendingCount + changeCount + meetingCount + productDesignCount;

  async function markProductDesignNotificationsRead() {
    if (productDesignCount === 0) return;
    const response = await fetch("/api/notifications", { method: "PATCH" });
    if (!response.ok) return;
    setProductDesignCount(0);
    window.dispatchEvent(new Event("product-design-notifications-read"));
  }

  function toggle() {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (!nextOpen) return;
    setAssignmentPopup(null);

    const nextSeenAt = checkedAt ?? new Date().toISOString();
    sinceRef.current = nextSeenAt;
    window.localStorage.setItem(storageKey, nextSeenAt);
    setChangeCount(0);
    setMeetingCount(0);
    void markProductDesignNotificationsRead();
  }

  return (
    <div ref={rootRef} className="relative">
      {assignmentPopup && (
        <div role="alert" className="fixed right-4 top-[84px] z-[70] w-[min(390px,calc(100vw-2rem))] overflow-hidden rounded-[18px] border border-[#f0c6c2] bg-white shadow-[0_18px_55px_rgba(31,48,38,0.2)]">
          <div className="flex items-start gap-3 p-4">
            <span className="relative flex size-11 shrink-0 items-center justify-center rounded-full bg-[#fff0ef] text-[#c95850]">
              <Palette className="size-5" />
              <span className="absolute right-0 top-0 size-3 rounded-full bg-[#e24f45] ring-2 ring-white" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-black leading-5 text-[#354139]">미확인 알람이 있습니다.</p>
              <p className="mt-1 text-[11px] font-bold text-[#58665e]">{assignmentPopup.title}</p>
              <p className="mt-1 text-[10px] text-[#7b867f]">{assignmentPopup.description}</p>
              <button
                type="button"
                onClick={() => {
                  setAssignmentPopup(null);
                  setOpen(true);
                  void markProductDesignNotificationsRead();
                }}
                className="mt-3 inline-flex rounded-[9px] bg-[#edf7f0] px-3 py-2 text-[11px] font-extrabold text-[#397051] hover:bg-[#dfeee4]"
              >
                알림 확인
              </button>
            </div>
            <button type="button" onClick={() => setAssignmentPopup(null)} aria-label="작업 배정 알림 닫기" className="flex size-7 shrink-0 items-center justify-center rounded-[8px] text-[#8a948e] hover:bg-[#f0f3f1]">
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}
      {!assignmentPopup && meetingPopup && (
        <div role="alert" className="fixed right-4 top-[84px] z-[70] w-[min(390px,calc(100vw-2rem))] overflow-hidden rounded-[16px] border border-[#bcdcc7] bg-white shadow-[0_18px_55px_rgba(31,48,38,0.2)]">
          <div className="flex items-start gap-3 p-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#e5f5eb] text-[#397051]">
              <UsersRound className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-extrabold leading-5 text-[#354139]">{meetingPopup.title}</p>
              <p className="mt-1 text-[11px] text-[#77827b]">{meetingPopup.description}</p>
              <Link href={meetingPopup.href} onClick={() => setMeetingPopup(null)} className="mt-3 inline-flex rounded-[8px] bg-[#e8f5ec] px-3 py-2 text-[11px] font-extrabold text-[#397051] hover:bg-[#dcefe3]">
                회의 내용 확인
              </Link>
            </div>
            <button type="button" onClick={() => setMeetingPopup(null)} aria-label="회의 알림 닫기" className="flex size-7 shrink-0 items-center justify-center rounded-[8px] text-[#8a948e] hover:bg-[#f0f3f1]">
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}
      <Button
        variant="ghost"
        size="icon"
        aria-label={count > 0 ? `알림 ${count}개` : "알림"}
        aria-expanded={open}
        onClick={toggle}
        className="relative"
      >
        <Bell className="size-[19px]" />
        {count > 0 && (
          <span className="absolute right-0.5 top-0.5 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[#dc6b61] px-1 text-[10px] font-extrabold leading-none text-white ring-2 ring-white">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-[48px] z-50 w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-[16px] border border-[#dfe5e1] bg-white shadow-[0_18px_55px_rgba(31,48,38,0.18)]">
          <div className="flex items-center justify-between border-b border-[#edf0ee] px-4 py-3.5">
            <div>
              <p className="text-[14px] font-extrabold text-[#303c35]">알림</p>
              <p className="mt-0.5 text-[10px] text-[#8a948e]">작업 배정, 회의 초대와 휴가 처리 내역</p>
            </div>
            {canReceiveLeave && (
              <Link
                href="/admin/leave"
                onClick={() => setOpen(false)}
                className="rounded-[8px] bg-[#edf7f0] px-2.5 py-1.5 text-[11px] font-extrabold text-[#397050] hover:bg-[#e2f1e7]"
              >
                휴가 승인
              </Link>
            )}
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {loading && items.length === 0 ? (
              <div className="flex min-h-32 items-center justify-center text-[#809087]">
                <Loader2 className="size-5 animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <CalendarCheck2 className="mx-auto size-7 text-[#9bb4a5]" />
                <p className="mt-2 text-[12px] font-bold text-[#77827b]">새 알림이 없습니다.</p>
              </div>
            ) : (
              items.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex gap-3 border-b border-[#f0f2f0] px-4 py-3.5 transition last:border-0 hover:bg-[#f8faf8]"
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full",
                      item.type === "product_design"
                        ? "bg-[#f0eafa] text-[#7048a1]"
                        : item.type === "meeting"
                        ? "bg-[#e5f5eb] text-[#397051]"
                        : item.type === "approval"
                        ? "bg-[#fff3c4] text-[#806719]"
                        : "bg-[#f8e8e6] text-[#9a514b]",
                    )}
                  >
                    {item.type === "product_design" ? (
                      <Palette className="size-4" />
                    ) : item.type === "meeting" ? (
                      <UsersRound className="size-4" />
                    ) : item.type === "approval" ? (
                      <CalendarCheck2 className="size-4" />
                    ) : item.type === "deleted" ? (
                      <Trash2 className="size-4" />
                    ) : (
                      <CalendarX2 className="size-4" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] font-extrabold leading-5 text-[#39443e]">{item.title}</span>
                    <span className="mt-0.5 block text-[10px] leading-4 text-[#7e8982]">{item.description}</span>
                    <time className="mt-1 block text-[9px] font-medium text-[#a0a8a3]">{formatDateTime(item.createdAt)}</time>
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
