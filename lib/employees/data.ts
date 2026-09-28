import "server-only";

import { unstable_cache } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";

export const EMPLOYEES_CACHE_TAG = "workspace-employees";

export const getWorkspaceEmployees = unstable_cache(
  async () => {
    const { data, error } = await createAdminClient()
      .from("employees")
      .select(
        "id, login_id, name, position, department, phone, profile_image_url, role, account_status",
      )
      .not("login_id", "like", "deleted-%")
      .neq("name", "삭제된 직원")
      .order("name", { ascending: true });

    if (error) throw new Error("직원 정보를 불러오지 못했습니다.");
    return data ?? [];
  },
  ["workspace-employees-v1"],
  {
    tags: [EMPLOYEES_CACHE_TAG],
    revalidate: 60,
  },
);
