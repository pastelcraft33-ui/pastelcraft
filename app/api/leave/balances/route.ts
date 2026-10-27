import { NextResponse } from "next/server";
import {
  requireApiEmployee,
  hasValidMutationOrigin,
  invalidOriginResponse,
} from "@/lib/auth/api";
import { loadLeaveBalances } from "@/lib/leave/balance-data";
import { canViewAllLeaveBalances } from "@/lib/leave/balance-permissions";
import { currentReportingMonth, koreanToday } from "@/lib/leave/balance";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";
import {
  validDate,
  reportingPeriod,
  leaveImportDate,
} from "@/lib/leave/balance";

const date = z.string().refine(validDate, "올바른 날짜를 입력해 주세요.");
const days = z
  .number()
  .min(-1000)
  .max(1000)
  .refine((n) => Number.isInteger(n * 4), "0.25일 단위로 입력해 주세요.");
const mutationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("opening"),
    employeeId: z.uuid(),
    openingDate: date,
    days,
    reason: z.string().trim().min(1).max(1000),
    monthlyEnabled: z.literal(true),
    workDays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    excludeHolidays: z.boolean(),
  }),
  z.object({
    action: z.literal("entry"),
    requestId: z.uuid(),
    employeeId: z.uuid(),
    effectiveDate: date,
    days: days.refine((v) => v !== 0),
    kind: z.enum(["grant", "adjustment"]),
    reason: z.string().trim().min(1).max(1000),
  }),
  z.object({
    action: z.literal("close"),
    month: z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/),
  }),
]);
export async function GET(request: Request) {
  const auth = await requireApiEmployee();
  if (auth.response) return auth.response;
  const month =
    new URL(request.url).searchParams.get("month") ??
    currentReportingMonth(koreanToday(), auth.employee.departmentCode);
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month))
    return NextResponse.json(
      { message: "집계 월을 확인해 주세요." },
      { status: 400 },
    );
  try {
    const ownOnly =
      !canViewAllLeaveBalances(auth.employee) ||
      new URL(request.url).searchParams.get("scope") === "me";
    const data = await loadLeaveBalances(
      month,
      ownOnly ? auth.employee.id : undefined,
    );
    const { data: closing, error } =
      !ownOnly && data.ready
        ? await createAdminClient()
            .from("leave_balance_closings")
            .select("id,created_at,snapshot")
            .eq("period_month", month)
            .maybeSingle()
        : { data: null, error: null };
    if (error) throw error;
    return NextResponse.json(
      { ...data, closing },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        message: "연차 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
      },
      { status: 503 },
    );
  }
}
export async function POST(request: Request) {
  if (!hasValidMutationOrigin(request)) return invalidOriginResponse();
  const auth = await requireApiEmployee();
  if (auth.response) return auth.response;
  if (auth.employee.role !== "admin")
    return NextResponse.json(
      { message: "관리자만 변경할 수 있습니다." },
      { status: 403 },
    );
  const parsed = mutationSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요." },
      { status: 400 },
    );
  const input = parsed.data;
  const db = createAdminClient();
  const today = koreanToday();
  try {
    if (input.action === "close") {
      const snapshot = await loadLeaveBalances(input.month);
      if (snapshot.rows.some(row => reportingPeriod(input.month, row.department).end >= today))
        return NextResponse.json(
          { message: "전체 부서의 집계 기간이 끝난 다음 날부터 마감할 수 있습니다. 남대문팀은 매월 25일 마감입니다." },
          { status: 400 },
        );
      if (
        !snapshot.ready ||
        snapshot.rows.some((r) => !r.result || !r.result.period.covered)
      )
        return NextResponse.json(
          {
            message: "모든 직원의 초기 잔액과 집계 기간을 먼저 확인해 주세요.",
          },
          { status: 400 },
        );
      const { error } = await db
        .from("leave_balance_closings")
        .insert({
          period_month: input.month,
          snapshot: { rows: snapshot.rows, today: snapshot.today },
          created_by: auth.employee.id,
        });
      if (error) throw error;
    } else {
      const { data: employee, error: employeeError } = await db
        .from("employees")
        .select("id,hire_date,department")
        .eq("id", input.employeeId)
        .eq("account_status", "active")
        .maybeSingle();
      if (employeeError) throw employeeError;
      if (!employee?.hire_date)
        return NextResponse.json(
          { message: "재직 중인 직원과 입사일을 확인해 주세요." },
          { status: 400 },
        );
      if (input.action === "opening") {
        if (
          input.openingDate > today ||
          input.openingDate < employee.hire_date ||
          input.openingDate < leaveImportDate(employee.department)
        )
          return NextResponse.json(
            {
              message:
                `기준일은 ${leaveImportDate(employee.department)} 또는 입사일 중 늦은 날부터 오늘 사이로 설정해 주세요.`,
            },
            { status: 400 },
          );
        const { error } = await db
          .from("leave_balance_accounts")
          .insert({
            employee_id: input.employeeId,
            opening_date: input.openingDate,
            opening_days: input.days,
            monthly_enabled: input.monthlyEnabled,
            work_days: [...new Set(input.workDays)],
            exclude_holidays: input.excludeHolidays,
            reason: input.reason,
            created_by: auth.employee.id,
          });
        if (error) throw error;
      } else {
        const { data: account, error: accountError } = await db
          .from("leave_balance_accounts")
          .select("opening_date")
          .eq("employee_id", input.employeeId)
          .maybeSingle();
        if (accountError) throw accountError;
        if (
          !account ||
          input.effectiveDate <= account.opening_date ||
          input.effectiveDate > today ||
          (input.kind === "grant" && input.days <= 0)
        )
          return NextResponse.json(
            {
              message:
                "부여·조정일은 이관 기준일 다음 날부터 오늘 사이이며 부여일수는 양수여야 합니다.",
            },
            { status: 400 },
          );
        const { error } = await db
          .from("leave_balance_entries")
          .insert({
            id: input.requestId,
            employee_id: input.employeeId,
            effective_date: input.effectiveDate,
            days: input.days,
            kind: input.kind,
            reason: input.reason,
            created_by: auth.employee.id,
          });
        if (error) throw error;
      }
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const code = (error as { code?: string }).code;
    return NextResponse.json(
      {
        message:
          code === "23505"
            ? "이미 확정된 기록입니다. 새로고침해 주세요."
            : "저장하지 못했습니다. 연차 관리 SQL 적용 여부를 확인해 주세요.",
      },
      { status: code === "23505" ? 409 : 500 },
    );
  }
}
