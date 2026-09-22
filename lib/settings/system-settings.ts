import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type SystemSettings = {
  companyName: string;
  defaultCalendarTab: "task" | "leave";
  weekStartsOn: 0 | 1;
  sessionTtlHours: number;
};

export const defaultSystemSettings: SystemSettings = {
  companyName: "파스텔크래프트",
  defaultCalendarTab: "leave",
  weekStartsOn: 0,
  sessionTtlHours: Number(process.env.SESSION_TTL_HOURS || 168),
};

export async function getSystemSettings(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("system_settings")
    .select("company_name, default_calendar_tab, week_starts_on, session_ttl_hours")
    .eq("id", true)
    .maybeSingle();
  if (error || !data) return { settings: defaultSystemSettings, schemaReady: !error };
  return {
    settings: {
      companyName: data.company_name,
      defaultCalendarTab: data.default_calendar_tab as "task" | "leave",
      weekStartsOn: data.week_starts_on as 0 | 1,
      sessionTtlHours: data.session_ttl_hours,
    },
    schemaReady: true,
  };
}
