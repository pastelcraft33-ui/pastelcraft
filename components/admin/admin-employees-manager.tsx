"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Activity,
  Ban,
  Check,
  CheckCircle2,
  Clock3,
  KeyRound,
  Loader2,
  Pencil,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  UsersRound,
  UserX,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  accountStatusLabels,
  allDepartmentOptions,
  adminPositionOptions,
  departmentLabel,
  departmentOptions,
  positionLabel,
  roleLabel,
  roleOptions,
} from "@/lib/employees/constants";
import { securityQuestionOptions } from "@/lib/auth/security-questions";
import { cn, formatPhone } from "@/lib/utils";
import {
  adminCreateEmployeeSchema,
  adminResetPasswordSchema,
  adminUpdateEmployeeSchema,
  type AdminCreateEmployeeInput,
  type AdminResetPasswordInput,
  type AdminUpdateEmployeeInput,
} from "@/schemas/admin-employees";

export type ManagedEmployee = {
  id: string;
  loginId: string;
  name: string;
  position: string;
  department: string;
  phone: string;
  imageUrl: string | null;
  role: "employee" | "admin";
  accountStatus: "pending" | "active" | "rejected" | "suspended";
  hireDate: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
};

type ActivityLog = {
  id: string;
  actionType: string;
  actorName: string;
  targetName: string;
  changedData: Record<string, unknown>;
  createdAt: string;
};

type Tab = "pending" | "all" | "activity";
type StatusAction = "approve" | "reject" | "suspend" | "activate";

