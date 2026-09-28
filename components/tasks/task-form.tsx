"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  ArrowLeft,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronDown,
  FileText,
  Link2,
  Loader2,
  Paperclip,
  Save,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { departmentOptions, isSameDepartmentGroup, legacyDepartmentOptions } from "@/lib/employees/constants";
import {
  MAX_TASK_ATTACHMENT_COUNT,
  taskAttachmentAccept,
  validateTaskAttachments,
} from "@/lib/tasks/files";
import { cn } from "@/lib/utils";
import { taskFormSchema, type TaskFormInput } from "@/schemas/tasks";

type EmployeeOption = {
  id: string;
  name: string;
  position: string;
  department: string;
  departmentLabel: string;
  imageUrl: string | null;
};

type ExistingAttachment = {
  id: string;
  fileName: string;
  fileSizeBytes: number;
  downloadUrl: string;
};

type InitialTask = TaskFormInput & {
  id: string;
  attachments: ExistingAttachment[];
};

export function TaskForm({
  employees,
  currentEmployee,
  initialTask,
}: {
  employees: EmployeeOption[];
  currentEmployee: {
    id: string;
    name: string;
    role: "employee" | "admin";
    department: string;
  };
  initialTask: InitialTask | null;
}) {
  const router = useRouter();
  const isEditing = Boolean(initialTask);
  const [files, setFiles] = useState<File[]>([]);
  const [removedAttachmentIds, setRemovedAttachmentIds] = useState<string[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TaskFormInput>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: initialTask ?? {
      title: "",
      description: "",
      ownerId: currentEmployee.id,
      participantIds: [],
      department: currentEmployee.department as TaskFormInput["department"],
      startDate: today,
      endDate: today,
      relatedLink: "",
    },
  });

  const selectedOwnerId = useWatch({ control, name: "ownerId" });
  const selectedDepartment = useWatch({ control, name: "department" });
  const selectedParticipantIds = useWatch({ control, name: "participantIds" }) ?? [];
  const availableParticipants = employees.filter(
    (employee) =>
      employee.id !== selectedOwnerId && isSameDepartmentGroup(employee.department, selectedDepartment),
  );
  const keptAttachments = (initialTask?.attachments ?? []).filter(
    (attachment) => !removedAttachmentIds.includes(attachment.id),
  );

  function handleOwnerChange(ownerId: string) {
    setValue("ownerId", ownerId, { shouldValidate: true });
    setValue(
      "participantIds",
      selectedParticipantIds.filter((id) => id !== ownerId),
      { shouldValidate: true },
    );
    const owner = employees.find((employee) => employee.id === ownerId);
    if (owner) {
      setValue("department", owner.department as TaskFormInput["department"], {
        shouldValidate: true,
      });
    }
  }

  function toggleParticipant(employeeId: string) {
    const next = selectedParticipantIds.includes(employeeId)
      ? selectedParticipantIds.filter((id) => id !== employeeId)
      : [...selectedParticipantIds, employeeId];
    setValue("participantIds", next, { shouldValidate: true, shouldDirty: true });
  }

  function handleFiles(nextFiles: File[]) {
    const validationError = validateTaskAttachments(
      nextFiles,
      keptAttachments.length,
    );
    setFileError(validationError);
    if (!validationError) setFiles(nextFiles);
  }

  const onSubmit = handleSubmit(async (input) => {
    const validationError = validateTaskAttachments(files, keptAttachments.length);
    if (validationError) {
      setFileError(validationError);
      return;
    }

    setServerError(null);
    const formData = new FormData();
    Object.entries(input).forEach(([key, value]) => {
      formData.set(key, Array.isArray(value) ? JSON.stringify(value) : value);
    });
    files.forEach((file) => formData.append("attachments", file));
    formData.set("removeAttachmentIds", JSON.stringify(removedAttachmentIds));

    try {
      const response = await fetch(
        initialTask ? `/api/tasks/${initialTask.id}` : "/api/tasks",
        { method: initialTask ? "PATCH" : "POST", body: formData },
      );
      const result = (await response.json()) as { message?: string; id?: string };
      if (!response.ok) throw new Error(result.message ?? "업무를 저장하지 못했습니다.");

      if (!initialTask) window.dispatchEvent(new Event("workspace-content-created"));
      router.push(`/calendar?task=${result.id ?? initialTask?.id ?? ""}`);
    } catch (error) {
      setServerError(
        error instanceof Error ? error.message : "업무 저장 중 오류가 발생했습니다.",
      );
    }
  });

  async function handleDelete() {
    if (!initialTask || !window.confirm("이 업무를 삭제할까요? 삭제한 업무는 복구할 수 없습니다.")) return;
    setIsDeleting(true);
    setServerError(null);
    try {
      const response = await fetch(`/api/tasks/${initialTask.id}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "업무를 삭제하지 못했습니다.");
      router.push("/calendar");
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "업무 삭제 중 오류가 발생했습니다.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <section className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[980px]">
        <Link href="/calendar" className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-1 text-[13px] font-bold text-[#647169] hover:text-[#315f47]">
          <ArrowLeft className="size-4" /> 캘린더로 돌아가기
        </Link>

        <div className="mt-5 overflow-hidden rounded-[20px] border border-[#e0e6e2] bg-white shadow-[0_16px_45px_rgba(35,54,42,0.05)]">
          <div className="border-b border-[#e9edea] bg-[#fbfcfb] px-5 py-5 sm:px-8">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-[13px] bg-[#e4f5ea] text-[#356d4d]">
                <BriefcaseBusiness className="size-5" />
              </span>
              <div>
                <p className="text-[11px] font-extrabold text-[#4a7b5c]">{isEditing ? "업무 관리" : "새 업무"}</p>
                <h2 className="mt-0.5 text-[23px] font-extrabold tracking-[-0.04em] text-[#2d3932]">
                  {isEditing ? "업무 정보 수정" : "업무 등록"}
                </h2>
              </div>
            </div>
            <p className="mt-3 text-[13px] leading-6 text-[#7d8781]">
              {currentEmployee.role === "admin"
                ? "관리자는 모든 직원의 업무를 등록하고 참여 직원을 지정할 수 있습니다."
                : `${currentEmployee.name}님이 주 담당자로 등록되며, 함께할 직원을 참여자로 추가할 수 있습니다.`}
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-7 px-5 py-6 sm:px-8 sm:py-8" noValidate>
            {(serverError || fileError) && (
              <div role="alert" className="flex items-start gap-2.5 rounded-[12px] border border-[#efc7c3] bg-[#fff3f2] px-4 py-3 text-[13px] text-[#984b46]">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{serverError ?? fileError}</span>
              </div>
            )}

            <FormSection title="기본 정보" description="캘린더에 표시할 업무 정보를 입력합니다.">
              <Field label="업무 제목" error={errors.title?.message} required>
                <input {...register("title")} placeholder="예: 브랜드 사이트 2차 시안" className={inputClass} />
              </Field>
              <Field label="업무 내용" error={errors.description?.message} required>
                <textarea {...register("description")} rows={7} placeholder="업무 범위와 필요한 내용을 자세히 입력해 주세요." className={cn(inputClass, "h-auto resize-y py-3 leading-6")} />
              </Field>
            </FormSection>

            <FormSection title="담당 직원" description="주 담당자와 함께 참여할 직원을 지정합니다.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="주 담당자" error={errors.ownerId?.message} required>
                  <SelectWrap>
                    <select
                      {...register("ownerId")}
                      value={selectedOwnerId}
                      onChange={(event) => handleOwnerChange(event.target.value)}
                      disabled={currentEmployee.role !== "admin"}
                      className={cn(inputClass, "appearance-none pr-9 disabled:bg-[#f4f6f4] disabled:text-[#68736c]")}
                    >
                      {employees.map((employee) => (
                        <option key={employee.id} value={employee.id}>
                          {employee.name} · {employee.departmentLabel} · {employee.position}
                        </option>
                      ))}
                    </select>
                  </SelectWrap>
                </Field>
                <Field label="부서" error={errors.department?.message} required>
                  <SelectWrap>
                    <select
                      {...register("department", {
                        onChange: (event) => {
                          const department = String(event.target.value);
                          setValue(
                            "participantIds",
                            selectedParticipantIds.filter((employeeId) =>
                              employees.some(
                                (employee) => employee.id === employeeId && isSameDepartmentGroup(employee.department, department),
                              ),
                            ),
                            { shouldValidate: true, shouldDirty: true },
                          );
                        },
                      })}
                      className={cn(inputClass, "appearance-none pr-9")}
                    >
                      {[...departmentOptions, ...(selectedDepartment === "web" ? legacyDepartmentOptions : [])]
                        .filter(
                          (option) =>
                            currentEmployee.role === "admin" ||
                            option.value === currentEmployee.department,
                        )
                        .map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </SelectWrap>
                </Field>
              </div>
              <Field label="함께 참여하는 직원" error={errors.participantIds?.message}>
                <div className="rounded-[13px] border border-[#dce2de] bg-[#fafcfa] p-3">
                  <p className="mb-3 text-[12px] text-[#7b867f]">
                    여러 명을 선택할 수 있으며, 선택한 직원의 프로필이 업무 일정에 표시됩니다.
                  </p>
                  <div className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">
                    {availableParticipants.map((employee) => {
                      const selected = selectedParticipantIds.includes(employee.id);
                      return (
                        <button
                          key={employee.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => toggleParticipant(employee.id)}
                          className={cn(
                            "flex items-center gap-3 rounded-[11px] border px-3 py-2.5 text-left transition",
                            selected
                              ? "border-[#83bd99] bg-[#edf8f1] ring-2 ring-[#d8f0e1]"
                              : "border-[#e1e6e2] bg-white hover:border-[#b9ccc0]",
                          )}
                        >
                          <Avatar name={employee.name} imageUrl={employee.imageUrl} size="sm" className="size-8" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-extrabold text-[#3e4a43]">{employee.name}</span>
                            <span className="block truncate text-[11px] text-[#818b85]">{employee.departmentLabel} · {employee.position}</span>
                          </span>
                          <span className={cn("flex size-5 items-center justify-center rounded-full border", selected ? "border-[#4e9a6b] bg-[#4e9a6b] text-white" : "border-[#cbd4ce] bg-white")}>
                            {selected && <CheckCircle2 className="size-3.5" />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {availableParticipants.length === 0 && (
                    <p className="py-4 text-center text-[12px] text-[#8a948e]">추가할 수 있는 직원이 없습니다.</p>
                  )}
                </div>
              </Field>
            </FormSection>

            <FormSection title="업무 기간" description="시작일과 종료일을 선택합니다.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="시작일" error={errors.startDate?.message} required>
                  <input {...register("startDate")} type="date" className={inputClass} />
                </Field>
                <Field label="종료일" error={errors.endDate?.message} required>
                  <input {...register("endDate")} type="date" className={inputClass} />
                </Field>
              </div>
            </FormSection>

            <FormSection title="자료 및 링크" description="업무에 필요한 파일과 관련 페이지를 등록합니다.">
              <Field label="관련 링크" error={errors.relatedLink?.message}>
                <div className="relative">
                  <Link2 className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#8d9791]" />
                  <input {...register("relatedLink")} type="url" placeholder="https://example.com" className={cn(inputClass, "pl-10")} />
                </div>
              </Field>

              {initialTask?.attachments.length ? (
                <div>
                  <p className="mb-2 text-[12px] font-bold text-[#56615a]">등록된 첨부파일</p>
                  <div className="space-y-2">
                    {initialTask.attachments.map((attachment) => {
                      const removed = removedAttachmentIds.includes(attachment.id);
                      return (
                        <div key={attachment.id} className={cn("flex items-center gap-3 rounded-[11px] border px-3 py-2.5", removed ? "border-[#ead0cd] bg-[#fff5f4] opacity-65" : "border-[#e2e7e3] bg-[#fafbfa]")}>
                          <FileText className="size-4 shrink-0 text-[#6d7871]" />
                          <a href={attachment.downloadUrl} className={cn("min-w-0 flex-1 truncate text-[12px] font-bold text-[#4e5a53] hover:underline", removed && "line-through")}>
                            {attachment.fileName} · {formatFileSize(attachment.fileSizeBytes)}
                          </a>
                          <button type="button" onClick={() => setRemovedAttachmentIds((items) => removed ? items.filter((id) => id !== attachment.id) : [...items, attachment.id])} className="rounded-[8px] p-1.5 text-[#8b5652] hover:bg-[#f8e9e7]" aria-label={removed ? "첨부파일 삭제 취소" : "첨부파일 삭제"}>
                            {removed ? <CheckCircle2 className="size-4" /> : <X className="size-4" />}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <label className="block cursor-pointer rounded-[14px] border border-dashed border-[#cfd8d2] bg-[#fafcfa] px-5 py-6 text-center transition hover:border-[#9ec8ad] hover:bg-[#f5faf7]">
                <Paperclip className="mx-auto size-5 text-[#668171]" />
                <span className="mt-2 block text-[13px] font-bold text-[#506057]">첨부파일 선택</span>
                <span className="mt-1 block text-[11px] leading-5 text-[#8a948e]">문서, 이미지, ZIP · 신규 첨부 합계 4MB · 최대 {MAX_TASK_ATTACHMENT_COUNT}개</span>
                <input type="file" multiple accept={taskAttachmentAccept} className="sr-only" onChange={(event) => handleFiles(Array.from(event.target.files ?? []))} />
              </label>
              {files.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {files.map((file) => (
                    <span key={`${file.name}-${file.lastModified}`} className="inline-flex items-center gap-1.5 rounded-full bg-[#eef5f0] px-2.5 py-1.5 text-[11px] font-bold text-[#52645a]">
                      <FileText className="size-3.5" /> {file.name} · {formatFileSize(file.size)}
                    </span>
                  ))}
                </div>
              )}
            </FormSection>

            <div className="flex flex-col-reverse justify-between gap-3 border-t border-[#e9edea] pt-6 sm:flex-row">
              {isEditing ? (
                <Button type="button" variant="secondary" onClick={handleDelete} disabled={isDeleting || isSubmitting} className="text-[#a04d48]">
                  {isDeleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />} 업무 삭제
                </Button>
              ) : <span />}
              <div className="flex justify-end gap-2">
                <Button asChild type="button" variant="secondary"><Link href="/calendar">취소</Link></Button>
                <Button type="submit" disabled={isSubmitting || isDeleting}>
                  {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  {isEditing ? "수정 저장" : "업무 등록"}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}

const inputClass = "h-11 w-full rounded-[11px] border border-[#dce2de] bg-white px-3.5 text-[13px] font-medium text-[#354039] outline-none transition placeholder:text-[#a3aba6] hover:border-[#cbd4ce] focus:border-[#8fc7a5] focus:ring-3 focus:ring-emerald-100";

function FormSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <fieldset className="space-y-4"><legend className="text-[15px] font-extrabold text-[#354139]">{title}</legend><p className="-mt-2 text-[11px] text-[#929a95]">{description}</p>{children}</fieldset>;
}

function Field({ label, error, required, children }: { label: string; error?: string; required?: boolean; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 flex items-center gap-1 text-[12px] font-bold text-[#56615a]">{label}{required && <span className="text-[#d26b63]">*</span>}</span>{children}{error && <span className="mt-1.5 block text-[11px] font-medium text-[#b55853]">{error}</span>}</label>;
}

function SelectWrap({ children }: { children: React.ReactNode }) {
  return <div className="relative">{children}<ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-[#8b958f]" /></div>;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
