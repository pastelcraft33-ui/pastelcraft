export type MeetingAnnouncementSchedule = {
  meeting_date: string;
  end_time: string;
};

export function isMeetingAnnouncementActive(
  meeting: MeetingAnnouncementSchedule | MeetingAnnouncementSchedule[] | null | undefined,
  now = new Date(),
) {
  const schedule = Array.isArray(meeting) ? meeting[0] : meeting;
  if (!schedule) return false;

  const endTime = schedule.end_time.slice(0, 8);
  const endAt = new Date(`${schedule.meeting_date}T${endTime}+09:00`);
  return !Number.isNaN(endAt.getTime()) && endAt.getTime() > now.getTime();
}
