import "server-only";

import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  productDesignImageExtension,
  productDesignSpreadsheetExtension,
} from "@/lib/product-design/files";

export const PRODUCT_DESIGN_IMAGE_BUCKET = "product-design-images";
export const PRODUCT_DESIGN_FILE_BUCKET = "product-design-files";

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

export async function uploadProductDesignSpreadsheet({
  supabase,
  taskId,
  file,
}: {
  supabase: SupabaseClient;
  taskId: string;
  file: File;
}) {
  const extension = productDesignSpreadsheetExtension(file.name);
  const path = `${taskId}/${randomUUID()}.${extension}`;
  const { error } = await supabase.storage
    .from(PRODUCT_DESIGN_FILE_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  return { path, error };
}

export async function createProductDesignSpreadsheetSignedUrl(
  supabase: SupabaseClient,
  path: string | null,
  fileName: string | null,
) {
  if (!path || !fileName) return null;
  const { data, error } = await supabase.storage
    .from(PRODUCT_DESIGN_FILE_BUCKET)
    .createSignedUrl(path, 60 * 60, { download: fileName });
  return error ? null : data.signedUrl;
}
