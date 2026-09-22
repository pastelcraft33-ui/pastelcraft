"use client";

import koLocale from "@fullcalendar/core/locales/ko";
import type { EventApi, EventClickArg, EventContentArg, EventDropArg, EventInput } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin, { type EventResizeDoneArg } from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import {
  BriefcaseBusiness,
  CalendarPlus,
  CalendarDays,
  CalendarOff,
  Check,
  Clock3,
  ExternalLink,
  Link2,
  Loader2,
  MapPin,
  Paperclip,
  Pencil,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  calendarMonthLabel,
  calendarMonthValue,
  overlapsCalendarMonth,
} from "@/lib/calendar/month-range";
import type {
  CompanyHolidayCalendarItem,
  LeaveCalendarItem,
} from "@/lib/leave/types";
import type {
  TaskCalendarItem,
} from "@/lib/tasks/types";
import { cn } from "@/lib/utils";

type CalendarMode = "task" | "leave";
type ScheduleKind = CalendarMode | "holiday";

type ScheduleMeta = {
  kind: ScheduleKind;
  ownerName: string;
  department: string;
  position: string;
  status: string;
  statusLabel: string;
  description: string;
  detail: string;
  imageUrl?: string | null;
  participants?: TaskCalendarItem["participants"];
  canEdit?: boolean;
  leaveTypeLabel?: string;
  dayTypeLabel?: string;
};

const statusTheme: Record<string, { bg: string; text: string; dot: string }> = {
  task: { bg: "#e8f4ec", text: "#35684b", dot: "#6aaa7f" },
  pending: { bg: "#fff5cf", text: "#80651a", dot: "#e0b940" },
  approved: { bg: "#e5f6eb", text: "#32714b", dot: "#58ae77" },
  rejected: { bg: "#fee8e7", text: "#a94743", dot: "#dc6b66" },
  cancelled: { bg: "#ecefed", text: "#66706a", dot: "#929b95" },
  holiday: { bg: "#fce8ec", text: "#9c3f55", dot: "#d86880" },
};

function taskEvents(tasks: TaskCalendarItem[]): EventInput[] {
  return tasks.map((task) => ({
    id: task.id,
    title: task.title,
    start: task.startDate,
    end: nextDate(task.endDate),
    editable: task.canEdit,
    startEditable: task.canEdit,
    durationEditable: task.canEdit,
    extendedProps: {
      kind: "task",
      ownerName: task.ownerName,
      department: task.departmentLabel,
      position: task.ownerPosition,
      status: "task",
      statusLabel: "",
      description: task.description ?? "",
      detail: "",
      imageUrl: task.ownerImageUrl,
      participants: task.participants,
      canEdit: task.canEdit,
    } satisfies ScheduleMeta,
  }));
}

function nextDate(dateValue: string) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function leaveEvents(leaves: LeaveCalendarItem[]): EventInput[] {
  return leaves.map((leave) => ({
    id: leave.id,
    title: `${leave.employeeName} · ${leave.leaveTypeLabel}`,
    start: leave.startDate,
    end: nextDate(leave.endDate),
    editable: false,
    extendedProps: {
      kind: "leave",
      ownerName: leave.employeeName,
      department: leave.departmentLabel,
      position: leave.employeePosition,
      status: leave.status,
      statusLabel: leave.statusLabel,
      description: "",
      detail: "",
      imageUrl: leave.employeeImageUrl,
      canEdit: leave.canEdit,
      leaveTypeLabel: leave.leaveTypeLabel,
      dayTypeLabel: leave.dayTypeLabel,
    } satisfies ScheduleMeta,
  }));
}

function holidayEvents(holidays: CompanyHolidayCalendarItem[], companyName: string): EventInput[] {
  return holidays.map((holiday) => {
    const isPublicHoliday = holiday.holidayType === "public";
    return {
      id: `holiday-${holiday.id}`,
      title: holiday.title,
      start: holiday.holidayDate,
      editable: false,
      extendedProps: {
        kind: "holiday",
        ownerName: isPublicHoliday ? "대한민국" : companyName,
        department: isPublicHoliday ? "대한민국 공통" : "회사 공통",
        position: isPublicHoliday ? "공휴일" : "휴무일",
        status: "holiday",
        statusLabel: isPublicHoliday ? "대한민국 공휴일" : "회사 휴무일",
        description:
          holiday.description ??
          (isPublicHoliday
            ? "대한민국 공식 공휴일입니다."
            : "회사 지정 휴무일입니다."),
        detail: isPublicHoliday ? "대한민국 공식 휴일" : "전사 공통 일정",
      } satisfies ScheduleMeta,
    };
  });
}

