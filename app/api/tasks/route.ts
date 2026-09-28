import { NextResponse } from "next/server";

import {
  hasValidMutationOrigin,
  invalidOriginResponse,
  requireApiEmployee,
} from "@/lib/auth/api";
import { departmentCodesInSameGroup, departmentLabel, isSameDepartmentGroup, positionLabel } from "@/lib/employees/constants";
import { canViewAllDepartments } from "@/lib/employees/permissions";
import { createProfileImageSignedUrlMap } from "@/lib/storage/profile-image";
import { validateTaskAttachments } from "@/lib/tasks/files";
import { canManageTask } from "@/lib/tasks/permissions";
import {
  taskAttachmentFiles,
  uploadTaskAttachments,
} from "@/lib/tasks/storage";
import { validateTaskParticipants } from "@/lib/tasks/participants";
import { createAdminClient } from "@/lib/supabase/admin";
import { taskFormSchema, taskInputFromFormData } from "@/schemas/tasks";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireApiEmployee();
  if (auth.response) return auth.response;

  const supabase = createAdminClient();
  let ownerQuery = supabase
    .from("employees")
    .select("id, name, position, department, profile_image_url");
  if (!canViewAllDepartments(auth.employee)) {
    ownerQuery = ownerQuery.in("department", departmentCodesInSameGroup(auth.employee.departmentCode));
  }
  const { data: owners } = await ownerQuery;
  const visibleOwnerIds = (owners ?? []).map((owner) => owner.id);
  let taskQuery = supabase
    .from("tasks")
    .select("id, title, owner_id, department, start_date, end_date")
    .in("owner_id", visibleOwnerIds);
  if (!canViewAllDepartments(auth.employee)) {
    taskQuery = taskQuery.in("department", departmentCodesInSameGroup(auth.employee.departmentCode));
  }
  const { data: tasks, error } = await taskQuery.order("start_date", {
    ascending: true,
  });

  if (error) {
    return NextResponse.json(
      { message: "업무 목록을 불러오지 못했습니다." },
      { status: 500 },
    );
  }

  const { data: participantRows, error: participantError } = (tasks ?? []).length
    ? await supabase
        .from("task_participants")
        .select("task_id, employee_id")
        .in("task_id", (tasks ?? []).map((task) => task.id))
    : { data: [], error: null };
  if (participantError && participantError.code !== "PGRST205") {
    return NextResponse.json(
      { message: "업무 참여자 정보를 불러오지 못했습니다." },
      { status: 500 },
    );
  }

  const profileImageUrlByValue = await createProfileImageSignedUrlMap(
    supabase,
    (owners ?? []).map((owner) => owner.profile_image_url),
  );
  const ownerEntries = (owners ?? []).map((owner) => [
      owner.id,
      {
        id: owner.id,
        name: owner.name,
        position: positionLabel(owner.position),
        department: departmentLabel(owner.department),
        imageUrl: owner.profile_image_url
          ? (profileImageUrlByValue.get(owner.profile_image_url) ?? null)
          : null,
      },
    ] as const);
  const ownerById = new Map(ownerEntries);
  const participantIdsByTask = new Map<string, string[]>();
  (participantRows ?? []).forEach((participant) => {
    const ids = participantIdsByTask.get(participant.task_id) ?? [];
    ids.push(participant.employee_id);
    participantIdsByTask.set(participant.task_id, ids);
  });

  return NextResponse.json({
    tasks: (tasks ?? []).map((task) => ({
      id: task.id,
      title: task.title,
      ownerId: task.owner_id,
      owner: ownerById.get(task.owner_id) ?? null,
      participants: (participantIdsByTask.get(task.id) ?? [])
        .map((employeeId) => ownerById.get(employeeId))
        .filter(Boolean),
      department: task.department,
      departmentLabel: departmentLabel(task.department),
      startDate: task.start_date,
      endDate: task.end_date,
      canEdit: canManageTask(auth.employee, task.owner_id, task.department),
    })),
  });
}

