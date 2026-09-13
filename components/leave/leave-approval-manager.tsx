"use client";

import {
  AlertCircle,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  FileText,
  Loader2,
  Pencil,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ApprovalRequest = {
  id: string;
  applicant: {
    id: string;
    name: string;
    position: string;
    departmentCode: string;
    department: string;
    imageUrl: string | null;
  };
  leaveType: string;
  leaveTypeLabel: string;
  dayType: string;
  dayTypeLabel: string;
  startDate: string;
  endDate: string;
  reason: string;
  handoverNote: string | null;
  attachment: {
    fileName: string;
    fileSizeBytes: number;
    downloadUrl: string;
  } | null;
  status: string;
  statusLabel: string;
  teamLeadStatus: string;
  teamLeadApprovalSkipped: boolean;
  teamLeadReviewer: string | null;
  teamLeadReviewedAt: string | null;
  representativeStatus: string;
  representativeReviewer: string | null;
  representativeReviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
};

type ReviewStage = "team_lead" | "representative";

export function LeaveApprovalManager({
  requests,
  currentEmployee,
}: {
  requests: ApprovalRequest[];
  currentEmployee: {
    id: string;
    role: "employee" | "admin";
    positionCode: string;
    departmentCode: string;
  };
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"pending" | "all">("pending");
  const [search, setSearch] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const pending = requests.filter((request) => request.status === "pending");
  const filtered = useMemo(() => {
    const source = tab === "pending" ? pending : requests;
    const keyword = search.trim().toLowerCase();
    if (!keyword) return source;
    return source.filter((request) =>
      [request.applicant.name, request.applicant.department, request.leaveTypeLabel]
        .some((value) => value.toLowerCase().includes(keyword)),
    );
  }, [pending, requests, search, tab]);

  async function review(request: ApprovalRequest, stage: ReviewStage, decision: "approve" | "reject") {
    let reason: string | undefined;
    if (decision === "reject") {
      const input = window.prompt(`${request.applicant.name}님의 휴가 반려 사유를 입력해 주세요.`);
      if (input === null) return;
      if (!input.trim()) {
        setNotice({ kind: "error", text: "반려 사유를 입력해 주세요." });
        return;
      }
      reason = input.trim();
    } else if (!window.confirm(`${stage === "team_lead" ? "부서 팀장" : "대표자"} 승인을 진행할까요?`)) {
      return;
    }

    const key = `${request.id}:${stage}:${decision}`;
    setBusyKey(key);
    setNotice(null);
    try {
      const response = await fetch(`/api/leave/${request.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage, decision, reason }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "승인 상태를 변경하지 못했습니다.");
      setNotice({ kind: "success", text: decision === "approve" ? "승인 처리했습니다." : "반려 처리했습니다." });
      window.dispatchEvent(new Event("leave-requests-changed"));
      router.refresh();
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "처리 중 오류가 발생했습니다." });
    } finally {
      setBusyKey(null);
    }
  }

  async function cancel(request: ApprovalRequest) {
    if (!window.confirm(`${request.applicant.name}님의 휴가 신청을 취소할까요?`)) return;
    const key = `${request.id}:cancel`;
    setBusyKey(key);
    try {
      const response = await fetch(`/api/leave/${request.id}/cancel`, { method: "POST" });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "휴가를 취소하지 못했습니다.");
      setNotice({ kind: "success", text: "휴가 신청을 취소했습니다." });
      window.dispatchEvent(new Event("leave-requests-changed"));
      router.refresh();
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "취소 중 오류가 발생했습니다." });
    } finally {
      setBusyKey(null);
    }
  }

  async function remove(request: ApprovalRequest) {
    if (!window.confirm(`${request.applicant.name}님의 휴가 신청과 첨부파일이 영구 삭제됩니다. 계속할까요?`)) return;
    const key = `${request.id}:delete`;
    setBusyKey(key);
    setNotice(null);
    try {
      const response = await fetch(`/api/leave/${request.id}`, { method: "DELETE" });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "휴가 신청을 삭제하지 못했습니다.");
      setNotice({ kind: "success", text: "휴가 신청을 영구 삭제했습니다." });
      window.dispatchEvent(new Event("leave-requests-changed"));
      router.refresh();
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "삭제 중 오류가 발생했습니다." });
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <section className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1280px]">
        <div>
          <p className="text-[13px] font-bold text-[#3c7453]">2단계 승인</p>
          <h2 className="mt-1 text-[24px] font-extrabold tracking-[-0.04em] text-[#29352e]">휴가 승인 관리</h2>
          <p className="mt-2 text-[13px] text-[#7d8781]">일반 직원은 부서 팀장 승인 후 대표자가 최종 승인하며, 팀장 신청은 대표자가 직접 승인합니다.</p>
        </div>

        {notice && <div className={cn("mt-5 flex items-center justify-between rounded-[12px] border px-4 py-3 text-[13px]", notice.kind === "success" ? "border-[#bfe0ca] bg-[#eff9f2] text-[#3c7452]" : "border-[#efc5c1] bg-[#fff2f1] text-[#9a4d47]")}><span className="flex items-center gap-2">{notice.kind === "success" ? <CheckCircle2 className="size-4" /> : <AlertCircle className="size-4" />}{notice.text}</span><button onClick={() => setNotice(null)} aria-label="알림 닫기"><X className="size-4" /></button></div>}

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Stat label="전체 신청" value={requests.length} icon={CalendarDays} />
          <Stat label="승인 대기" value={pending.length} icon={Clock3} tone="yellow" />
          <Stat label="승인 완료" value={requests.filter((request) => request.status === "approved").length} icon={ShieldCheck} tone="green" />
        </div>

        <div className="mt-6 overflow-hidden rounded-[18px] border border-[#e1e6e2] bg-white">
          <div className="flex flex-col justify-between gap-3 border-b border-[#e8ece9] px-4 py-4 sm:flex-row sm:items-center sm:px-6">
            <div className="flex gap-1 rounded-[11px] bg-[#f0f3f1] p-1">
              <Tab active={tab === "pending"} onClick={() => setTab("pending")}>승인 대기 {pending.length}</Tab>
              <Tab active={tab === "all"} onClick={() => setTab("all")}>전체 {requests.length}</Tab>
            </div>
            <label className="relative block sm:w-[280px]"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#939c96]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="직원, 부서, 휴가 종류 검색" className="h-10 w-full rounded-[10px] border border-[#dfe4e1] pl-9 pr-3 text-[13px] outline-none focus:border-[#97cbaa] focus:ring-3 focus:ring-emerald-100" /></label>
          </div>

          {filtered.length === 0 ? (
            <div className="px-6 py-16 text-center text-[13px] text-[#8d9691]">표시할 휴가 신청이 없습니다.</div>
          ) : (
            <div className="grid gap-4 p-4 lg:grid-cols-2 lg:p-6">
              {filtered.map((request) => (
                <RequestCard key={request.id} request={request} currentEmployee={currentEmployee} busyKey={busyKey} onReview={review} onCancel={cancel} onDelete={remove} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function RequestCard({ request, currentEmployee, busyKey, onReview, onCancel, onDelete }: { request: ApprovalRequest; currentEmployee: { id: string; role: "employee" | "admin"; positionCode: string; departmentCode: string }; busyKey: string | null; onReview: (request: ApprovalRequest, stage: ReviewStage, decision: "approve" | "reject") => void; onCancel: (request: ApprovalRequest) => void; onDelete: (request: ApprovalRequest) => void }) {
  const self = request.applicant.id === currentEmployee.id;
  const canTeamReview = !self && request.status === "pending" && request.teamLeadStatus === "pending" && currentEmployee.positionCode === "team_lead" && currentEmployee.departmentCode === request.applicant.departmentCode;
  const canRepresentativeReview = !self && request.status === "pending" && request.teamLeadStatus === "approved" && request.representativeStatus === "pending" && currentEmployee.role === "admin" && currentEmployee.positionCode === "representative";
  return (
    <article className="rounded-[16px] border border-[#e2e7e3] bg-[#fbfcfb] p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <Avatar name={request.applicant.name} imageUrl={request.applicant.imageUrl} size="lg" />
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-extrabold text-[#344039]">{request.applicant.name}</h3><StatusBadge status={request.status} label={request.statusLabel} /></div><p className="mt-1 text-[11px] text-[#87908a]">{request.applicant.department} · {request.applicant.position}</p><p className="mt-2 font-bold text-[#4e5953]">{request.leaveTypeLabel} · {request.dayTypeLabel}</p><p className="mt-1 text-[12px] text-[#68736c]">{request.startDate === request.endDate ? request.startDate : `${request.startDate} ~ ${request.endDate}`}</p></div>
      </div>
      <div className="mt-4 space-y-3 border-t border-[#e8ece9] pt-4"><Detail label="휴가 사유" value={request.reason} /><Detail label="인수인계" value={request.handoverNote || "등록된 내용 없음"} /></div>
      {request.attachment && <a href={request.attachment.downloadUrl} className="mt-3 flex items-center gap-2 rounded-[10px] bg-[#f0f4f1] px-3 py-2 text-[11px] font-bold text-[#506057] hover:bg-[#e8efea]"><FileText className="size-4" /><span className="min-w-0 flex-1 truncate">{request.attachment.fileName}</span><span className="text-[#929b95]">{formatFileSize(request.attachment.fileSizeBytes)}</span></a>}
      <ApprovalTimeline request={request} />
      {request.rejectionReason && <p className="mt-3 rounded-[10px] bg-[#fff1f0] px-3 py-2 text-[11px] text-[#984c47]">반려 사유: {request.rejectionReason}</p>}
      {(canTeamReview || canRepresentativeReview || currentEmployee.role === "admin") && (
        <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-[#e8ece9] pt-3">
          {currentEmployee.role === "admin" && request.status !== "cancelled" && <><Button asChild variant="ghost" size="sm"><Link href={`/leave/new?edit=${request.id}`}><Pencil className="size-3.5" /> 수정</Link></Button><Button variant="ghost" size="sm" onClick={() => onCancel(request)} disabled={Boolean(busyKey)} className="text-[#98514c]">{busyKey === `${request.id}:cancel` ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />} 취소</Button></>}
          {currentEmployee.role === "admin" && <Button variant="ghost" size="sm" onClick={() => onDelete(request)} disabled={Boolean(busyKey)} className="text-[#a13f3a]">{busyKey === `${request.id}:delete` ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />} 영구 삭제</Button>}
          {(canTeamReview || canRepresentativeReview) && <><Button variant="secondary" size="sm" onClick={() => onReview(request, canTeamReview ? "team_lead" : "representative", "reject")} disabled={Boolean(busyKey)}>반려</Button><Button size="sm" onClick={() => onReview(request, canTeamReview ? "team_lead" : "representative", "approve")} disabled={Boolean(busyKey)}>{busyKey?.endsWith(":approve") ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}{canTeamReview ? "팀장 승인" : "대표자 승인"}</Button></>}
        </div>
      )}
    </article>
  );
}

function ApprovalTimeline({ request }: { request: ApprovalRequest }) { return <div className="mt-4 grid grid-cols-2 gap-2"><ApprovalBox icon={UserCheck} label={request.teamLeadApprovalSkipped ? "팀장 승인 생략" : "부서 팀장"} status={request.teamLeadStatus} reviewer={request.teamLeadApprovalSkipped ? "자동 처리" : request.teamLeadReviewer} /><ApprovalBox icon={ShieldCheck} label="대표자" status={request.representativeStatus} reviewer={request.representativeReviewer} /></div>; }
function ApprovalBox({ icon: Icon, label, status, reviewer }: { icon: React.ComponentType<{ className?: string }>; label: string; status: string; reviewer: string | null }) { const text = status === "approved" ? "승인" : status === "rejected" ? "반려" : "대기"; return <div className="rounded-[11px] border border-[#e4e8e5] bg-white p-3"><div className="flex items-center gap-2"><Icon className="size-4 text-[#6b7770]" /><span className="text-[11px] font-bold text-[#606b64]">{label}</span><span className={cn("ml-auto text-[10px] font-extrabold", status === "approved" ? "text-[#3a7552]" : status === "rejected" ? "text-[#a34e49]" : "text-[#92741e]")}>{text}</span></div>{reviewer && <p className="mt-1.5 text-[9px] text-[#98a09b]">{reviewer} 처리</p>}</div>; }
function Detail({ label, value }: { label: string; value: string }) { return <div><p className="text-[10px] font-bold text-[#8b948f]">{label}</p><p className="mt-1 whitespace-pre-wrap text-[12px] leading-5 text-[#56615a]">{value}</p></div>; }
function StatusBadge({ status, label }: { status: string; label: string }) { return <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-extrabold", status === "approved" ? "bg-[#e4f5ea] text-[#34704c]" : status === "rejected" ? "bg-[#fee8e7] text-[#a94743]" : status === "cancelled" ? "bg-[#ecefed] text-[#6c756f]" : "bg-[#fff4c8] text-[#7e641a]")}>{label}</span>; }
function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button type="button" onClick={onClick} className={cn("rounded-[8px] px-3 py-2 text-[12px] font-bold", active ? "bg-white text-[#315f47] shadow-sm" : "text-[#748078]")}>{children}</button>; }
function Stat({ label, value, icon: Icon, tone = "gray" }: { label: string; value: number; icon: React.ComponentType<{ className?: string }>; tone?: "gray" | "yellow" | "green" }) { return <div className="flex items-center gap-3 rounded-[15px] border border-[#e1e6e2] bg-white p-4"><span className={cn("flex size-10 items-center justify-center rounded-[12px]", tone === "green" ? "bg-[#e5f5ea] text-[#397153]" : tone === "yellow" ? "bg-[#fff4c8] text-[#80651a]" : "bg-[#eef1ef] text-[#66716a]")}><Icon className="size-[18px]" /></span><span><span className="block text-[10px] font-bold text-[#929b95]">{label}</span><span className="text-xl font-extrabold text-[#344039]">{value}</span></span></div>; }
function formatFileSize(bytes: number) { if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`; return `${(bytes / (1024 * 1024)).toFixed(1)}MB`; }
