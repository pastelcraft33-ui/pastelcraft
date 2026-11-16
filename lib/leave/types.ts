export type LeaveCalendarItem = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeePosition: string;
  employeePositionCode: string;
  employeeImageUrl: string | null;
  department: string;
  departmentLabel: string;
  leaveType: string;
  leaveTypeLabel: string;
  dayType: string;
  dayTypeLabel: string;
  startTime?: string;
  endTime?: string;
  startDate: string;
  endDate: string;
  status: string;
  statusLabel: string;
  canEdit: boolean;
};

export type CompanyHolidayCalendarItem = {
  id: string;
  title: string;
  holidayDate: string;
  description: string | null;
  holidayType?: "company" | "public";
};