export function AdminEmployeesManager({
  employees,
  activityLogs,
  currentEmployeeId,
  isAdmin,
  canEditHireDate,
  hireDateAvailable,
}: {
  employees: ManagedEmployee[];
  activityLogs: ActivityLog[];
  currentEmployeeId: string;
  isAdmin: boolean;
  canEditHireDate: boolean;
  hireDateAvailable: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<ManagedEmployee | null>(null);
  const [resettingEmployee, setResettingEmployee] = useState<ManagedEmployee | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const pendingEmployees = employees.filter(
    (employee) => employee.accountStatus === "pending",
  );
  const stats = {
    total: employees.length,
    pending: pendingEmployees.length,
    active: employees.filter((employee) => employee.accountStatus === "active").length,
    suspended: employees.filter((employee) => employee.accountStatus === "suspended").length,
    admins: employees.filter((employee) => employee.role === "admin").length,
  };
  const filteredEmployees = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return employees;

    return employees.filter((employee) =>
      [
        employee.name,
        employee.loginId,
        employee.phone,
        positionLabel(employee.position),
        departmentLabel(employee.department),
      ].some((value) => value.toLowerCase().includes(keyword)),
    );
  }, [employees, search]);

  async function runStatusAction(
    employee: ManagedEmployee,
    action: StatusAction,
  ) {
    let reason: string | undefined;

    if (action === "reject") {
      const input = window.prompt(`${employee.name}님의 가입 반려 사유를 입력해 주세요.`);
      if (input === null) return;
      if (!input.trim()) {
        setNotice({ kind: "error", text: "반려 사유를 입력해 주세요." });
        return;
      }
      reason = input.trim();
    }

    if (
      action === "suspend" &&
      !window.confirm(`${employee.name}님의 계정 사용을 중지할까요? 로그인 세션도 종료됩니다.`)
    ) {
      return;
    }

    if (
      action === "approve" &&
      !window.confirm(`${employee.name}님의 계정을 승인할까요?`)
    ) {
      return;
    }

    const key = `${employee.id}:${action}`;
    setBusyKey(key);
    setNotice(null);

    try {
      const response = await fetch(`/api/admin/employees/${employee.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      const result = (await response.json()) as { message?: string };

      if (!response.ok) throw new Error(result.message ?? "계정 상태를 변경하지 못했습니다.");

      setNotice({ kind: "success", text: statusSuccessMessage(employee.name, action) });
      router.refresh();
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "처리 중 오류가 발생했습니다.",
      });
    } finally {
      setBusyKey(null);
    }
  }

  async function deleteEmployee(employee: ManagedEmployee) {
    const confirmationName = window.prompt(
      `${employee.name}님의 계정을 영구 삭제합니다.\n해당 직원이 소유한 업무·휴가·업무일지·회의·메신저 데이터도 함께 삭제되며 복구할 수 없습니다.\n계속하려면 직원 이름을 정확히 입력해 주세요.`,
    );
    if (confirmationName === null) return;
    if (confirmationName.trim() !== employee.name) {
      setNotice({ kind: "error", text: "직원 이름이 일치하지 않아 삭제하지 않았습니다." });
      return;
    }

    const key = `${employee.id}:delete`;
    setBusyKey(key);
    setNotice(null);

    try {
      const response = await fetch(`/api/admin/employees/${employee.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmationName: confirmationName.trim() }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "직원을 삭제하지 못했습니다.");

      setNotice({ kind: "success", text: `${employee.name}님의 계정과 연결 데이터를 영구 삭제했습니다.` });
      router.refresh();
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "처리 중 오류가 발생했습니다.",
      });
    } finally {
      setBusyKey(null);
    }
  }

  function handleSaved(message: string) {
    setCreateOpen(false);
    setEditingEmployee(null);
    setNotice({ kind: "success", text: message });
    router.refresh();
  }

  return (
    <section className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1480px]">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-[13px] font-bold text-[#3c7453]">{isAdmin ? "관리자 전용" : "팀장·대표자 전용"}</p>
            <h2 className="mt-1 text-[24px] font-extrabold tracking-[-0.04em] text-[#29352e]">
              직원 계정 관리
            </h2>
            <p className="mt-2 text-[13px] text-[#7d8781]">
              {isAdmin
                ? "가입 승인부터 계정 권한과 사용 상태까지 안전하게 관리합니다."
                : "전체 직원 정보를 확인하고 입사일을 기록합니다."}
            </p>
          </div>
          {isAdmin && (
            <Button onClick={() => setCreateOpen(true)}>
              <UserPlus className="size-[17px]" /> 직원 직접 등록
            </Button>
          )}
        </div>

        {notice && (
          <div
            role="status"
            className={cn(
              "mt-5 flex items-center justify-between gap-3 rounded-[12px] border px-4 py-3 text-[13px] font-medium",
              notice.kind === "success"
                ? "border-[#bfe0ca] bg-[#eff9f2] text-[#3c7452]"
                : "border-[#efc5c1] bg-[#fff2f1] text-[#9a4d47]",
            )}
          >
            <span className="flex items-center gap-2">
              {notice.kind === "success" ? <CheckCircle2 className="size-4" /> : <X className="size-4" />}
              {notice.text}
            </span>
            <button type="button" onClick={() => setNotice(null)} aria-label="알림 닫기">
              <X className="size-4" />
            </button>
          </div>
        )}

        {!hireDateAvailable && canEditHireDate && (
          <p className="mt-4 rounded-xl border border-[#edda9b] bg-[#fff9e7] px-4 py-3 text-[12px] leading-5 text-[#786323]">
            입사일 입력 기능을 사용하려면 Supabase SQL Editor에서 <code>202610070001_employee_hire_date.sql</code>을 먼저 실행해 주세요.
          </p>
        )}

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={UsersRound} label="전체 직원" value={stats.total} tone="green" />
          <StatCard icon={Clock3} label="승인 대기" value={stats.pending} tone="yellow" />
          <StatCard icon={UserCheck} label="사용 중" value={stats.active} tone="blue" />
          <StatCard icon={ShieldCheck} label="관리자" value={stats.admins} tone="gray" detail={stats.suspended ? `사용 중지 ${stats.suspended}명` : undefined} />
        </div>

        <div className="mt-6 overflow-hidden rounded-[18px] border border-[#e1e6e2] bg-white shadow-[0_12px_35px_rgba(38,57,45,0.04)]">
          <div className="flex flex-col justify-between gap-3 border-b border-[#e8ece9] px-4 py-4 sm:flex-row sm:items-center sm:px-6">
            <div role="tablist" aria-label="직원 관리 보기" className="flex gap-1 rounded-[11px] bg-[#f0f3f1] p-1">
              <TabButton active={tab === "all"} onClick={() => setTab("all")}>
                전체 직원 <CountBadge value={stats.total} />
              </TabButton>
              {isAdmin && (
                <>
                  <TabButton active={tab === "pending"} onClick={() => setTab("pending")}>
                    가입 대기 <CountBadge value={stats.pending} highlight />
                  </TabButton>
                  <TabButton active={tab === "activity"} onClick={() => setTab("activity")}>
                    활동 기록
                  </TabButton>
                </>
              )}
            </div>

            {tab === "all" && (
              <label className="relative block sm:w-[280px]">
                <span className="sr-only">직원 검색</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#939c96]" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="이름, 아이디, 연락처 검색"
                  className="h-10 w-full rounded-[10px] border border-[#dfe4e1] bg-white pl-9 pr-3 text-[13px] outline-none focus:border-[#97cbaa] focus:ring-3 focus:ring-emerald-100"
                />
              </label>
            )}
          </div>

          {tab === "pending" && (
            <PendingList
              employees={pendingEmployees}
              busyKey={busyKey}
              onAction={runStatusAction}
              onEdit={setEditingEmployee}
              onDelete={deleteEmployee}
            />
          )}
          {tab === "all" && (
            <EmployeeTable
              employees={filteredEmployees}
              currentEmployeeId={currentEmployeeId}
              busyKey={busyKey}
              onAction={runStatusAction}
              onEdit={setEditingEmployee}
              onResetPassword={setResettingEmployee}
              onDelete={deleteEmployee}
              canManageEmployees={isAdmin}
              canEditHireDate={canEditHireDate && hireDateAvailable}
              onHireDateSaved={() => {
                setNotice({ kind: "success", text: "입사일을 저장했습니다." });
                router.refresh();
              }}
            />
          )}
          {tab === "activity" && isAdmin && <ActivityList logs={activityLogs} />}
        </div>
      </div>

      {createOpen && (
        <CreateEmployeeDialog
          onClose={() => setCreateOpen(false)}
          onSaved={() => handleSaved("직원 계정을 생성했습니다.")}
        />
      )}
      {editingEmployee && (
        <EditEmployeeDialog
          employee={editingEmployee}
          isSelf={editingEmployee.id === currentEmployeeId}
          onClose={() => setEditingEmployee(null)}
          onSaved={() => handleSaved("직원 정보를 수정했습니다.")}
        />
      )}
      {resettingEmployee && (
        <ResetPasswordDialog
          employee={resettingEmployee}
          onClose={() => setResettingEmployee(null)}
          onSaved={() => {
            setResettingEmployee(null);
            setNotice({ kind: "success", text: `${resettingEmployee.name}님의 비밀번호를 재설정하고 기존 로그인을 종료했습니다.` });
            router.refresh();
          }}
        />
      )}
    </section>
  );
}

