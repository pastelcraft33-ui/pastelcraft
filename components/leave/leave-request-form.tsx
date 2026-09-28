"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Loader2,
  Pencil,
  Save,
  ShieldCheck,
  Trash2,
  UserCheck,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  leaveDayTypeLabel,
  leaveDayTypeOptions,
  leaveTypeLabel,
  leaveTypeOptions,
} from "@/lib/leave/constants";
import { cn } from "@/lib/utils";
import { leaveFormSchema, type LeaveFormInput } from "@/schemas/leave";

type InitialRequest = LeaveFormInput & {
  id: string;
  status: string;
};

type RequestSummary = {
  id: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  dayType: string;
  status: string;
  statusLabel: string;
  teamLeadStatus: string;
  teamLeadApprovalSkipped: boolean;
  representativeStatus: string;
  rejectionReason: string | null;
  createdAt: string;
};

export function LeaveRequestForm({
  initialRequest,
  requests,
  saved,
  isAdmin,
}: {
  initialRequest: InitialRequest | null;
  requests: RequestSummary[];
  saved: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LeaveFormInput>({
    resolver: zodResolver(leaveFormSchema),
    defaultValues: initialRequest
      ? { ...initialRequest, handoverNote: "" }
      : {
          leaveType: "annual",
          startDate: today,
          endDate: today,
          dayType: "full_day",
          reason: "",
          handoverNote: "",
        },
  });
  const leaveType = useWatch({ control, name: "leaveType" });
  const dayType = useWatch({ control, name: "dayType" });

  function handleLeaveType(value: LeaveFormInput["leaveType"]) {
    setValue("leaveType", value, { shouldValidate: true });
    if (
      value === "morning_half" ||
      value === "afternoon_half" ||
      value === "morning_quarter" ||
      value === "afternoon_quarter"
    ) {
      setValue("dayType", value, { shouldValidate: true });
    }
  }

  const onSubmit = handleSubmit(async (input) => {
    setServerError(null);
    const formData = new FormData();
    Object.entries(input).forEach(([key, value]) => formData.set(key, value));
    formData.set("handoverNote", "");
    formData.set("removeAttachment", "true");

    try {
      const response = await fetch(
        initialRequest ? `/api/leave/${initialRequest.id}` : "/api/leave",
        { method: initialRequest ? "PATCH" : "POST", body: formData },
      );
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "휴가 신청을 저장하지 못했습니다.");
      if (!initialRequest) window.dispatchEvent(new Event("workspace-content-created"));
      router.push("/leave/new?saved=1");
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "저장 중 오류가 발생했습니다.");
    }
  });

  async function cancelRequest(id: string) {
    if (!window.confirm("취소하면 캘린더에서 즉시 제외됩니다. 이 휴가 신청을 취소할까요?")) return;
    setCancellingId(id);
    setServerError(null);
    try {
      const response = await fetch(`/api/leave/${id}/cancel`, { method: "POST" });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "휴가 신청을 취소하지 못했습니다.");
      window.dispatchEvent(new Event("leave-requests-changed"));
      router.refresh();
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "취소 중 오류가 발생했습니다.");
    } finally {
      setCancellingId(null);
    }
  }

  async function deleteRequest(id: string) {
    if (!window.confirm("휴가 신청이 영구 삭제됩니다. 정말 삭제할까요?")) return;
    setDeletingId(id);
    setServerError(null);
    try {
      const response = await fetch(`/api/leave/${id}`, { method: "DELETE" });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "휴가 신청을 삭제하지 못했습니다.");
      window.dispatchEvent(new Event("leave-requests-changed"));
      router.refresh();
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "삭제 중 오류가 발생했습니다.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1120px]">
        <Link href="/calendar" className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-1 text-[13px] font-bold text-[#647169] hover:text-[#315f47]">
          <ArrowLeft className="size-4" /> 캘린더로 돌아가기
        </Link>

        <ApprovalGuide />

        {(saved || serverError) && (
          <div className={cn("mt-5 flex items-start gap-2.5 rounded-[12px] border px-4 py-3 text-[13px]", serverError ? "border-[#efc7c3] bg-[#fff3f2] text-[#984b46]" : "border-[#bfe1ca] bg-[#eff9f2] text-[#3d7552]")}>
            {serverError ? <AlertCircle className="mt-0.5 size-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0" />}
            <span>{serverError ?? "휴가 신청을 저장했습니다. 부서 팀장 승인 후 대표자 승인으로 진행됩니다."}</span>
          </div>
        )}

        <div className="mt-5 overflow-hidden rounded-[20px] border border-[#e0e6e2] bg-white shadow-[0_16px_45px_rgba(35,54,42,0.05)]">
          <div className="border-b border-[#e9edea] bg-[#fbfcfb] px-5 py-5 sm:px-8">
            <p className="text-[11px] font-extrabold text-[#4a7b5c]">{initialRequest ? "신청 관리" : "새 휴가"}</p>
            <h2 className="mt-1 text-[23px] font-extrabold tracking-[-0.04em] text-[#2d3932]">
              {initialRequest ? "휴가 신청 수정" : "휴가 신청"}
            </h2>
            <p className="mt-2 text-[12px] text-[#808a84]">
              승인 진행 중인 신청을 수정하면 팀장 승인부터 다시 시작합니다.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-7 px-5 py-6 sm:px-8 sm:py-8" noValidate>
            <FormSection title="휴가 정보">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="휴가 종류" error={errors.leaveType?.message} required>
                  <SelectWrap>
                    <select {...register("leaveType")} value={leaveType} onChange={(event) => handleLeaveType(event.target.value as LeaveFormInput["leaveType"])} className={cn(inputClass, "appearance-none pr-9")}>
                      {leaveTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </SelectWrap>
                </Field>
                <div className="sm:col-span-2">
                <Field label="휴가 단위" error={errors.dayType?.message} required>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {leaveDayTypeOptions.map((option) => (
                      <label key={option.value} className={cn("flex h-11 cursor-pointer items-center justify-center rounded-[11px] border text-[12px] font-bold transition", dayType === option.value ? "border-[#86bf9c] bg-[#e9f7ee] text-[#356d4d]" : "border-[#dce2de] bg-white text-[#6d7771] hover:bg-[#f7f9f7]")}>
                        <input {...register("dayType")} type="radio" value={option.value} className="sr-only" />{option.label}
                      </label>
                    ))}
                  </div>
                </Field>
                </div>
                <Field label="시작일" error={errors.startDate?.message} required><input {...register("startDate")} type="date" className={inputClass} /></Field>
                <Field label="종료일" error={errors.endDate?.message} required><input {...register("endDate")} type="date" className={inputClass} /></Field>
              </div>
            </FormSection>

            <FormSection title="휴가 사유">
              <Field label="휴가 사유" error={errors.reason?.message} required><textarea {...register("reason")} rows={4} placeholder="휴가 사유를 입력해 주세요." className={cn(inputClass, "h-auto resize-y py-3 leading-6")} /></Field>
            </FormSection>

            <div className="flex justify-end gap-2 border-t border-[#e9edea] pt-6">
              {initialRequest && <Button asChild type="button" variant="secondary"><Link href="/leave/new">수정 취소</Link></Button>}
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {initialRequest ? "수정 저장" : "승인 요청"}
              </Button>
            </div>
          </form>
        </div>

        <MyLeaveRequests
          requests={requests}
          isAdmin={isAdmin}
          cancellingId={cancellingId}
          deletingId={deletingId}
          onCancel={cancelRequest}
          onDelete={deleteRequest}
        />
      </div>
    </section>
  );
}

function ApprovalGuide() {
  return (
    <div className="mt-5 rounded-[18px] border border-[#dfe6e1] bg-white px-5 py-5 sm:px-7">
      <p className="text-[13px] font-extrabold text-[#344039]">휴가 승인 절차</p>
      <div className="mt-4 grid gap-2 sm:flex sm:items-center sm:gap-4">
        <ApprovalStep icon={UserCheck} number="1" label="부서 팀장 승인" />
        <span className="hidden h-px flex-1 bg-[#cfd9d2] sm:block" />
        <ApprovalStep icon={ShieldCheck} number="2" label="대표자 승인" />
        <span className="hidden h-px flex-1 bg-[#cfd9d2] sm:block" />
        <ApprovalStep icon={Check} number="3" label="승인 완료" />
      </div>
    </div>
  );
}

function ApprovalStep({ icon: Icon, number, label }: { icon: React.ComponentType<{ className?: string }>; number: string; label: string }) {
  return <div className="flex min-h-12 w-full shrink-0 items-center gap-3 rounded-[11px] bg-[#f6f9f7] px-3 sm:min-h-0 sm:w-auto sm:gap-2 sm:bg-transparent sm:px-0"><span className="flex size-8 items-center justify-center rounded-full bg-[#e6f5eb] text-[#3b7453]"><Icon className="size-4" /></span><span><span className="block text-[9px] font-bold text-[#9aa29d]">{number}단계</span><span className="block text-[11px] font-extrabold text-[#556159] sm:text-[12px]">{label}</span></span></div>;
}

function MyLeaveRequests({
  requests,
  isAdmin,
  cancellingId,
  deletingId,
  onCancel,
  onDelete,
}: {
  requests: RequestSummary[];
  isAdmin: boolean;
  cancellingId: string | null;
  deletingId: string | null;
  onCancel: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="mt-7">
      <h2 className="text-[18px] font-extrabold tracking-[-0.03em] text-[#303c35]">내 휴가 신청 내역</h2>
      {requests.length === 0 ? (
        <div className="mt-3 rounded-[16px] border border-dashed border-[#d7ded9] bg-white px-5 py-9 text-center text-[13px] text-[#8a948e]">아직 휴가 신청 내역이 없습니다.</div>
      ) : (
        <div className="mt-3 space-y-3">
          {requests.map((request) => {
            const canEdit = request.status === "pending" || (isAdmin && request.status !== "cancelled");
            const canCancel = request.status !== "cancelled";
            const isBusy = cancellingId === request.id || deletingId === request.id;
            return (
              <article key={request.id} className="rounded-[16px] border border-[#e0e5e2] bg-white p-4 sm:p-5">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-extrabold text-[#354139]">{leaveTypeLabel(request.leaveType)} · {leaveDayTypeLabel(request.dayType)}</h3>
                      <LeaveStatusBadge status={request.status} label={request.statusLabel} />
                    </div>
                    <p className="mt-2 flex items-center gap-1.5 text-[12px] text-[#69746d]"><CalendarDays className="size-3.5" /> {formatDateRange(request.startDate, request.endDate)}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-[10px] text-[#9aa29e]"><Clock3 className="size-3" /> 신청 {formatDateTime(request.createdAt)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {canEdit && (
                      <Button asChild variant="secondary" size="sm">
                        <Link href={`/leave/new?edit=${request.id}`}><Pencil className="size-3.5" /> 수정</Link>
                      </Button>
                    )}
                    {canCancel && (
                      <Button variant="secondary" size="sm" onClick={() => onCancel(request.id)} disabled={isBusy} className="text-[#8a6350]">
                        {cancellingId === request.id ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />} 취소
                      </Button>
                    )}
                    <Button variant="secondary" size="sm" onClick={() => onDelete(request.id)} disabled={isBusy} className="border-[#efcfcc] text-[#a14f49] hover:bg-[#fff4f3]">
                      {deletingId === request.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />} 삭제
                    </Button>
                  </div>
                </div>
                <ApprovalProgress teamLeadStatus={request.teamLeadStatus} teamLeadApprovalSkipped={request.teamLeadApprovalSkipped} representativeStatus={request.representativeStatus} status={request.status} />
                {request.rejectionReason && <p className="mt-3 rounded-[10px] bg-[#fff1f0] px-3 py-2 text-[11px] text-[#984c47]">반려 사유: {request.rejectionReason}</p>}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ApprovalProgress({ teamLeadStatus, teamLeadApprovalSkipped, representativeStatus, status }: { teamLeadStatus: string; teamLeadApprovalSkipped: boolean; representativeStatus: string; status: string }) {
  const cancelled = status === "cancelled";
  return <div className="mt-4 grid grid-cols-2 gap-2 border-t border-[#edf0ee] pt-3"><ProgressItem label={teamLeadApprovalSkipped ? "팀장 승인 생략" : "부서 팀장"} status={cancelled ? "cancelled" : teamLeadStatus} /><ProgressItem label="대표자" status={cancelled ? "cancelled" : representativeStatus} /></div>;
}

function ProgressItem({ label, status }: { label: string; status: string }) {
  const text = status === "approved" ? "승인" : status === "rejected" ? "반려" : status === "cancelled" ? "취소" : "대기";
  return <div className="flex items-center justify-between rounded-[9px] bg-[#f6f8f6] px-3 py-2 text-[11px]"><span className="font-bold text-[#69736d]">{label}</span><span className={cn("font-extrabold", status === "approved" ? "text-[#3c7754]" : status === "rejected" ? "text-[#a24e49]" : "text-[#947521]")}>{text}</span></div>;
}

function LeaveStatusBadge({ status, label }: { status: string; label: string }) {
  return <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-extrabold", status === "approved" ? "bg-[#e4f5ea] text-[#34704c]" : status === "rejected" ? "bg-[#fee8e7] text-[#a94743]" : status === "cancelled" ? "bg-[#ecefed] text-[#6c756f]" : "bg-[#fff4c8] text-[#7e641a]")}>{label}</span>;
}

const inputClass = "h-11 w-full rounded-[11px] border border-[#dce2de] bg-white px-3.5 text-[13px] font-medium text-[#354039] outline-none transition placeholder:text-[#a3aba6] hover:border-[#cbd4ce] focus:border-[#8fc7a5] focus:ring-3 focus:ring-emerald-100";
function FormSection({ title, children }: { title: string; children: React.ReactNode }) { return <fieldset className="space-y-4"><legend className="text-[15px] font-extrabold text-[#354139]">{title}</legend>{children}</fieldset>; }
function Field({ label, error, required, children }: { label: string; error?: string; required?: boolean; children: React.ReactNode }) { return <label className="block"><span className="mb-2 flex items-center gap-1 text-[12px] font-bold text-[#56615a]">{label}{required && <span className="text-[#d26b63]">*</span>}</span>{children}{error && <span className="mt-1.5 block text-[11px] font-medium text-[#b55853]">{error}</span>}</label>; }
function SelectWrap({ children }: { children: React.ReactNode }) { return <div className="relative">{children}<ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-[#8b958f]" /></div>; }
function formatDateRange(start: string, end: string) { return start === end ? start : `${start} ~ ${end}`; }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
