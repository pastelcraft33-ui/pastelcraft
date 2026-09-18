import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { canViewMeetingAnnouncement } from "@/lib/announcements/permissions";

const announcementSelect =
  "id, title, content, created_by, meeting_id, created_at";

export type VisibleAnnouncement = {
  id: string;
  title: string;
  content: string;
  created_by: string;
  meeting_id: string | null;
  created_at: string;
};

export async function getVisibleAnnouncements(
  supabase: SupabaseClient,
  employeeId: string,
  limit: number,
) {
  const [companyResult, participationResult] = await Promise.all([
    supabase
      .from("announcements")
      .select(announcementSelect)
      .is("meeting_id", null)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("meeting_participants")
      .select("meeting_id")
      .eq("employee_id", employeeId),
  ]);

  if (companyResult.error) return { data: [] as VisibleAnnouncement[], error: companyResult.error };
  if (participationResult.error) {
    return { data: [] as VisibleAnnouncement[], error: participationResult.error };
  }

  const participantMeetingIds = [
    ...new Set((participationResult.data ?? []).map((row) => row.meeting_id)),
  ];
  if (participantMeetingIds.length === 0) {
    return { data: (companyResult.data ?? []) as VisibleAnnouncement[], error: null };
  }

  const meetingResult = await supabase
    .from("announcements")
    .select(announcementSelect)
    .in("meeting_id", participantMeetingIds)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (meetingResult.error) {
    return { data: [] as VisibleAnnouncement[], error: meetingResult.error };
  }

  const visible = [...(companyResult.data ?? []), ...(meetingResult.data ?? [])]
    .filter((announcement) =>
      canViewMeetingAnnouncement(announcement.meeting_id, participantMeetingIds),
    )
    .sort(
      (left, right) =>
        new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
    )
    .slice(0, limit) as VisibleAnnouncement[];

  return { data: visible, error: null };
}

export async function countVisibleAnnouncementsSince(
  supabase: SupabaseClient,
  employeeId: string,
  since: string,
  checkedAt: string,
) {
  const [companyResult, participationResult] = await Promise.all([
    supabase
      .from("announcements")
      .select("id", { count: "exact", head: true })
      .is("meeting_id", null)
      .gt("created_at", since)
      .lte("created_at", checkedAt),
    supabase
      .from("meeting_participants")
      .select("meeting_id")
      .eq("employee_id", employeeId),
  ]);
  if (companyResult.error) return { count: 0, error: companyResult.error };
  if (participationResult.error) return { count: 0, error: participationResult.error };

  const participantMeetingIds = [
    ...new Set((participationResult.data ?? []).map((row) => row.meeting_id)),
  ];
  if (participantMeetingIds.length === 0) {
    return { count: companyResult.count ?? 0, error: null };
  }

  const meetingResult = await supabase
    .from("announcements")
    .select("id", { count: "exact", head: true })
    .in("meeting_id", participantMeetingIds)
    .gt("created_at", since)
    .lte("created_at", checkedAt);
  if (meetingResult.error) return { count: 0, error: meetingResult.error };

  return {
    count: (companyResult.count ?? 0) + (meetingResult.count ?? 0),
    error: null,
  };
}
