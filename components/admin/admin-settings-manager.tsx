"use client";

import { Activity, AlertCircle, CalendarOff, CheckCircle2, Database, FileArchive, Loader2, LockKeyholeOpen, Pencil, Plus, Save, Settings2, ShieldCheck, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Tab = "holidays" | "storage" | "logs" | "security" | "operating";
type Holiday = { id: string; title: string; holidayDate: string; description: string; creatorName: string; createdAt: string };
type StorageFile = { bucket: string; path: string; name: string; size: number; mimeType: string; updatedAt: string | null; referenced: boolean };
type ActivityLog = { id: string; actionType: string; actorName: string; targetType: string; targetId: string | null; changedData: Record<string, unknown>; createdAt: string };
type LockedEmployee = { id: string; loginId: string; name: string; failedLoginCount: number; lockedUntil: string | null; accountStatus: string };
type Settings = { companyName: string; defaultCalendarTab: "task" | "leave"; weekStartsOn: 0 | 1; sessionTtlHours: number };

const tabs: { value: Tab; label: string; icon: typeof CalendarOff }[] = [
  { value: "holidays", label: "회사 휴무일", icon: CalendarOff },
  { value: "storage", label: "Storage", icon: FileArchive },
  { value: "logs", label: "활동 로그", icon: Activity },
  { value: "security", label: "세션·잠금", icon: ShieldCheck },
  { value: "operating", label: "운영 설정", icon: Settings2 },
];

export function AdminSettingsManager({ holidays, storageFiles, activityLogs, lockedEmployees, sessionStats, settings, settingsSchemaReady }: {
  holidays: Holiday[];
  storageFiles: StorageFile[];
  activityLogs: ActivityLog[];
  lockedEmployees: LockedEmployee[];
  sessionStats: { total: number; active: number; expired: number };
  settings: Settings;
  settingsSchemaReady: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("holidays");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function run(key: string, request: () => Promise<Response>, successMessage: string) {
    setBusy(key);
    setMessage(null);
    try {
      const response = await request();
      const result = (await response.json()) as { message?: string; count?: number };
      if (!response.ok) throw new Error(result.message ?? "관리 작업을 완료하지 못했습니다.");
      setMessage({ type: "success", text: result.count === undefined ? successMessage : `${successMessage} (${result.count}건)` });
      router.refresh();
      return true;
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "관리 작업 중 오류가 발생했습니다." });
      return false;
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1240px]">
        <div>
          <p className="text-[12px] font-extrabold text-[#4c795d]">ADMIN CONSOLE</p>
          <h2 className="mt-1 text-[27px] font-extrabold tracking-[-0.045em] text-[#29352e]">관리자 설정</h2>
          <p className="mt-2 text-[13px] text-[#78827c]">회사 일정, 파일, 보안 상태와 기본 운영 정책을 관리합니다.</p>
        </div>

        <div className="mt-6 overflow-x-auto rounded-[14px] border border-[#e0e6e2] bg-white p-1.5 shadow-[0_10px_30px_rgba(35,54,42,0.04)]">
          <div className="flex min-w-max gap-1" role="tablist">
            {tabs.map((item) => { const Icon = item.icon; return <button key={item.value} type="button" role="tab" aria-selected={tab === item.value} onClick={() => { setTab(item.value); setMessage(null); }} className={cn("flex h-10 items-center gap-2 rounded-[10px] px-4 text-[12px] font-extrabold transition", tab === item.value ? "bg-[#e5f4e9] text-[#315f47]" : "text-[#717c75] hover:bg-[#f2f5f3]")}><Icon className="size-4" />{item.label}</button>; })}
          </div>
        </div>

        {message && <div role={message.type === "error" ? "alert" : "status"} className={cn("mt-4 flex items-center gap-2 rounded-[12px] border px-4 py-3 text-[13px] font-semibold", message.type === "error" ? "border-[#efc7c3] bg-[#fff3f2] text-[#984b46]" : "border-[#c5e4ce] bg-[#f0faf3] text-[#3e7552]")}>{message.type === "error" ? <AlertCircle className="size-4" /> : <CheckCircle2 className="size-4" />}{message.text}</div>}

        <div className="mt-5">
          {tab === "holidays" && <HolidayPanel holidays={holidays} busy={busy} run={run} />}
          {tab === "storage" && <StoragePanel files={storageFiles} busy={busy} run={run} />}
          {tab === "logs" && <LogPanel logs={activityLogs} />}
          {tab === "security" && <SecurityPanel employees={lockedEmployees} stats={sessionStats} busy={busy} run={run} />}
          {tab === "operating" && <OperatingPanel initial={settings} schemaReady={settingsSchemaReady} busy={busy} run={run} />}
        </div>
      </div>
    </section>
  );
}

