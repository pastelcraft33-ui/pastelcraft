"use client";

import { Bell, FileSpreadsheet, FileText, ImageIcon, Loader2, MessageCircle, Paperclip, Presentation, Send, Users, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { chatAttachmentAccept, validateChatAttachment } from "@/lib/chat/files";
import type { ChatEmployee, ChatMessageItem, ChatRealtimePayload, ChatRoomSummary } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

export function MessengerWorkspace({
  rooms,
  activeRoomId,
  messages,
  employees,
  currentEmployee,
  startEmployeeId,
  schemaAvailable,
}: {
  rooms: ChatRoomSummary[];
  activeRoomId: string | null;
  messages: ChatMessageItem[];
  employees: ChatEmployee[];
  currentEmployee: ChatEmployee;
  startEmployeeId: string | null;
  schemaAvailable: boolean;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [content, setContent] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(startEmployeeId ?? "");
  const [isStarting, setIsStarting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const activeRoom = rooms.find((room) => room.id === activeRoomId) ?? null;
  const latestMessageId = messages.at(-1)?.id ?? null;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "instant", block: "end" });
  }, [activeRoomId, latestMessageId]);

  useEffect(() => {
    if (!activeRoomId) return;
    const markRead = async () => {
      await fetch(`/api/chat/rooms/${activeRoomId}/read`, { method: "POST" }).catch(() => null);
      window.dispatchEvent(new Event("chat-read-state-changed"));
    };
    void markRead();
  }, [activeRoomId, latestMessageId]);

  useEffect(() => {
    const handleMessage = (event: Event) => {
      const payload = (event as CustomEvent<ChatRealtimePayload>).detail;
      if (payload.roomId === activeRoomId) {
        router.refresh();
      }
    };
    window.addEventListener("chat-message-received", handleMessage);
    const intervalId = window.setInterval(() => router.refresh(), 20_000);
    return () => {
      window.removeEventListener("chat-message-received", handleMessage);
      window.clearInterval(intervalId);
    };
  }, [activeRoomId, router]);

  useEffect(() => {
    if (!startEmployeeId || rooms.some((room) => room.otherEmployee.id === startEmployeeId)) return;
    void startChat(startEmployeeId);
    // URL로 전달된 직원과 최초 한 번 채팅방을 연결합니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startEmployeeId]);

  async function startChat(employeeId = selectedEmployeeId) {
    if (!employeeId || !schemaAvailable) return;
    const existing = rooms.find((room) => room.otherEmployee.id === employeeId);
    if (existing) {
      router.push(`/messenger?room=${existing.id}`);
      return;
    }
    setIsStarting(true);
    setNotice(null);
    try {
      const response = await fetch("/api/chat/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId }),
      });
      const result = await response.json() as { roomId?: string; message?: string };
      if (!response.ok || !result.roomId) throw new Error(result.message ?? "채팅방을 만들지 못했습니다.");
      router.push(`/messenger?room=${result.roomId}`);
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "채팅방을 만들지 못했습니다.");
    } finally {
      setIsStarting(false);
    }
  }

  function selectAttachment(file: File | null) {
    const error = validateChatAttachment(file);
    if (error) {
      setNotice(error);
      return;
    }
    setAttachment(file);
    setNotice(null);
  }

  async function sendMessage() {
    if (!activeRoomId || (!content.trim() && !attachment)) return;
    setIsSending(true);
    setNotice(null);
    try {
      const formData = new FormData();
      formData.set("content", content);
      if (attachment) formData.set("attachment", attachment);
      const response = await fetch(`/api/chat/rooms/${activeRoomId}/messages`, { method: "POST", body: formData });
      const result = await response.json() as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "메시지를 전송하지 못했습니다.");
      setContent("");
      setAttachment(null);
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "메시지를 전송하지 못했습니다.");
    } finally {
      setIsSending(false);
    }
  }

  async function enableBrowserNotifications() {
    if (!("Notification" in window)) {
      setNotice("이 브라우저에서는 알림 기능을 지원하지 않습니다.");
      return;
    }
    const permission = await Notification.requestPermission();
    setNotice(permission === "granted" ? "브라우저 채팅 알림을 켰습니다." : "브라우저에서 알림 권한을 허용해 주세요.");
  }

  return (
    <section className="p-3 sm:p-5 lg:p-7">
      <div className="mx-auto flex h-[calc(100vh-116px)] min-h-[620px] max-w-[1460px] overflow-hidden rounded-[20px] border border-[#dfe5e1] bg-white shadow-[0_14px_45px_rgba(29,49,36,0.06)]">
        <aside className={cn("w-full shrink-0 border-r border-[#e6eae7] bg-[#fafcfa] md:w-[330px]", activeRoom && "hidden md:block")}>
          <div className="border-b border-[#e7ebe8] p-4">
            <div className="flex items-center justify-between gap-2"><div><p className="text-[12px] font-bold text-[#3c7453]">PASTEL MESSENGER</p><h2 className="text-[22px] font-extrabold text-[#2d3932]">파스텔 메신저</h2></div><Button variant="ghost" size="icon" onClick={() => void enableBrowserNotifications()} title="브라우저 알림 켜기"><Bell className="size-4" /></Button></div>
            <div className="mt-4 flex gap-2">
              <select value={selectedEmployeeId} onChange={(event) => setSelectedEmployeeId(event.target.value)} className="h-10 min-w-0 flex-1 rounded-[10px] border border-[#dce3de] bg-white px-3 text-[12px] font-semibold outline-none focus:border-[#83b494]">
                <option value="">대화할 직원 선택</option>
                {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} · {employee.department}</option>)}
              </select>
              <Button size="sm" className="h-10" onClick={() => void startChat()} disabled={!selectedEmployeeId || isStarting || !schemaAvailable}>{isStarting ? <Loader2 className="size-4 animate-spin" /> : <MessageCircle className="size-4" />}</Button>
            </div>
          </div>
          {!schemaAvailable ? <div className="m-4 rounded-[12px] border border-[#efd9a2] bg-[#fff9e8] p-4 text-[12px] font-semibold leading-5 text-[#7a6226]">파스텔 메신저 데이터베이스와 Storage 설정이 필요합니다. 마이그레이션 SQL을 적용해 주세요.</div> : rooms.length ? <div className="overflow-y-auto p-2">{rooms.map((room) => <Link key={room.id} href={`/messenger?room=${room.id}`} className={cn("flex items-center gap-3 rounded-[13px] p-3 transition hover:bg-[#edf4ef]", activeRoomId === room.id && "bg-[#e4f4e9]")}><Avatar name={room.otherEmployee.name} imageUrl={room.otherEmployee.imageUrl} /><span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="truncate text-[13px] font-extrabold text-[#354139]">{room.otherEmployee.name}</span><span className="text-[10px] text-[#8a948e]">{room.otherEmployee.department}</span></span><span className="mt-1 block truncate text-[11px] text-[#7a857e]">{room.lastMessage ? `${room.lastMessage.sentByMe ? "나: " : ""}${room.lastMessage.content || room.lastMessage.attachmentName || "첨부파일"}` : "새 대화를 시작해 보세요."}</span></span>{room.unreadCount > 0 && <span className="flex min-w-5 items-center justify-center rounded-full bg-[#efc747] px-1.5 py-0.5 text-[10px] font-black text-[#594708]">{room.unreadCount > 99 ? "99+" : room.unreadCount}</span>}</Link>)}</div> : <EmptyRooms />}
        </aside>

        <div className={cn("min-w-0 flex-1 flex-col", activeRoom ? "flex" : "hidden md:flex")}>
          {activeRoom ? <>
            <header className="flex h-[72px] shrink-0 items-center gap-3 border-b border-[#e5eae6] px-4 sm:px-5"><Link href="/messenger" className="rounded-[9px] px-2 py-1 text-[12px] font-bold text-[#577061] md:hidden">목록</Link><Avatar name={activeRoom.otherEmployee.name} imageUrl={activeRoom.otherEmployee.imageUrl} /><div><p className="font-extrabold text-[#344039]">{activeRoom.otherEmployee.name}</p><p className="text-[11px] text-[#89938d]">{activeRoom.otherEmployee.department} · {activeRoom.otherEmployee.position}</p></div></header>
            <div className="flex-1 overflow-y-auto bg-[#f8faf8] px-3 py-5 sm:px-6">
              {messages.length ? <div className="space-y-4">{messages.map((message) => <ChatBubble key={message.id} message={message} mine={message.senderId === currentEmployee.id} />)}<div ref={bottomRef} /></div> : <div className="flex h-full flex-col items-center justify-center text-center"><span className="flex size-14 items-center justify-center rounded-[18px] bg-[#e4f4e9] text-[#3b7552]"><MessageCircle className="size-7" /></span><p className="mt-3 text-[14px] font-extrabold text-[#4a554f]">첫 메시지를 보내보세요</p><p className="mt-1 text-[11px] text-[#8a948e]">이미지와 업무 파일도 함께 전송할 수 있습니다.</p></div>}
            </div>
            <footer className="shrink-0 border-t border-[#e3e8e4] bg-white p-3 sm:p-4">
              {notice && <div className="mb-2 flex items-center justify-between rounded-[10px] bg-[#fff4ef] px-3 py-2 text-[11px] font-semibold text-[#98544c]"><span>{notice}</span><button type="button" onClick={() => setNotice(null)}><X className="size-3.5" /></button></div>}
              {attachment && <div className="mb-2 flex items-center gap-2 rounded-[10px] bg-[#eef4f0] px-3 py-2 text-[11px] font-semibold text-[#56635b]"><FileIcon mimeType={attachment.type} /><span className="min-w-0 flex-1 truncate">{attachment.name}</span><span className="text-[#8a948e]">{formatFileSize(attachment.size)}</span><button type="button" onClick={() => setAttachment(null)} aria-label="첨부파일 제거"><X className="size-4" /></button></div>}
              <div className="flex items-end gap-2"><input ref={fileInputRef} type="file" accept={chatAttachmentAccept} className="sr-only" onChange={(event) => { selectAttachment(event.target.files?.[0] ?? null); event.target.value = ""; }} /><Button type="button" variant="secondary" size="icon" onClick={() => fileInputRef.current?.click()} disabled={isSending} title="파일 첨부"><Paperclip className="size-4" /></Button><textarea value={content} onChange={(event) => setContent(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} rows={1} placeholder="메시지를 입력하세요. Enter 전송 · Shift+Enter 줄바꿈" className="max-h-32 min-h-10 flex-1 resize-none rounded-[12px] border border-[#dce3de] bg-[#fbfcfb] px-3.5 py-2.5 text-[13px] outline-none focus:border-[#7eae8d] focus:ring-3 focus:ring-[#dcefe2]" /><Button type="button" size="icon" onClick={() => void sendMessage()} disabled={isSending || (!content.trim() && !attachment)}>{isSending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}</Button></div>
              <p className="mt-2 text-[10px] text-[#929b95]">이미지·Excel·PowerPoint·PDF·Word·CSV·TXT · 최대 4MB</p>
            </footer>
          </> : <EmptyConversation />}
        </div>
      </div>
    </section>
  );
}

