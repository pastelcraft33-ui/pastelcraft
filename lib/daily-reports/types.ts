import type { DailyReportWorkItem } from "@/schemas/daily-reports";

export type DailyReportItem = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeePosition: string;
  department: string;
  reportDate: string;
  updatedAt: string;
  workItems: DailyReportWorkItem[];
  hasLegacyImage: boolean;
  canDelete: boolean;
};