type Run = (key: string, request: () => Promise<Response>, successMessage: string) => Promise<boolean>;

function HolidayPanel({ holidays, busy, run }: { holidays: Holiday[]; busy: string | null; run: Run }) {
  const [editing, setEditing] = useState<Holiday | null>(null);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");

  function reset() { setEditing(null); setTitle(""); setDate(""); setDescription(""); }
  function edit(holiday: Holiday) { setEditing(holiday); setTitle(holiday.title); setDate(holiday.holidayDate); setDescription(holiday.description); }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const key = editing ? `holiday-${editing.id}` : "holiday-new";
    const ok = await run(key, () => fetch(editing ? `/api/admin/settings/holidays/${editing.id}` : "/api/admin/settings/holidays", { method: editing ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title, holidayDate: date, description }) }), editing ? "휴무일을 수정했습니다." : "휴무일을 등록했습니다.");
    if (ok) reset();
  }

  return <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
    <Panel title={editing ? "휴무일 수정" : "휴무일 등록"} description="캘린더에 전사 휴무일로 표시됩니다." icon={<CalendarOff className="size-5" />}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="휴무일 이름"><input value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={100} placeholder="예: 창립기념일" className={inputClass} /></Field>
        <Field label="날짜"><input type="date" value={date} onChange={(event) => setDate(event.target.value)} required className={inputClass} /></Field>
        <Field label="설명"><textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} rows={4} placeholder="선택 사항" className={cn(inputClass, "h-auto resize-y py-3")} /></Field>
        <div className="flex gap-2"><Button type="submit" disabled={Boolean(busy)} className="flex-1">{busy?.startsWith("holiday-") ? <Loader2 className="size-4 animate-spin" /> : editing ? <Save className="size-4" /> : <Plus className="size-4" />}{editing ? "수정 저장" : "휴무일 등록"}</Button>{editing && <Button type="button" variant="secondary" onClick={reset}>취소</Button>}</div>
      </form>
    </Panel>
    <Panel title="등록된 회사 휴무일" description={`총 ${holidays.length}개의 휴무일이 등록되어 있습니다.`} icon={<Database className="size-5" />}>
      {holidays.length ? <div className="divide-y divide-[#edf0ee]">{holidays.map((holiday) => <div key={holiday.id} className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0"><div><p className="font-extrabold text-[#37433c]">{holiday.title}</p><p className="mt-1 text-[12px] font-bold text-[#4e785d]">{formatDate(holiday.holidayDate)}</p>{holiday.description && <p className="mt-1.5 text-[12px] text-[#737e77]">{holiday.description}</p>}<p className="mt-2 text-[10px] text-[#969e99]">{holiday.creatorName} 등록</p></div><div className="flex shrink-0 gap-1"><Button type="button" size="sm" variant="ghost" onClick={() => edit(holiday)}><Pencil className="size-3.5" />수정</Button><Button type="button" size="sm" variant="ghost" className="text-[#a0524d]" disabled={Boolean(busy)} onClick={() => { if (window.confirm(`${holiday.title} 휴무일을 삭제할까요?`)) void run(`holiday-delete-${holiday.id}`, () => fetch(`/api/admin/settings/holidays/${holiday.id}`, { method: "DELETE" }), "휴무일을 삭제했습니다."); }}><Trash2 className="size-3.5" />삭제</Button></div></div>)}</div> : <Empty text="등록된 회사 휴무일이 없습니다." />}
    </Panel>
  </div>;
}

function StoragePanel({ files, busy, run }: { files: StorageFile[]; busy: string | null; run: Run }) {
  const [bucket, setBucket] = useState("all");
  const shown = files.filter((file) => bucket === "all" || file.bucket === bucket);
  const orphanCount = files.filter((file) => !file.referenced).length;
  return <Panel title="Storage 파일 관리" description={`전체 ${files.length}개 · 정리 가능한 미참조 파일 ${orphanCount}개`} icon={<FileArchive className="size-5" />}>
    <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><p className="max-w-2xl text-[11px] leading-5 text-[#7c8780]">업무·휴가·프로필·일일업무일지·메신저에서 사용 중인 파일은 보호됩니다. 데이터베이스 참조가 없는 파일만 영구 삭제할 수 있습니다.</p><select value={bucket} onChange={(event) => setBucket(event.target.value)} className={cn(inputClass, "w-full sm:w-48")}><option value="all">전체 버킷</option><option value="profile-images">프로필 이미지</option><option value="task-attachments">업무 첨부</option><option value="leave-attachments">휴가 첨부</option><option value="daily-work-reports">일일업무일지</option><option value="chat-attachments">메신저 첨부</option></select></div>
    {shown.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead><tr className="border-b border-[#e5eae7] text-[10px] font-extrabold text-[#859088]"><th className="pb-3">파일</th><th className="pb-3">버킷</th><th className="pb-3">크기</th><th className="pb-3">상태</th><th className="pb-3 text-right">관리</th></tr></thead><tbody>{shown.map((file) => <tr key={`${file.bucket}/${file.path}`} className="border-b border-[#f0f2f0] last:border-0"><td className="max-w-[330px] py-3.5"><p className="truncate text-[12px] font-bold text-[#47534c]">{file.name}</p><p className="mt-1 truncate text-[10px] text-[#929b95]">{file.path}</p></td><td className="py-3.5 text-[11px] text-[#657169]">{bucketLabel(file.bucket)}</td><td className="py-3.5 text-[11px] text-[#657169]">{formatFileSize(file.size)}</td><td className="py-3.5"><span className={cn("rounded-full px-2 py-1 text-[10px] font-extrabold", file.referenced ? "bg-[#e9f5ec] text-[#3d7652]" : "bg-[#fff1df] text-[#96601f]")}>{file.referenced ? "사용 중" : "미참조"}</span></td><td className="py-3.5 text-right"><Button type="button" size="sm" variant="ghost" disabled={file.referenced || Boolean(busy)} className="text-[#a0524d]" onClick={() => { if (window.confirm(`${file.name} 파일을 Storage에서 영구 삭제할까요?`)) void run(`storage-${file.path}`, () => fetch("/api/admin/settings/storage", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ bucket: file.bucket, path: file.path }) }), "미참조 파일을 삭제했습니다."); }}>{busy === `storage-${file.path}` ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}삭제</Button></td></tr>)}</tbody></table></div> : <Empty text="표시할 Storage 파일이 없습니다." />}
  </Panel>;
}

