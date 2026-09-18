"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Megaphone,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  announcementSchema,
  type AnnouncementInput,
} from "@/schemas/announcements";

export type AnnouncementItem = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  authorName: string;
  authorPosition: string;
  canDelete: boolean;
};

export function AnnouncementBoard({
  announcements,
  canPublish,
  schemaAvailable,
  displayAll = false,
}: {
  announcements: AnnouncementItem[];
  canPublish: boolean;
  schemaAvailable: boolean;
  displayAll?: boolean;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const visibleAnnouncements = useMemo(
    () =>
      displayAll || isExpanded ? announcements : announcements.slice(0, 3),
    [announcements, displayAll, isExpanded],
  );

  async function deleteAnnouncement(announcement: AnnouncementItem) {
    if (!window.confirm(`“${announcement.title}” 공지를 삭제할까요?`)) return;
    setDeletingId(announcement.id);
    setNotice(null);
    try {
      const response = await fetch(`/api/announcements/${announcement.id}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(result.message ?? "공지사항을 삭제하지 못했습니다.");
      }
      router.refresh();
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "공지사항을 삭제하지 못했습니다.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="px-4 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pt-8">
      <div className="mx-auto max-w-[1480px] overflow-hidden rounded-[18px] border border-[#e3dfc5] bg-[#fffdf4] shadow-[0_8px_28px_rgba(91,75,25,0.045)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eee8ca] px-4 py-3.5 sm:px-5">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-[11px] bg-[#f7dd78] text-[#5a4813]">
              <Megaphone className="size-[18px]" />
            </span>
            <div>
              <h2 className="text-[15px] font-extrabold text-[#3d3a2b]">공지사항</h2>
              <p className="text-[11px] text-[#91886b]">
                전 직원 공지와 나에게 공유된 회의 안내입니다.
              </p>
            </div>
          </div>
          {canPublish && (
            <Button
              type="button"
              size="sm"
              variant="yellow"
              onClick={() => setIsOpen(true)}
              disabled={!schemaAvailable}
            >
              <Plus className="size-4" /> 공지 등록
            </Button>
          )}
        </div>

        {!schemaAvailable && canPublish ? (
          <div className="flex items-center gap-2 px-5 py-4 text-[13px] font-semibold text-[#8b6822]">
            <AlertCircle className="size-4 shrink-0" />
            공지사항 데이터베이스 설정이 필요합니다. 새 마이그레이션 SQL을 적용해 주세요.
          </div>
        ) : visibleAnnouncements.length === 0 ? (
          <p className="px-5 py-5 text-[13px] text-[#948d75]">등록된 공지사항이 없습니다.</p>
        ) : (
          <div className="divide-y divide-[#eee9d2]">
            {visibleAnnouncements.map((announcement) => (
              <article key={announcement.id} className="px-4 py-4 sm:px-5">
                <div className="flex items-start gap-3">
                  <span className="mt-2 size-2 shrink-0 rounded-full bg-[#e4bd36]" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <h3 className="text-[14px] font-extrabold text-[#3e443f]">
                        {announcement.title}
                      </h3>
                      <span className="text-[10px] text-[#a39b82]">
                        {formatAnnouncementDate(announcement.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-6 text-[#66695f]">
                      {announcement.content}
                    </p>
                    <p className="mt-2 text-[10px] font-semibold text-[#9b947e]">
                      {announcement.authorName} · {announcement.authorPosition}
                    </p>
                  </div>
                  {announcement.canDelete && (
                    <button
                      type="button"
                      onClick={() => void deleteAnnouncement(announcement)}
                      disabled={Boolean(deletingId)}
                      className="flex size-8 shrink-0 items-center justify-center rounded-[9px] text-[#a49d84] transition-colors hover:bg-[#fff1e9] hover:text-[#a65348] disabled:opacity-50"
                      aria-label={`${announcement.title} 공지 삭제`}
                    >
                      {deletingId === announcement.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}

        {!displayAll && announcements.length > 3 && (
          <button
            type="button"
            onClick={() => setIsExpanded((value) => !value)}
            className="flex w-full items-center justify-center gap-1.5 border-t border-[#eee8ca] px-4 py-3 text-[12px] font-bold text-[#7f765a] hover:bg-[#fff9e6]"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="size-4" /> 공지 접기
              </>
            ) : (
              <>
                <ChevronDown className="size-4" /> 공지 {announcements.length - 3}건 더 보기
              </>
            )}
          </button>
        )}

        {notice && (
          <div className="border-t border-[#efd4ce] bg-[#fff5f3] px-5 py-3 text-[12px] font-semibold text-[#a25149]">
            {notice}
          </div>
        )}
      </div>

      {isOpen && (
        <AnnouncementDialog
          onClose={() => setIsOpen(false)}
          onSaved={() => {
            setIsOpen(false);
            window.dispatchEvent(new Event("workspace-content-created"));
            router.refresh();
          }}
        />
      )}
    </section>
  );
}

function AnnouncementDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<AnnouncementInput>({
    resolver: zodResolver(announcementSchema),
    defaultValues: { title: "", content: "" },
  });

  const submit = handleSubmit(async (values) => {
    const response = await fetch("/api/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const result = (await response.json()) as { message?: string };
    if (!response.ok) {
      setError("root", {
        message: result.message ?? "공지사항을 등록하지 못했습니다.",
      });
      return;
    }
    onSaved();
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="announcement-dialog-title"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[#17211b]/45 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) onClose();
      }}
    >
      <form
        onSubmit={submit}
        className="w-full max-w-[560px] rounded-[20px] border border-[#dde3df] bg-white p-5 shadow-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[12px] font-bold text-[#3b7652]">전 직원 공지</p>
            <h2
              id="announcement-dialog-title"
              className="mt-1 text-[21px] font-extrabold tracking-[-0.03em] text-[#2f3a33]"
            >
              공지사항 등록
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex size-9 items-center justify-center rounded-[10px] text-[#7c867f] hover:bg-[#f0f3f1]"
            aria-label="공지 등록 닫기"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="text-[12px] font-bold text-[#4e5952]">공지 제목</span>
            <input
              {...register("title")}
              maxLength={120}
              autoFocus
              placeholder="공지 제목을 입력해 주세요."
              className="mt-2 h-11 w-full rounded-[11px] border border-[#dce2de] px-3.5 text-[14px] outline-none focus:border-[#82bd98] focus:ring-3 focus:ring-emerald-100"
            />
            {errors.title && (
              <span className="mt-1.5 block text-[11px] text-[#a75049]">
                {errors.title.message}
              </span>
            )}
          </label>

          <label className="block">
            <span className="text-[12px] font-bold text-[#4e5952]">공지 내용</span>
            <textarea
              {...register("content")}
              maxLength={5000}
              rows={7}
              placeholder="전 직원에게 전달할 내용을 입력해 주세요."
              className="mt-2 w-full resize-y rounded-[11px] border border-[#dce2de] px-3.5 py-3 text-[14px] leading-6 outline-none focus:border-[#82bd98] focus:ring-3 focus:ring-emerald-100"
            />
            {errors.content && (
              <span className="mt-1.5 block text-[11px] text-[#a75049]">
                {errors.content.message}
              </span>
            )}
          </label>
        </div>

        {errors.root?.message && (
          <p className="mt-4 rounded-[10px] bg-[#fff2f0] px-3.5 py-3 text-[12px] font-semibold text-[#a14f47]">
            {errors.root.message}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            취소
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Megaphone className="size-4" />}
            등록하기
          </Button>
        </div>
      </form>
    </div>
  );
}

function formatAnnouncementDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
