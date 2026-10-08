import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProductDesignWorkspace } from "@/components/product-design/product-design-workspace";
import { requireCurrentEmployee } from "@/lib/auth/session";
import { departmentGroup } from "@/lib/employees/constants";
import { loadDesignWorkspaceData } from "@/lib/product-design/workspace-data";

export const metadata: Metadata = { title: "교육팀" };
export const dynamic = "force-dynamic";

const views = ["register", "ongoing", "dashboard", "completed"] as const;

export default async function EducationWorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; assignee?: string }>;
}) {
  const currentEmployee = await requireCurrentEmployee();
  if (departmentGroup(currentEmployee.departmentCode) !== "web") notFound();

  const { view, assignee } = await searchParams;
  if (assignee && currentEmployee.role !== "admin") notFound();
  const currentView = views.includes(view as (typeof views)[number])
    ? (view as (typeof views)[number])
    : "register";
  const { taskItems, employeeOptions, schemaAvailable, adminDailyActivity, employeeView } =
    await loadDesignWorkspaceData({
      currentEmployee,
      currentView,
      assigneeId: currentView === "ongoing" ? assignee : undefined,
      workspaceType: "web_education",
    });

  return (
    <ProductDesignWorkspace
      workspaceType="web_education"
      currentView={currentView}
      currentUserId={currentEmployee.id}
      currentUserName={currentEmployee.name}
      currentUserRole={currentEmployee.role}
      employeeOptions={employeeOptions}
      tasks={taskItems}
      schemaAvailable={schemaAvailable}
      adminDailyActivity={adminDailyActivity}
      employeeView={employeeView}
    />
  );
}
