import type { Metadata } from "next";

import { AnnouncementBoard } from "@/components/announcements/announcement-board";
import { WorkspaceCalendar } from "@/components/calendar/workspace-calendar";
import {
  canDeleteAnnouncement,
  canPublishAnnouncement,
} from "@/lib/announcements/permissions";
import { getVisibleAnnouncements } from "@/lib/announcements/data";
import { requireCurrentEmployee } from "@/lib/auth/session";
import {
  departmentLabel,
  positionLabel,
} from "@/lib/employees/constants";
import { getWorkspaceEmployees } from "@/lib/employees/data";
import { resolveVisibleDepartment } from "@/lib/employees/permissions";
import { getKoreanPublicHolidays } from "@/lib/holidays/korean-public-holidays";
import {
  leaveDayTypeLabel,
  leaveProgressLabel,
  leaveTypeLabel,
} from "@/lib/leave/constants";
import { createProfileImageSignedUrlMap } from "@/lib/storage/profile-image";
import { canManageTask, canViewTaskDetails } from "@/lib/tasks/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSystemSettings } from "@/lib/settings/system-settings";

export const metadata: Metadata = {
  title: "캘린더",
};

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ department?: string | string[] }>;
}) {
  const currentEmployee = await requireCurrentEmployee();
  const { department: requestedDepartmentValue } = await searchParams;
  const requestedDepartment = Array.isArray(requestedDepartmentValue)
    ? requestedDepartmentValue[0]
    : requestedDepartmentValue;
  const effectiveDepartment = resolveVisibleDepartment(
    currentEmployee,
    requestedDepartment,
  );
  const supabase = createAdminClient();
  const settingsPromise = getSystemSettings(supabase);
  const holidayPromise = supabase
    .from("company_holidays")
    .select("id, title, holiday_date, description")
    .order("holiday_date", { ascending: true });
  const publicHolidayPromise = getKoreanPublicHolidays().catch((error) => {
    console.error(
      "대한민국 공휴일을 불러오지 못했습니다.",
      error instanceof Error ? error.message : "알 수 없는 오류",
    );
    return [];
  });
  const announcementPromise = getVisibleAnnouncements(
    supabase,
    currentEmployee.id,
    20,
  );
  const workspaceEmployees = await getWorkspaceEmployees();
  const scopedEmployees = workspaceEmployees.filter(
    (employee) =>
      !effectiveDepartment || employee.department === effectiveDepartment,
  );
  const visibleEmployeeIds = scopedEmployees.map((employee) => employee.id);

  const [
    settingsResult,
    taskResult,
    leaveResult,
    holidayResult,
    publicHolidays,
    announcementResult,
  ] = await Promise.all([
    settingsPromise,
    (() => {
      let query = supabase
        .from("tasks")
        .select("id, title, description, owner_id, department, start_date, end_date")
        .in("owner_id", visibleEmployeeIds);
      if (effectiveDepartment) {
        query = query.eq("department", effectiveDepartment);
      }
      return query.order("start_date", { ascending: true });
    })(),
    supabase
      .from("leave_requests")
      .select(
        "id, employee_id, leave_type, start_date, end_date, day_type, status, team_lead_status, representative_status",
      )
      .neq("status", "cancelled")
      .in("employee_id", visibleEmployeeIds)
      .order("start_date", { ascending: true }),
    holidayPromise,
    publicHolidayPromise,
    announcementPromise,
  ]);
  const { settings } = settingsResult;

  if (
    taskResult.error ||
    leaveResult.error ||
    holidayResult.error ||
    (announcementResult.error &&
      announcementResult.error.code !== "PGRST205" &&
      announcementResult.error.code !== "PGRST204" &&
      announcementResult.error.code !== "42P01")
  ) {
    throw new Error("캘린더 데이터를 불러오지 못했습니다.");
  }

  const tasks = taskResult.data ?? [];
  const leaves = leaveResult.data ?? [];
  const announcements = announcementResult.error
    ? []
    : (announcementResult.data ?? []);
  const taskParticipantPromise = tasks.length
    ? supabase
        .from("task_participants")
        .select("task_id, employee_id")
        .in("task_id", tasks.map((task) => task.id))
    : Promise.resolve({ data: [], error: null });
  const profileImagePromise = createProfileImageSignedUrlMap(
    supabase,
    scopedEmployees.map((employee) => employee.profile_image_url),
  );
  const [
    { data: taskParticipantRows, error: taskParticipantError },
    profileImageUrlByValue,
  ] = await Promise.all([
    taskParticipantPromise,
    profileImagePromise,
  ]);
  const announcementAuthorById = new Map(
    workspaceEmployees.map((author) => [author.id, author]),
  );
  if (taskParticipantError && taskParticipantError.code !== "PGRST205") {
    throw new Error("업무 참여자 정보를 불러오지 못했습니다.");
  }

  const owners = scopedEmployees;
  const ownerEntries = owners.map((owner) => [
      owner.id,
      {
        name: owner.name,
        position: positionLabel(owner.position),
        positionCode: owner.position,
        department: owner.department,
        departmentLabel: departmentLabel(owner.department),
        imageUrl: owner.profile_image_url
          ? (profileImageUrlByValue.get(owner.profile_image_url) ?? null)
          : null,
      },
    ] as const);
  const ownerById = new Map(ownerEntries);
  const participantIdsByTask = new Map<string, string[]>();
  (taskParticipantRows ?? []).forEach((participant) => {
    const ids = participantIdsByTask.get(participant.task_id) ?? [];
    ids.push(participant.employee_id);
    participantIdsByTask.set(participant.task_id, ids);
  });

  const calendarTasks = tasks.map((task) => {
    const owner = ownerById.get(task.owner_id);
    const participantIds = participantIdsByTask.get(task.id) ?? [];
    const participants = participantIds
      .map((participantId) => {
        const participant = ownerById.get(participantId);
        return participant
          ? {
              id: participantId,
              name: participant.name,
              position: participant.position,
              positionCode: participant.positionCode,
              department: participant.department,
              departmentLabel: participant.departmentLabel,
              imageUrl: participant.imageUrl,
            }
          : null;
      })
      .filter((participant): participant is NonNullable<typeof participant> => Boolean(participant));
    const canViewDetails = canViewTaskDetails(
      currentEmployee,
      task.owner_id,
      task.department,
      participantIds.includes(currentEmployee.id),
    );
    const canViewAdminOverview = currentEmployee.role === "admin";
    return {
      id: task.id,
      title: task.title,
      description: canViewAdminOverview && canViewDetails ? task.description : null,
      ownerId: task.owner_id,
      ownerName: owner?.name ?? "알 수 없는 직원",
      ownerPosition: owner?.position ?? "직원",
      ownerPositionCode: owner?.positionCode ?? "staff",
      ownerImageUrl: owner?.imageUrl ?? null,
      participants,
      department: task.department,
      departmentLabel: departmentLabel(task.department),
      startDate: task.start_date,
      endDate: task.end_date,
      canEdit:
        canManageTask(currentEmployee, task.owner_id, task.department),
      canViewDetails,
    };
  });

  const calendarLeaves = leaves.map((leave) => {
    const employee = ownerById.get(leave.employee_id);
    return {
      id: leave.id,
      employeeId: leave.employee_id,
      employeeName: employee?.name ?? "알 수 없는 직원",
      employeePosition: employee?.position ?? "직원",
      employeePositionCode: employee?.positionCode ?? "staff",
      employeeImageUrl: employee?.imageUrl ?? null,
      department: employee?.department ?? "",
      departmentLabel: employee?.departmentLabel ?? "부서 없음",
      leaveType: leave.leave_type,
      leaveTypeLabel: leaveTypeLabel(leave.leave_type),
      dayType: leave.day_type,
      dayTypeLabel: leaveDayTypeLabel(leave.day_type),
      startDate: leave.start_date,
      endDate: leave.end_date,
      status: leave.status,
      statusLabel: leaveProgressLabel({
        status: leave.status,
        teamLeadStatus: leave.team_lead_status,
        representativeStatus: leave.representative_status,
      }),
      canEdit:
        (currentEmployee.id === leave.employee_id && leave.status === "pending") ||
        (currentEmployee.role === "admin" && leave.status !== "cancelled"),
    };
  });

  return (
    <>
      <AnnouncementBoard
        announcements={announcements.map((announcement) => {
          const author = announcementAuthorById.get(announcement.created_by);
          return {
            id: announcement.id,
            title: announcement.title,
            content: announcement.content,
            createdAt: announcement.created_at,
            authorName: author?.name ?? "알 수 없는 직원",
            authorPosition: author ? positionLabel(author.position) : "직원",
            canDelete:
              !announcement.meeting_id &&
              canDeleteAnnouncement(currentEmployee, announcement.created_by),
          };
        })}
        canPublish={canPublishAnnouncement(currentEmployee)}
        schemaAvailable={!announcementResult.error}
      />
      <WorkspaceCalendar
        tasks={calendarTasks}
        leaves={calendarLeaves}
        holidays={[
          ...publicHolidays.map((holiday) => ({
            id: `kr-${holiday.date}`,
            title: holiday.name,
            holidayDate: holiday.date,
            description: "공공데이터포털의 대한민국 공식 공휴일 정보입니다.",
            holidayType: "public" as const,
          })),
          ...(holidayResult.data ?? []).map((holiday) => ({
            id: holiday.id,
            title: holiday.title,
            holidayDate: holiday.holiday_date,
            description: holiday.description,
            holidayType: "company" as const,
          })),
        ]}
        defaultMode={settings.defaultCalendarTab}
        weekStartsOn={settings.weekStartsOn}
        companyName={settings.companyName}
        canViewAdminOverview={currentEmployee.role === "admin"}
      />
    </>
  );
}
