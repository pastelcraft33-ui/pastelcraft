import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export const managedStorageBuckets = [
  "profile-images",
  "task-attachments",
  "leave-attachments",
  "daily-work-reports",
] as const;

export type ManagedStorageBucket = (typeof managedStorageBuckets)[number];

export type ManagedStorageFile = {
  bucket: ManagedStorageBucket;
  path: string;
  name: string;
  size: number;
  mimeType: string;
  updatedAt: string | null;
  referenced: boolean;
};

export async function listManagedStorageFiles(supabase: SupabaseClient) {
  const [{ data: employees }, { data: tasks }, { data: leaves }, { data: dailyReports }] = await Promise.all([
    supabase.from("employees").select("profile_image_url").not("profile_image_url", "is", null),
    supabase.from("task_attachments").select("file_url"),
    supabase.from("leave_requests").select("attachment_url").not("attachment_url", "is", null),
    supabase.from("daily_work_reports").select("image_path"),
  ]);
  const references: Record<ManagedStorageBucket, Set<string>> = {
    "profile-images": new Set((employees ?? []).map((row) => row.profile_image_url).filter(Boolean)),
    "task-attachments": new Set((tasks ?? []).map((row) => row.file_url).filter(Boolean)),
    "leave-attachments": new Set((leaves ?? []).map((row) => row.attachment_url).filter(Boolean)),
    "daily-work-reports": new Set((dailyReports ?? []).map((row) => row.image_path).filter(Boolean)),
  };

  const files = await Promise.all(managedStorageBuckets.map((bucket) => listBucket(supabase, bucket, references[bucket])));
  return files.flat().sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
}

async function listBucket(supabase: SupabaseClient, bucket: ManagedStorageBucket, references: Set<string>) {
  const { data: rootItems, error } = await supabase.storage.from(bucket).list("", { limit: 1000, sortBy: { column: "updated_at", order: "desc" } });
  if (error) return [];
  const result: ManagedStorageFile[] = [];

  for (const item of rootItems ?? []) {
    if (item.id) {
      result.push(toFile(bucket, item.name, item, references));
      continue;
    }
    const { data: children } = await supabase.storage.from(bucket).list(item.name, { limit: 1000, sortBy: { column: "updated_at", order: "desc" } });
    for (const child of children ?? []) {
      if (child.id) result.push(toFile(bucket, `${item.name}/${child.name}`, child, references));
    }
  }
  return result;
}

function toFile(bucket: ManagedStorageBucket, path: string, item: { name: string; updated_at?: string | null; metadata?: Record<string, unknown> | null }, references: Set<string>): ManagedStorageFile {
  return {
    bucket,
    path,
    name: item.name,
    size: typeof item.metadata?.size === "number" ? item.metadata.size : 0,
    mimeType: typeof item.metadata?.mimetype === "string" ? item.metadata.mimetype : "알 수 없음",
    updatedAt: item.updated_at ?? null,
    referenced: references.has(path),
  };
}