function LogPanel({ logs }: { logs: ActivityLog[] }) {
  const [search, setSearch] = useState("");
  const shown = useMemo(() => { const key = search.trim().toLowerCase(); return logs.filter((log) => !key || log.actorName.toLowerCase().includes(key) || actionLabel(log.actionType).toLowerCase().includes(key) || log.actionType.toLowerCase().includes(key)); }, [logs, search]);
  return <Panel title="활동 로그" description="최근 관리자·직원·인증 작업 최대 150건을 표시합니다." icon={<Activity className="size-5" />}>
    <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="작업명 또는 실행자 검색" className={cn(inputClass, "mb-4 max-w-sm")} />
    {shown.length ? <div className="max-h-[650px] overflow-y-auto divide-y divide-[#edf0ee]">{shown.map((log) => <div key={log.id} className="py-3.5 first:pt-0"><div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-center"><p className="text-[12px] font-extrabold text-[#3e4a43]">{actionLabel(log.actionType)}</p><time className="text-[10px] text-[#929b95]">{formatDateTime(log.createdAt)}</time></div><p className="mt-1 text-[11px] text-[#68746c]">{log.actorName} · {log.targetType}</p>{Object.keys(log.changedData).length > 0 && <p className="mt-1.5 overflow-hidden text-ellipsis whitespace-nowrap rounded-[8px] bg-[#f7f9f7] px-2.5 py-2 font-mono text-[9px] text-[#7c8780]">{JSON.stringify(log.changedData)}</p>}</div>)}</div> : <Empty text="조건에 맞는 활동 로그가 없습니다." />}
  </Panel>;
}

function SecurityPanel({ employees, stats, busy, run }: { employees: LockedEmployee[]; stats: { total: number; active: number; expired: number }; busy: string | null; run: Run }) {
  return <div className="grid gap-5 lg:grid-cols-2">
    <Panel title="세션 관리" description="만료된 세션 레코드를 안전하게 정리합니다." icon={<ShieldCheck className="size-5" />}>
      <div className="grid grid-cols-3 gap-3"><Stat label="전체" value={stats.total} /><Stat label="활성" value={stats.active} tone="green" /><Stat label="만료" value={stats.expired} tone="orange" /></div>
      <Button type="button" className="mt-5 w-full" disabled={Boolean(busy) || stats.expired === 0} onClick={() => void run("sessions-cleanup", () => fetch("/api/admin/settings/maintenance", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "cleanup_expired_sessions" }) }), "만료 세션을 정리했습니다.")}>{busy === "sessions-cleanup" ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}만료 세션 {stats.expired}건 정리</Button>
    </Panel>
    <Panel title="로그인 잠금 해제" description="실패 횟수와 로그인 잠금 시간을 초기화합니다." icon={<LockKeyholeOpen className="size-5" />}>
      {employees.length ? <div className="divide-y divide-[#edf0ee]">{employees.map((employee) => <div key={employee.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"><div><p className="text-[12px] font-extrabold text-[#3e4a43]">{employee.name} <span className="font-normal text-[#8b948f]">({employee.loginId})</span></p><p className="mt-1 text-[10px] text-[#8a948e]">실패 {employee.failedLoginCount}회 · {employee.lockedUntil && new Date(employee.lockedUntil) > new Date() ? `${formatDateTime(employee.lockedUntil)}까지 잠금` : "현재 잠금 시간 없음"}</p></div><Button type="button" size="sm" variant="secondary" disabled={Boolean(busy)} onClick={() => void run(`unlock-${employee.id}`, () => fetch("/api/admin/settings/maintenance", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "unlock_employee", employeeId: employee.id }) }), `${employee.name}님의 로그인 잠금을 해제했습니다.`)}>{busy === `unlock-${employee.id}` ? <Loader2 className="size-3.5 animate-spin" /> : <LockKeyholeOpen className="size-3.5" />}해제</Button></div>)}</div> : <Empty text="실패가 누적되거나 잠긴 계정이 없습니다." />}
    </Panel>
  </div>;
}

function OperatingPanel({ initial, schemaReady, busy, run }: { initial: Settings; schemaReady: boolean; busy: string | null; run: Run }) {
  const [values, setValues] = useState(initial);
  async function submit(event: React.FormEvent) { event.preventDefault(); await run("operating", () => fetch("/api/admin/settings/operating", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(values) }), "기본 운영 설정을 저장했습니다."); }
  return <Panel title="기본 운영 설정" description="새 로그인과 캘린더 화면부터 즉시 적용됩니다." icon={<Settings2 className="size-5" />}>
    {!schemaReady && <div className="mb-5 rounded-[12px] border border-[#efd7a0] bg-[#fff9e8] px-4 py-3 text-[12px] font-semibold leading-5 text-[#796126]">운영 설정 테이블이 아직 없습니다. `202608040003_admin_settings.sql`을 Supabase SQL Editor에서 먼저 실행해 주세요. 현재는 안전한 기본값으로 동작합니다.</div>}
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <Field label="회사 표시명"><input value={values.companyName} onChange={(event) => setValues({ ...values, companyName: event.target.value })} maxLength={100} required className={inputClass} /></Field>
      <Field label="기본 캘린더 탭"><select value={values.defaultCalendarTab} onChange={(event) => setValues({ ...values, defaultCalendarTab: event.target.value as "task" | "leave" })} className={inputClass}><option value="task">업무 캘린더</option><option value="leave">휴가 캘린더</option></select></Field>
      <Field label="한 주 시작 요일"><select value={values.weekStartsOn} onChange={(event) => setValues({ ...values, weekStartsOn: Number(event.target.value) as 0 | 1 })} className={inputClass}><option value={0}>일요일</option><option value={1}>월요일</option></select></Field>
      <Field label="로그인 세션 유지 시간"><div className="relative"><input type="number" min={1} max={720} value={values.sessionTtlHours} onChange={(event) => setValues({ ...values, sessionTtlHours: Number(event.target.value) })} required className={cn(inputClass, "pr-14")} /><span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-[#8a948e]">시간</span></div></Field>
      <div className="sm:col-span-2"><p className="mb-4 rounded-[10px] bg-[#f7f9f7] px-3.5 py-3 text-[11px] leading-5 text-[#768078]">세션 시간 변경은 새로 로그인하는 세션부터 적용됩니다. 기존 세션의 만료 시간은 변경되지 않습니다.</p><Button type="submit" disabled={Boolean(busy) || !schemaReady}>{busy === "operating" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}운영 설정 저장</Button></div>
    </form>
  </Panel>;
}

function Panel({ title, description, icon, children }: { title: string; description: string; icon: React.ReactNode; children: React.ReactNode }) { return <div className="rounded-[18px] border border-[#e0e6e2] bg-white p-5 shadow-[0_12px_35px_rgba(35,54,42,0.04)] sm:p-6"><div className="mb-5 flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-[12px] bg-[#e7f4ea] text-[#3d7051]">{icon}</span><div><h3 className="text-[17px] font-extrabold text-[#344039]">{title}</h3><p className="mt-0.5 text-[11px] text-[#88918c]">{description}</p></div></div>{children}</div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label><span className="mb-1.5 block text-[11px] font-bold text-[#5e6962]">{label}</span>{children}</label>; }
function Empty({ text }: { text: string }) { return <div className="rounded-[12px] border border-dashed border-[#dce3de] bg-[#fafbfa] py-10 text-center text-[12px] text-[#8a948e]">{text}</div>; }
function Stat({ label, value, tone = "gray" }: { label: string; value: number; tone?: "gray" | "green" | "orange" }) { return <div className={cn("rounded-[12px] px-3 py-4 text-center", tone === "green" ? "bg-[#edf8f0]" : tone === "orange" ? "bg-[#fff4e7]" : "bg-[#f3f5f3]")}><p className="text-[21px] font-extrabold text-[#39463e]">{value}</p><p className="mt-0.5 text-[10px] font-bold text-[#7d8781]">{label}</p></div>; }
function formatDate(value: string) { const [year, month, day] = value.split("-"); return `${year}.${month}.${day}`; }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul" }).format(new Date(value)); }
function formatFileSize(value: number) { if (!value) return "-"; if (value < 1024) return `${value} B`; if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`; return `${(value / 1024 / 1024).toFixed(1)} MB`; }
function bucketLabel(value: string) { return { "profile-images": "프로필 이미지", "task-attachments": "업무 첨부", "leave-attachments": "휴가 첨부", "daily-work-reports": "일일업무일지", "chat-attachments": "메신저 첨부" }[value] ?? value; }
function actionLabel(value: string) { return ({ "auth.login": "로그인", "auth.password.recover": "비밀번호 재설정", "employee.register": "직원 가입 신청", "employee.profile.update": "프로필 수정", "admin.employee.create": "직원 직접 등록", "admin.employee.update": "직원 정보 수정", "admin.employee.password.reset": "직원 비밀번호 재설정", "admin.employee.delete": "직원 삭제", "admin.employee.approve": "직원 가입 승인", "admin.employee.reject": "직원 가입 반려", "admin.employee.suspend": "직원 사용 중지", "admin.employee.activate": "직원 사용 재개", "admin.holiday.create": "회사 휴무일 등록", "admin.holiday.update": "회사 휴무일 수정", "admin.holiday.delete": "회사 휴무일 삭제", "admin.sessions.cleanup": "만료 세션 정리", "admin.login.unlock": "로그인 잠금 해제", "admin.storage.delete": "Storage 파일 삭제", "admin.settings.update": "운영 설정 변경", "task.create": "업무 등록", "task.update": "업무 수정", "task.schedule.update": "캘린더에서 업무 일정 변경", "task.delete": "업무 삭제", "leave.create": "휴가 신청", "leave.update": "휴가 수정", "leave.cancel": "휴가 취소", "leave.delete": "휴가 삭제", "leave.review": "휴가 승인 처리", "daily_report.create": "일일업무일지 등록", "daily_report.update": "일일업무일지 수정", "daily_report.delete": "일일업무일지 삭제", "chat.room.create": "메신저 채팅방 생성", "chat.room.leave": "메신저 채팅방 나가기" } as Record<string, string>)[value] ?? value; }
const inputClass = "h-11 w-full rounded-[10px] border border-[#dfe5e1] bg-white px-3.5 text-[13px] font-semibold text-[#455049] outline-none transition focus:border-[#7eae8d] focus:ring-3 focus:ring-[#dcefe2]";
