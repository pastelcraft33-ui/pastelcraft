import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProductDesignWorkspace } from "@/components/product-design/product-design-workspace";
import { requireCurrentEmployee } from "@/lib/auth/session";
import { departmentGroup } from "@/lib/employees/constants";
import { loadDesignWorkspaceData } from "@/lib/product-design/workspace-data";

export const metadata: Metadata = { title: "마케팅 팀" };
export const dynamic = "force-dynamic";

const views = ["register", "ongoing", "dashboard", "completed"] as const;

export default async function MarketingWorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const currentEmployee = await requireCurrentEmployee();
  if (departmentGroup(currentEmployee.departmentCode) !== "web") notFound();

  const { view } = await searchParams;
  const currentView = views.includes(view as (typeof views)[number])
    ? (view as (typeof views)[number])
    : "register";
  const { taskItems, employeeOptions, schemaAvailable } =
    await loadDesignWorkspaceData({
      currentEmployee,
      currentView,
      workspaceType: "web_marketing",
    });

  return (
    <ProductDesignWorkspace
      workspaceType="web_marketing"
      currentView={currentView}
      currentUserId={currentEmployee.id}
      currentUserName={currentEmployee.name}
      currentUserRole={currentEmployee.role}
      employeeOptions={employeeOptions}
      tasks={taskItems}
      schemaAvailable={schemaAvailable}
    />
  );
}
