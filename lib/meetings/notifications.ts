import "server-only";

import type { CurrentEmployee } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export type MeetingNotificationItem = {
  id: string;
  type: "meeting";
  title: string;
  description: string;
  createdAt: string;
  href: string;
};

export async function getMeetingNotifications(
  currentEmployee: CurrentEmployee,
  since: string,
) {
  const supabase = createAdminClient();
  const { data: participations, error: participationError } = await supabase
    .from("meeting_participants")
    .select("meeting_id, created_at")
    .eq("employee_id", currentEmployee.id)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(50);

  if (participationError) {
    if (
      participationError.code === "PGRST205" ||
      participationError.code === "42P01"
    ) {
      return { items: [] as MeetingNotificationItem[], meetingCount: 0 };
    }
    throw new Error("회의 알림을 불러오지 못했습니다.");
  }

  const meetingIds = [...new Set((participations ?? []).map((row) => row.meeting_id))];
  if (meetingIds.length === 0) {
    return { items: [] as MeetingNotificationItem[], meetingCount: 0 };
  }

  const [meetingResult, announcementResult] = await Promise.all([
    supabase
      .from("meetings")
      .select("id, subject, meeting_date, start_time, end_time")
      .in("id", meetingIds),
    supabase
      .from("announcements")
      .select("meeting_id")
      .in("meeting_id", meetingIds),
  ]);
  if (meetingResult.error || announcementResult.error) {
    throw new Error("회의 알림을 불러오지 못했습니다.");
  }

  const activeMeetingIds = new Set(
    (announcementResult.data ?? []).flatMap((announcement) =>
      announcement.meeting_id ? [announcement.meeting_id] : [],
    ),
  );
  const meetingById = new Map(
    (meetingResult.data ?? [])
      .filter((meeting) => activeMeetingIds.has(meeting.id))
      .map((meeting) => [meeting.id, meeting]),
  );
  const items = (participations ?? []).flatMap((participation) => {
    const meeting = meetingById.get(participation.meeting_id);
    if (!meeting) return [];
    return [{
      id: `meeting:${meeting.id}`,
      type: "meeting" as const,
      title: `새 회의에 초대되었습니다: ${meeting.subject}`,
      description: `${formatDate(meeting.meeting_date)} · ${formatTime(meeting.start_time)}~${formatTime(meeting.end_time)}`,
      createdAt: participation.created_at,
      href: "/meetings",
    }];
  });

  return { items, meetingCount: items.length };
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${year}.${month}.${day}`;
}

function formatTime(value: string) {
  return value.slice(0, 5);
}
