"use client";

import koLocale from "@fullcalendar/core/locales/ko";
import type { EventClickArg, EventContentArg, EventInput } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { DateClickArg } from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import { ClipboardPaste, FileImage, ImagePlus, Loader2, Trash2, X } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DAILY_REPORT_IMAGE_ACCEPT,
  validateDailyReportImage,
} from "@/lib/daily-reports/files";
import type { DailyReportItem } from "@/lib/daily-reports/types";

type CurrentEmployee = {
  id: string;
  name: string;
  position: string;
  department: string;
};

export function DailyReportCalendar({
  initialReports,
  currentEmployee,
  schemaAvailable,
}: {
  initialReports: DailyReportItem[];
  currentEmployee: CurrentEmployee;
  schemaAvailable: boolean;
}) {
  const router = useRouter();
  const [reports, setReports] = useState(initialReports);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const events = useMemo<EventInput[]>(
    () => reports.map((report) => ({
      id: report.id,
      title: report.employeeName,
      start: report.reportDate,
      allDay: true,
      extendedProps: { employeeName: report.employeeName, department: report.department },
    })),
    [reports],
  );
  const selectedReports = useMemo(
    () => reports.filter((report) => report.reportDate === selectedDate),
    [reports, selectedDate],
  );

  function openDate(date: string) {
    setSelectedDate(date);
  }

  function handleDateClick(arg: DateClickArg) {
    openDate(arg.dateStr);
  }

  function handleEventClick(arg: EventClickArg) {
    openDate(arg.event.startStr.slice(0, 10));
  }

  return (
    <section className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1480px]">
        <div className="mb-5">
          <p className="text-[13px] font-bold text-[#3b7652]">퇴근 전 업무 기록</p>
          <h2 className="mt-1 text-[26px] font-extrabold tracking-[-0.04em] text-[#29352e]">
            일일업무일지
          </h2>
          <p className="mt-2 text-[13px] text-[#7f8983]">
            날짜를 누른 뒤 Excel에서 복사한 업무일지 영역을 붙여넣어 이미지로 등록하세요.
          </p>
        </div>

        {!schemaAvailable && (
          <div className="mb-5 rounded-[14px] border border-[#efd89e] bg-[#fff9e7] px-4 py-3 text-[13px] font-semibold text-[#856822]">
            일일업무일지 데이터베이스와 Storage 설정이 필요합니다. 마이그레이션 SQL을 적용해 주세요.
          </div>
        )}

        <div className="rounded-[18px] border border-[#e2e7e3] bg-white p-4 shadow-[0_1px_2px_rgba(25,42,32,0.03),0_12px_30px_rgba(40,62,49,0.035)] sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3 border-b border-[#edf0ee] pb-4">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-[11px] bg-[#e7f6ec] text-[#3a7452]">
                <FileImage className="size-[18px]" />
              </span>
              <div>
                <p className="text-sm font-extrabold text-[#344039]">날짜별 업무일지</p>
                <p className="text-[11px] text-[#929a95]">등록된 업무일지 {reports.length}건</p>
              </div>
            </div>
            <span className="rounded-full bg-[#fff5c9] px-3 py-1.5 text-[11px] font-bold text-[#795f16]">
              오늘 날짜를 눌러 등록
            </span>
          </div>

          <div className="pc-calendar daily-report-calendar overflow-x-auto pb-2">
            <FullCalendar
              plugins={[dayGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              locale={koLocale}
              firstDay={0}
              height="auto"
              events={events}
              dateClick={handleDateClick}
              eventClick={handleEventClick}
              eventContent={renderDailyReportEvent}
              dayMaxEvents={4}
              headerToolbar={{ left: "prev,next today", center: "title", right: "" }}
              buttonText={{ today: "오늘" }}
              moreLinkText={(count) => `+${count}명 더보기`}
              noEventsText="등록된 업무일지가 없습니다."
            />
          </div>
        </div>
      </div>

      {selectedDate && (
        <DailyReportDialog
          date={selectedDate}
          reports={selectedReports}
          currentEmployee={currentEmployee}
          schemaAvailable={schemaAvailable}
          onClose={() => setSelectedDate(null)}
          onSaved={(report) => {
            setReports((current) => [
              report,
              ...current.filter(
                (item) =>
                  !(item.employeeId === report.employeeId && item.reportDate === report.reportDate),
              ),
            ]);
            window.dispatchEvent(new Event("workspace-content-created"));
            router.refresh();
          }}
          onDeleted={(id) => {
            setReports((current) => current.filter((report) => report.id !== id));
            router.refresh();
          }}
        />
      )}
    </section>
  );
}

function renderDailyReportEvent(arg: EventContentArg) {
  return (
    <div className="flex min-w-0 items-center gap-1.5 px-2 py-1.5">
      <span className="size-1.5 shrink-0 rounded-full bg-[#58a873]" />
      <span className="truncate text-[12px] font-extrabold text-[#356047]">
        {arg.event.title}
      </span>
    </div>
  );
}

function DailyReportDialog({
  date,
  reports,
  currentEmployee,
  schemaAvailable,
  onClose,
  onSaved,
  onDeleted,
}: {
  date: string;
  reports: DailyReportItem[];
  currentEmployee: CurrentEmployee;
  schemaAvailable: boolean;
  onClose: () => void;
  onSaved: (report: DailyReportItem) => void;
  onDeleted: (id: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<File | null>(null);
  const previewUrl = useMemo(() => (image ? URL.createObjectURL(image) : null), [image]);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const ownReport = reports.find((report) => report.employeeId === currentEmployee.id);
  const canRegister = date <= localDateValue(new Date()) && schemaAvailable;

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function selectImage(file: File) {
    const validationError = validateDailyReportImage(file);
    if (validationError) {
      setNotice({ tone: "error", text: validationError });
      return;
    }
    setImage(file);
    setNotice(null);
  }

  async function handlePaste(event: React.ClipboardEvent<HTMLDivElement>) {
    const clipboard = event.clipboardData;
    const imageItem = [...clipboard.items].find(
      (item) => item.kind === "file" && item.type.startsWith("image/"),
    );
    if (imageItem) {
      event.preventDefault();
      const file = imageItem.getAsFile();
      if (file) selectImage(normalizeImageFile(file));
      return;
    }

    const html = clipboard.getData("text/html");
    if (html && /<table[\s>]/i.test(html)) {
      event.preventDefault();
      setNotice(null);
      try {
        selectImage(await excelHtmlToPng(html));
      } catch {
        setNotice({
          tone: "error",
          text: "Excel 표를 이미지로 변환하지 못했습니다. Excel에서 그림으로 복사 후 다시 붙여넣어 주세요.",
        });
      }
      return;
    }
    setNotice({
      tone: "error",
      text: "Excel에서 셀 영역을 복사하거나 이미지 파일을 붙여넣어 주세요.",
    });
  }

  async function saveReport() {
    if (!image || !canRegister) return;
    setIsSaving(true);
    setNotice(null);
    try {
      const formData = new FormData();
      formData.set("reportDate", date);
      formData.set("image", image);
      const response = await fetch("/api/daily-reports", { method: "POST", body: formData });
      const result = (await response.json()) as { message?: string; report?: DailyReportItem };
      if (!response.ok || !result.report) {
        throw new Error(result.message ?? "일일업무일지를 등록하지 못했습니다.");
      }
      onSaved(result.report);
      setImage(null);
      setNotice({ tone: "success", text: ownReport ? "업무일지를 수정했습니다." : "업무일지를 등록했습니다." });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "일일업무일지를 등록하지 못했습니다.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteReport(report: DailyReportItem) {
    if (!window.confirm(`${report.employeeName}님의 ${formatKoreanDate(date)} 업무일지를 삭제할까요?`)) return;
    setDeletingId(report.id);
    setNotice(null);
    try {
      const response = await fetch(`/api/daily-reports/${report.id}`, { method: "DELETE" });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "업무일지를 삭제하지 못했습니다.");
      onDeleted(report.id);
      setNotice({ tone: "success", text: "업무일지를 삭제했습니다." });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "업무일지를 삭제하지 못했습니다.",
      });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="daily-report-dialog-title"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[#17211b]/55 p-3 backdrop-blur-[2px] sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) onClose();
      }}
    >
      <div className="max-h-[94vh] w-full max-w-[1050px] overflow-y-auto rounded-[20px] border border-[#dde3df] bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[12px] font-bold text-[#3b7652]">{formatKoreanDate(date)}</p>
            <h2 id="daily-report-dialog-title" className="mt-1 text-[22px] font-extrabold text-[#2e3932]">
              일일 업무일지 등록
            </h2>
          </div>
          <button type="button" onClick={onClose} disabled={isSaving} className="flex size-9 items-center justify-center rounded-[10px] text-[#7c867f] hover:bg-[#f0f3f1]" aria-label="일일업무일지 닫기">
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.72fr)]">
          <div>
            <div
              tabIndex={0}
              onClick={(event) => event.currentTarget.focus()}
              onPaste={(event) => void handlePaste(event)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const file = event.dataTransfer.files[0];
                if (file) selectImage(file);
              }}
              className="flex min-h-[320px] cursor-text flex-col items-center justify-center overflow-hidden rounded-[16px] border-2 border-dashed border-[#bfd5c6] bg-[#f7fbf8] p-5 text-center outline-none transition hover:border-[#82b894] focus:border-[#68a77d] focus:ring-4 focus:ring-emerald-100"
            >
              {previewUrl ? (
                <Image src={previewUrl} alt="붙여넣은 일일업무일지 미리보기" width={1400} height={900} unoptimized className="max-h-[620px] h-auto w-full object-contain" />
              ) : (
                <>
                  <span className="flex size-14 items-center justify-center rounded-[16px] bg-[#e2f3e8] text-[#3d7954]">
                    <ClipboardPaste className="size-7" />
                  </span>
                  <p className="mt-4 text-[16px] font-extrabold text-[#405048]">여기를 클릭한 뒤 붙여넣기</p>
                  <p className="mt-2 max-w-md text-[12px] leading-6 text-[#7e8982]">
                    Excel에서 업무일지 셀 영역을 선택하고 복사한 다음 이 영역에서 Ctrl+V 또는 ⌘V를 눌러 주세요.
                  </p>
                  <p className="mt-2 text-[11px] font-semibold text-[#96a099]">PNG · JPG · WEBP, 최대 4MB</p>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept={DAILY_REPORT_IMAGE_ACCEPT}
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) selectImage(file);
                event.target.value = "";
              }}
            />

            {!canRegister && (
              <p className="mt-3 rounded-[11px] bg-[#fff8df] px-3.5 py-3 text-[12px] font-semibold text-[#80651a]">
                미래 날짜에는 업무일지를 등록할 수 없습니다.
              </p>
            )}
            {notice && (
              <p className={`mt-3 rounded-[11px] px-3.5 py-3 text-[12px] font-semibold ${notice.tone === "success" ? "bg-[#edf8f1] text-[#397052]" : "bg-[#fff2f0] text-[#a14f47]"}`}>
                {notice.text}
              </p>
            )}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
                disabled={!canRegister || isSaving}
              >
                <FileImage className="size-4" />
                {image ? "이미지 다시 선택" : "이미지 파일 선택"}
              </Button>
              <Button type="button" onClick={() => void saveReport()} disabled={!image || !canRegister || isSaving}>
                {isSaving ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
                {ownReport ? "업무일지 수정" : "업무일지 등록"}
              </Button>
            </div>
          </div>

          <div>
            <h3 className="text-[14px] font-extrabold text-[#3c4942]">등록된 업무일지</h3>
            <p className="mt-1 text-[11px] text-[#8a948e]">이미지를 누르면 원본 크기로 확인할 수 있습니다.</p>
            <div className="mt-3 space-y-3">
              {reports.length ? reports.map((report) => (
                <article key={report.id} className="overflow-hidden rounded-[14px] border border-[#e1e6e2] bg-[#fafbfa]">
                  <div className="flex items-center gap-2.5 border-b border-[#e8ece9] bg-white px-3 py-2.5">
                    <Avatar name={report.employeeName} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-extrabold text-[#405048]">{report.employeeName}</p>
                      <p className="truncate text-[10px] text-[#8b958f]">{report.department} · {report.employeePosition}</p>
                    </div>
                    {report.canDelete && (
                      <button type="button" onClick={() => void deleteReport(report)} disabled={Boolean(deletingId)} className="flex size-8 items-center justify-center rounded-[9px] text-[#9b625d] hover:bg-[#fff0ee]" aria-label={`${report.employeeName} 업무일지 삭제`}>
                        {deletingId === report.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                      </button>
                    )}
                  </div>
                  <a href={`/api/daily-reports/${report.id}/image?v=${encodeURIComponent(report.updatedAt)}`} target="_blank" rel="noreferrer" className="block bg-white p-2">
                    <Image src={`/api/daily-reports/${report.id}/image?v=${encodeURIComponent(report.updatedAt)}`} alt={`${report.employeeName}님의 ${formatKoreanDate(report.reportDate)} 일일업무일지`} width={900} height={600} unoptimized className="h-auto max-h-[280px] w-full object-contain" />
                  </a>
                </article>
              )) : (
                <div className="rounded-[13px] border border-dashed border-[#d8dfda] py-10 text-center text-[12px] text-[#8a948e]">
                  이 날짜에 등록된 업무일지가 없습니다.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function normalizeImageFile(file: File) {
  const extension = file.type === "image/jpeg" ? "jpg" : file.type === "image/webp" ? "webp" : "png";
  return new File([file], `daily-report.${extension}`, { type: file.type || "image/png" });
}

async function excelHtmlToPng(html: string) {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const table = parsed.querySelector("table");
  if (!table) throw new Error("표가 없습니다.");
  table.querySelectorAll("script, iframe, object, embed, link, meta").forEach((node) => node.remove());

  const wrapper = document.createElement("div");
  wrapper.style.position = "fixed";
  wrapper.style.left = "-100000px";
  wrapper.style.top = "0";
  wrapper.style.width = "max-content";
  wrapper.style.maxWidth = "2200px";
  wrapper.style.padding = "20px";
  wrapper.style.background = "#ffffff";
  wrapper.style.color = "#222222";
  wrapper.style.fontFamily = "Arial, sans-serif";
  wrapper.appendChild(table.cloneNode(true));
  document.body.appendChild(wrapper);

  try {
    const { toBlob } = await import("html-to-image");
    const blob = await toBlob(wrapper, {
      backgroundColor: "#ffffff",
      pixelRatio: 2,
      cacheBust: true,
    });
    if (!blob) throw new Error("이미지 변환에 실패했습니다.");
    return new File([blob], "daily-report.png", { type: "image/png" });
  } finally {
    wrapper.remove();
  }
}

function localDateValue(date: Date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function formatKoreanDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${year}년 ${Number(month)}월 ${Number(day)}일`;
}
