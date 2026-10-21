/** Leave reporting groups web departments without changing employee records. */
export function leaveReportingDepartment<T extends { department: string; departmentLabel: string }>(row: T): T {
  if (["web", "web_design", "web_marketing"].includes(row.department)) {
    return { ...row, department: "web", departmentLabel: "웹팀" };
  }
  return row;
}

export function filterLeaveReportingTeam<T extends { department: string; departmentLabel: string }>(rows: T[], department: string) {
  return rows.map(leaveReportingDepartment).filter(row => !department || row.department === department);
}