function PendingList({
  employees,
  busyKey,
  onAction,
  onEdit,
  onDelete,
}: {
  employees: ManagedEmployee[];
  busyKey: string | null;
  onAction: (employee: ManagedEmployee, action: StatusAction) => void;
  onEdit: (employee: ManagedEmployee) => void;
  onDelete: (employee: ManagedEmployee) => void;
}) {
  if (employees.length === 0) {
    return (
      <EmptyState
        icon={UserCheck}
        title="대기 중인 가입 신청이 없습니다"
        description="새 직원이 가입을 신청하면 이곳에서 확인할 수 있습니다."
      />
    );
  }

  return (
    <div className="grid gap-3 p-4 lg:grid-cols-2 lg:p-6">
      {employees.map((employee) => (
        <article key={employee.id} className="rounded-[15px] border border-[#e5e9e6] bg-[#fbfcfb] p-4">
          <div className="flex items-start gap-3">
            <Avatar name={employee.name} imageUrl={employee.imageUrl} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-extrabold text-[#354139]">{employee.name}</h3>
                <StatusBadge status="pending" />
              </div>
              <p className="mt-1 text-[12px] text-[#87908a]">
                {departmentLabel(employee.department)} · {positionLabel(employee.position)} · @{employee.loginId}
              </p>
              <p className="mt-2 text-[12px] font-medium text-[#59645d]">{employee.phone}</p>
              <p className="mt-1 text-[10px] text-[#a0a8a3]">
                신청 {formatDateTime(employee.createdAt)}
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-[#ebeeec] pt-3">
            <Button variant="ghost" size="sm" onClick={() => onEdit(employee)}>
              <Pencil className="size-3.5" /> 정보 수정
            </Button>
            <Button variant="ghost" size="sm" className="text-[#b6544f] hover:bg-[#fff1f0] hover:text-[#9d433e]" onClick={() => onDelete(employee)} disabled={busyKey === `${employee.id}:delete`}>
              {busyKey === `${employee.id}:delete` ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />} 삭제
            </Button>
            <Button variant="secondary" size="sm" onClick={() => onAction(employee, "reject")} disabled={busyKey === `${employee.id}:reject`}>
              {busyKey === `${employee.id}:reject` ? <Loader2 className="size-3.5 animate-spin" /> : <UserX className="size-3.5" />} 반려
            </Button>
            <Button size="sm" onClick={() => onAction(employee, "approve")} disabled={busyKey === `${employee.id}:approve`}>
              {busyKey === `${employee.id}:approve` ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} 승인
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}

function EmployeeTable({
  employees,
  currentEmployeeId,
  busyKey,
  onAction,
  onEdit,
  onResetPassword,
  onDelete,
  canManageEmployees,
  canEditHireDate,
  onHireDateSaved,
}: {
  employees: ManagedEmployee[];
  currentEmployeeId: string;
  busyKey: string | null;
  onAction: (employee: ManagedEmployee, action: StatusAction) => void;
  onEdit: (employee: ManagedEmployee) => void;
  onResetPassword: (employee: ManagedEmployee) => void;
  onDelete: (employee: ManagedEmployee) => void;
  canManageEmployees: boolean;
  canEditHireDate: boolean;
  onHireDateSaved: () => void;
}) {
  if (employees.length === 0) {
    return <EmptyState icon={Search} title="검색 결과가 없습니다" description="다른 검색어로 다시 확인해 주세요." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className={cn("w-full border-collapse text-left", canManageEmployees ? "min-w-[1120px]" : "min-w-[920px] table-fixed")}>
        <thead>
          <tr className="border-b border-[#e9ecea] bg-[#fafbfa] text-[11px] font-bold text-[#7d8781]">
            <th className={cn("whitespace-nowrap px-4 py-3.5", canManageEmployees ? "min-w-[190px]" : "w-[17%]")}>직원</th>
            <th className={cn("whitespace-nowrap px-4 py-3.5", canManageEmployees ? "min-w-[145px]" : "w-[19%]")}>부서·직급</th>
            <th className={cn("whitespace-nowrap px-4 py-3.5", canManageEmployees ? "min-w-[135px]" : "w-[14%]")}>연락처</th>
            <th className={cn("whitespace-nowrap px-4 py-3.5", canManageEmployees ? "min-w-[220px]" : "w-[25%]")}>입사일</th>
            <th className={cn("whitespace-nowrap px-4 py-3.5", canManageEmployees ? "min-w-[100px]" : "w-[9%]")}>권한</th>
            <th className={cn("whitespace-nowrap px-4 py-3.5", canManageEmployees ? "min-w-[150px]" : "w-[16%]")}>최근 로그인</th>
            {canManageEmployees && <th className="px-6 py-3.5 text-right">관리</th>}
          </tr>
        </thead>
        <tbody>
          {employees.map((employee) => {
            const isSelf = employee.id === currentEmployeeId;
            return (
              <tr key={employee.id} className="border-b border-[#eef0ef] text-[13px] last:border-0 hover:bg-[#fafcfa]">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={employee.name} imageUrl={employee.imageUrl} />
                    <div>
                      <p className="font-bold text-[#39443d]">
                        {employee.name} {isSelf && <span className="ml-1 text-[10px] text-[#3c7955]">나</span>}
                      </p>
                      <p className="mt-0.5 text-[10px] text-[#929b95]">@{employee.loginId}</p>
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-[#5d6861]">{departmentLabel(employee.department)} · {positionLabel(employee.position)}</td>
                <td className="whitespace-nowrap px-4 py-4 font-medium text-[#5d6861]">{employee.phone}</td>
                <td className="whitespace-nowrap px-4 py-3.5">
                  {canEditHireDate ? (
                    <HireDateEditor employee={employee} onSaved={onHireDateSaved} />
                  ) : employee.hireDate ? formatDate(employee.hireDate) : <span className="text-[#a0a8a3]">미입력</span>}
                </td>
                <td className="whitespace-nowrap px-4 py-4">
                  <span className={cn("inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold", employee.role === "admin" ? "bg-[#fff3c5] text-[#775e18]" : "bg-[#eef1ef] text-[#66716a]")}>{roleLabel(employee.role)}</span>
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-[11px] text-[#87918b]">{employee.lastLoginAt ? formatDateTime(employee.lastLoginAt) : "로그인 기록 없음"}</td>
                {canManageEmployees && <td className="px-6 py-4">
                  <div className="flex justify-end gap-1.5">
                    <Button variant="ghost" size="sm" onClick={() => onEdit(employee)}><Pencil className="size-3.5" /> 수정</Button>
                    {!isSelf && <Button variant="ghost" size="sm" onClick={() => onResetPassword(employee)}><KeyRound className="size-3.5" /> 비밀번호</Button>}
                    {!isSelf && <Button variant="ghost" size="sm" className="text-[#b6544f] hover:bg-[#fff1f0] hover:text-[#9d433e]" onClick={() => onDelete(employee)} disabled={busyKey === `${employee.id}:delete`}>{busyKey === `${employee.id}:delete` ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />} 삭제</Button>}
                    {employee.accountStatus === "pending" && <Button size="sm" onClick={() => onAction(employee, "approve")} disabled={busyKey === `${employee.id}:approve`}><Check className="size-3.5" /> 승인</Button>}
                    {employee.accountStatus === "rejected" && <Button variant="secondary" size="sm" onClick={() => onAction(employee, "approve")}><RotateCcw className="size-3.5" /> 다시 승인</Button>}
                    {employee.accountStatus === "active" && !isSelf && <Button variant="secondary" size="sm" onClick={() => onAction(employee, "suspend")} disabled={busyKey === `${employee.id}:suspend`}><Ban className="size-3.5" /> 사용 중지</Button>}
                    {employee.accountStatus === "suspended" && <Button variant="secondary" size="sm" onClick={() => onAction(employee, "activate")} disabled={busyKey === `${employee.id}:activate`}><RotateCcw className="size-3.5" /> 재활성화</Button>}
                  </div>
                </td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function HireDateEditor({ employee, onSaved }: { employee: ManagedEmployee; onSaved: () => void }) {
  const [hireDate, setHireDate] = useState(employee.hireDate ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unchanged = (employee.hireDate ?? "") === hireDate;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/employees/${employee.id}/hire-date`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hireDate: hireDate || null }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "입사일을 저장하지 못했습니다.");
      onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "입사일을 저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-w-[210px] items-center gap-1.5">
      <input
        type="date"
        aria-label={`${employee.name} 입사일`}
        value={hireDate}
        onChange={(event) => {
          setHireDate(event.target.value);
          setError(null);
        }}
        className="h-9 min-w-0 rounded-lg border border-[#dfe4e1] bg-white px-2 text-[11px] text-[#526058] outline-none focus:border-[#97cbaa] focus:ring-2 focus:ring-emerald-100"
      />
      <Button type="button" size="sm" variant="secondary" disabled={busy || unchanged} onClick={() => void save()}>
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : "저장"}
      </Button>
      {error && <span role="alert" className="sr-only">{error}</span>}
      {error && <span title={error} className="text-[10px] font-semibold text-[#a44742]">오류</span>}
    </div>
  );
}

function ActivityList({ logs }: { logs: ActivityLog[] }) {
  if (logs.length === 0) {
    return <EmptyState icon={Activity} title="관리자 활동 기록이 없습니다" description="직원 계정을 관리하면 변경 내역이 이곳에 기록됩니다." />;
  }

  return (
    <div className="divide-y divide-[#ecefed]">
      {logs.map((log) => (
        <div key={log.id} className="flex gap-3 px-5 py-4 sm:px-6">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#edf5f0] text-[#47765a]"><Activity className="size-4" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] text-[#4b5750]"><strong className="text-[#354139]">{log.actorName}</strong>님이 <strong className="text-[#354139]">{log.targetName}</strong>님의 계정을 {activityActionLabel(log.actionType)}했습니다.</p>
            {activityDetail(log.changedData) && <p className="mt-1.5 truncate text-[11px] text-[#8b948f]">{activityDetail(log.changedData)}</p>}
          </div>
          <time className="shrink-0 text-[10px] text-[#9ba39e]">{formatDateTime(log.createdAt)}</time>
        </div>
      ))}
    </div>
  );
}

function CreateEmployeeDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<AdminCreateEmployeeInput>({
    resolver: zodResolver(adminCreateEmployeeSchema),
    defaultValues: { loginId: "", password: "", passwordConfirm: "", name: "", position: "staff", department: "web_design", phone: "", role: "employee", securityQuestion: "high_school", securityAnswer: "" },
  });
  const phoneField = register("phone");

  const onSubmit = handleSubmit(async (input) => {
    setServerError(null);
    const response = await fetch("/api/admin/employees", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
    const result = (await response.json()) as { message?: string };
    if (!response.ok) { setServerError(result.message ?? "직원을 등록하지 못했습니다."); return; }
    onSaved();
  });

  return (
    <EmployeeDialog title="직원 직접 등록" description="관리자가 생성한 계정은 즉시 사용 가능한 상태가 됩니다." onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {serverError && <FormError message={serverError} />}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="로그인 아이디" error={errors.loginId?.message}><input {...register("loginId")} className={inputClass} placeholder="영문 아이디" /></FormField>
          <FormField label="이름" error={errors.name?.message}><input {...register("name")} className={inputClass} placeholder="직원 이름" /></FormField>
          <FormField label="비밀번호" error={errors.password?.message}><input {...register("password")} type="password" className={inputClass} placeholder="영문·숫자 포함 10자 이상" /></FormField>
          <FormField label="비밀번호 확인" error={errors.passwordConfirm?.message}><input {...register("passwordConfirm")} type="password" className={inputClass} placeholder="비밀번호 다시 입력" /></FormField>
          <FormField label="직급" error={errors.position?.message}><select {...register("position")} className={inputClass}>{adminPositionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></FormField>
          <FormField label="부서" error={errors.department?.message}><select {...register("department")} className={inputClass}>{departmentOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></FormField>
          <FormField label="연락처" error={errors.phone?.message}><input {...phoneField} onChange={(event) => { event.target.value = formatPhone(event.target.value); phoneField.onChange(event); }} className={inputClass} placeholder="010-1234-5678" /></FormField>
          <FormField label="계정 권한" error={errors.role?.message}><select {...register("role")} className={inputClass}>{roleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></FormField>
          <FormField label="보안 질문" error={errors.securityQuestion?.message}><select {...register("securityQuestion")} className={inputClass}>{securityQuestionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></FormField>
          <FormField label="보안 질문 답변" error={errors.securityAnswer?.message}><input {...register("securityAnswer")} type="password" autoComplete="off" className={inputClass} placeholder="비밀번호 찾기에 사용할 답변" /></FormField>
        </div>
        <DialogActions onClose={onClose} submitting={isSubmitting} submitLabel="직원 계정 생성" />
      </form>
    </EmployeeDialog>
  );
}

function EditEmployeeDialog({ employee, isSelf, onClose, onSaved }: { employee: ManagedEmployee; isSelf: boolean; onClose: () => void; onSaved: () => void }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<AdminUpdateEmployeeInput>({
    resolver: zodResolver(adminUpdateEmployeeSchema),
    defaultValues: { name: employee.name, position: employee.position as AdminUpdateEmployeeInput["position"], department: employee.department as AdminUpdateEmployeeInput["department"], phone: employee.phone, role: employee.role },
  });
  const phoneField = register("phone");

  const onSubmit = handleSubmit(async (input) => {
    setServerError(null);
    const response = await fetch(`/api/admin/employees/${employee.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
    const result = (await response.json()) as { message?: string };
    if (!response.ok) { setServerError(result.message ?? "직원 정보를 수정하지 못했습니다."); return; }
    onSaved();
  });

  return (
    <EmployeeDialog title="직원 정보 수정" description={`@${employee.loginId} 계정의 정보와 권한을 수정합니다.`} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {serverError && <FormError message={serverError} />}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="이름" error={errors.name?.message}><input {...register("name")} className={inputClass} /></FormField>
          <FormField label="연락처" error={errors.phone?.message}><input {...phoneField} onChange={(event) => { event.target.value = formatPhone(event.target.value); phoneField.onChange(event); }} className={inputClass} /></FormField>
          <FormField label="직급" error={errors.position?.message}><select {...register("position")} className={inputClass}>{adminPositionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></FormField>
          <FormField label="부서" error={errors.department?.message}><select {...register("department")} className={inputClass}>{allDepartmentOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>{employee.department === "web" && <p className="mt-1.5 text-[10px] text-[#8b948f]">기존 웹팀 직원입니다. 웹디자인팀 또는 웹마케팅팀으로 지정해 주세요.</p>}</FormField>
          <FormField label="계정 권한" error={errors.role?.message} className="sm:col-span-2"><select {...register("role")} disabled={isSelf} className={cn(inputClass, "disabled:bg-[#f2f4f2] disabled:text-[#969e99]")}>{roleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>{isSelf && <p className="mt-1.5 text-[10px] text-[#8b948f]">현재 로그인한 계정의 관리자 권한은 해제할 수 없습니다.</p>}</FormField>
        </div>
        <DialogActions onClose={onClose} submitting={isSubmitting} submitLabel="변경 내용 저장" />
      </form>
    </EmployeeDialog>
  );
}

function ResetPasswordDialog({ employee, onClose, onSaved }: { employee: ManagedEmployee; onClose: () => void; onSaved: () => void }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<AdminResetPasswordInput>({
    resolver: zodResolver(adminResetPasswordSchema),
    defaultValues: { password: "", passwordConfirm: "" },
  });

  const onSubmit = handleSubmit(async (input) => {
    setServerError(null);
    try {
      const response = await fetch(`/api/admin/employees/${employee.id}/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "비밀번호를 재설정하지 못했습니다.");
      reset();
      onSaved();
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "처리 중 오류가 발생했습니다.");
    }
  });

  return (
    <EmployeeDialog title="직원 비밀번호 재설정" description={`${employee.name} (@${employee.loginId}) 계정에 새 비밀번호를 설정합니다.`} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {serverError && <FormError message={serverError} />}
        <div className="rounded-[11px] border border-[#eedda8] bg-[#fff9e5] px-4 py-3 text-[11px] leading-5 text-[#75601f]">
          저장 즉시 기존 로그인 세션이 모두 종료되며, 직원은 새 비밀번호로 다시 로그인해야 합니다.
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="새 비밀번호" error={errors.password?.message}><input {...register("password")} type="password" autoComplete="new-password" className={inputClass} placeholder="영문·숫자 포함 10자 이상" /></FormField>
          <FormField label="새 비밀번호 확인" error={errors.passwordConfirm?.message}><input {...register("passwordConfirm")} type="password" autoComplete="new-password" className={inputClass} placeholder="새 비밀번호 다시 입력" /></FormField>
        </div>
        <DialogActions onClose={onClose} submitting={isSubmitting} submitLabel="비밀번호 재설정" />
      </form>
    </EmployeeDialog>
  );
}

function EmployeeDialog({ title, description, onClose, children }: { title: string; description: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#18271e]/40 p-4 backdrop-blur-[2px]" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className="my-auto w-full max-w-[680px] overflow-hidden rounded-[20px] border border-white/70 bg-white shadow-[0_25px_90px_rgba(20,39,27,0.22)]">
        <div className="flex items-start justify-between border-b border-[#e9edea] px-6 py-5">
          <div><h3 className="text-xl font-extrabold tracking-[-0.03em] text-[#2d3932]">{title}</h3><p className="mt-1 text-[12px] text-[#858f89]">{description}</p></div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="닫기" className="-mr-2 -mt-1"><X className="size-5" /></Button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function DialogActions({ onClose, submitting, submitLabel }: { onClose: () => void; submitting: boolean; submitLabel: string }) {
  return <div className="flex justify-end gap-2 border-t border-[#edf0ee] pt-4"><Button type="button" variant="secondary" onClick={onClose}>취소</Button><Button type="submit" disabled={submitting}>{submitting && <Loader2 className="size-4 animate-spin" />}{submitLabel}</Button></div>;
}

function FormField({ label, error, className, children }: { label: string; error?: string; className?: string; children: React.ReactNode }) {
  return <label className={cn("block", className)}><span className="mb-1.5 block text-[12px] font-bold text-[#59645d]">{label}</span>{children}{error && <span className="mt-1 block text-[10px] font-medium text-[#b6544f]">{error}</span>}</label>;
}

function FormError({ message }: { message: string }) {
  return <div className="rounded-[10px] border border-[#efc4c0] bg-[#fff2f1] px-3 py-2.5 text-[12px] text-[#994b46]">{message}</div>;
}

function StatCard({ icon: Icon, label, value, tone, detail }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; tone: "green" | "yellow" | "blue" | "gray"; detail?: string }) {
  const tones = { green: "bg-[#e6f5eb] text-[#3e7554]", yellow: "bg-[#fff3c5] text-[#7b631d]", blue: "bg-[#e8f1fd] text-[#4a72a2]", gray: "bg-[#eef1ef] text-[#68726c]" };
  return <div className="flex items-center gap-3 rounded-[15px] border border-[#e2e7e3] bg-white p-4"><span className={cn("flex size-10 items-center justify-center rounded-[12px]", tones[tone])}><Icon className="size-[18px]" /></span><div><p className="text-[11px] font-bold text-[#828c86]">{label}</p><p className="mt-0.5 text-xl font-extrabold text-[#354139]">{value}<span className="ml-1 text-[11px] font-medium text-[#929b95]">명</span></p>{detail && <p className="text-[9px] text-[#9aa29d]">{detail}</p>}</div></div>;
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" role="tab" aria-selected={active} onClick={onClick} className={cn("flex h-9 items-center gap-1.5 rounded-[8px] px-3 text-[12px] font-bold transition", active ? "bg-white text-[#346b4c] shadow-sm" : "text-[#77817b] hover:text-[#4c5851]")}>{children}</button>;
}

function CountBadge({ value, highlight = false }: { value: number; highlight?: boolean }) {
  return <span className={cn("rounded-full px-1.5 py-0.5 text-[9px]", highlight && value > 0 ? "bg-[#fff0b1] text-[#765c12]" : "bg-[#edf0ee] text-[#758079]")}>{value}</span>;
}

function StatusBadge({ status }: { status: ManagedEmployee["accountStatus"] }) {
  const styles = { pending: "bg-[#fff3c5] text-[#7a621c]", active: "bg-[#e4f5ea] text-[#37704d]", rejected: "bg-[#fde9e7] text-[#9e4b46]", suspended: "bg-[#eef0ef] text-[#68716c]" };
  return <span className={cn("inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold", styles[status])}>{accountStatusLabels[status]}</span>;
}

function EmptyState({ icon: Icon, title, description }: { icon: React.ComponentType<{ className?: string }>; title: string; description: string }) {
  return <div className="flex min-h-[300px] flex-col items-center justify-center px-6 text-center"><span className="flex size-12 items-center justify-center rounded-[15px] bg-[#eef5f0] text-[#557b64]"><Icon className="size-5" /></span><h3 className="mt-4 text-[15px] font-extrabold text-[#3c4740]">{title}</h3><p className="mt-1.5 text-[12px] text-[#8a938e]">{description}</p></div>;
}

function statusSuccessMessage(name: string, action: StatusAction) {
  return { approve: `${name}님의 계정을 승인했습니다.`, reject: `${name}님의 가입 신청을 반려했습니다.`, suspend: `${name}님의 계정 사용을 중지했습니다.`, activate: `${name}님의 계정을 다시 활성화했습니다.` }[action];
}

function activityActionLabel(action: string) {
  return ({ "admin.employee.create": "직접 등록", "admin.employee.update": "수정", "admin.employee.hire_date.update": "입사일 수정", "admin.employee.password.reset": "비밀번호 재설정", "admin.employee.delete": "삭제", "admin.employee.approve": "승인", "admin.employee.reject": "반려", "admin.employee.suspend": "사용 중지", "admin.employee.activate": "재활성화" } as Record<string, string>)[action] ?? "변경";
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${year}.${month}.${day}`;
}

function activityDetail(data: Record<string, unknown>) {
  if (typeof data.reason === "string" && data.reason) return `사유: ${data.reason}`;
  const keys = Object.keys(data).filter((key) => key !== "reason");
  return keys.length ? `변경 항목: ${keys.map(changedFieldLabel).join(", ")}` : "";
}

function changedFieldLabel(field: string) {
  return ({ login_id: "로그인 아이디", name: "이름", position: "직급", department: "부서", phone: "연락처", role: "권한", account_status: "계정 상태" } as Record<string, string>)[field] ?? field;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { year: "2-digit", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

const inputClass = "h-11 w-full rounded-[10px] border border-[#dce2de] bg-white px-3 text-[13px] text-[#354139] outline-none transition focus:border-[#91c8a5] focus:ring-3 focus:ring-emerald-100";
