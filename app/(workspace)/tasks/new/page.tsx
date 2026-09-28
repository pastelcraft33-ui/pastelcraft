import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TaskForm } from "@/components/tasks/task-form";
import { requireCurrentEmployee } from "@/lib/auth/session";
import { departmentCodesInSameGroup, departmentLabel, positionLabel } from "@/lib/employees/constants";
import { getWorkspaceEmployees } from "@/lib/employees/data";
import { canViewAllDepartments } from "@/lib/employees/permissions";
import {
  createProfileImageSignedUrl,
  createProfileImageSignedUrlMap,
} from "@/lib/storage/profile-image";
import { canManageTask } from "@/lib/tasks/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "업무 등록" };

export default async function TaskNewPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const currentEmployee = await requireCurrentEmployee();
  const { edit: editId } = await searchParams;
  const supabase = createAdminClient();

  const canSeeEveryDepartment = canViewAllDepartments(currentEmployee);
  const employees = (await getWorkspaceEmployees()).filter(
    (employee) =>
      employee.account_status === "active" &&
      (canSeeEveryDepartment ||
        departmentCodesInSameGroup(currentEmployee.departmentCode).includes(employee.department as never)),
  );
  const profileImageUrlByValue = await createProfileImageSignedUrlMap(
    supabase,
    employees.map((employee) => employee.profile_image_url),
  );
  const employeeOptions = employees.map((employee) => ({
    id: employee.id,
    name: employee.name,
    position: positionLabel(employee.position),
    department: employee.department,
    departmentLabel: departmentLabel(employee.department),
    imageUrl: employee.profile_image_url
      ? (profileImageUrlByValue.get(employee.profile_image_url) ?? null)
      : null,
  }));

  let initialTask = null;
  if (editId) {
    const [{ data: task }, { data: attachments }, { data: participants }] = await Promise.all([
      supabase
        .from("tasks")
        .select(
          "id, title, description, owner_id, department, start_date, end_date, related_link",
        )
        .eq("id", editId)
        .maybeSingle(),
      supabase
        .from("task_attachments")
        .select("id, file_name, file_size_bytes")
        .eq("task_id", editId)
        .order("created_at", { ascending: true }),
      supabase
        .from("task_participants")
        .select("employee_id")
        .eq("task_id", editId),
    ]);

    if (
      !task ||
      !canManageTask(currentEmployee, task.owner_id, task.department)
    ) {
      notFound();
    }

    if (!employeeOptions.some((employee) => employee.id === task.owner_id)) {
      const { data: existingOwner } = await supabase
        .from("employees")
        .select("id, name, position, department, profile_image_url")
        .eq("id", task.owner_id)
        .maybeSingle();
      if (existingOwner) {
        employeeOptions.push({
          id: existingOwner.id,
          name: `${existingOwner.name} (사용 중지)`,
          position: positionLabel(existingOwner.position),
          department: existingOwner.department,
          departmentLabel: departmentLabel(existingOwner.department),
          imageUrl: await createProfileImageSignedUrl(supabase, existingOwner.profile_image_url),
        });
      }
    }

    initialTask = {
      id: task.id,
      title: task.title,
      description: task.description,
      ownerId: task.owner_id,
      participantIds: (participants ?? []).map((participant) => participant.employee_id),
      department: task.department,
      startDate: task.start_date,
      endDate: task.end_date,
      relatedLink: task.related_link ?? "",
      attachments: (attachments ?? []).map((attachment) => ({
        id: attachment.id,
        fileName: attachment.file_name,
        fileSizeBytes: attachment.file_size_bytes,
        downloadUrl: `/api/tasks/${task.id}/attachments/${attachment.id}`,
      })),
    };
  }

  return (
    <TaskForm
      employees={employeeOptions}
      currentEmployee={{
        id: currentEmployee.id,
        name: currentEmployee.name,
        role: currentEmployee.role,
        department: currentEmployee.departmentCode,
      }}
      initialTask={initialTask}
    />
  );
}
