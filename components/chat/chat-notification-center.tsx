"use client";

import { MessageCircle, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type { ChatRealtimePayload } from "@/lib/chat/types";
import { createClient } from "@/lib/supabase/client";

export function ChatNotificationCenter({ topic }: { topic: string }) {
  const router = useRouter();
  const [notification, setNotification] = useState<ChatRealtimePayload | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(topic)
      .on("broadcast", { event: "new-message" }, ({ payload }) => {
        const next = payload as ChatRealtimePayload;
        setNotification(next);
        window.dispatchEvent(new CustomEvent("chat-message-received", { detail: next }));
        if ("Notification" in window && Notification.permission === "granted") {
          const browserNotification = new Notification(`${next.senderName}님의 새 메시지`, {
            body: next.preview,
            tag: `pastel-chat-${next.roomId}`,
          });
          browserNotification.onclick = () => {
            window.focus();
            router.push(`/messenger?room=${encodeURIComponent(next.roomId)}`);
          };
        }
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [router, topic]);

  useEffect(() => {
    if (!notification) return;
    const timer = window.setTimeout(() => setNotification(null), 7000);
    return () => window.clearTimeout(timer);
  }, [notification]);

  if (!notification) return null;
  return (
    <div className="fixed right-4 top-[84px] z-[90] w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-[16px] border border-[#cfe0d4] bg-white shadow-[0_20px_60px_rgba(28,52,37,0.2)]">
      <Link href={`/messenger?room=${encodeURIComponent(notification.roomId)}`} className="flex items-start gap-3 p-4 pr-11 hover:bg-[#f8fbf9]">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-[#e3f5ea] text-[#34704c]"><MessageCircle className="size-5" /></span>
        <span className="min-w-0">
          <span className="block text-[12px] font-extrabold text-[#334039]">{notification.senderName}님의 새 메시지</span>
          <span className="mt-1 block truncate text-[12px] text-[#6f7a73]">{notification.preview}</span>
        </span>
      </Link>
      <button type="button" onClick={() => setNotification(null)} aria-label="채팅 알림 닫기" className="absolute right-2.5 top-2.5 flex size-8 items-center justify-center rounded-[9px] text-[#7e8982] hover:bg-[#eef2ef]"><X className="size-4" /></button>
    </div>
  );
}
