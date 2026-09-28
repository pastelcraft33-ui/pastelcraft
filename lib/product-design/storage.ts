import "server-only";

import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { productDesignImageExtension } from "@/lib/product-design/files";

export const PRODUCT_DESIGN_IMAGE_BUCKET = "product-design-images";

export async function uploadProductDesignImage({
  supabase,
  taskId,
  file,
}: {
  supabase: SupabaseClient;
  taskId: string;
  file: File;
}) {
  const extension = productDesignImageExtension(file.name);
  const path = `${taskId}/${randomUUID()}.${extension}`;
  const { error } = await supabase.storage
    .from(PRODUCT_DESIGN_IMAGE_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  return { path, error };
}

export async function createProductDesignImageSignedUrl(
  supabase: SupabaseClient,
  path: string | null,
) {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(PRODUCT_DESIGN_IMAGE_BUCKET)
    .createSignedUrl(path, 60 * 60);
  return error ? null : data.signedUrl;
}
