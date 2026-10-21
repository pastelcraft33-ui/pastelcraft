/** Leave reporting groups web departments without changing employee records. */
export function leaveReportingDepartment<T extends { department: string; departmentLabel: string }>(row: T): T {
  if (["web", "web_design", "web_marketing"].includes(row.department)) {
    return { ...row, department: "web", departmentLabel: "웹팀" };
  }
  return row;
}
