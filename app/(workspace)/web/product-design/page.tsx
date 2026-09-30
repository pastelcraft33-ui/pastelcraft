import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  ProductDesignWorkspace,
} from "@/components/product-design/product-design-workspace";
import { requireCurrentEmployee } from "@/lib/auth/session";
import { canUseProductDesignWorkspace } from "@/lib/product-design/permissions";
import { loadDesignWorkspaceData } from "@/lib/product-design/workspace-data";

export const metadata: Metadata = { title: "제품 디자인팀" };
export const dynamic = "force-dynamic";

const views = ["register", "planned", "ongoing", "dashboard", "completed"] as const;

export default async function ProductDesignPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const currentEmployee = await requireCurrentEmployee();
  if (!canUseProductDesignWorkspace(currentEmployee)) notFound();

  const { view } = await searchParams;
  const currentView = views.includes(view as (typeof views)[number])
    ? (view as (typeof views)[number])
    : "register";
  if (currentView === "planned" && currentEmployee.role !== "admin") notFound();
  const { taskItems, employeeOptions, schemaAvailable } =
    await loadDesignWorkspaceData({
      currentEmployee,
      currentView,
      workspaceType: "product_design",
    });

  return (
    <ProductDesignWorkspace
      currentView={currentView}
      workspaceType="product_design"
      currentUserId={currentEmployee.id}
      currentUserName={currentEmployee.name}
      currentUserRole={currentEmployee.role}
      employeeOptions={employeeOptions}
      tasks={taskItems}
      schemaAvailable={schemaAvailable}
    />
  );
}
