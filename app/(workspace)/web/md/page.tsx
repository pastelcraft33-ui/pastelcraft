import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDesignWorkspace } from "@/components/product-design/product-design-workspace";
import { requireCurrentEmployee } from "@/lib/auth/session";
import { canUseProductDesignWorkspace } from "@/lib/product-design/permissions";
import { loadDesignWorkspaceData } from "@/lib/product-design/workspace-data";

export const metadata: Metadata = { title: "MD팀" };
export const dynamic = "force-dynamic";
const views = ["register", "ongoing", "dashboard", "completed"] as const;

export default async function MdWorkspacePage({ searchParams }: {
  searchParams: Promise<{ view?: string; assignee?: string; task?: string }>;
}) {
  const employee = await requireCurrentEmployee();
  if (!canUseProductDesignWorkspace(employee)) notFound();
  const { view, assignee, task } = await searchParams;
  if (assignee && employee.role !== "admin") notFound();
  const currentView = views.includes(view as typeof views[number]) ? view as typeof views[number] : "register";
  const data = await loadDesignWorkspaceData({ currentEmployee: employee, currentView, workspaceType: "web_md", assigneeId: currentView === "ongoing" ? assignee : undefined, selectedTaskId: currentView === "ongoing" ? task : undefined });
  if (currentView === "ongoing" && task && !data.taskItems.some((item) => item.id === task)) notFound();
  return <ProductDesignWorkspace workspaceType="web_md" currentView={currentView} currentUserId={employee.id} currentUserName={employee.name} currentUserRole={employee.role} employeeOptions={data.employeeOptions} tasks={data.taskItems} schemaAvailable={data.schemaAvailable} adminDailyActivity={data.adminDailyActivity} employeeView={data.employeeView} selectedTaskId={currentView === "ongoing" ? task : undefined} />;
}
