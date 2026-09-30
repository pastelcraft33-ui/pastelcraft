import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { CurrentEmployee } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export type ProductDesignNotificationItem = {
  id: string;
  type: "product_design";
  title: string;
  description: string;
  createdAt: string;
  href: string;
};

export async function createProductDesignAssignmentNotification({
  supabase,
  employeeId,
  taskId,
  productName,
  assignedByName,
  assignmentKind,
  workspaceType = "product_design",
}: {
  supabase: SupabaseClient;
  employeeId: string;
  taskId: string;
  productName: string;
  assignedByName: string;
  assignmentKind: "assigned" | "transferred";
  workspaceType?: "product_design" | "web_design" | "web_marketing";
}) {
  const teamName = workspaceType === "web_marketing"
    ? "마케팅"
    : workspaceType === "web_design"
      ? "웹 디자인"
      : "제품 디자인";
  const href = workspaceType === "web_marketing"
    ? "/web/marketing?view=ongoing"
    : workspaceType === "web_design"
      ? "/web/design?view=ongoing"
      : "/web/product-design?view=ongoing";
  return supabase.from("employee_notifications").insert({
    employee_id: employeeId,
    notification_type: "product_design_assignment",
    title: `새 ${teamName} 작업이 ${assignmentKind === "transferred" ? "이관" : "배정"}되었습니다`,
    description: `${assignedByName}님이 '${productName}' 작업의 담당자로 지정했습니다.`,
    href,
    metadata: {
      task_id: taskId,
      product_name: productName,
      assignment_kind: assignmentKind,
      workspace_type: workspaceType,
    },
  });
}

export async function getProductDesignNotifications(
  currentEmployee: CurrentEmployee,
) {
  const { data, error } = await createAdminClient()
    .from("employee_notifications")
    .select("id, title, description, href, created_at")
    .eq("employee_id", currentEmployee.id)
    .eq("notification_type", "product_design_assignment")
    .is("read_at", null)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    if (error.code === "PGRST205" || error.code === "42P01") {
      return { items: [] as ProductDesignNotificationItem[], productDesignCount: 0 };
    }
    throw new Error("제품 디자인 알림을 불러오지 못했습니다.");
  }

  const items: ProductDesignNotificationItem[] = (data ?? []).map((item) => ({
    id: `product-design:${item.id}`,
    type: "product_design",
    title: item.title,
    description: item.description,
    createdAt: item.created_at,
    href: item.href,
  }));
  return { items, productDesignCount: items.length };
}
