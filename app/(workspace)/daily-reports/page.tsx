import type { Metadata } from "next";

import { DailyReportCalendar } from "@/components/daily-reports/daily-report-calendar";
import { requireCurrentEmployee } from "@/lib/auth/session";
import type { DailyReportItem } from "@/lib/daily-reports/types";
import { departmentLabel, positionLabel } from "@/lib/employees/constants";
import { getWorkspaceEmployees } from "@/lib/employees/data";
import { resolveVisibleDepartment } from "@/lib/employees/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "일일업무일지" };

export default async function DailyReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ department?: string | string[] }>;
}) {
  const currentEmployee = await requireCurrentEmployee();
  const { department: requestedValue } = await searchParams;
  const requestedDepartment = Array.isArray(requestedValue)
    ? requestedValue[0]
    : requestedValue;
  const effectiveDepartment = resolveVisibleDepartment(
    currentEmployee,
    requestedDepartment,
  );
  const employees = (await getWorkspaceEmployees()).filter(
    (employee) =>
      employee.account_status === "active" &&
      (!effectiveDepartment || employee.department === effectiveDepartment),
  );
  const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
  const visibleEmployeeIds = employees.map((employee) => employee.id);
  const supabase = createAdminClient();
  const reportResult = visibleEmployeeIds.length
    ? await supabase
        .from("daily_work_reports")
        .select("id, employee_id, report_date, updated_at")
        .in("employee_id", visibleEmployeeIds)
        .order("report_date", { ascending: false })
        .limit(1000)
    : { data: [], error: null };
  const schemaMissing =
    reportResult.error?.code === "PGRST205" || reportResult.error?.code === "42P01";
  if (reportResult.error && !schemaMissing) {
    throw new Error("일일업무일지 목록을 불러오지 못했습니다.");
  }

  const reports: DailyReportItem[] = (reportResult.data ?? []).flatMap((report) => {
    const employee = employeeById.get(report.employee_id);
    if (!employee) return [];
    return [{
      id: report.id,
      employeeId: employee.id,
      employeeName: employee.name,
      employeePosition: positionLabel(employee.position),
      department: departmentLabel(employee.department),
      reportDate: report.report_date,
      updatedAt: report.updated_at,
      canDelete:
        currentEmployee.role === "admin" || currentEmployee.id === employee.id,
    }];
  });

  return (
    <DailyReportCalendar
      key={effectiveDepartment ?? "all"}
      initialReports={reports}
      currentEmployee={{
        id: currentEmployee.id,
        name: currentEmployee.name,
        position: currentEmployee.position,
        department: currentEmployee.department,
      }}
      schemaAvailable={!schemaMissing}
    />
  );
}
