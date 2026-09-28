import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  ProductDesignWorkspace,
  type ProductDesignTaskItem,
} from "@/components/product-design/product-design-workspace";
import { requireCurrentEmployee } from "@/lib/auth/session";
import { canUseProductDesignWorkspace } from "@/lib/product-design/permissions";
import { createProductDesignImageSignedUrl } from "@/lib/product-design/storage";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "제품 디자인팀" };
export const dynamic = "force-dynamic";

const views = ["register", "ongoing", "dashboard"] as const;

type ProductDesignLogRow = {
  id: string;
  task_id: string;
  author_id: string;
  current_stage: string;
  work_content: string;
  change_summary: string;
  created_at: string;
};

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
  const supabase = createAdminClient();
  const taskResult = await supabase
    .from("product_design_tasks")
    .select(
      "id, product_name, work_type, representative_image_path, detailed_work_content, current_stage, started_at, created_by, created_at, updated_at",
    )
    .order("started_at", { ascending: false })
    .limit(200);

  const schemaAvailable = !(
    taskResult.error?.code === "PGRST205" || taskResult.error?.code === "42P01"
  );
  if (taskResult.error && schemaAvailable) {
    throw new Error("제품 디자인 작업 목록을 불러오지 못했습니다.");
  }

  const tasks = taskResult.data ?? [];
  const taskIds = tasks.map((task) => task.id);
  const logResult = taskIds.length
    ? await supabase
        .from("product_design_work_logs")
        .select(
          "id, task_id, author_id, current_stage, work_content, change_summary, created_at",
        )
        .in("task_id", taskIds)
        .order("created_at", { ascending: false })
    : { data: [], error: null };
  if (logResult.error) throw new Error("제품 디자인 작업 기록을 불러오지 못했습니다.");

  const employeeIds = [
    ...new Set([
      ...tasks.map((task) => task.created_by),
      ...(logResult.data ?? []).map((log) => log.author_id),
    ]),
  ];
  const employeeResult = employeeIds.length
    ? await supabase.from("employees").select("id, name").in("id", employeeIds)
    : { data: [], error: null };
  if (employeeResult.error) throw new Error("작업 작성자 정보를 불러오지 못했습니다.");
  const employeeNameById = new Map(
    (employeeResult.data ?? []).map((employee) => [employee.id, employee.name]),
  );

  const productDesignLogs = (logResult.data ?? []) as ProductDesignLogRow[];
  const logsByTaskId = new Map<string, ProductDesignLogRow[]>();
  productDesignLogs.forEach((log) => {
    const logs = logsByTaskId.get(log.task_id) ?? [];
    logs.push(log);
    logsByTaskId.set(log.task_id, logs);
  });

  const taskItems: ProductDesignTaskItem[] = await Promise.all(
    tasks.map(async (task) => ({
      id: task.id,
      productName: task.product_name,
      workType: task.work_type as ProductDesignTaskItem["workType"],
      imageUrl: await createProductDesignImageSignedUrl(
        supabase,
        task.representative_image_path,
      ),
      detailedWorkContent: task.detailed_work_content,
      currentStage: task.current_stage,
      startedAt: task.started_at,
      createdAt: task.created_at,
      updatedAt: task.updated_at,
      creatorName: employeeNameById.get(task.created_by) ?? "알 수 없는 직원",
      logs: (logsByTaskId.get(task.id) ?? []).map((log) => ({
        id: log.id,
        authorName: employeeNameById.get(log.author_id) ?? "알 수 없는 직원",
        currentStage: log.current_stage,
        workContent: log.work_content,
        changeSummary: log.change_summary,
        createdAt: log.created_at,
      })),
    })),
  );

  return (
    <ProductDesignWorkspace
      currentView={currentView}
      currentUserName={currentEmployee.name}
      tasks={taskItems}
      schemaAvailable={schemaAvailable}
    />
  );
}
