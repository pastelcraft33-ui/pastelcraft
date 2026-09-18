"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  CalendarDays,
  Check,
  Clock3,
  Loader2,
  Plus,
  Search,
  Trash2,
  UsersRound,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { meetingSchema, type MeetingInput } from "@/schemas/meetings";

export type MeetingEmployeeOption = {
  id: string;
  name: string;
  position: string;
  department: string;
};

export type MeetingItem = {
  id: string;
  subject: string;
  content: string;
  meetingDate: string;
  startTime: string;
  endTime: string;
  authorName: string;
  participants: MeetingEmployeeOption[];
  canDelete: boolean;
};

export function MeetingRoom({
  meetings,
  employees,
  schemaAvailable,
}: {
  meetings: MeetingItem[];
  employees: MeetingEmployeeOption[];
  schemaAvailable: boolean;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function deleteMeeting(meeting: MeetingItem) {
    if (!window.confirm(`“${meeting.subject}” 회의를 삭제할까요? 참여자 안내도 함께 삭제됩니다.`)) {
      return;
    }
    setDeletingId(meeting.id);
    setNotice(null);
    try {
      const response = await fetch(`/api/meetings/${meeting.id}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(result.message ?? "회의를 삭제하지 못했습니다.");
      }
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "회의를 삭제하지 못했습니다.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1280px]">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-[13px] font-bold text-[#3b7652]">함께 정하는 일정</p>
            <h2 className="mt-1 text-[26px] font-extrabold tracking-[-0.04em] text-[#29352e]">
              회의실
            </h2>
            <p className="mt-2 text-[13px] text-[#7f8983]">
              회의를 등록하고 클릭으로 참여자를 선택하세요. 회의 안내는 선택한 참여자에게만 표시됩니다.
            </p>
          </div>
          <Button onClick={() => setIsOpen(true)} disabled={!schemaAvailable}>
            <Plus className="size-4" /> 회의 등록
          </Button>
        </div>

        {!schemaAvailable && (
          <div className="mt-6 rounded-[14px] border border-[#efd89e] bg-[#fff9e7] px-4 py-3 text-[13px] font-semibold text-[#856822]">
            회의실 데이터베이스 설정이 필요합니다. 새 회의실 마이그레이션 SQL을 적용해 주세요.
          </div>
        )}
        {notice && (
          <div className="mt-6 rounded-[14px] border border-[#efcbc7] bg-[#fff3f2] px-4 py-3 text-[13px] font-semibold text-[#994f49]">
            {notice}
          </div>
        )}

        {meetings.length === 0 ? (
          <div className="mt-6 rounded-[18px] border border-dashed border-[#d8dfda] bg-white px-6 py-16 text-center">
            <UsersRound className="mx-auto size-9 text-[#aab5ae]" />
            <p className="mt-3 text-[14px] font-bold text-[#5b665f]">등록된 회의가 없습니다.</p>
            <p className="mt-1 text-[12px] text-[#929b95]">첫 회의를 등록해 팀에 공유해 보세요.</p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            {meetings.map((meeting) => (
              <article
                key={meeting.id}
                className="rounded-[18px] border border-[#e1e6e2] bg-white p-5 shadow-[0_8px_28px_rgba(34,56,42,0.035)]"
              >
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-[#e5f5eb] text-[#397051]">
                    <UsersRound className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[16px] font-extrabold text-[#344039]">{meeting.subject}</h3>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-semibold text-[#78827c]">
                      <span className="flex items-center gap-1.5">
                        <CalendarDays className="size-3.5" /> {formatDate(meeting.meetingDate)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock3 className="size-3.5" /> {meeting.startTime}~{meeting.endTime}
                      </span>
                    </div>
                  </div>
                  {meeting.canDelete && (
                    <button
                      type="button"
                      onClick={() => void deleteMeeting(meeting)}
                      disabled={Boolean(deletingId)}
                      className="flex size-9 shrink-0 items-center justify-center rounded-[10px] text-[#8c9690] hover:bg-[#fff0ee] hover:text-[#a34f47] disabled:opacity-50"
                      aria-label={`${meeting.subject} 회의 삭제`}
                    >
                      {deletingId === meeting.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                    </button>
                  )}
                </div>

                <p className="mt-4 whitespace-pre-wrap border-t border-[#edf0ee] pt-4 text-[13px] leading-6 text-[#606a64]">
                  {meeting.content}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#edf0ee] pt-4">
                  <span className="mr-1 text-[11px] font-bold text-[#7b857f]">참여자</span>
                  {meeting.participants.map((participant) => (
                    <span
                      key={participant.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#f0f4f1] py-1 pl-1 pr-2.5 text-[11px] font-bold text-[#536059]"
                      title={`${participant.department} · ${participant.position}`}
                    >
                      <Avatar name={participant.name} size="sm" />
                      {participant.name}
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-right text-[10px] text-[#9ba39e]">등록: {meeting.authorName}</p>
              </article>
            ))}
          </div>
        )}
      </div>

      {isOpen && (
        <MeetingDialog
          employees={employees}
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

function MeetingDialog({
  employees,
  onClose,
  onSaved,
}: {
  employees: MeetingEmployeeOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [search, setSearch] = useState("");
  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<MeetingInput>({
    resolver: zodResolver(meetingSchema),
    defaultValues: {
      subject: "",
      content: "",
      meetingDate: localDateValue(new Date()),
      startTime: "09:00",
      endTime: "10:00",
      participantIds: [],
    },
  });
  const participantIds = useWatch({ control, name: "participantIds" });
  const filteredEmployees = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return employees;
    return employees.filter((employee) =>
      [employee.name, employee.position, employee.department].some((value) =>
        value.toLowerCase().includes(keyword),
      ),
    );
  }, [employees, search]);

  function toggleParticipant(employeeId: string) {
    const selected = participantIds.includes(employeeId);
    setValue(
      "participantIds",
      selected
        ? participantIds.filter((id) => id !== employeeId)
        : [...participantIds, employeeId],
      { shouldDirty: true, shouldValidate: true },
    );
  }

  const submit = handleSubmit(async (values) => {
    const response = await fetch("/api/meetings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const result = (await response.json()) as { message?: string };
    if (!response.ok) {
      setError("root", { message: result.message ?? "회의를 등록하지 못했습니다." });
      return;
    }
    onSaved();
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="meeting-dialog-title"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[#17211b]/50 p-3 backdrop-blur-[2px] sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) onClose();
      }}
    >
      <form
        onSubmit={submit}
        className="max-h-[94vh] w-full max-w-[760px] overflow-y-auto rounded-[20px] border border-[#dde3df] bg-white p-5 shadow-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[12px] font-bold text-[#3b7652]">참여자 전용 회의 안내</p>
            <h2 id="meeting-dialog-title" className="mt-1 text-[22px] font-extrabold text-[#2e3932]">
              회의 등록
            </h2>
          </div>
          <button type="button" onClick={onClose} disabled={isSubmitting} className="flex size-9 items-center justify-center rounded-[10px] text-[#7c867f] hover:bg-[#f0f3f1]" aria-label="회의 등록 닫기">
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="회의 주제" error={errors.subject?.message} className="sm:col-span-2">
            <input {...register("subject")} maxLength={120} autoFocus placeholder="회의 주제를 입력해 주세요." className={inputClass} />
          </Field>
          <Field label="회의 날짜" error={errors.meetingDate?.message}>
            <input type="date" {...register("meetingDate")} className={inputClass} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="시작 시간" error={errors.startTime?.message}>
              <input type="time" {...register("startTime")} className={inputClass} />
            </Field>
            <Field label="종료 시간" error={errors.endTime?.message}>
              <input type="time" {...register("endTime")} className={inputClass} />
            </Field>
          </div>
          <Field label="회의 내용" error={errors.content?.message} className="sm:col-span-2">
            <textarea {...register("content")} maxLength={5000} rows={5} placeholder="회의 목적과 논의할 내용을 입력해 주세요." className={`${inputClass} h-auto resize-y py-3 leading-6`} />
          </Field>
        </div>

        <div className="mt-5 border-t border-[#e9eeea] pt-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[12px] font-bold text-[#4e5952]">참여자 선택</p>
              <p className="mt-1 text-[11px] text-[#929b95]">직원 카드를 클릭해 선택하세요. {participantIds.length}명 선택</p>
            </div>
            <label className="relative block w-full sm:w-[260px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9aa39e]" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="이름, 직급, 부서 검색" className="h-10 w-full rounded-[10px] border border-[#dce2de] pl-9 pr-3 text-[12px] outline-none focus:border-[#82bd98]" />
            </label>
          </div>

          <div className="mt-3 grid max-h-[260px] gap-2 overflow-y-auto rounded-[13px] border border-[#e2e7e3] bg-[#fafbfa] p-2 sm:grid-cols-2 lg:grid-cols-3">
            {filteredEmployees.map((employee) => {
              const selected = participantIds.includes(employee.id);
              return (
                <button
                  key={employee.id}
                  type="button"
                  onClick={() => toggleParticipant(employee.id)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-[11px] border p-2.5 text-left transition",
                    selected
                      ? "border-[#79b78f] bg-[#e8f6ed] ring-1 ring-[#a8d5b8]"
                      : "border-transparent bg-white hover:border-[#d7e0da]",
                  )}
                >
                  <Avatar name={employee.name} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-extrabold text-[#3e4942]">{employee.name}</span>
                    <span className="mt-0.5 block truncate text-[10px] text-[#8a948e]">{employee.department} · {employee.position}</span>
                  </span>
                  <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-full border", selected ? "border-[#4f9569] bg-[#4f9569] text-white" : "border-[#cfd7d2]")}>{selected && <Check className="size-3" />}</span>
                </button>
              );
            })}
          </div>
          {errors.participantIds && <p className="mt-1.5 text-[11px] text-[#a75049]">{errors.participantIds.message}</p>}
        </div>

        {errors.root?.message && <p className="mt-4 rounded-[10px] bg-[#fff2f0] px-3.5 py-3 text-[12px] font-semibold text-[#a14f47]">{errors.root.message}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>취소</Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <UsersRound className="size-4" />}
            회의 등록
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, error, className, children }: { label: string; error?: string; className?: string; children: React.ReactNode }) {
  return <label className={className}><span className="text-[12px] font-bold text-[#4e5952]">{label}</span><span className="mt-2 block">{children}</span>{error && <span className="mt-1.5 block text-[11px] text-[#a75049]">{error}</span>}</label>;
}

const inputClass = "h-11 w-full rounded-[11px] border border-[#dce2de] px-3.5 text-[13px] outline-none focus:border-[#82bd98] focus:ring-3 focus:ring-emerald-100";

function localDateValue(date: Date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${year}.${month}.${day}`;
}
