import type { Metadata } from "next";

import { MeetingRoom } from "@/components/meetings/meeting-room";
import { requireCurrentEmployee } from "@/lib/auth/session";
import { departmentLabel, positionLabel } from "@/lib/employees/constants";
import { getWorkspaceEmployees } from "@/lib/employees/data";
import { canDeleteMeeting } from "@/lib/meetings/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "회의실" };
export default async function MeetingsPage() {
  const currentEmployee = await requireCurrentEmployee();
  const supabase = createAdminClient();
  const [meetingResult, employees] = await Promise.all([
    supabase
      .from("meetings")
      .select(
        "id, subject, content, meeting_date, start_time, end_time, created_by, created_at",
      )
      .order("meeting_date", { ascending: true })
      .order("start_time", { ascending: true })
      .limit(100),
    getWorkspaceEmployees(),
  ]);

  const schemaMissing =
    meetingResult.error?.code === "PGRST205" ||
    meetingResult.error?.code === "42P01";
  if (meetingResult.error && !schemaMissing) {
    throw new Error("회의 목록을 불러오지 못했습니다.");
  }
  const meetings = meetingResult.data ?? [];
  const meetingIds = meetings.map((meeting) => meeting.id);
  const [participantResult, announcementResult] = meetings.length
    ? await Promise.all([
        supabase
          .from("meeting_participants")
          .select("meeting_id, employee_id")
          .in("meeting_id", meetingIds),
        supabase
          .from("announcements")
          .select("meeting_id")
          .in("meeting_id", meetingIds),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
      ];
  if (participantResult.error && !schemaMissing) {
    throw new Error("회의 참여자 정보를 불러오지 못했습니다.");
  }
  if (announcementResult.error && !schemaMissing) {
    throw new Error("회의 종료 상태를 불러오지 못했습니다.");
  }

  const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
  const activeMeetingIds = new Set(
    (announcementResult.data ?? []).flatMap((announcement) =>
      announcement.meeting_id ? [announcement.meeting_id] : [],
    ),
  );
  const participantIdsByMeeting = new Map<string, string[]>();
  (participantResult.data ?? []).forEach((participant) => {
    const ids = participantIdsByMeeting.get(participant.meeting_id) ?? [];
    ids.push(participant.employee_id);
    participantIdsByMeeting.set(participant.meeting_id, ids);
  });
  const employeeItem = (employee: (typeof employees)[number]) => ({
    id: employee.id,
    name: employee.name,
    position: positionLabel(employee.position),
    department: departmentLabel(employee.department),
  });

  return (
    <MeetingRoom
      meetings={meetings.map((meeting) => ({
        id: meeting.id,
        subject: meeting.subject,
        content: meeting.content,
        meetingDate: meeting.meeting_date,
        startTime: meeting.start_time.slice(0, 5),
        endTime: meeting.end_time.slice(0, 5),
        authorName: employeeById.get(meeting.created_by)?.name ?? "알 수 없는 직원",
        participants: (participantIdsByMeeting.get(meeting.id) ?? [])
          .map((employeeId) => employeeById.get(employeeId))
          .filter((employee): employee is NonNullable<typeof employee> => Boolean(employee))
          .map(employeeItem),
        isEnded: !activeMeetingIds.has(meeting.id),
        canEnd: canDeleteMeeting(currentEmployee, meeting.created_by),
        canDelete: canDeleteMeeting(currentEmployee, meeting.created_by),
      }))}
      employees={employees
        .filter((employee) => employee.account_status === "active")
        .map(employeeItem)}
      schemaAvailable={!meetingResult.error}
    />
  );
}
