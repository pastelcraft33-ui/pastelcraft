"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarDays, Download, RefreshCw, X, Wallet } from "lucide-react";
import {
  addMonths,
  currentReportingMonth,
  koreanToday,
  reportingPeriod,
  LEAVE_IMPORT_DATE,
  leaveDays,
  annualTypes,
  tenureGroup,
  type BalanceLeave,
} from "@/lib/leave/balance";
import type { LeaveBalanceData } from "@/lib/leave/balance-data";
import type { LeaveImportDraft } from "@/lib/leave/import-preview";

type Row = LeaveBalanceData["rows"][number];
type Data = LeaveBalanceData & {
  closing: {
    id: string;
    created_at: string;
    snapshot: { rows: Row[]; today: string };
  } | null;
};
const inputClass =
  "min-h-11 rounded-xl border border-slate-300 bg-white px-3 py-2 text-base";
const buttonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2 font-semibold text-emerald-900 disabled:opacity-40";
const days = (value: number | null | undefined) =>
  value == null ? "확인 필요" : `${value}일`;

export function LeaveBalancePanel({ admin = false, canManage = false, draft }: { admin?: boolean; canManage?: boolean; draft?: Pick<BalanceLeave, "start_date" | "end_date" | "leave_type" | "day_type"> }) {
  const [month, setMonth] = useState(() =>
    currentReportingMonth(koreanToday()),
  );
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [department, setDepartment] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [showClosing, setShowClosing] = useState(false);
  const [drafts, setDrafts] = useState<LeaveImportDraft[]>([]);
  const [importSource, setImportSource] = useState("");
  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const response = await fetch(
          `/api/leave/balances?month=${month}${admin ? "" : "&scope=me"}`,
          { cache: "no-store", signal },
        );
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);
        setData(result);
        setError("");
      } catch (e) {
        if (!signal?.aborted)
          setError(e instanceof Error ? e.message : "불러오지 못했습니다.");
      } finally {
        if (!signal?.aborted) setBusy(false);
      }
    },
    [month, admin],
  );
  // load only updates state after an asynchronous fetch; abort prevents stale month responses.
  useEffect(() => {
    const c = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(c.signal);
    return () => c.abort();
  }, [load]);
  useEffect(() => {
    const refresh = () => void load();
    let day = koreanToday();
    const timer = window.setInterval(() => {
      const nextDay = koreanToday();
      if (day !== nextDay) { day = nextDay; void load(); }
    }, 60_000);
    window.addEventListener("focus", refresh);
    window.addEventListener("leave-requests-changed", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("leave-requests-changed", refresh);
    };
  }, [load]);

  if (!admin) {
    const row = data?.rows[0];
    const requestedDays = draft && row?.account && annualTypes.has(draft.leave_type)
      ? -leaveDays({ ...draft, id: "draft", employee_id: row.id, status: "pending" }, row.account, new Set(data?.holidays ?? [])).reduce((sum, item) => sum + item.days, 0) : 0;
    return (
      <section
        className="my-5 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5"
        aria-label="내 연차 현황"
      >
        <h2 className="flex items-center gap-2 text-xl font-bold text-emerald-950">
          <Wallet className="size-5" /> 내 연차 현황
        </h2>
        {error ? (
          <p role="alert" className="mt-3 text-red-700">
            {error}{" "}
            <button onClick={() => void load()} className="underline">
              다시 시도
            </button>
          </p>
        ) : !data ? (
          <p className="mt-3">연차를 확인하고 있습니다.</p>
        ) : !row?.result ? (
          <p className="mt-3">
            {row?.issue ?? "초기 잔액 확인 필요"} · 관리자가 기존 대장과 잔액을
            확인하면 표시됩니다.
          </p>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
              {[
                ["현재 잔여", row.result.current],
                ["사용 가능", row.result.available],
                ["승인 대기", row.result.pending],
                ["올해 사용일수", row.result.yearUsed],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-white p-4">
                  <p className="text-sm text-slate-600">{label}</p>
                  <p
                    className={`mt-2 text-3xl font-bold ${Number(value) < 0 ? "text-red-600" : "text-emerald-900"}`}
                  >
                    {label === "현재 잔여" && row.result?.notYetAccrued ? "미발생" : value == null ? "확인 필요" : `${value}일`}
                  </p>
                </div>
              ))}
            </div>
            {draft && requestedDays > 0 && <p className={`mt-4 rounded-xl border bg-white p-3 font-semibold ${row.result.available - requestedDays < 0 ? "text-red-600" : "text-emerald-900"}`}>현재 잔액 기준으로 이번 신청 {requestedDays}일이 승인되면 추가 사용 가능 연차는 {row.result.available - requestedDays}일입니다. 미래 발생 예정분은 포함하지 않습니다.</p>}
            <p className="mt-3 text-sm text-slate-600">
              {data.today} 기준 ·{" "}
              {row.result.nextAccrual
                ? `다음 부여일 ${row.result.nextAccrual} (+${row.result.nextAccrualDays}일)`
                : "예정된 자동 부여가 없습니다."}{" "}
              · 마이너스는 선사용 일수입니다.
            </p>
          </>
        )}
      </section>
    );
  }
  const rows =
    showClosing && data?.closing
      ? data.closing.snapshot.rows
      : (data?.rows ?? []);
  const period = reportingPeriod(month);
  const teamRows = rows.filter((r) => !department || r.department === department);
  const filtered = teamRows.filter(
    (r) =>
      (filter === "all" ||
        (filter === "negative" && (r.result?.available ?? 0) < 0) ||
        (filter === "unconfirmed" && !r.result) ||
        (filter === "under" &&
          r.hire_date &&
          addMonths(r.hire_date, 12) > (data?.today ?? koreanToday())) ||
        (filter === "over" &&
          r.hire_date &&
          addMonths(r.hire_date, 12) <= (data?.today ?? koreanToday()))),
  );
  const current = rows.find((r) => r.id === selected);
  const matchingDrafts = current
    ? drafts.filter(
        (d) => d.name === current.name && d.hireDate === current.hire_date,
      )
    : [];
  async function readLedger(file: File) {
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/leave/balances/import-preview", {
        method: "POST",
        body: form,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setDrafts(result.drafts);
      setImportSource(result.sourceName);
      setSelected(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "대장을 읽지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }
  async function closePeriod() {
    if (
      !window.confirm(
        `${period.start} ~ ${period.end} 대장을 마감 보관할까요? 이후 변경은 실시간 대장과 비교할 수 있습니다.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/leave/balances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "close", month }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      await load();
      setShowClosing(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "마감하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-6 p-4 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-emerald-950">
            연차 관리
          </h1>
          <p className="mt-2 text-slate-600">
            잔여 연차와 경리 제출용 사용대장을 확인하세요.
          </p>
        </div>
        <button
          className={buttonClass}
          onClick={() => void load()}
          disabled={busy}
        >
          <RefreshCw className="size-4" /> 새로고침
        </button>
      </div>
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">
          {error}
        </p>
      )}
      {!canManage && <p className="rounded-xl bg-emerald-50 p-4 text-emerald-900">전체 직원 및 팀별 연차를 조회할 수 있습니다. 초기 잔액 확정과 연차 변경은 관리자만 할 수 있습니다.</p>}
      {canManage && <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5">
        <h2 className="text-lg font-bold">
          기존 대장 가져오기 · 2026년 10월 15일 기준
        </h2>
        <p className="my-2 text-sm text-slate-600">
          웹팀 또는 물류팀 엑셀을 선택하면 직원별 초기 잔액 검토안을 준비합니다.
          이름과 입사일이 일치하는 직원의 ‘상세’에서 확인 후 확정하세요. 파일
          선택만으로 저장되지 않습니다.
        </p>
        <input
          aria-label="기존 연차 대장"
          type="file"
          accept=".xlsx"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void readLedger(file);
            e.target.value = "";
          }}
          className="max-w-full text-sm"
        />
        {importSource && (
          <p className="mt-2 text-sm text-emerald-800">
            {importSource} · {drafts.length}명 검토안 준비 · 직원 상세에서
            확인하세요.
          </p>
        )}
      </div>}
      {data && !data.ready && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-5">
          <p className="font-bold">연차 관리 저장소 연결이 필요합니다.</p>
          <p className="mt-1">
            직원 목록은 확인할 수 있습니다. 데이터베이스 설정 후 초기 잔액을
            확정하면 계산과 저장을 시작합니다.
          </p>
          {canManage && <a
            download
            href="/api/leave/balances/setup"
            className="mt-3 inline-block font-bold text-emerald-800 underline"
          >
            설정 SQL 다운로드
          </a>}
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[
          [department ? "선택 팀 직원" : "전체 직원", teamRows.length],
          ["잔액 확인 완료", teamRows.filter((r) => r.result).length],
          [
            "마이너스 직원",
            teamRows.filter((r) => (r.result?.available ?? 0) < 0).length,
          ],
          ["초기 확인 필요", teamRows.filter((r) => !r.result).length],
        ].map(([title, number]) => (
          <div
            key={title}
            className="rounded-2xl border border-emerald-100 bg-white p-5"
          >
            <p className="text-slate-600">{title}</p>
            <p className="mt-2 text-3xl font-black text-emerald-900">
              {number}
              <span className="ml-1 text-base">명</span>
            </p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border bg-white p-5">
        <label className="grid gap-2 font-semibold">
          집계 월
          <input
            aria-label="집계 월"
            type="month"
            value={month}
            onChange={(e) => {
              if (e.target.value) {
                setMonth(e.target.value);
                setShowClosing(false);
                setSelected(null);
                setData(null);
              }
            }}
            className={inputClass}
          />
        </label>
        <label className="grid gap-2 font-semibold">
          부서
          <select
            aria-label="부서"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className={inputClass}
          >
            <option value="">전체 부서</option>
            {[
              ...new Map(
                rows.map((r) => [r.department, r.departmentLabel]),
              ).entries(),
            ].map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 font-semibold">
          직원 구분
          <select
            aria-label="직원 구분"
            className={inputClass}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">전체</option>
            <option value="under">1년 미만</option>
            <option value="over">1년 이상</option>
            <option value="negative">마이너스</option>
            <option value="unconfirmed">확인 필요</option>
          </select>
        </label>
        <a
          className={buttonClass}
          href={`/api/leave/balances/export?month=${month}&source=${showClosing ? "closing" : "live"}`}
        >
          <Download className="size-4" /> 전체 직원 엑셀
        </a>
        {canManage && <button
          className={buttonClass}
          disabled={
            busy ||
            !data?.ready ||
            !!data?.closing ||
            period.end >= koreanToday()
          }
          onClick={() => void closePeriod()}
        >
          마감 확정
        </button>}
        {data?.closing && (
          <button
            className={buttonClass}
            onClick={() => {
              setShowClosing(!showClosing);
              setSelected(null);
            }}
          >
            {showClosing ? "현재 대장 보기" : "마감본 보기"}
          </button>
        )}
        <p className="w-full text-sm text-slate-600">
          집계 기간 {period.start} ~ {period.end} ·{" "}
          {showClosing
            ? "마감 당시 보관본"
            : `현재 잔액은 ${data?.today ?? "오늘"} 기준`}{" "}
          · 엑셀에는 전체 직원이 포함됩니다.
        </p>
      </div>
      {data?.closing && !showClosing && (
        <p className="rounded-xl bg-blue-50 p-4 text-blue-900">
          이 기간은 마감되었습니다. 현재 화면은 이후 변경을 반영하며, ‘마감본
          보기’에서 제출 당시 기록을 확인할 수 있습니다.
        </p>
      )}
      <div className="overflow-x-auto rounded-2xl border bg-white">
        <table className="w-full min-w-[800px] text-left">
          <thead className="bg-emerald-50 text-emerald-950">
            <tr>
              {[
                "직원 / 입사일",
                "근속",
                "현재 잔여",
                "사용 가능",
                "승인 대기",
                "올해 사용일수",
                "관리",
              ].map((h) => (
                <th key={h} className="whitespace-nowrap border-b p-4">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr
                key={row.id}
                className="border-b last:border-0 hover:bg-emerald-50/30"
              >
                <td className="p-4">
                  <strong className="text-lg">{row.name}</strong>
                  <p className="text-sm text-slate-500">
                    {row.departmentLabel} · {row.hire_date ?? "입사일 등록 필요"}
                  </p>
                </td>
                <td className="p-3 whitespace-nowrap">
                  {tenureGroup(row.hire_date, showClosing && data?.closing ? data.closing.snapshot.today : (data?.today ?? koreanToday()))}
                </td>
                {[
                  row.result?.current,
                  row.result?.available,
                  row.result?.pending,
                  row.result?.yearUsed,
                ].map((value, i) => (
                  <td
                    key={i}
                    className={`whitespace-nowrap p-3 font-semibold ${value != null && value < 0 ? "text-red-600" : value == null ? "text-slate-400 text-sm" : "text-slate-800"}`}
                  >
                    {i === 0 && row.result?.notYetAccrued ? "미발생" : days(value)}
                  </td>
                ))}
                <td className="p-3">
                  <button
                    className={buttonClass}
                    onClick={() => setSelected(row.id)}
                  >
                    상세
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && (
          <p className="p-8 text-center text-slate-500">
            {busy
              ? "직원 정보를 확인하고 있습니다."
              : "해당하는 직원이 없습니다."}
          </p>
        )}
      </div>
      <p className="text-sm text-slate-500">
        사용 가능은 현재 잔여에서 승인된 미래 휴가를 뺀 일수입니다. 올해 사용일수는 1월 1일부터 조회 기준일까지 사용한 연차이며, 이관한 엑셀 사용량을 포함합니다. 승인 대기와 미래 휴가는 제외합니다.{" "}
        이관 기준일까지의 사용분은 초기 잔액에 포함됩니다. 이후 승인된 연차만
        자동 반영하며, 반려·취소·삭제된 신청은 차감하지 않습니다. 대장 미등재로 자동 설정한 직원은 입사일 기준으로 연간 부여됩니다. 기존 대장 직원의 연간 부여 및 이월·소멸 정산은 관리자 확인 후 기록합니다.
      </p>
      {current && (
        <div
          className="fixed inset-0 z-[80] overflow-y-auto bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`${current.name} 연차 상세`}
        >
          <div className="mx-auto my-8 max-w-3xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">{current.name} · 연차 상세</h2>
              <button
                className={buttonClass}
                onClick={() => setSelected(null)}
                aria-label="닫기"
              >
                <X />
              </button>
            </div>
            <p className="mt-3 text-slate-600">
              {current.departmentLabel} · 입사일 {current.hire_date ?? "미등록"}
            </p>
            {current.issue && (
              <p className="mt-3 rounded-lg bg-amber-50 p-3">{current.issue}</p>
            )}
            {current.account && (
              <p className="mt-3">
                이관 기준 {current.account.opening_date} · 잔액{" "}
                {days(Number(current.account.opening_days))} · 월별 자동 부여{" "}
                {current.account.monthly_enabled ? "사용" : "사용 안 함"}
              </p>
            )}
            {current.result?.monthlyUsage && (
              <section className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4" aria-label="월별 연차 사용 내역">
                <h3 className="text-xl font-bold">{(showClosing && data?.closing ? data.closing.snapshot.today : data?.today)?.slice(0, 4)}년 월별 연차 사용 내역</h3>
                <p className="mt-2 text-sm text-slate-600">이전 사용량은 엑셀에 적힌 월을 유지합니다. 엑셀 집계는 전월 16일~당월 15일 기준이며, 이관 이후는 실제 사용일의 월에 표시합니다. 승인 대기·미래 휴가는 제외합니다.</p>
                {current.result.monthlyUsage.some(m => m.corrected) && <p className="mt-2 font-semibold text-emerald-800">직접 정정한 월별 사용량이 반영되어 있습니다.</p>}
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left">
                    <thead><tr className="border-b"><th className="p-2">월</th><th className="p-2">이전 사용</th><th className="p-2">이관 후 사용</th><th className="p-2">합계</th></tr></thead>
                    <tbody>{current.result.monthlyUsage.map(m => <tr key={m.month} className="border-b last:border-0"><th className="p-2 font-semibold">{m.month}월</th><td className="p-2">{m.future ? "—" : days(m.imported)}</td><td className="p-2">{m.future ? "—" : days(m.subsequent)}</td><td className={`p-2 font-bold ${m.total ? "text-emerald-800" : "text-slate-500"}`}>{m.future ? "아직 도래하지 않음" : days(m.total)}</td></tr>)}</tbody>
                    <tfoot><tr className="border-t-2"><th className="p-2" colSpan={3}>올해 사용일수</th><td className="p-2 font-bold text-emerald-900">{days(current.result.yearUsed)}</td></tr></tfoot>
                  </table>
                </div>
              </section>
            )}
            {canManage && !showClosing && (
              <BalanceEditor
                key={current.id + String(!!current.account)}
                row={current}
                draft={
                  matchingDrafts.length === 1 ? matchingDrafts[0] : undefined
                }
                ready={!!data?.ready}
                onSaved={async () => {
                  await load();
                }}
              />
            )}
            <h3 className="mt-6 flex items-center gap-2 text-xl font-bold">
              <CalendarDays className="size-5" /> 발생·사용·조정 기록
            </h3>
            <div className="mt-3 max-h-80 overflow-y-auto">
              <table className="w-full text-left">
                <thead>
                  <tr>
                    <th className="p-2">일자</th>
                    <th className="p-2">내용</th>
                    <th className="p-2">일수</th>
                  </tr>
                </thead>
                <tbody>
                  {current.result?.movements.map((m, i) => (
                    <tr key={m.source + m.date + i} className="border-t">
                      <td className="whitespace-nowrap p-2">{m.date}</td>
                      <td className="p-2">{m.label}</td>
                      <td
                        className={`whitespace-nowrap p-2 font-bold ${m.days < 0 ? "text-red-600" : "text-emerald-700"}`}
                      >
                        {m.days > 0 ? "+" : ""}
                        {m.days}일
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!current.result?.movements.length && (
                <p className="p-4 text-slate-500">
                  확정된 추가 기록이 없습니다.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function BalanceEditor({
  row,
  draft,
  ready,
  onSaved,
}: {
  row: Row;
  draft?: LeaveImportDraft;
  ready: boolean;
  onSaved: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const submissionId = useRef<string | null>(null);
  const [workDays, setWorkDays] = useState([1, 2, 3, 4, 5]);
  const opening = !row.account;
  const defaultDate = opening
    ? row.hire_date && row.hire_date > LEAVE_IMPORT_DATE
      ? row.hire_date
      : LEAVE_IMPORT_DATE
    : koreanToday();
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true);
    setMessage("");
    try {
      submissionId.current ??= crypto.randomUUID();
      const response = await fetch("/api/leave/balances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: opening ? "opening" : "entry",
          requestId: submissionId.current,
          employeeId: row.id,
          days: Number(values.get("days")),
          reason: values.get("reason"),
          ...(opening
            ? {
                openingDate: values.get("date"),
                monthlyEnabled: true,
                workDays,
                excludeHolidays: values.get("holidays") === "on",
              }
            : { effectiveDate: values.get("date"), kind: values.get("kind") }),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      submissionId.current = null;
      setMessage("저장했습니다.");
      await onSaved();
      if (!opening) form.reset();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={submit}
      className="mt-5 space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-5"
    >
      <h3 className="text-xl font-bold">
        {opening ? "초기 잔액 확정" : "연차 부여 / 일수 조정"}
      </h3>
      {opening && draft && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
          <p className="font-bold">
            엑셀 검토안: 발생 {days(draft.accrued)} + 이월 {days(draft.carry)} −
            사용 {days(draft.used)} / 잔액 {days(draft.openingDays)}
          </p>
          <ul className="mt-2 list-disc pl-5">
            {draft.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
          <label className="mt-3 flex items-start gap-2">
            <input type="checkbox" required /> 원본의 과거 미발생분과 사용량을
            확인했습니다.
          </label>
        </div>
      )}
      <p className="text-sm text-slate-600">
        {opening
          ? "기존 대장에서 기준일까지 사용한 내역을 반영한 잔액을 입력하세요. 미래 발생분은 제외합니다. 확정 후에는 조정 기록으로 정정합니다."
          : "1년 이상 직원의 연간 부여, 이월, 소멸 또는 정정을 기록합니다. 자동 연간 부여는 하지 않으며 출근 요건과 기존 대장을 확인한 뒤 확정해 주세요."}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-2">
          {opening ? "이관 기준일 (해당 일 종료 시점)" : "반영일"}
          <input
            className={inputClass}
            name="date"
            type="date"
            required
            defaultValue={defaultDate}
            max={koreanToday()}
            min={row.hire_date ?? undefined}
          />
        </label>
        <label className="grid gap-2">
          {opening ? "확정 잔액" : "부여·조정 일수 (+ / -)"}
          <input
            className={inputClass}
            name="days"
            type="number"
            step="0.25"
            min="-1000"
            max="1000"
            required
            defaultValue={
              opening ? (draft?.openingDays ?? undefined) : undefined
            }
            placeholder="예: -1 또는 3.5"
          />
        </label>
      </div>
      {!opening && (
        <label className="grid gap-2">
          처리 구분
          <select name="kind" className={inputClass}>
            <option value="grant">연차 부여</option>
            <option value="adjustment">잔액 조정 / 소멸 정산</option>
          </select>
        </label>
      )}
      <label className="grid gap-2">
        확인 근거 / 사유
        <textarea
          className={inputClass}
          name="reason"
          required
          maxLength={1000}
          rows={2}
          placeholder={
            opening
              ? "확인한 대장과 기준 기간을 적어 주세요."
              : "부여 또는 조정 사유를 적어 주세요."
          }
        />
      </label>
      {opening && (
        <>
          <label className="flex items-center gap-2">
            1년 미만
            매월 1일 보장 (기준일 이후 발생분부터, 최대 11회)
          </label>
          <p className="text-sm text-slate-600">
            회사 정책으로 개근 여부와 관계없이 부여합니다. 입사일의 월별 해당일
            기준이며 해당일이 없는 달은 말일입니다.
          </p>
          <fieldset>
            <legend className="mb-2">연차 차감 대상 근무요일</legend>
            <div className="flex flex-wrap gap-3">
              {["일", "월", "화", "수", "목", "금", "토"].map((name, i) => (
                <label key={name} className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={workDays.includes(i)}
                    onChange={(e) =>
                      setWorkDays(
                        e.target.checked
                          ? [...workDays, i]
                          : workDays.filter((d) => d !== i),
                      )
                    }
                  />
                  {name}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="holidays" defaultChecked /> 공휴일·회사
            휴무일에는 차감하지 않음
          </label>
        </>
      )}
      <p role="status" className="text-sm text-emerald-900">
        {message}
      </p>
      <button
        type="submit"
        className={buttonClass}
        disabled={!ready || !row.hire_date || busy}
      >
        {busy ? "저장 중…" : opening ? "잔액 확정" : "기록 저장"}
      </button>
    </form>
  );
}
