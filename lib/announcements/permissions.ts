import type { CurrentEmployee } from "@/lib/auth/session";

const announcementPublisherPositions = new Set([
  "team_lead",
  "representative",
]);

export function canPublishAnnouncement(employee: CurrentEmployee) {
  return (
    employee.role === "admin" ||
    announcementPublisherPositions.has(employee.positionCode)
  );
}

export function canDeleteAnnouncement(
  employee: CurrentEmployee,
  createdBy: string,
) {
  return (
    employee.role === "admin" ||
    (canPublishAnnouncement(employee) && employee.id === createdBy)
  );
}

export function canViewMeetingAnnouncement(
  meetingId: string | null,
  participantMeetingIds: Iterable<string>,
) {
  if (!meetingId) return true;
  return new Set(participantMeetingIds).has(meetingId);
}