function ChatBubble({ message, mine }: { message: ChatMessageItem; mine: boolean }) {
  return <div className={cn("flex items-end gap-2", mine && "justify-end")}>
    {!mine && <Avatar name={message.senderName} imageUrl={message.senderImageUrl} size="sm" />}
    <div className={cn("max-w-[82%]", mine && "text-right")}>
      {!mine && <p className="mb-1 text-[10px] font-bold text-[#78847c]">{message.senderName}</p>}
      <div className={cn("inline-block rounded-[15px] px-3.5 py-2.5 text-left text-[13px] leading-5", mine ? "rounded-br-[5px] bg-[#3d7654] text-white" : "rounded-bl-[5px] border border-[#e0e6e2] bg-white text-[#465149]")}>
        {message.content && <p className="whitespace-pre-wrap break-words">{message.content}</p>}
        {message.attachment && <a href={message.attachment.downloadUrl} target="_blank" rel="noreferrer" className={cn("mt-2 block overflow-hidden rounded-[10px]", mine ? "bg-white/12" : "bg-[#f3f6f4]", !message.content && "mt-0")}>{message.attachment.isImage && <Image src={message.attachment.previewUrl} alt={message.attachment.fileName} width={720} height={480} unoptimized className="max-h-[360px] h-auto w-full object-contain bg-white" />}<span className="flex items-center gap-2 px-3 py-2.5"><FileIcon mimeType={message.attachment.mimeType} /><span className="min-w-0 flex-1 truncate text-[11px] font-bold">{message.attachment.fileName}</span><span className="text-[9px] opacity-70">{formatFileSize(message.attachment.fileSizeBytes)}</span></span></a>}
      </div>
      <p className="mt-1 text-[9px] text-[#9aa29d]">{formatMessageTime(message.createdAt)}</p>
    </div>
  </div>;
}

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("image/")) return <ImageIcon className="size-4 shrink-0" />;
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType === "text/csv") return <FileSpreadsheet className="size-4 shrink-0" />;
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return <Presentation className="size-4 shrink-0" />;
  return <FileText className="size-4 shrink-0" />;
}

function EmptyRooms() { return <div className="flex flex-col items-center px-5 py-16 text-center"><Users className="size-8 text-[#a0aaa4]" /><p className="mt-3 text-[13px] font-bold text-[#68746d]">아직 채팅방이 없습니다.</p><p className="mt-1 text-[11px] leading-5 text-[#929b95]">직원을 선택하거나 직원 목록에서 채팅을 시작하세요.</p></div>; }
function EmptyConversation() { return <div className="flex h-full flex-col items-center justify-center text-center"><MessageCircle className="size-10 text-[#9caaa1]" /><p className="mt-3 text-[14px] font-extrabold text-[#66716a]">채팅방을 선택해 주세요.</p></div>; }
function formatFileSize(bytes: number) { return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))}KB` : `${(bytes / 1024 / 1024).toFixed(1)}MB`; }
function formatMessageTime(value: string) { return new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
