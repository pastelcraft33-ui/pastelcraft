import { NextResponse } from "next/server";

import { requireApiEmployee } from "@/lib/auth/api";
import { getWorkspaceEmployees } from "@/lib/employees/data";
import { canViewAllDepartments } from "@/lib/employees/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

const categories = ["calendar", "dailyReports", "employees", "meetings", "announcements"] as const;
type Category = (typeof categories)[number];

function parseSince(url: URL, category: Category, checkedAt: string) {
  const value = url.searchParams.get(`${category}Since`);
  if (!value || Number.isNaN(Date.parse(value))) return null;
  return new Date(Math.min(Date.parse(value), Date.parse(checkedAt))).toISOString();
}

export async function GET(request: Request) {
  const auth = await requireApiEmployee();
  if (auth.response) return auth.response;

  const checkedAt = new Date().toISOString();
  const url = new URL(request.url);
  const since = Object.fromEntries(
    categories.map((category) => [category, parseSince(url, category, checkedAt)]),
  ) as Record<Category, string | null>;
  const counts: Record<Category, number> = {
    calendar: 0,
    dailyReports: 0,
    employees: 0,
    meetings: 0,
    announcements: 0,
  };
  const supabase = createAdminClient();
  const employees = await getWorkspaceEmployees();
  const visibleEmployeeIds = employees
    .filter(
      (employee) =>
        canViewAllDepartments(auth.employee) ||
        employee.department === auth.employee.departmentCode,
    )
    .map((employee) => employee.id);
  let newTaskQuery = supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .in("owner_id", visibleEmployeeIds);
  if (!canViewAllDepartments(auth.employee)) {
    newTaskQuery = newTaskQuery.eq(
      "department",
      auth.employee.departmentCode,
    );
  }

  const calendarQueries = since.calendar
    ? [
        newTaskQuery
          .gt("created_at", since.calendar)
          .lte("created_at", checkedAt),
        supabase
          .from("leave_requests")
          .select("id", { count: "exact", head: true })
          .in("employee_id", visibleEmployeeIds)
          .gt("created_at", since.calendar)
          .lte("created_at", checkedAt),
      ]
    : [];

  const employeePromise = since.employees
    ? supabase
        .from("activity_logs")
        .select("target_id")
        .eq("target_type", "employee")
        .in("action_type", ["admin.employee.create", "admin.employee.approve"])
        .gt("created_at", since.employees)
        .lte("created_at", checkedAt)
    : Promise.resolve({ data: [], error: null });
  const meetingPromise = since.meetings
    ? supabase
        .from("meetings")
        .select("id", { count: "exact", head: true })
        .gt("created_at", since.meetings)
        .lte("created_at", checkedAt)
    : Promise.resolve({ count: 0, error: null });
  const dailyReportsPromise = since.dailyReports
    ? supabase
        .from("daily_work_reports")
        .select("id", { count: "exact", head: true })
        .in("employee_id", visibleEmployeeIds)
        .gt("created_at", since.dailyReports)
        .lte("created_at", checkedAt)
    : Promise.resolve({ count: 0, error: null });
  const announcementPromise = since.announcements
    ? supabase
        .from("announcements")
        .select("id", { count: "exact", head: true })
        .gt("created_at", since.announcements)
        .lte("created_at", checkedAt)
    : Promise.resolve({ count: 0, error: null });

  const [calendarResults, employeeResult, meetingResult, announcementResult, dailyReportsResult] =
    await Promise.all([
      Promise.all(calendarQueries),
      employeePromise,
      meetingPromise,
      announcementPromise,
      dailyReportsPromise,
    ]);
  const dailyReportsSchemaMissing =
    dailyReportsResult.error?.code === "PGRST205" ||
    dailyReportsResult.error?.code === "42P01";
  const error = [
    ...calendarResults.map((result) => result.error),
    employeeResult.error,
    meetingResult.error,
    announcementResult.error,
    dailyReportsSchemaMissing ? null : dailyReportsResult.error,
  ].find(Boolean);
  if (error) {
    return NextResponse.json(
      { message: "새 알림 건수를 불러오지 못했습니다." },
      { status: 500 },
    );
  }

  counts.calendar = calendarResults.reduce(
    (total, result) => total + (result.count ?? 0),
    0,
  );
  counts.employees = new Set(
    (employeeResult.data ?? []).map((activity) => activity.target_id).filter(Boolean),
  ).size;
  counts.meetings = meetingResult.count ?? 0;
  counts.announcements = announcementResult.count ?? 0;
  counts.dailyReports = dailyReportsResult.count ?? 0;

  return NextResponse.json(
    { counts, checkedAt },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
