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

export const leaveCalendarTeams = {
  web: { label: "웹팀", color: "#245FA2" },
  logistics: { label: "물류팀", color: "#257049" },
  namdaemun: { label: "남대문팀", color: "#88449A" },
  other: { label: "기타·무소속", color: "#556170" },
} as const;

export function leaveCalendarTeam(code: string) {
  const { department } = leaveReportingDepartment({department: code, departmentLabel: ""});
  return leaveCalendarTeams[department === "web" || department === "logistics" || department === "namdaemun" ? department : "other"];
}