export async function POST(request: Request) {
  if (!hasValidMutationOrigin(request)) return invalidOriginResponse();

  const auth = await requireApiEmployee();
  if (auth.response) return auth.response;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { message: "업무 등록 정보를 읽을 수 없습니다." },
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

  if (auth.employee.role !== "admin" && parsed.data.ownerId !== auth.employee.id) {
    return NextResponse.json(
      { message: "본인 업무만 등록할 수 있습니다." },
      { status: 403 },
    );
  }

  if (
    auth.employee.role !== "admin" &&
    !isSameDepartmentGroup(parsed.data.department, auth.employee.departmentCode)
  ) {
    return NextResponse.json(
      { message: "본인 소속 부서의 업무만 등록할 수 있습니다." },
      { status: 403 },
    );
  }

  const supabase = createAdminClient();

  const participantError = await validateTaskParticipants(
    supabase,
    auth.employee,
    parsed.data.participantIds,
    parsed.data.department,
  );
  if (participantError) {
    return NextResponse.json({ message: participantError }, { status: 403 });
  }

  const files = taskAttachmentFiles(formData);
  const fileError = validateTaskAttachments(files);
  if (fileError) {
    return NextResponse.json({ message: fileError }, { status: 400 });
  }

  const { data: owner } = await supabase
    .from("employees")
    .select("id, department")
    .eq("id", parsed.data.ownerId)
    .eq("account_status", "active")
    .maybeSingle();

  if (!owner) {
    return NextResponse.json(
      { message: "선택한 담당 직원을 찾을 수 없습니다." },
      { status: 400 },
    );
  }

  if (
    auth.employee.role !== "admin" &&
    !isSameDepartmentGroup(owner.department, auth.employee.departmentCode)
  ) {
    return NextResponse.json(
      { message: "다른 부서 직원의 업무는 등록할 수 없습니다." },
      { status: 403 },
    );
  }

  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      title: parsed.data.title,
      description: parsed.data.description,
      owner_id: parsed.data.ownerId,
      department: parsed.data.department,
      start_date: parsed.data.startDate,
      end_date: parsed.data.endDate,
      related_link: parsed.data.relatedLink || null,
    })
    .select("id")
    .single();

  if (error || !task) {
    return NextResponse.json(
      { message: "업무를 등록하지 못했습니다." },
      { status: 500 },
    );
  }


  if (parsed.data.participantIds.length) {
    const { error: participantInsertError } = await supabase
      .from("task_participants")
      .insert(
        parsed.data.participantIds.map((employeeId) => ({
          task_id: task.id,
          employee_id: employeeId,
        })),
      );
    if (participantInsertError) {
      await supabase.from("tasks").delete().eq("id", task.id);
      return NextResponse.json(
        { message: "참여 직원을 저장하지 못해 업무 등록을 취소했습니다." },
        { status: 500 },
      );
    }
  }

  const upload = await uploadTaskAttachments({
    supabase,
    taskId: task.id,
    files,
    uploadedBy: auth.employee.id,
  });

  if (upload.error) {
    await supabase.from("tasks").delete().eq("id", task.id);
    return NextResponse.json(
      { message: "첨부파일을 저장하지 못해 업무 등록을 취소했습니다." },
      { status: 500 },
    );
  }

  await supabase.from("activity_logs").insert({
    employee_id: auth.employee.id,
    action_type: "task.create",
    target_type: "task",
    target_id: task.id,
    changed_data: {
      title: parsed.data.title,
      owner_id: parsed.data.ownerId,
      department: parsed.data.department,
      start_date: parsed.data.startDate,
      end_date: parsed.data.endDate,
      attachment_count: files.length,
      participant_ids: parsed.data.participantIds,
    },
  });

  return NextResponse.json({ ok: true, id: task.id }, { status: 201 });
}
