import "server-only";

import type {
  ProductDesignEmployeeOption,
  ProductDesignTaskItem,
} from "@/components/product-design/product-design-workspace";
import type { CurrentEmployee } from "@/lib/auth/session";
import { departmentGroup } from "@/lib/employees/constants";
import {
  dashboardCompletedCutoff,
  isTaskVisibleOnDashboard,
} from "@/lib/product-design/dashboard";
import {
  createProductDesignImageSignedUrl,
  createProductDesignSpreadsheetSignedUrl,
} from "@/lib/product-design/storage";
import { createAdminClient } from "@/lib/supabase/admin";

type WorkspaceType = "product_design" | "web_design" | "web_marketing";
type WorkspaceView = "register" | "planned" | "ongoing" | "dashboard" | "completed";

type WorkLogRow = {
  id: string;
  task_id: string;
  author_id: string;
  current_stage: string;
  work_content: string;
  change_summary: string;
  created_at: string;
};

export async function loadDesignWorkspaceData({
  currentEmployee,
  currentView,
  workspaceType,
}: {
  currentEmployee: CurrentEmployee;
  currentView: WorkspaceView;
  workspaceType: WorkspaceType;
}) {
  const supabase = createAdminClient();
  let taskQuery = supabase
    .from("product_design_tasks")
    .select(
      "id, product_name, work_type, representative_image_path, spreadsheet_path, spreadsheet_file_name, spreadsheet_size_bytes, detailed_work_content, current_stage, workflow_status, note, started_at, completed_at, created_by, assigned_to, created_at, updated_at",
    )
    .eq("workspace_type", workspaceType);
  if (currentView === "dashboard") {
    const completedCutoff = new Date(dashboardCompletedCutoff()).toISOString();
    taskQuery = taskQuery.or(
      `workflow_status.neq.completed,completed_at.gt.${completedCutoff},and(completed_at.is.null,updated_at.gt.${completedCutoff})`,
    );
  } else if (currentView === "completed") {
    taskQuery = taskQuery.eq("workflow_status", "completed");
  } else {
    taskQuery = taskQuery.eq("assigned_to", currentEmployee.id);
  }
  const taskResult = await taskQuery
    .order("started_at", { ascending: false })
    .limit(200);

  const schemaAvailable = !(
    taskResult.error?.code === "PGRST205" ||
    taskResult.error?.code === "PGRST204" ||
    taskResult.error?.code === "42703" ||
    taskResult.error?.code === "42P01"
  );
  if (taskResult.error && schemaAvailable) {
    throw new Error("디자인 작업 목록을 불러오지 못했습니다.");
  }

  const tasks = (taskResult.data ?? []).filter(
    (task) =>
      currentView === "dashboard"
        ? isTaskVisibleOnDashboard({
            workflowStatus: task.workflow_status,
            completedAt: task.completed_at,
            updatedAt: task.updated_at,
          })
        : currentView !== "completed" || task.workflow_status === "completed",
  );
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
  if (logResult.error) throw new Error("디자인 작업 기록을 불러오지 못했습니다.");

  const employeeResult = await supabase
    .from("employees")
    .select("id, login_id, name, department, account_status")
    .not("login_id", "like", "deleted-%")
    .neq("name", "삭제된 직원")
    .order("name", { ascending: true });
  if (employeeResult.error) throw new Error("작업 작성자 정보를 불러오지 못했습니다.");

  const employeeNameById = new Map(
    (employeeResult.data ?? []).map((employee) => [employee.id, employee.name]),
  );
  const logsByTaskId = new Map<string, WorkLogRow[]>();
  ((logResult.data ?? []) as WorkLogRow[]).forEach((log) => {
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
      spreadsheetUrl:
        currentView === "ongoing"
          ? await createProductDesignSpreadsheetSignedUrl(
              supabase,
              task.spreadsheet_path,
              task.spreadsheet_file_name,
            )
          : null,
      spreadsheetFileName: task.spreadsheet_file_name,
      spreadsheetSizeBytes: task.spreadsheet_size_bytes,
      detailedWorkContent: task.detailed_work_content,
      currentStage: task.current_stage,
      workflowStatus: task.workflow_status as ProductDesignTaskItem["workflowStatus"],
      note: task.note,
      startedAt: task.started_at,
      completedAt: task.completed_at,
      createdAt: task.created_at,
      updatedAt: task.updated_at,
      creatorName: employeeNameById.get(task.created_by) ?? "알 수 없는 직원",
      assigneeId: task.assigned_to,
      assigneeName: employeeNameById.get(task.assigned_to) ?? "알 수 없는 직원",
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

  const employeeOptions: ProductDesignEmployeeOption[] = (employeeResult.data ?? [])
    .filter(
      (employee) =>
        employee.account_status === "active" &&
        departmentGroup(employee.department) === "web",
    )
    .map((employee) => ({ id: employee.id, name: employee.name }));

  return { taskItems, employeeOptions, schemaAvailable };
}
