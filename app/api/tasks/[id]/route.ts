import { NextResponse } from "next/server";

import {
  hasValidMutationOrigin,
  invalidOriginResponse,
  requireApiEmployee,
} from "@/lib/auth/api";
import { departmentLabel, isSameDepartmentGroup, positionLabel } from "@/lib/employees/constants";
import { canViewDepartment } from "@/lib/employees/permissions";
import { createProfileImageSignedUrl } from "@/lib/storage/profile-image";
import { validateTaskAttachments } from "@/lib/tasks/files";
import {
  canManageTask,
  canViewTaskDetails,
} from "@/lib/tasks/permissions";
import {
  TASK_ATTACHMENT_BUCKET,
  taskAttachmentFiles,
  uploadTaskAttachments,
} from "@/lib/tasks/storage";
import { validateTaskParticipants } from "@/lib/tasks/participants";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  removedAttachmentIdsSchema,
  taskFormSchema,
  taskInputFromFormData,
} from "@/schemas/tasks";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiEmployee();
  if (auth.response) return auth.response;

  const { id } = await params;
  const supabase = createAdminClient();
  const { data: task } = await supabase
    .from("tasks")
    .select(
      "id, title, description, owner_id, department, start_date, end_date, related_link, created_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (!task) {
    return NextResponse.json(
      { message: "업무를 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  const { data: owner } = await supabase
    .from("employees")
    .select("id, name, position, department, profile_image_url")
    .eq("id", task.owner_id)
    .maybeSingle();
  if (
    !owner ||
    !canViewDepartment(auth.employee, owner.department) ||
    !canViewDepartment(auth.employee, task.department)
  ) {
    return NextResponse.json(
      { message: "다른 부서의 업무 일정은 조회할 수 없습니다." },
      { status: 403 },
    );
  }

  const { data: participantRows } = await supabase
    .from("task_participants")
    .select("employee_id")
    .eq("task_id", task.id);
  const participantIds = (participantRows ?? []).map((row) => row.employee_id);
  const isParticipant = participantIds.includes(auth.employee.id);
  const canViewDetail = canViewTaskDetails(
    auth.employee,
    task.owner_id,
    task.department,
    isParticipant,
  );
  const canEdit = canManageTask(auth.employee, task.owner_id, task.department);
  const { data: participantEmployees } = participantIds.length
    ? await supabase
        .from("employees")
        .select("id, name, position, department, profile_image_url")
        .in("id", participantIds)
    : { data: [] };
  const { data: attachments } = canViewDetail
    ? await supabase
        .from("task_attachments")
        .select("id, file_name, mime_type, file_size_bytes, created_at")
        .eq("task_id", task.id)
        .order("created_at", { ascending: true })
    : { data: [] };

  return NextResponse.json({
    task: {
      id: task.id,
      title: task.title,
      ownerId: task.owner_id,
      owner: owner
        ? {
            name: owner.name,
            position: positionLabel(owner.position),
            department: departmentLabel(owner.department),
            imageUrl: await createProfileImageSignedUrl(
              supabase,
              owner.profile_image_url,
            ),
          }
        : null,
      participants: await Promise.all(
        (participantEmployees ?? []).map(async (participant) => ({
          id: participant.id,
          name: participant.name,
          position: positionLabel(participant.position),
          department: departmentLabel(participant.department),
          imageUrl: await createProfileImageSignedUrl(
            supabase,
            participant.profile_image_url,
          ),
        })),
      ),
      department: task.department,
      departmentLabel: departmentLabel(task.department),
      startDate: task.start_date,
      endDate: task.end_date,
      description: canViewDetail ? task.description : null,
      relatedLink: canViewDetail ? task.related_link : null,
      attachments: canViewDetail
        ? (attachments ?? []).map((attachment) => ({
            id: attachment.id,
            fileName: attachment.file_name,
            mimeType: attachment.mime_type,
            fileSizeBytes: attachment.file_size_bytes,
            downloadUrl: `/api/tasks/${task.id}/attachments/${attachment.id}`,
          }))
        : [],
      canViewDetail,
      canEdit,
    },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasValidMutationOrigin(request)) return invalidOriginResponse();

  const auth = await requireApiEmployee();
  if (auth.response) return auth.response;

  const { id } = await params;
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { message: "업무 수정 정보를 읽을 수 없습니다." },
      { status: 400 },
    );
  }

  const parsed = taskFormSchema.safeParse(taskInputFromFormData(formData));
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "업무 정보를 확인해 주세요." },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const { data: before } = await supabase
    .from("tasks")
    .select(
      "id, title, owner_id, department, start_date, end_date, related_link",
    )
    .eq("id", id)
    .maybeSingle();

  if (!before) {
    return NextResponse.json(
      { message: "업무를 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  if (!canManageTask(auth.employee, before.owner_id, before.department)) {
    return NextResponse.json(
      { message: "이 업무를 수정할 권한이 없습니다." },
      { status: 403 },
    );
  }

  if (auth.employee.role !== "admin" && parsed.data.ownerId !== auth.employee.id) {
    return NextResponse.json(
      { message: "업무 담당자를 변경할 권한이 없습니다." },
      { status: 403 },
    );
  }

  if (
    auth.employee.role !== "admin" &&
    !isSameDepartmentGroup(parsed.data.department, auth.employee.departmentCode)
  ) {
    return NextResponse.json(
      { message: "본인 소속 부서의 업무만 수정할 수 있습니다." },
      { status: 403 },
    );
  }

  const participantError = await validateTaskParticipants(
    supabase,
    auth.employee,
    parsed.data.participantIds,
    parsed.data.department,
  );
  if (participantError) {
    return NextResponse.json({ message: participantError }, { status: 403 });
  }

  if (parsed.data.ownerId !== before.owner_id) {
    const { data: owner } = await supabase
      .from("employees")
      .select("id")
      .eq("id", parsed.data.ownerId)
      .eq("account_status", "active")
      .maybeSingle();
    if (!owner) {
      return NextResponse.json(
        { message: "선택한 담당 직원을 찾을 수 없습니다." },
        { status: 400 },
      );
    }
  }

  let rawRemovedIds: unknown = [];
  try {
    rawRemovedIds = JSON.parse(String(formData.get("removeAttachmentIds") ?? "[]"));
  } catch {
    return NextResponse.json(
      { message: "삭제할 첨부파일 정보를 확인해 주세요." },
      { status: 400 },
    );
  }
  const removedIds = removedAttachmentIdsSchema.safeParse(rawRemovedIds);
  if (!removedIds.success) {
    return NextResponse.json(
      { message: "삭제할 첨부파일 정보를 확인해 주세요." },
      { status: 400 },
    );
  }

  const { data: existingAttachments } = await supabase
    .from("task_attachments")
    .select("id, file_url")
    .eq("task_id", id);
  const existing = existingAttachments ?? [];
  const removable = existing.filter((attachment) =>
    removedIds.data.includes(attachment.id),
  );
  if (removable.length !== removedIds.data.length) {
    return NextResponse.json(
      { message: "삭제할 첨부파일을 찾을 수 없습니다." },
      { status: 400 },
    );
  }

  const files = taskAttachmentFiles(formData);
  const fileError = validateTaskAttachments(
    files,
    existing.length - removable.length,
  );
  if (fileError) {
    return NextResponse.json({ message: fileError }, { status: 400 });
  }

  const updates = {
    title: parsed.data.title,
    description: parsed.data.description,
    owner_id: parsed.data.ownerId,
    department: parsed.data.department,
    start_date: parsed.data.startDate,
    end_date: parsed.data.endDate,
    related_link: parsed.data.relatedLink || null,
  };
  const { error: updateError } = await supabase
    .from("tasks")
    .update(updates)
    .eq("id", id);
  if (updateError) {
    return NextResponse.json(
      { message: "업무를 수정하지 못했습니다." },
      { status: 500 },
    );
  }


  const { data: beforeParticipants } = await supabase
    .from("task_participants")
    .select("employee_id")
    .eq("task_id", id);
  const beforeParticipantIds = (beforeParticipants ?? []).map(
    (participant) => participant.employee_id,
  );
  const participantIdsToAdd = parsed.data.participantIds.filter(
    (employeeId) => !beforeParticipantIds.includes(employeeId),
  );
  const participantIdsToRemove = beforeParticipantIds.filter(
    (employeeId) => !parsed.data.participantIds.includes(employeeId),
  );
  if (participantIdsToAdd.length) {
    const { error: addParticipantError } = await supabase
      .from("task_participants")
      .insert(
        participantIdsToAdd.map((employeeId) => ({
          task_id: id,
          employee_id: employeeId,
        })),
      );
    if (addParticipantError) {
      return NextResponse.json(
        { message: "업무는 수정했지만 참여 직원을 추가하지 못했습니다." },
        { status: 500 },
      );
    }
  }
  if (participantIdsToRemove.length) {
    const { error: removeParticipantError } = await supabase
      .from("task_participants")
      .delete()
      .eq("task_id", id)
      .in("employee_id", participantIdsToRemove);
    if (removeParticipantError) {
      return NextResponse.json(
        { message: "업무는 수정했지만 참여 직원을 제외하지 못했습니다." },
        { status: 500 },
      );
    }
  }

  const upload = await uploadTaskAttachments({
    supabase,
    taskId: id,
    files,
    uploadedBy: auth.employee.id,
  });
  if (upload.error) {
    return NextResponse.json(
      { message: "업무 정보는 수정했지만 새 첨부파일을 저장하지 못했습니다." },
      { status: 500 },
    );
  }

  if (removable.length) {
    const paths = removable.map((attachment) => attachment.file_url);
    const { error: storageError } = await supabase.storage
      .from(TASK_ATTACHMENT_BUCKET)
      .remove(paths);
    if (storageError) {
      return NextResponse.json(
        { message: "업무 정보는 수정했지만 첨부파일을 삭제하지 못했습니다." },
        { status: 500 },
      );
    }
    await supabase
      .from("task_attachments")
      .delete()
      .eq("task_id", id)
      .in("id", removedIds.data);
  }

  await supabase.from("activity_logs").insert({
    employee_id: auth.employee.id,
    action_type: "task.update",
    target_type: "task",
    target_id: id,
    changed_data: {
      title: { before: before.title, after: parsed.data.title },
      owner_id: { before: before.owner_id, after: parsed.data.ownerId },
      department: { before: before.department, after: parsed.data.department },
      start_date: { before: before.start_date, after: parsed.data.startDate },
      end_date: { before: before.end_date, after: parsed.data.endDate },
      attachments_added: files.length,
      attachments_removed: removable.length,
      participant_ids: {
        before: beforeParticipantIds,
        after: parsed.data.participantIds,
      },
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasValidMutationOrigin(request)) return invalidOriginResponse();

  const auth = await requireApiEmployee();
  if (auth.response) return auth.response;

  const { id } = await params;
  const supabase = createAdminClient();
  const { data: task } = await supabase
    .from("tasks")
    .select("id, title, owner_id, department")
    .eq("id", id)
    .maybeSingle();

  if (!task) {
    return NextResponse.json(
      { message: "업무를 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  if (!canManageTask(auth.employee, task.owner_id, task.department)) {
    return NextResponse.json(
      { message: "이 업무를 삭제할 권한이 없습니다." },
      { status: 403 },
    );
  }

  const { data: attachments } = await supabase
    .from("task_attachments")
    .select("file_url")
    .eq("task_id", id);
  const { error: deleteError } = await supabase.from("tasks").delete().eq("id", id);
  if (deleteError) {
    return NextResponse.json(
      { message: "업무를 삭제하지 못했습니다." },
      { status: 500 },
    );
  }

  const paths = (attachments ?? []).map((attachment) => attachment.file_url);
  if (paths.length) {
    await supabase.storage.from(TASK_ATTACHMENT_BUCKET).remove(paths);
  }

  await supabase.from("activity_logs").insert({
    employee_id: auth.employee.id,
    action_type: "task.delete",
    target_type: "task",
    target_id: id,
    changed_data: {
      title: task.title,
      owner_id: task.owner_id,
      attachment_count: paths.length,
    },
  });

  return NextResponse.json({ ok: true });
}