export function WorkspaceCalendar({
  tasks,
  leaves,
  holidays,
  defaultMode,
  weekStartsOn,
  companyName,
  canViewAdminOverview,
}: {
  tasks: TaskCalendarItem[];
  leaves: LeaveCalendarItem[];
  holidays: CompanyHolidayCalendarItem[];
  defaultMode: CalendarMode;
  weekStartsOn: 0 | 1;
  companyName: string;
  canViewAdminOverview: boolean;
}) {
  const router = useRouter();
  const calendarRef = useRef<FullCalendar | null>(null);
  const [mode, setMode] = useState<CalendarMode>(defaultMode);
  const [overviewMonth, setOverviewMonth] = useState(() =>
    calendarMonthValue(new Date()),
  );
  const [selected, setSelected] = useState<EventClickArg["event"] | null>(null);
  const [isScheduleSaving, setIsScheduleSaving] = useState(false);
  const [scheduleNotice, setScheduleNotice] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const events = useMemo(
    () => mode === "task"
      ? [...taskEvents(tasks), ...holidayEvents(holidays, companyName)]
      : [...leaveEvents(leaves), ...holidayEvents(holidays, companyName)],
    [companyName, holidays, leaves, mode, tasks],
  );
  const publicHolidayDates = useMemo(
    () =>
      new Set(
        holidays
          .filter((holiday) => holiday.holidayType === "public")
          .map((holiday) => holiday.holidayDate),
      ),
    [holidays],
  );

  useEffect(() => {
    if (window.matchMedia("(max-width: 639px)").matches) {
      calendarRef.current?.getApi().changeView("listMonth");
    }
  }, [mode]);

  function changeMode(nextMode: CalendarMode) {
    setMode(nextMode);
    setSelected(null);
  }

  async function saveScheduleChange(event: EventApi, revert: () => void) {
    if (!event.allDay || !event.start) {
      revert();
      setScheduleNotice({
        tone: "error",
        message: "현재는 날짜 이동만 지원합니다. 시간 단위 이동은 사용할 수 없습니다.",
      });
      return;
    }

    const exclusiveEnd = event.end ?? new Date(event.start.getTime() + 86_400_000);
    const inclusiveEnd = new Date(exclusiveEnd);
    inclusiveEnd.setDate(inclusiveEnd.getDate() - 1);
    const startDate = localDateValue(event.start);
    const endDate = localDateValue(inclusiveEnd);

    setIsScheduleSaving(true);
    setScheduleNotice(null);
    try {
      const response = await fetch(`/api/tasks/${event.id}/schedule`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ startDate, endDate }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(result.message ?? "업무 일정을 변경하지 못했습니다.");
      }
      setScheduleNotice({
        tone: "success",
        message: "업무 일정을 변경했습니다.",
      });
      router.refresh();
    } catch (error) {
      revert();
      setScheduleNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "업무 일정을 변경하지 못했습니다.",
      });
    } finally {
      setIsScheduleSaving(false);
    }
  }

  function handleEventDrop(arg: EventDropArg) {
    void saveScheduleChange(arg.event, arg.revert);
  }

  function handleEventResize(arg: EventResizeDoneArg) {
    void saveScheduleChange(arg.event, arg.revert);
  }

  return (
    <>
      <section className="p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-[1480px]">
          <div className="mb-5 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
            <div>
              <div
                role="tablist"
                aria-label="캘린더 종류"
                className="inline-flex rounded-[12px] border border-[#e0e5e1] bg-[#edf1ee] p-1"
              >
                <CalendarTab active={mode === "leave"} onClick={() => changeMode("leave")}>
                  휴가 캘린더
                </CalendarTab>
                <CalendarTab active={mode === "task"} onClick={() => changeMode("task")}>
                  업무 캘린더
                </CalendarTab>
              </div>
              <p className="mt-3 text-[13px] text-[#7f8983]">
                {mode === "task"
                  ? "모든 직원의 업무 일정을 한눈에 확인합니다. 수정 권한이 있는 일정은 드래그해 이동·기간 변경할 수 있습니다."
                  : "승인 상태를 포함한 팀 휴가 일정을 확인합니다."}
              </p>
            </div>

            <div className="flex items-center">
              <Button asChild className="ml-0 xl:ml-1">
                <Link href={mode === "task" ? "/tasks/new" : "/leave/new"}>
                  <CalendarPlus className="size-[17px]" />
                  {mode === "task" ? "업무 등록" : "휴가 신청"}
                </Link>
              </Button>
            </div>
          </div>

          <div className="rounded-[18px] border border-[#e2e7e3] bg-white p-4 shadow-[0_1px_2px_rgba(25,42,32,0.03),0_12px_30px_rgba(40,62,49,0.035)] sm:p-6">
            {mode === "task" && scheduleNotice && (
              <div
                role="status"
                className={cn(
                  "mb-4 rounded-[11px] border px-4 py-3 text-[13px] font-bold",
                  scheduleNotice.tone === "success"
                    ? "border-[#cce4d4] bg-[#edf8f1] text-[#397052]"
                    : "border-[#efcbc7] bg-[#fff3f2] text-[#994f49]",
                )}
              >
                {scheduleNotice.message}
              </div>
            )}
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-[#edf0ee] pb-4">
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 items-center justify-center rounded-[10px] bg-[#e7f6ec] text-[#3a7452]">
                  <CalendarDays className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-bold text-[#344039]">
                    {mode === "task" ? "전체 업무" : "전체 휴가"}
                  </p>
                  <p className="text-[11px] text-[#929a95]">
                    {mode === "task"
                      ? `등록된 업무 ${tasks.length}건`
                      : `휴가 ${leaves.length}건 · 회사 휴무일 ${holidays.length}건`}
                  </p>
                </div>
              </div>
              <StatusLegend mode={mode} />
            </div>

            <div className="pc-calendar overflow-x-auto pb-2">
              <FullCalendar
                ref={calendarRef}
                key={mode}
                plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                locale={koLocale}
                firstDay={weekStartsOn}
                height="auto"
                dayMaxEvents={3}
                events={events}
                editable={mode === "task"}
                eventResizableFromStart
                eventAllow={(dropInfo, draggedEvent) =>
                  mode === "task" &&
                  !isScheduleSaving &&
                  dropInfo.allDay &&
                  draggedEvent?.extendedProps.kind === "task" &&
                  Boolean(draggedEvent?.extendedProps.canEdit)
                }
                eventDrop={handleEventDrop}
                eventResize={handleEventResize}
                datesSet={(arg) =>
                  setOverviewMonth(calendarMonthValue(arg.view.calendar.getDate()))
                }
                eventContent={renderEventContent}
                eventClick={(arg) => setSelected(arg.event)}
                dayCellClassNames={(arg) =>
                  publicHolidayDates.has(localDateValue(arg.date))
                    ? ["fc-day-public-holiday"]
                    : []
                }
                headerToolbar={{
                  left: "prev,next today",
                  center: "title",
                  right: "dayGridMonth,timeGridWeek,timeGridDay,listMonth",
                }}
                buttonText={{
                  today: "오늘",
                  month: "월간",
                  week: "주간",
                  day: "일간",
                  list: "목록",
                }}
                moreLinkText={(num) => `+${num}개 더보기`}
                noEventsText="표시할 일정이 없습니다."
              />
            </div>
          </div>

          {canViewAdminOverview && (
            <ScheduleOverview
              mode={mode}
              tasks={tasks}
              leaves={leaves}
              monthValue={overviewMonth}
            />
          )}
        </div>
      </section>

      {selected && <ScheduleDialog event={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function localDateValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function ScheduleOverview({
  mode,
  tasks,
  leaves,
  monthValue,
}: {
  mode: CalendarMode;
  tasks: TaskCalendarItem[];
  leaves: LeaveCalendarItem[];
  monthValue: string;
}) {
  const monthlyTasks = useMemo(
    () =>
      tasks.filter((task) =>
        overlapsCalendarMonth(task.startDate, task.endDate, monthValue),
      ),
    [monthValue, tasks],
  );
  const monthlyLeaves = useMemo(
    () =>
      leaves.filter((leave) =>
        overlapsCalendarMonth(leave.startDate, leave.endDate, monthValue),
      ),
    [leaves, monthValue],
  );
  const groups = useMemo(() => {
    if (mode === "task") {
      const byEmployee = new Map<string, { id: string; name: string; position: string; department: string; imageUrl: string | null; items: TaskCalendarItem[] }>();
      monthlyTasks.forEach((task) => {
        const current = byEmployee.get(task.ownerId) ?? {
          id: task.ownerId,
          name: task.ownerName,
          position: task.ownerPosition,
          department: task.departmentLabel,
          imageUrl: task.ownerImageUrl,
          items: [],
        };
        current.items.push(task);
        byEmployee.set(task.ownerId, current);
      });
      return [...byEmployee.values()]
        .map((group) => ({ ...group, items: group.items.sort((a, b) => a.startDate.localeCompare(b.startDate)) }))
        .sort((a, b) => a.name.localeCompare(b.name, "ko"));
    }

    const byEmployee = new Map<string, { id: string; name: string; position: string; department: string; imageUrl: string | null; items: LeaveCalendarItem[] }>();
    monthlyLeaves.forEach((leave) => {
      const current = byEmployee.get(leave.employeeId) ?? {
        id: leave.employeeId,
        name: leave.employeeName,
        position: leave.employeePosition,
        department: leave.departmentLabel,
        imageUrl: leave.employeeImageUrl,
        items: [],
      };
      current.items.push(leave);
      byEmployee.set(leave.employeeId, current);
    });
    return [...byEmployee.values()]
      .map((group) => ({ ...group, items: group.items.sort((a, b) => a.startDate.localeCompare(b.startDate)) }))
      .sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }, [mode, monthlyLeaves, monthlyTasks]);

  const monthlyItemCount =
    mode === "task" ? monthlyTasks.length : monthlyLeaves.length;

  return (
    <section className="mt-5 rounded-[18px] border border-[#e2e7e3] bg-[#f9fbf9] p-4 shadow-[0_8px_24px_rgba(40,62,49,0.025)] sm:p-5">
      <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-[11px] bg-[#e4f4e9] text-[#397052]">
            {mode === "task" ? <BriefcaseBusiness className="size-[18px]" /> : <CalendarDays className="size-[18px]" />}
          </span>
          <div>
            <h3 className="text-[15px] font-extrabold tracking-[-0.02em] text-[#334039]">
              {mode === "task" ? "직원별 업무 한눈에 보기" : "직원별 휴가 일정 한눈에 보기"}
            </h3>
            <p className="mt-0.5 text-[11px] text-[#89928d]">
              {calendarMonthLabel(monthValue)}에 해당하는 일정만 표시합니다.
            </p>
          </div>
        </div>
        <p className="text-[11px] font-bold text-[#69756e]">{groups.length}명 · {monthlyItemCount}건</p>
      </div>

      {groups.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {groups.map((group) => (
            <article key={group.id} className="overflow-hidden rounded-[15px] border border-[#e0e6e2] bg-white">
              <div className="flex items-center gap-3 border-b border-[#edf0ee] px-4 py-3.5">
                <Avatar name={group.name} imageUrl={group.imageUrl} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-extrabold text-[#37433c]">{group.name}</p>
                  <p className="mt-0.5 truncate text-[10px] font-semibold text-[#89928d]">{group.department} · {group.position}</p>
                </div>
                <span className="rounded-full bg-[#f0f4f1] px-2.5 py-1 text-[10px] font-extrabold text-[#647068]">{group.items.length}건</span>
              </div>
              <div className="divide-y divide-[#f0f2f0] px-4">
                {mode === "task"
                  ? <TaskEmployeeOverview group={group as { id: string; name: string; position: string; department: string; imageUrl: string | null; items: TaskCalendarItem[] }} />
                  : (group.items as LeaveCalendarItem[]).map((leave) => <LeaveOverviewRow key={leave.id} leave={leave} />)}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-[12px] border border-dashed border-[#d9e1dc] bg-white py-9 text-center text-[12px] text-[#87918b]">
          표시할 {mode === "task" ? "업무" : "휴가 일정"}이 없습니다.
        </div>
      )}
    </section>
  );
}

function TaskEmployeeOverview({
  group,
}: {
  group: {
    id: string;
    name: string;
    position: string;
    department: string;
    imageUrl: string | null;
    items: TaskCalendarItem[];
  };
}) {
  return (
    <div className="flex items-center gap-3 py-4">
      <Avatar name={group.name} imageUrl={group.imageUrl} size="sm" />
      <div className="min-w-0 flex-1">
        <Link
          href={`/employees/${group.id}`}
          className="inline-flex max-w-full items-center gap-1 text-[13px] font-extrabold text-[#35684b] hover:text-[#244c35] hover:underline"
        >
          <span className="truncate">{group.name}</span>
          <ExternalLink className="size-3.5 shrink-0" />
        </Link>
        <p className="mt-1 text-[11px] font-semibold text-[#7e8982]">
          {group.items.length}건의 업무가 등록되어 있습니다.
        </p>
      </div>
      <span className="shrink-0 rounded-full bg-[#edf8f1] px-2.5 py-1 text-[10px] font-extrabold text-[#397052]">
        상세 보기
      </span>
    </div>
  );
}

function LeaveOverviewRow({ leave }: { leave: LeaveCalendarItem }) {
  const theme = statusTheme[leave.status] ?? statusTheme.pending;
  return (
    <div className="py-3.5">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 flex-1 text-[12px] font-extrabold leading-5 text-[#414d46]">{leave.leaveTypeLabel} · {leave.dayTypeLabel}</p>
        <span className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-extrabold" style={{ backgroundColor: theme.bg, color: theme.text }}>{leave.statusLabel}</span>
      </div>
      <p className="mt-1.5 text-[10px] font-semibold text-[#7e8982]">{shortDate(leave.startDate)} ~ {shortDate(leave.endDate)}</p>
    </div>
  );
}

function shortDate(value: string) {
  const [, month, day] = value.split("-");
  return `${Number(month)}월 ${Number(day)}일`;
}

function CalendarTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "h-11 rounded-[9px] px-4 text-[13px] font-bold transition-all focus:outline-none focus:ring-3 focus:ring-emerald-100 sm:h-9",
        active
          ? "bg-white text-[#2d6245] shadow-[0_1px_3px_rgba(35,50,41,0.09)]"
          : "text-[#7b857f] hover:text-[#48534c]",
      )}
    >
      {children}
    </button>
  );
}

function renderEventContent(arg: EventContentArg) {
  const meta = arg.event.extendedProps as ScheduleMeta;
  const theme = statusTheme[meta.status] ?? statusTheme.task;

  return (
    <div
      className={cn(
        "flex w-full items-center gap-1.5 px-1.5 py-1.5",
        meta.kind === "task" && meta.canEdit
          ? "cursor-grab active:cursor-grabbing"
          : "cursor-pointer",
      )}
      style={{ backgroundColor: theme.bg, color: theme.text }}
      title={meta.kind === "task"
        ? `${arg.event.title}${meta.canEdit ? " · 드래그해 일정 변경" : ""}`
        : `${arg.event.title} · ${meta.statusLabel}`}
    >
      {meta.kind === "holiday" ? (
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white/80">
          <CalendarOff className="size-3 text-[#b54d65]" />
        </span>
      ) : meta.kind === "task" ? (
        <ProfileStack
          owner={{ name: meta.ownerName, imageUrl: meta.imageUrl ?? null }}
          participants={meta.participants ?? []}
          compact
        />
      ) : (
        <Avatar name={meta.ownerName} imageUrl={meta.imageUrl} size="sm" className="size-5 text-[9px] ring-1 ring-white/80" />
      )}
      <span className="min-w-0 flex-1 truncate text-[13px] font-bold">{arg.event.title}</span>
      <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: theme.dot }} />
    </div>
  );
}

function ProfileStack({
  owner,
  participants,
  compact = false,
}: {
  owner: { name: string; imageUrl: string | null };
  participants: TaskCalendarItem["participants"];
  compact?: boolean;
}) {
  const profiles = [owner, ...participants].slice(0, compact ? 3 : 4);
  const remaining = 1 + participants.length - profiles.length;
  return (
    <span className="flex shrink-0 items-center" aria-label={`참여자: ${[owner.name, ...participants.map((participant) => participant.name)].join(", ")}`}>
      {profiles.map((profile, index) => (
        <Avatar
          key={`${profile.name}-${index}`}
          name={profile.name}
          imageUrl={profile.imageUrl}
          size="sm"
          className={cn("size-5 border border-white text-[9px] ring-0", index > 0 && "-ml-1.5")}
        />
      ))}
      {remaining > 0 && (
        <span className="-ml-1.5 flex size-5 items-center justify-center rounded-full border border-white bg-[#637269] text-[8px] font-extrabold text-white">
          +{remaining}
        </span>
      )}
    </span>
  );
}

function StatusLegend({ mode }: { mode: CalendarMode }) {
  const items = mode === "task"
    ? [["holiday", "공휴일 · 회사 휴무일"]]
    : [
        ["pending", "승인 대기"],
        ["approved", "승인"],
        ["rejected", "반려"],
        ["cancelled", "취소"],
        ["holiday", "공휴일 · 회사 휴무일"],
      ];

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {items.map(([key, label]) => (
        <span key={key} className="flex items-center gap-1.5 text-[11px] font-medium text-[#737d77]">
          <span className="size-2 rounded-full" style={{ backgroundColor: statusTheme[key].dot }} />
          {label}
        </span>
      ))}
    </div>
  );
}

type TaskDetail = {
  description: string | null;
  relatedLink: string | null;
  canViewDetail: boolean;
  canEdit: boolean;
  participants: {
    id: string;
    name: string;
    position: string;
    department: string;
    imageUrl: string | null;
  }[];
  attachments: {
    id: string;
    fileName: string;
    fileSizeBytes: number;
    downloadUrl: string;
  }[];
};

type LeaveDetail = {
  reason: string | null;
  handoverNote: string | null;
  rejectionReason: string | null;
  canViewDetail: boolean;
  canEdit: boolean;
  teamLeadStatus: string;
  teamLeadApprovalSkipped: boolean;
  teamLeadReviewer: string | null;
  representativeStatus: string;
  representativeReviewer: string | null;
  attachment: {
    fileName: string;
    fileSizeBytes: number;
    downloadUrl: string;
  } | null;
};

function ScheduleDialog({
  event,
  onClose,
}: {
  event: EventClickArg["event"];
  onClose: () => void;
}) {
  const meta = event.extendedProps as ScheduleMeta;
  const [taskDetail, setTaskDetail] = useState<TaskDetail | null>(null);
  const [leaveDetail, setLeaveDetail] = useState<LeaveDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const theme = statusTheme[meta.status] ?? statusTheme.task;
  const start = event.start?.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
  const endDate = event.end ? new Date(event.end.getTime() - 86400000) : null;
  const end = endDate?.toLocaleDateString("ko-KR", { month: "long", day: "numeric" });

  useEffect(() => {
    if (meta.kind === "holiday") return;
    let disposed = false;

    const endpoint =
      meta.kind === "task" ? `/api/tasks/${event.id}` : `/api/leave/${event.id}`;
    void fetch(endpoint, { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as {
          message?: string;
          task?: TaskDetail;
          leave?: LeaveDetail;
        };
        const detail = meta.kind === "task" ? result.task : result.leave;
        if (!response.ok || !detail) {
          throw new Error(result.message ?? "일정 상세를 불러오지 못했습니다.");
        }
        if (!disposed) {
          if (meta.kind === "task") setTaskDetail(detail as TaskDetail);
          else setLeaveDetail(detail as LeaveDetail);
        }
      })
      .catch((error) => {
        if (!disposed) {
          setDetailError(
            error instanceof Error ? error.message : "일정 상세를 불러오지 못했습니다.",
          );
        }
      });

    return () => {
      disposed = true;
    };
  }, [event.id, meta.kind]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1b2921]/35 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div role="dialog" aria-modal="true" aria-label="일정 상세" className="flex max-h-[calc(100vh-2rem)] w-full max-w-[460px] flex-col overflow-hidden rounded-[20px] border border-white/60 bg-white shadow-[0_24px_80px_rgba(23,43,31,0.2)]">
        <div className="flex shrink-0 items-start justify-between border-b border-[#ecefec] px-6 py-5">
          <div className="min-w-0 pr-4">
            {meta.kind !== "task" && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold"
                style={{ backgroundColor: theme.bg, color: theme.text }}
              >
                <span className="size-1.5 rounded-full" style={{ backgroundColor: theme.dot }} />
                {meta.statusLabel}
              </span>
            )}
            <h2 className={cn("text-xl font-extrabold tracking-[-0.03em] text-[#29352e]", meta.kind !== "task" && "mt-3")}>{event.title}</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="닫기" className="-mr-2 -mt-1">
            <X className="size-5" />
          </Button>
        </div>

        <div className="space-y-5 overflow-y-auto px-6 py-5">
          <div className="flex items-center gap-3 rounded-[14px] bg-[#f7f9f7] p-3.5">
            {meta.kind === "holiday" ? (
              <span className="flex size-12 items-center justify-center rounded-[14px] bg-[#fce8ec] text-[#a3445a]">
                <CalendarOff className="size-5" />
              </span>
            ) : (
              <Avatar name={meta.ownerName} imageUrl={meta.imageUrl} size="lg" />
            )}
            <div>
              <p className="text-sm font-bold text-[#354139]">{meta.ownerName}</p>
              <p className="mt-0.5 text-xs text-[#858e88]">{meta.department} · {meta.position}</p>
            </div>
          </div>

          {meta.kind === "task" && (taskDetail?.participants ?? meta.participants ?? []).length > 0 && (
            <div>
              <p className="mb-2 text-xs font-bold text-[#7a847e]">함께 참여하는 직원</p>
              <div className="flex flex-wrap gap-2">
                {(taskDetail?.participants ?? meta.participants ?? []).map((participant) => (
                  <span key={participant.id} className="inline-flex items-center gap-2 rounded-full border border-[#dfe6e1] bg-white py-1.5 pl-1.5 pr-3">
                    <Avatar name={participant.name} imageUrl={participant.imageUrl} size="sm" className="size-7" />
                    <span>
                      <span className="block text-[12px] font-extrabold leading-4 text-[#465249]">{participant.name}</span>
                      <span className="block text-[10px] leading-4 text-[#8a948e]">{participant.department} · {participant.position}</span>
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <DetailRow icon={Clock3} label="기간" value={`${start ?? ""}${end ? ` ~ ${end}` : ""}`} />
          <DetailRow icon={MapPin} label="부서" value={meta.department} />
          {meta.kind === "leave" && meta.dayTypeLabel && (
            <DetailRow icon={CalendarDays} label="단위" value={meta.dayTypeLabel} />
          )}

          {meta.kind === "task" ? (
            <TaskDetailContent detail={taskDetail} error={detailError} />
          ) : meta.kind === "leave" ? (
            <LeaveDetailContent detail={leaveDetail} error={detailError} />
          ) : (
            <div>
              <p className="text-xs font-bold text-[#7a847e]">휴무일 안내</p>
              <p className="mt-2 text-sm leading-6 text-[#4d5852]">{meta.description}</p>
            </div>
          )}
        </div>

        <div className="flex shrink-0 justify-end gap-2 bg-[#fafbfa] px-6 py-4">
          {meta.kind === "task" && (taskDetail?.canEdit ?? meta.canEdit) && (
            <Button asChild variant="secondary" size="sm">
              <Link href={`/tasks/new?edit=${event.id}`}>
                <Pencil className="size-4" /> 수정·삭제
              </Link>
            </Button>
          )}
          {meta.kind === "leave" && (leaveDetail?.canEdit ?? meta.canEdit) && (
            <Button asChild variant="secondary" size="sm">
              <Link href={`/leave/new?edit=${event.id}`}>
                <Pencil className="size-4" /> 휴가 수정
              </Link>
            </Button>
          )}
          <Button size="sm" onClick={onClose}>
            <Check className="size-4" /> 확인
          </Button>
        </div>
      </div>
    </div>
  );
}

function TaskDetailContent({
  detail,
  error,
}: {
  detail: TaskDetail | null;
  error: string | null;
}) {
  if (error) {
    return (
      <div className="rounded-[11px] bg-[#fff1f0] px-3.5 py-3 text-xs text-[#9a4d47]">
        {error}
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex items-center gap-2 rounded-[11px] bg-[#f5f7f5] px-3.5 py-3 text-xs text-[#78827c]">
        <Loader2 className="size-4 animate-spin" /> 상세 내용을 확인하고 있습니다.
      </div>
    );
  }

  if (!detail.canViewDetail) {
    return (
      <div className="rounded-[11px] border border-[#eadba9] bg-[#fff9e7] px-3.5 py-3 text-xs leading-5 text-[#796321]">
        기본 일정만 확인할 수 있습니다. 상세 업무 내용과 첨부파일은 담당자·참여자 또는 과장급 이상만 조회할 수 있습니다.
      </div>
    );
  }

  return (
    <>
      {!detail.canEdit && (
        <div className="rounded-[11px] border border-[#d9e4dc] bg-[#f3f8f4] px-3.5 py-2.5 text-[11px] leading-5 text-[#587061]">
          다른 직원의 업무로 조회만 가능합니다. 수정과 삭제는 담당자 또는 관리자만 할 수 있습니다.
        </div>
      )}
      <div>
        <p className="text-xs font-bold text-[#7a847e]">업무 내용</p>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#4d5852]">
          {detail.description}
        </p>
      </div>

      <div className="space-y-2 border-t border-[#edf0ee] pt-4">
        {detail.attachments.length ? (
          detail.attachments.map((attachment) => (
            <a
              key={attachment.id}
              href={attachment.downloadUrl}
              className="flex items-center gap-2 rounded-[10px] border border-[#e1e6e2] bg-[#fafbfa] px-3 py-2 text-[12px] font-bold text-[#526058] hover:bg-[#f3f7f4]"
            >
              <Paperclip className="size-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{attachment.fileName}</span>
              <span className="text-[10px] font-medium text-[#929b95]">
                {formatAttachmentSize(attachment.fileSizeBytes)}
              </span>
            </a>
          ))
        ) : (
          <p className="text-[11px] text-[#949c97]">등록된 첨부파일이 없습니다.</p>
        )}

        {detail.relatedLink && (
          <a
            href={detail.relatedLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[#397253] hover:underline"
          >
            <Link2 className="size-4" /> 관련 링크 열기
          </a>
        )}
      </div>
    </>
  );
}

function LeaveDetailContent({
  detail,
  error,
}: {
  detail: LeaveDetail | null;
  error: string | null;
}) {
  if (error) {
    return (
      <div className="rounded-[11px] bg-[#fff1f0] px-3.5 py-3 text-xs text-[#9a4d47]">
        {error}
      </div>
    );
  }
  if (!detail) {
    return (
      <div className="flex items-center gap-2 rounded-[11px] bg-[#f5f7f5] px-3.5 py-3 text-xs text-[#78827c]">
        <Loader2 className="size-4 animate-spin" /> 휴가 상세를 확인하고 있습니다.
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <LeaveApprovalBox
          label={detail.teamLeadApprovalSkipped ? "팀장 승인 생략" : "부서 팀장"}
          status={detail.teamLeadStatus}
          reviewer={detail.teamLeadApprovalSkipped ? "자동 처리" : detail.teamLeadReviewer}
        />
        <LeaveApprovalBox
          label="대표자"
          status={detail.representativeStatus}
          reviewer={detail.representativeReviewer}
        />
      </div>

      {!detail.canViewDetail ? (
        <div className="rounded-[11px] border border-[#eadba9] bg-[#fff9e7] px-3.5 py-3 text-xs leading-5 text-[#796321]">
          휴가 기간과 승인 상태만 확인할 수 있습니다. 휴가 사유와 인수인계는 신청자, 같은 부서 팀장, 관리자에게만 공개됩니다.
        </div>
      ) : (
        <>
          <div>
            <p className="text-xs font-bold text-[#7a847e]">휴가 사유</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#4d5852]">
              {detail.reason}
            </p>
          </div>
          <div>
            <p className="text-xs font-bold text-[#7a847e]">인수인계</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#4d5852]">
              {detail.handoverNote || "등록된 인수인계 내용이 없습니다."}
            </p>
          </div>
          {detail.rejectionReason && (
            <p className="rounded-[10px] bg-[#fff1f0] px-3 py-2 text-xs text-[#984c47]">
              반려 사유: {detail.rejectionReason}
            </p>
          )}
          {detail.attachment ? (
            <a
              href={detail.attachment.downloadUrl}
              className="flex items-center gap-2 rounded-[10px] border border-[#e1e6e2] bg-[#fafbfa] px-3 py-2 text-[12px] font-bold text-[#526058] hover:bg-[#f3f7f4]"
            >
              <Paperclip className="size-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{detail.attachment.fileName}</span>
              <span className="text-[10px] font-medium text-[#929b95]">
                {formatAttachmentSize(detail.attachment.fileSizeBytes)}
              </span>
            </a>
          ) : (
            <p className="text-[11px] text-[#949c97]">등록된 첨부파일이 없습니다.</p>
          )}
        </>
      )}
    </>
  );
}

function LeaveApprovalBox({
  label,
  status,
  reviewer,
}: {
  label: string;
  status: string;
  reviewer: string | null;
}) {
  const statusText =
    status === "approved" ? "승인" : status === "rejected" ? "반려" : "대기";
  return (
    <div className="rounded-[10px] border border-[#e2e7e3] bg-[#fafbfa] px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold text-[#717c75]">{label}</span>
        <span
          className={cn(
            "text-[10px] font-extrabold",
            status === "approved"
              ? "text-[#397451]"
              : status === "rejected"
                ? "text-[#a34e49]"
                : "text-[#92741e]",
          )}
        >
          {statusText}
        </span>
      </div>
      {reviewer && <p className="mt-1 text-[9px] text-[#99a19c]">{reviewer} 처리</p>}
    </div>
  );
}

function formatAttachmentSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <Icon className="size-4 text-[#8b958f]" />
      <span className="w-10 text-xs font-bold text-[#7a847e]">{label}</span>
      <span className="font-medium text-[#4e5953]">{value}</span>
    </div>
  );
}
