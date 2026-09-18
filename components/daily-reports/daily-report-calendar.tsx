"use client";

import koLocale from "@fullcalendar/core/locales/ko";
import type { EventClickArg, EventContentArg, EventInput } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { DateClickArg } from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import { ClipboardList, Copy, Loader2, Plus, Save, Trash2, X } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { DailyReportItem } from "@/lib/daily-reports/types";
import {
  dailyReportInputSchema,
  type DailyReportWorkItem,
} from "@/schemas/daily-reports";

type CurrentEmployee = {
  id: string;
  name: string;
  position: string;
  department: string;
  role: "employee" | "admin";
};

const emptyWorkItem = (): DailyReportWorkItem => ({
  workContent: "",
  details: "",
  notes: "",
});

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

  function handleDateClick(arg: DateClickArg) {
    setSelectedDate(arg.dateStr);
  }

  function handleEventClick(arg: EventClickArg) {
    setSelectedDate(arg.event.startStr.slice(0, 10));
  }

  return (
    <section className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1480px]">
        <div className="mb-5">
          <p className="text-[13px] font-bold text-[#3b7652]">퇴근 전 업무 기록</p>
          <h2 className="mt-1 text-[26px] font-extrabold tracking-[-0.04em] text-[#29352e]">일일업무일지</h2>
          <p className="mt-2 text-[13px] text-[#7f8983]">
            날짜를 누르고 업무 내용·사항·특이사항을 항목별로 등록하세요.
          </p>
        </div>

        {!schemaAvailable && (
          <div className="mb-5 rounded-[14px] border border-[#efd89e] bg-[#fff9e7] px-4 py-3 text-[13px] font-semibold text-[#856822]">
            구조화 업무일지 SQL을 Supabase에 먼저 적용해 주세요. 기존 이미지 업무일지는 계속 확인할 수 있습니다.
          </div>
        )}

        <div className="rounded-[18px] border border-[#e2e7e3] bg-white p-4 shadow-[0_1px_2px_rgba(25,42,32,0.03),0_12px_30px_rgba(40,62,49,0.035)] sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3 border-b border-[#edf0ee] pb-4">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-[11px] bg-[#e7f6ec] text-[#3a7452]">
                <ClipboardList className="size-[18px]" />
              </span>
              <div>
                <p className="text-sm font-extrabold text-[#344039]">날짜별 업무일지</p>
                <p className="text-[11px] text-[#929a95]">등록된 업무일지 {reports.length}건</p>
              </div>
            </div>
            <span className="rounded-full bg-[#fff5c9] px-3 py-1.5 text-[11px] font-bold text-[#795f16]">날짜를 눌러 등록</span>
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
              ...current.filter((item) =>
                !(item.employeeId === report.employeeId && item.reportDate === report.reportDate)),
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
      <span className="truncate text-[12px] font-extrabold text-[#356047]">{arg.event.title}</span>
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
  const ownReport = reports.find((report) => report.employeeId === currentEmployee.id);
  const [workItems, setWorkItems] = useState<DailyReportWorkItem[]>(
    ownReport?.workItems.length ? ownReport.workItems : [emptyWorkItem()],
  );
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingPrevious, setIsLoadingPrevious] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const canRegister = date <= localDateValue(new Date()) && schemaAvailable;

  function updateWorkItem(index: number, field: keyof DailyReportWorkItem, value: string) {
    setWorkItems((current) => current.map((item, itemIndex) =>
      itemIndex === index ? { ...item, [field]: value } : item));
  }

  function addWorkItem() {
    if (workItems.length >= 50) {
      setNotice({ tone: "error", text: "업무 항목은 최대 50개까지 추가할 수 있습니다." });
      return;
    }
    setWorkItems((current) => [...current, emptyWorkItem()]);
  }

  function removeWorkItem(index: number) {
    setWorkItems((current) => current.length === 1
      ? [emptyWorkItem()]
      : current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function loadPreviousReport() {
    setIsLoadingPrevious(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/daily-reports?before=${encodeURIComponent(date)}`, {
        cache: "no-store",
      });
      const result = (await response.json()) as {
        message?: string;
        reportDate?: string;
        workItems?: DailyReportWorkItem[];
      };
      if (!response.ok || !result.workItems?.length) {
        throw new Error(result.message ?? "불러올 이전 업무일지가 없습니다.");
      }
      setWorkItems(result.workItems.map((item) => ({ ...item })));
      setNotice({
        tone: "success",
        text: `${formatKoreanDate(result.reportDate ?? date)} 업무 ${result.workItems.length}개를 불러왔습니다.`,
      });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "이전 업무를 불러오지 못했습니다.",
      });
    } finally {
      setIsLoadingPrevious(false);
    }
  }

  async function saveReport() {
    if (!canRegister) return;
    const parsed = dailyReportInputSchema.safeParse({ reportDate: date, workItems });
    if (!parsed.success) {
      setNotice({ tone: "error", text: parsed.error.issues[0]?.message ?? "업무일지 내용을 확인해 주세요." });
      return;
    }

    setIsSaving(true);
    setNotice(null);
    try {
      const response = await fetch("/api/daily-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const result = (await response.json()) as { message?: string; report?: DailyReportItem };
      if (!response.ok || !result.report) {
        throw new Error(result.message ?? "일일업무일지를 등록하지 못했습니다.");
      }
      onSaved(result.report);
      setWorkItems(result.report.workItems.map((item) => ({ ...item })));
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
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "업무일지를 삭제하지 못했습니다." });
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
      <div className="max-h-[94vh] w-full max-w-[1500px] overflow-y-auto rounded-[20px] border border-[#dde3df] bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[12px] font-bold text-[#3b7652]">{formatKoreanDate(date)}</p>
            <h2 id="daily-report-dialog-title" className="mt-1 text-[22px] font-extrabold text-[#2e3932]">일일 업무일지 등록</h2>
          </div>
          <button type="button" onClick={onClose} disabled={isSaving} className="flex size-9 items-center justify-center rounded-[10px] text-[#7c867f] hover:bg-[#f0f3f1]" aria-label="일일업무일지 닫기">
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-[14px] font-extrabold text-[#3c4942]">내 업무 항목</h3>
                <p className="mt-1 text-[11px] text-[#8a948e]">필요한 만큼 항목을 추가해 각각 작성할 수 있습니다.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={() => void loadPreviousReport()} disabled={!canRegister || isLoadingPrevious || isSaving}>
                  {isLoadingPrevious ? <Loader2 className="size-4 animate-spin" /> : <Copy className="size-4" />}
                  이전 업무 불러오기
                </Button>
                <Button type="button" variant="secondary" onClick={addWorkItem} disabled={!canRegister || workItems.length >= 50 || isSaving}>
                  <Plus className="size-4" /> 업무 항목 추가
                </Button>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto rounded-[10px] border border-[#cfd8d2] bg-white">
              <table className="w-full min-w-[820px] table-fixed border-collapse text-left">
                <colgroup>
                  <col className="w-[52px]" />
                  <col className="w-[32%]" />
                  <col className="w-[32%]" />
                  <col className="w-[32%]" />
                  <col className="w-[52px]" />
                </colgroup>
                <thead>
                  <tr className="bg-[#edf3ef] text-[12px] font-extrabold text-[#45534b]">
                    <th scope="col" className="border-b border-r border-[#cfd8d2] px-2 py-2 text-center">번호</th>
                    <th scope="col" className="border-b border-r border-[#cfd8d2] px-3 py-2">업무 내용 <span className="text-[#b45d52]">*</span></th>
                    <th scope="col" className="border-b border-r border-[#cfd8d2] px-3 py-2">사항</th>
                    <th scope="col" className="border-b border-r border-[#cfd8d2] px-3 py-2">특이사항</th>
                    <th scope="col" className="border-b border-[#cfd8d2] px-2 py-2 text-center">삭제</th>
                  </tr>
                </thead>
                <tbody>
                  {workItems.map((item, index) => (
                    <tr key={index} className="align-top odd:bg-white even:bg-[#fbfcfb]">
                      <th scope="row" className="border-r border-b border-[#dfe5e1] px-2 py-3 text-center text-[12px] font-extrabold text-[#397052]">
                        {index + 1}
                      </th>
                      <td className="border-r border-b border-[#dfe5e1] p-0">
                        <textarea
                          value={item.workContent}
                          onChange={(event) => updateWorkItem(index, "workContent", event.target.value)}
                          maxLength={500}
                          rows={2}
                          disabled={!canRegister || isSaving}
                          placeholder="진행한 업무를 입력하세요."
                          aria-label={`${index + 1}번 업무 내용`}
                          className={tableTextareaClass}
                        />
                      </td>
                      <td className="border-r border-b border-[#dfe5e1] p-0">
                        <textarea
                          value={item.details}
                          onChange={(event) => updateWorkItem(index, "details", event.target.value)}
                          maxLength={1000}
                          rows={2}
                          disabled={!canRegister || isSaving}
                          placeholder="업무 진행 사항"
                          aria-label={`${index + 1}번 사항`}
                          className={tableTextareaClass}
                        />
                      </td>
                      <td className="border-r border-b border-[#dfe5e1] p-0">
                        <textarea
                          value={item.notes}
                          onChange={(event) => updateWorkItem(index, "notes", event.target.value)}
                          maxLength={1000}
                          rows={2}
                          disabled={!canRegister || isSaving}
                          placeholder="특이사항"
                          aria-label={`${index + 1}번 특이사항`}
                          className={tableTextareaClass}
                        />
                      </td>
                      <td className="border-b border-[#dfe5e1] px-2 py-2 text-center">
                        <button type="button" onClick={() => removeWorkItem(index)} disabled={!canRegister || isSaving} className="inline-flex size-8 items-center justify-center rounded-[7px] text-[#9b625d] hover:bg-[#fff0ee] disabled:opacity-50" aria-label={`${index + 1}번 업무 항목 삭제`}>
                          <Trash2 className="size-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!canRegister && (
              <p className="mt-3 rounded-[11px] bg-[#fff8df] px-3.5 py-3 text-[12px] font-semibold text-[#80651a]">
                {schemaAvailable ? "미래 날짜에는 업무일지를 등록할 수 없습니다." : "구조화 업무일지 SQL 적용 후 등록할 수 있습니다."}
              </p>
            )}
            {notice && (
              <p className={`mt-3 rounded-[11px] px-3.5 py-3 text-[12px] font-semibold ${notice.tone === "success" ? "bg-[#edf8f1] text-[#397052]" : "bg-[#fff2f0] text-[#a14f47]"}`}>
                {notice.text}
              </p>
            )}
            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="text-[11px] font-bold text-[#77847c]">현재 {workItems.length}개 항목</span>
              <Button type="button" onClick={() => void saveReport()} disabled={!canRegister || isSaving}>
                {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {ownReport ? "업무일지 수정" : "업무일지 등록"}
              </Button>
            </div>
          </div>

          <div>
            <h3 className="text-[14px] font-extrabold text-[#3c4942]">등록된 업무일지</h3>
            <p className="mt-1 text-[11px] text-[#8a948e]">같은 날짜에 등록된 직원별 업무를 확인합니다.</p>
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
                  {report.workItems.length > 0 && (
                    <div className="space-y-2 p-3">
                      {report.workItems.map((item, index) => (
                        <div key={index} className="rounded-[11px] border border-[#e5eae6] bg-white p-3">
                          <p className="text-[11px] font-extrabold text-[#356047]">{index + 1}. {item.workContent}</p>
                          {item.details && <p className="mt-2 whitespace-pre-wrap text-[11px] leading-5 text-[#66736b]"><span className="font-bold text-[#48564e]">사항</span> · {item.details}</p>}
                          {item.notes && <p className="mt-1 whitespace-pre-wrap text-[11px] leading-5 text-[#7b6549]"><span className="font-bold text-[#665036]">특이사항</span> · {item.notes}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                  {report.hasLegacyImage && (
                    <a href={`/api/daily-reports/${report.id}/image?v=${encodeURIComponent(report.updatedAt)}`} target="_blank" rel="noreferrer" className="block bg-white p-2">
                      <p className="mb-2 text-center text-[10px] font-bold text-[#7c8780]">기존 이미지 업무일지 · 이미지를 누르면 크게 열립니다.</p>
                      <Image src={`/api/daily-reports/${report.id}/image?v=${encodeURIComponent(report.updatedAt)}`} alt={`${report.employeeName}님의 ${formatKoreanDate(report.reportDate)} 일일업무일지`} width={1400} height={900} unoptimized className={`h-auto w-full object-contain ${currentEmployee.role === "admin" ? "max-h-[560px]" : "max-h-[280px]"}`} />
                    </a>
                  )}
                </article>
              )) : (
                <div className="rounded-[13px] border border-dashed border-[#d8dfda] py-10 text-center text-[12px] text-[#8a948e]">이 날짜에 등록된 업무일지가 없습니다.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const tableTextareaClass = "block min-h-[58px] w-full resize-y border-0 bg-transparent px-3 py-2.5 text-[12px] leading-[19px] text-[#3f4b44] outline-none transition placeholder:text-[#a1aaa4] focus:bg-[#f4fbf6] focus:ring-2 focus:ring-inset focus:ring-[#8ab498] disabled:bg-[#f2f4f2]";

function localDateValue(date: Date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function formatKoreanDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${year}년 ${Number(month)}월 ${Number(day)}일`;
}
