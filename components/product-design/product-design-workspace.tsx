"use client";

import koLocale from "@fullcalendar/core/locales/ko";
import type { EventContentArg, EventInput } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CalendarPlus,
  ClipboardCheck,
  CheckCircle2,
  ClipboardList,
  FileSpreadsheet,
  ImagePlus,
  LayoutDashboard,
  Loader2,
  PackageOpen,
  PenLine,
  Plus,
  Printer,
  Save,
  Sparkles,
  Trash2,
  UserRoundCog,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  PRODUCT_DESIGN_IMAGE_ACCEPT,
  PRODUCT_DESIGN_SPREADSHEET_ACCEPT,
} from "@/lib/product-design/files";
import {
  productDesignLogSchema,
  productDesignTaskSchema,
  webDesignTaskSchema,
  type ProductDesignLogInput,
  type ProductDesignTaskInput,
} from "@/schemas/product-design";

export type ProductDesignWorkLogItem = {
  id: string;
  authorName: string;
  currentStage: string;
  workContent: string;
  changeSummary: string;
  createdAt: string;
};

export type ProductDesignTaskItem = {
  id: string;
  productName: string;
  workType: "new_product" | "existing_product_update" | "planned" | "renewal" | "banner" | "html";
  imageUrl: string | null;
  detailedWorkContent: string;
  currentStage: string | null;
  workflowStatus:
    | "planned"
    | "in_progress"
    | "in_production"
    | "on_hold"
    | "awaiting_approval"
    | "completed";
  note: string | null;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  creatorName: string;
  assigneeId: string;
  assigneeName: string;
  spreadsheetUrl: string | null;
  spreadsheetFileName: string | null;
  spreadsheetSizeBytes: number | null;
  logs: ProductDesignWorkLogItem[];
};

export type ProductDesignEmployeeOption = {
  id: string;
  name: string;
};

type ProductDesignView = "register" | "planned" | "ongoing" | "dashboard" | "completed";
export type DesignWorkspaceType = "product_design" | "web_design" | "web_marketing";
type ProductDesignWorkflowStatus = ProductDesignTaskItem["workflowStatus"];
type DashboardStatusFilter = "all" | ProductDesignWorkflowStatus;

const tabs = [
  { value: "register", label: "작업등록", icon: Plus },
  { value: "planned", label: "예정 작업 등록", icon: CalendarPlus },
  { value: "ongoing", label: "진행중 작업", icon: ClipboardList },
  { value: "dashboard", label: "대시보드", icon: LayoutDashboard },
  { value: "completed", label: "완료 작업 리스트", icon: ClipboardCheck },
] as const;

export function ProductDesignWorkspace({
  workspaceType = "product_design",
  currentView,
  currentUserId,
  currentUserName,
  currentUserRole,
  employeeOptions,
  tasks,
  schemaAvailable,
}: {
  workspaceType?: DesignWorkspaceType;
  currentView: ProductDesignView;
  currentUserId: string;
  currentUserName: string;
  currentUserRole: "employee" | "admin";
  employeeOptions: ProductDesignEmployeeOption[];
  tasks: ProductDesignTaskItem[];
  schemaAvailable: boolean;
}) {
  const [dashboardStatusFilter, setDashboardStatusFilter] =
    useState<DashboardStatusFilter>("all");
  const isProductDesign = workspaceType === "product_design";
  const teamName = isProductDesign
    ? "제품 디자인팀"
    : workspaceType === "web_marketing"
      ? "마케팅 팀"
      : "웹 디자인팀";
  const basePath = isProductDesign
    ? "/web/product-design"
    : workspaceType === "web_marketing"
      ? "/web/marketing"
      : "/web/design";
  const heading = {
    register: { title: "작업등록", description: `새 ${teamName} 작업을 등록하고 예정 상태로 관리하세요.` },
    planned: { title: "예정 작업 등록", description: `추후 진행할 ${teamName} 작업을 예정 상태로 등록하세요.` },
    ongoing: { title: "진행중 작업", description: `현재 담당 중인 ${teamName} 작업과 변경 이력을 관리하세요.` },
    dashboard: { title: "대시보드", description: `${teamName} 전체 작업 현황을 한눈에 확인하세요.` },
    completed: { title: "완료 작업 리스트", description: `완료된 ${teamName} 작업과 기간별 완료 내역을 확인하세요.` },
  }[currentView];
  if (workspaceType === "web_marketing" && currentView === "register") {
    heading.title = "업무등록";
  }
  const visibleTabs = tabs.filter(
    (tab) => tab.value !== "planned" || (isProductDesign && currentUserRole === "admin"),
  );

  return (
    <section className="mx-auto w-full max-w-[1480px] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <div className="mb-5 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e2f3e8] px-3 py-1 text-[11px] font-extrabold text-[#397253]">
            <Sparkles className="size-3.5" /> {teamName}
          </span>
          <h2 className="mt-3 text-[28px] font-black tracking-[-0.045em] text-[#21342a] sm:text-[34px]">
            {heading.title}
          </h2>
          <p className="mt-1 text-[13px] text-[#7c8880]">
            {heading.description}
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 lg:items-end">
          {currentView === "dashboard" && (
            <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
              <DashboardStatusFilterButtons
                workspaceType={workspaceType}
                value={dashboardStatusFilter}
                onChange={setDashboardStatusFilter}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => window.print()}
                className="product-design-print-button h-auto shrink-0 rounded-[20px] border-0 bg-[#eff9f2] px-5 py-3 text-[14px] font-black text-[#2f6f4c] shadow-[0_8px_20px_rgba(55,113,77,0.12)] hover:bg-[#e4f5e9]"
              >
                <span className="flex size-9 items-center justify-center rounded-full bg-white text-[#397a54] shadow-sm">
                  <Printer className="size-4" />
                </span>
                대시보드 PDF 인쇄
              </Button>
            </div>
          )}
          <p className="text-[11px] font-semibold text-[#9aa39d]">
            시작일과 기록 일시는 저장 시 자동으로 기록됩니다.
          </p>
        </div>
      </div>

      <nav className="mb-5 grid gap-2 rounded-[16px] border border-[#dfe8e2] bg-white p-2 shadow-[0_8px_24px_rgba(34,63,45,0.035)] sm:grid-cols-2 md:grid-cols-4 lg:hidden">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <Link
              key={tab.value}
              href={`${basePath}?view=${tab.value}`}
              prefetch
              className={cn(
                "flex min-h-12 items-center justify-center gap-2 rounded-[11px] px-4 text-[13px] font-extrabold transition",
                currentView === tab.value
                  ? "bg-[#2f7250] text-white shadow-[0_7px_16px_rgba(47,114,80,0.2)]"
                  : "bg-[#f3f7f4] text-[#526159] hover:bg-[#eaf2ed]",
              )}
            >
              <Icon className="size-4" /> {workspaceType === "web_marketing" && tab.value === "register" ? "업무등록" : tab.label}
              {tab.value === "ongoing" && tasks.length > 0 && (
                <span className={cn("rounded-full px-2 py-0.5 text-[10px]", currentView === tab.value ? "bg-white/20" : "bg-white text-[#397253]")}>{tasks.length}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {!schemaAvailable && (
        <div className="mb-5 flex items-start gap-3 rounded-[14px] border border-[#ead29d] bg-[#fff9e8] px-4 py-3 text-[13px] font-semibold leading-5 text-[#85651f]">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          디자인 작업 데이터베이스 설정이 필요합니다. Supabase SQL Editor에서 기존 디자인 작업 SQL을 적용한 다음 <code>202609300001_web_design_html_spreadsheet.sql</code>을 실행해 주세요.
        </div>
      )}

      {currentView === "register" && (
        <ProductDesignRegistrationForm
          workspaceType={workspaceType}
          currentUserName={currentUserName}
          schemaAvailable={schemaAvailable}
          registrationMode="start_now"
        />
      )}
      {currentView === "planned" && (
        <ProductDesignRegistrationForm
          workspaceType={workspaceType}
          currentUserName={currentUserName}
          schemaAvailable={schemaAvailable}
          registrationMode="planned"
          employeeOptions={employeeOptions}
        />
      )}
      {currentView === "ongoing" && (
        <OngoingProductDesignTasks
          workspaceType={workspaceType}
          teamName={teamName}
          itemLabel={isProductDesign ? "제품" : "작업"}
          tasks={tasks}
          schemaAvailable={schemaAvailable}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          employeeOptions={employeeOptions}
        />
      )}
      {currentView === "dashboard" && (
        <ProductDesignDashboard
          workspaceType={workspaceType}
          tasks={tasks}
          teamName={teamName}
          basePath={basePath}
          itemLabel={isProductDesign ? "제품" : "작업"}
          statusFilter={dashboardStatusFilter}
        />
      )}
      {currentView === "completed" && (
        <CompletedProductDesignTasks
          workspaceType={workspaceType}
          tasks={tasks}
          teamName={teamName}
          itemLabel={isProductDesign ? "제품" : "작업"}
        />
      )}
    </section>
  );
}

function DashboardStatusFilterButtons({
  workspaceType,
  value,
  onChange,
}: {
  workspaceType: DesignWorkspaceType;
  value: DashboardStatusFilter;
  onChange: (value: DashboardStatusFilter) => void;
}) {
  const isWebWorkspace = workspaceType !== "product_design";
  const options: { value: DashboardStatusFilter; label: string }[] =
    isWebWorkspace
      ? [
          { value: "all", label: "전체" },
          { value: "planned", label: "예정" },
          { value: "in_progress", label: "작업중" },
          { value: "on_hold", label: "보류중" },
          { value: "completed", label: "완료" },
        ]
      : [
          { value: "all", label: "전체" },
          { value: "planned", label: "예정" },
          { value: "in_progress", label: "진행중" },
          { value: "in_production", label: "생산중" },
          { value: "on_hold", label: "보류중" },
          { value: "awaiting_approval", label: "컨펌 필요" },
          { value: "completed", label: "완료" },
        ];

  return (
    <div
      role="group"
      aria-label="대시보드 작업 상태 필터"
      className="flex flex-wrap items-center gap-1 rounded-[15px] border border-[#dce8df] bg-white p-1.5"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "min-h-9 rounded-[10px] px-3 text-[12px] font-extrabold transition-colors",
            value === option.value
              ? "bg-[#2f7250] text-white shadow-sm"
              : "text-[#5d6c62] hover:bg-[#eff6f1] hover:text-[#2f6848]",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function ProductDesignRegistrationForm({
  workspaceType,
  currentUserName,
  schemaAvailable,
  registrationMode,
  employeeOptions = [],
}: {
  workspaceType: DesignWorkspaceType;
  currentUserName: string;
  schemaAvailable: boolean;
  registrationMode: "start_now" | "planned";
  employeeOptions?: ProductDesignEmployeeOption[];
}) {
  const router = useRouter();
  const [image, setImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [plannedAssigneeId, setPlannedAssigneeId] = useState("");
  const [spreadsheet, setSpreadsheet] = useState<File | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    reset,
  } = useForm<ProductDesignTaskInput>({
    resolver: zodResolver(
      workspaceType === "product_design" ? productDesignTaskSchema : webDesignTaskSchema,
    ),
    defaultValues: {
      productName: "",
      workType: "new_product",
      detailedWorkContent: "",
    },
  });

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function chooseImage(file: File | null) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setImage(file);
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
    setNotice(null);
  }

  const submit = handleSubmit(async (values) => {
    if (registrationMode === "planned" && !plannedAssigneeId) {
      setNotice("예정 작업 담당자를 선택해 주세요.");
      return;
    }
    setNotice(null);
    const formData = new FormData();
    formData.set("productName", values.productName);
    if (workspaceType !== "web_marketing") {
      formData.set("workType", values.workType);
    }
    formData.set("detailedWorkContent", values.detailedWorkContent);
    if (image) formData.set("representativeImage", image);
    if (workspaceType === "web_design" && spreadsheet) {
      formData.set("spreadsheet", spreadsheet);
    }
    formData.set("registrationMode", registrationMode);
    formData.set("workspaceType", workspaceType);
    if (registrationMode === "planned") {
      formData.set("assigneeId", plannedAssigneeId);
    }

    try {
      const response = await fetch("/api/web/product-design/tasks", {
        method: "POST",
        body: formData,
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "작업을 등록하지 못했습니다.");
      reset();
      chooseImage(null);
      setSpreadsheet(null);
      window.dispatchEvent(new Event("workspace-content-created"));
      const destination = workspaceType === "product_design"
        ? "/web/product-design"
        : workspaceType === "web_marketing"
          ? "/web/marketing"
          : "/web/design";
      router.replace(`${destination}?view=ongoing`);
      router.refresh();
    } catch (error) {
      setError("root", {
        message: error instanceof Error ? error.message : "작업을 등록하지 못했습니다.",
      });
    }
  });

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="overflow-hidden rounded-[18px] border border-[#bcd8c6] bg-white shadow-[0_10px_30px_rgba(42,91,60,0.04)]">
        <SectionTitle
          title="기본 정보"
          description={workspaceType === "product_design" ? "상품과 작업 성격을 먼저 등록합니다." : workspaceType === "web_marketing" ? "업무명과 담당자 정보를 확인합니다." : "작업명과 작업 성격을 먼저 등록합니다."}
        />
        <div className="space-y-4 p-4 sm:p-6">
          <AutoField label="작업번호" value="등록 시 자동 생성" />
          {registrationMode === "planned" ? (
            <FormField label="담당자" required>
              <select
                value={plannedAssigneeId}
                onChange={(event) => {
                  setPlannedAssigneeId(event.target.value);
                  setNotice(null);
                }}
                className={inputClass}
              >
                <option value="">담당자를 선택해 주세요</option>
                {employeeOptions.map((employee) => (
                  <option key={employee.id} value={employee.id}>{employee.name}</option>
                ))}
              </select>
            </FormField>
          ) : (
            <AutoField label="담당자" value={`${currentUserName} · 로그인 정보`} />
          )}
          <AutoField label="등록일시" value="저장 시 자동 기록" />
          <FormField label={workspaceType === "product_design" ? "상품명" : "작업명"} error={errors.productName?.message} required>
            <input
              {...register("productName")}
              className={inputClass}
              placeholder={workspaceType === "product_design" ? "예: 봄꽃 클레이 액자" : "예: 가을 이벤트 페이지 제작"}
            />
          </FormField>
          {workspaceType !== "web_marketing" && (
            <FormField label="작업 구분" error={errors.workType?.message} required>
              <select {...register("workType")} className={inputClass}>
                {workspaceType === "product_design" ? (
                  <>
                    <option value="new_product">신규 제품</option>
                    <option value="existing_product_update">기존 제품 수정</option>
                    <option value="planned">예정</option>
                  </>
                ) : (
                  <>
                    <option value="new_product">신제품</option>
                    <option value="renewal">리뉴얼</option>
                    <option value="banner">배너</option>
                    {workspaceType === "web_design" && <option value="html">HTML</option>}
                  </>
                )}
              </select>
            </FormField>
          )}
          {workspaceType !== "web_marketing" && <FormField label="대표 이미지">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="relative flex h-36 w-full shrink-0 items-center justify-center overflow-hidden rounded-[14px] border border-dashed border-[#b9cbc0] bg-[#f5f8f6] sm:w-44">
                {previewUrl ? (
                  <Image src={previewUrl} alt="대표 이미지 미리보기" fill unoptimized className="object-cover" />
                ) : (
                  <div className="text-center text-[#8c9890]"><ImagePlus className="mx-auto size-7" /><span className="mt-2 block text-[11px] font-semibold">이미지 미리보기</span></div>
                )}
              </div>
              <div>
                <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-[11px] border border-[#9ebdab] bg-[#eff8f2] px-4 text-[13px] font-extrabold text-[#315f45] hover:bg-[#e5f3ea]">
                  <ImagePlus className="size-4" /> 이미지 선택
                  <input type="file" accept={PRODUCT_DESIGN_IMAGE_ACCEPT} className="sr-only" onChange={(event) => chooseImage(event.target.files?.[0] ?? null)} />
                </label>
                <p className="mt-2 text-[11px] leading-5 text-[#87928b]">선택 사항 · JPG, PNG, WEBP · 최대 5MB</p>
                {image && <p className="mt-1 max-w-xs truncate text-[11px] font-semibold text-[#526159]">{image.name}</p>}
              </div>
            </div>
          </FormField>}
        </div>
      </div>

      <div className="overflow-hidden rounded-[18px] border border-[#bcd8c6] bg-white shadow-[0_10px_30px_rgba(42,91,60,0.04)]">
        <SectionTitle title="작업 계획" description="예정된 세부 작업내용을 작성합니다." />
        <div className="p-4 sm:p-6">
          <FormField label="세부 작업내용" error={errors.detailedWorkContent?.message} required>
            <textarea
              {...register("detailedWorkContent")}
              rows={7}
              className={cn(inputClass, "h-auto resize-y py-3 leading-6")}
              placeholder={workspaceType === "product_design" ? "① 제품 도안 제작\n② 색상 선정 및 샘플 제작\n③ 구성품과 설명서 확인" : "① 화면 구성 및 시안 제작\n② 디자인 검토 및 수정\n③ 최종 결과물 전달"}
            />
          </FormField>
          {workspaceType === "web_design" && (
            <FormField label="엑셀 자료">
              <div className="rounded-[13px] border border-dashed border-[#b6cdbd] bg-[#f7faf8] p-4">
                <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-[10px] border border-[#9ebdab] bg-white px-4 text-[12px] font-extrabold text-[#315f45] transition hover:bg-[#eff8f2]">
                  <FileSpreadsheet className="size-4" /> 엑셀 파일 선택
                  <input
                    type="file"
                    accept={PRODUCT_DESIGN_SPREADSHEET_ACCEPT}
                    className="sr-only"
                    onChange={(event) => setSpreadsheet(event.target.files?.[0] ?? null)}
                  />
                </label>
                <p className="mt-2 text-[11px] leading-5 text-[#87928a]">선택 사항 · XLSX, XLS, CSV · 최대 4MB</p>
                {spreadsheet && (
                  <div className="mt-3 flex items-center gap-2 rounded-[10px] border border-[#dce8df] bg-white px-3 py-2">
                    <FileSpreadsheet className="size-4 shrink-0 text-[#397253]" />
                    <span className="min-w-0 flex-1 truncate text-[12px] font-bold text-[#45544b]">{spreadsheet.name}</span>
                    <button type="button" onClick={() => setSpreadsheet(null)} aria-label="선택한 엑셀 파일 제거" className="rounded-md p-1 text-[#7c8880] hover:bg-[#f0f4f1] hover:text-[#a44742]">
                      <X className="size-4" />
                    </button>
                  </div>
                )}
              </div>
            </FormField>
          )}
        </div>
      </div>

      {(notice || errors.root?.message) && (
        <p role="alert" className="rounded-[12px] border border-[#efc7c3] bg-[#fff3f2] px-4 py-3 text-[13px] font-semibold text-[#994f48]">{notice ?? errors.root?.message}</p>
      )}
      <div className="flex justify-end">
        <Button type="submit" className="h-11 px-6" disabled={isSubmitting || !schemaAvailable}>
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
          {registrationMode === "planned" ? "예정 작업 등록" : "작업 등록"}
        </Button>
      </div>
    </form>
  );
}

function OngoingProductDesignTasks({
  workspaceType,
  teamName,
  itemLabel,
  tasks,
  schemaAvailable,
  currentUserId,
  currentUserRole,
  employeeOptions,
}: {
  workspaceType: DesignWorkspaceType;
  teamName: string;
  itemLabel: "제품" | "작업";
  tasks: ProductDesignTaskItem[];
  schemaAvailable: boolean;
  currentUserId: string;
  currentUserRole: "employee" | "admin";
  employeeOptions: ProductDesignEmployeeOption[];
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(tasks[0]?.id ?? null);
  const selectedTask =
    tasks.find((task) => task.id === selectedId) ?? tasks[0] ?? null;

  useEffect(() => {
    const refreshAssignedTasks = () => router.refresh();
    window.addEventListener(
      "product-design-assignment-received",
      refreshAssignedTasks,
    );
    return () => {
      window.removeEventListener(
        "product-design-assignment-received",
        refreshAssignedTasks,
      );
    };
  }, [router]);

  if (!schemaAvailable || tasks.length === 0) {
    return (
      <div className="rounded-[18px] border border-[#dfe7e2] bg-white px-6 py-16 text-center">
        <PackageOpen className="mx-auto size-10 text-[#a1ada5]" />
        <h3 className="mt-4 text-lg font-extrabold text-[#405047]">등록된 작업이 없습니다.</h3>
        <p className="mt-1 text-[12px] text-[#89938d]">작업등록에서 첫 {teamName} 작업을 등록해 주세요.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-[18px] border border-[#bfd6c7] bg-white">
        <div className="hidden grid-cols-[1.35fr_0.7fr_1.5fr_0.55fr_0.42fr] bg-[#edf5ef] px-5 py-3 text-[11px] font-extrabold text-[#45564c] md:grid">
          <span>{itemLabel} · 담당자</span><span>상태 · 현재 단계</span><span>최근 작업 내용</span><span>시작일</span><span>관리</span>
        </div>
        <div className="divide-y divide-[#e7ece8]">
          {tasks.map((task) => {
            const latest = task.logs[0];
            return (
              <button key={task.id} type="button" onClick={() => setSelectedId(task.id)} className={cn("grid w-full gap-3 px-4 py-4 text-left transition hover:bg-[#f6faf7] md:grid-cols-[1.35fr_0.7fr_1.5fr_0.55fr_0.42fr] md:items-center md:px-5", selectedTask?.id === task.id && "bg-[#f0f8f3]")}> 
                <span className="flex min-w-0 items-center gap-3">
                  <TaskImage src={task.imageUrl} name={task.productName} className="size-14" />
                  <span className="min-w-0"><strong className="block truncate text-[13px] text-[#29382f]">{task.productName}</strong><small className="mt-1 block text-[10px] text-[#849087]">{workspaceType === "web_marketing" ? task.assigneeName : `${task.assigneeName} · ${workTypeLabel(task.workType)}`}</small></span>
                </span>
                <span className="space-y-1.5"><WorkflowStatusBadge status={task.workflowStatus} workspaceType={workspaceType} /><span className="block text-[11px] font-bold text-[#496154]"><MobileLabel>현재 단계</MobileLabel>{task.currentStage ?? "미입력"}</span></span>
                <span className="line-clamp-2 text-[12px] leading-5 text-[#657169]"><MobileLabel>최근 작업</MobileLabel>{latest?.workContent ?? "아직 작업 기록이 없습니다."}</span>
                <span className="text-[11px] font-semibold text-[#68756d]"><MobileLabel>시작일</MobileLabel>{formatShortDate(task.startedAt)}</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#397253]">상세 <ArrowRight className="size-3.5" /></span>
              </button>
            );
          })}
        </div>
      </div>
      {selectedTask && (
        <ProductDesignTaskDetail
          key={selectedTask.id}
          workspaceType={workspaceType}
          task={selectedTask}
          canManage={currentUserRole === "admin" || selectedTask.assigneeId === currentUserId}
          employeeOptions={employeeOptions}
        />
      )}
    </div>
  );
}

function ProductDesignTaskDetail({
  workspaceType,
  task,
  canManage,
  employeeOptions,
}: {
  workspaceType: DesignWorkspaceType;
  task: ProductDesignTaskItem;
  canManage: boolean;
  employeeOptions: ProductDesignEmployeeOption[];
}) {
  const router = useRouter();
  const isWebWorkspace = workspaceType !== "product_design";
  const [notice, setNotice] = useState<string | null>(null);
  const [managementError, setManagementError] = useState<string | null>(null);
  const [managementBusy, setManagementBusy] = useState<"transfer" | "delete" | null>(null);
  const [showTransfer, setShowTransfer] = useState(false);
  const [nextAssigneeId, setNextAssigneeId] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    resetField,
  } = useForm<ProductDesignLogInput>({
    resolver: zodResolver(productDesignLogSchema),
    defaultValues: {
      workflowStatus: task.workflowStatus,
      currentStage: task.currentStage ?? "",
      workContent: "",
      note: task.note ?? "",
    },
  });

  const submit = handleSubmit(async (values) => {
    setNotice(null);
    try {
      const response = await fetch(`/api/web/product-design/tasks/${task.id}/logs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "작업 기록을 저장하지 못했습니다.");
      resetField("workContent", { defaultValue: "" });
      setNotice("작업 기록을 저장했습니다.");
      router.refresh();
    } catch (error) {
      setError("root", { message: error instanceof Error ? error.message : "작업 기록을 저장하지 못했습니다." });
    }
  });

  async function transferTask() {
    if (!nextAssigneeId) {
      setManagementError("이관할 담당자를 선택해 주세요.");
      return;
    }
    const nextAssignee = employeeOptions.find((employee) => employee.id === nextAssigneeId);
    if (!window.confirm(`${task.productName} 작업을 ${nextAssignee?.name ?? "선택한 직원"}님에게 이관할까요?`)) return;

    setManagementBusy("transfer");
    setManagementError(null);
    try {
      const response = await fetch(`/api/web/product-design/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assigneeId: nextAssigneeId }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "담당자를 이관하지 못했습니다.");
      setShowTransfer(false);
      setNextAssigneeId("");
      setNotice(`${nextAssignee?.name ?? "새 담당자"}님에게 작업을 이관했습니다.`);
      router.refresh();
    } catch (error) {
      setManagementError(error instanceof Error ? error.message : "담당자를 이관하지 못했습니다.");
    } finally {
      setManagementBusy(null);
    }
  }

  async function deleteTask() {
    if (!window.confirm(`${task.productName} 작업과 모든 작업 이력을 삭제할까요?\n삭제한 데이터는 복구할 수 없습니다.`)) return;

    setManagementBusy("delete");
    setManagementError(null);
    try {
      const response = await fetch(`/api/web/product-design/tasks/${task.id}`, { method: "DELETE" });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "작업을 삭제하지 못했습니다.");
      router.refresh();
    } catch (error) {
      setManagementError(error instanceof Error ? error.message : "작업을 삭제하지 못했습니다.");
      setManagementBusy(null);
    }
  }

  return (
    <article className="overflow-hidden rounded-[18px] border border-[#bfd6c7] bg-white">
      <div className="flex flex-col gap-3 border-b border-[#dce8df] bg-[#edf5ef] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-[17px] font-black tracking-[-0.025em] text-[#24372c]">작업 상세 · {task.productName}</h3>
          <p className="mt-1 text-[11px] font-bold text-[#718078]">현재 담당자 · {task.assigneeName}</p>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => { setShowTransfer((value) => !value); setManagementError(null); }} disabled={Boolean(managementBusy)}>
              {showTransfer ? <X className="size-4" /> : <UserRoundCog className="size-4" />}
              {showTransfer ? "이관 닫기" : "담당자 이관"}
            </Button>
            <Button type="button" size="sm" variant="ghost" className="text-[#a44742] hover:bg-[#fff0ef] hover:text-[#913b37]" onClick={() => void deleteTask()} disabled={Boolean(managementBusy)}>
              {managementBusy === "delete" ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              작업 삭제
            </Button>
          </div>
        )}
      </div>
      {canManage && showTransfer && (
        <div className="border-b border-[#e2e9e4] bg-[#fbfdfb] px-5 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex-1">
              <span className="mb-1.5 block text-[11px] font-extrabold text-[#526158]">새 담당자</span>
              <select value={nextAssigneeId} onChange={(event) => setNextAssigneeId(event.target.value)} className={inputClass}>
                <option value="">담당자를 선택해 주세요</option>
                {employeeOptions.filter((employee) => employee.id !== task.assigneeId).map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
              </select>
            </label>
            <Button type="button" onClick={() => void transferTask()} disabled={managementBusy === "transfer" || !nextAssigneeId}>
              {managementBusy === "transfer" ? <Loader2 className="size-4 animate-spin" /> : <UserRoundCog className="size-4" />}
              이관하기
            </Button>
          </div>
          <p className="mt-2 text-[10px] text-[#849087]">이관하면 이전 담당자, 새 담당자, 처리자와 일시가 작업 이력에 자동 기록됩니다.</p>
        </div>
      )}
      {managementError && <p className="mx-5 mt-4 rounded-[10px] bg-[#fff1ef] px-3 py-2 text-[11px] font-semibold text-[#9b5149]">{managementError}</p>}
      <section className="mx-4 mt-5 rounded-[16px] border border-[#bcd8c6] bg-[#f3f9f5] p-5 shadow-[0_5px_18px_rgba(45,100,65,0.06)] sm:mx-6 sm:p-6">
        <div className="flex items-center gap-2.5 border-b border-[#d8e9dd] pb-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-[#dff1e4] text-[#34734e]">
            <ClipboardList className="size-[18px]" />
          </span>
          <h4 className="text-[15px] font-black text-[#294b36] sm:text-[17px]">세부 작업내용</h4>
        </div>
        <p className="mt-4 min-h-20 whitespace-pre-wrap text-[15px] font-medium leading-7 text-[#43564a] sm:text-[16px] sm:leading-8">
          {task.detailedWorkContent}
        </p>
        {task.spreadsheetUrl && task.spreadsheetFileName && (
          <a
            href={task.spreadsheetUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 flex min-h-12 items-center gap-3 rounded-[11px] border border-[#cfe1d4] bg-white px-4 py-3 text-[#315f45] transition hover:border-[#9ebdab] hover:bg-[#fbfdfb]"
          >
            <FileSpreadsheet className="size-5 shrink-0" />
            <span className="min-w-0 flex-1 truncate text-[12px] font-extrabold sm:text-[13px]">{task.spreadsheetFileName}</span>
            <span className="shrink-0 text-[11px] font-bold">엑셀 자료 열기</span>
          </a>
        )}
      </section>
      <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[0.85fr_1.15fr]">
        <div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-[15px] bg-[#f3f6f4]">
            {task.imageUrl ? <Image src={task.imageUrl} alt={task.productName} fill unoptimized className="object-cover" /> : <PackageOpen className="absolute inset-0 m-auto size-10 text-[#a8b2ac]" />}
          </div>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <FormField label="작업 상태" error={errors.workflowStatus?.message} required>
            <select {...register("workflowStatus")} className={inputClass}>
              <option value="planned">예정</option>
              <option value="in_progress">{isWebWorkspace ? "작업중" : "진행중"}</option>
              {!isWebWorkspace && (
                <>
                  <option value="in_production">생산중</option>
                  <option value="on_hold">보류중</option>
                  <option value="awaiting_approval">컨펌 필요</option>
                </>
              )}
              <option value="completed">완료</option>
            </select>
          </FormField>
          <FormField label="현재 단계" error={errors.currentStage?.message} required>
            <input {...register("currentStage")} className={inputClass} placeholder={isWebWorkspace ? "예: 상세 작업" : "예: 샘플 제작"} />
          </FormField>
          <FormField label="오늘 작업내용" error={errors.workContent?.message} required>
            <textarea {...register("workContent")} rows={5} className={cn(inputClass, "h-auto resize-y py-3 leading-6")} placeholder="오늘 진행한 작업과 변경 내용을 적어 주세요." />
          </FormField>
          <FormField label="비고" error={errors.note?.message}>
            <textarea {...register("note")} rows={3} className={cn(inputClass, "h-auto resize-y py-3 leading-6")} placeholder="다음 조치나 공유할 내용을 적어 주세요." />
          </FormField>
          {(notice || errors.root?.message) && <p className={cn("rounded-[10px] px-3 py-2 text-[11px] font-semibold", errors.root?.message ? "bg-[#fff1ef] text-[#9b5149]" : "bg-[#edf8f1] text-[#397253]")}>{errors.root?.message ?? notice}</p>}
          <div className="flex justify-end"><Button type="submit" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} 작업 기록 저장</Button></div>
        </form>
      </div>
      <div className="mx-4 mb-4 overflow-hidden rounded-[14px] border border-[#dde7e0] sm:mx-6 sm:mb-6">
        <div className="flex items-center gap-2 bg-[#f1f6f2] px-4 py-3"><PenLine className="size-4 text-[#47735a]" /><h4 className="text-[13px] font-extrabold text-[#33483b]">날짜별 작업 · 수정 이력</h4></div>
        {task.logs.length === 0 ? <p className="px-4 py-7 text-center text-[12px] text-[#8c968f]">저장된 작업 기록이 없습니다.</p> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left"><thead className="bg-[#f8faf8] text-[10px] font-extrabold text-[#6f7b73]"><tr><th className="px-4 py-2.5">일시</th><th className="px-4 py-2.5">작성자</th><th className="px-4 py-2.5">변경 내용</th></tr></thead><tbody className="divide-y divide-[#e8ede9]">{task.logs.map((log) => <tr key={log.id} className="text-[11px] text-[#56635b]"><td className="whitespace-nowrap px-4 py-3 font-semibold">{formatDateTime(log.createdAt)}</td><td className="whitespace-nowrap px-4 py-3 font-bold">{log.authorName}</td><td className="px-4 py-3 leading-5">{log.changeSummary}</td></tr>)}</tbody></table></div>
        )}
      </div>
    </article>
  );
}

function ProductDesignDashboard({
  workspaceType,
  tasks,
  teamName,
  basePath,
  itemLabel,
  statusFilter,
}: {
  workspaceType: DesignWorkspaceType;
  tasks: ProductDesignTaskItem[];
  teamName: string;
  basePath: string;
  itemLabel: "제품" | "작업";
  statusFilter: DashboardStatusFilter;
}) {
  const latestWorkAt = (task: ProductDesignTaskItem) =>
    Date.parse(task.logs[0]?.createdAt ?? task.updatedAt ?? task.createdAt);
  const sortedTasks = [...tasks].sort(
    (left, right) => latestWorkAt(right) - latestWorkAt(left),
  );
  const visibleTasks = statusFilter === "all"
    ? sortedTasks
    : sortedTasks.filter((task) => task.workflowStatus === statusFilter);
  const cards = workspaceType !== "product_design"
    ? [
        { label: "전체", value: tasks.length, color: "text-[#205f42]" },
        { label: "예정", value: tasks.filter((task) => task.workflowStatus === "planned").length, color: "text-[#69766e]" },
        { label: "작업중", value: tasks.filter((task) => task.workflowStatus === "in_progress").length, color: "text-[#2866b2]" },
        { label: "보류중", value: tasks.filter((task) => task.workflowStatus === "on_hold").length, color: "text-[#b66713]" },
        { label: "완료", value: tasks.filter((task) => task.workflowStatus === "completed").length, color: "text-[#267440]" },
      ]
    : [
        { label: "전체", value: tasks.length, color: "text-[#205f42]" },
        { label: "예정", value: tasks.filter((task) => task.workflowStatus === "planned").length, color: "text-[#69766e]" },
        { label: "진행중", value: tasks.filter((task) => task.workflowStatus === "in_progress").length, color: "text-[#2866b2]" },
        { label: "생산중", value: tasks.filter((task) => task.workflowStatus === "in_production").length, color: "text-[#b66713]" },
        { label: "보류중", value: tasks.filter((task) => task.workflowStatus === "on_hold").length, color: "text-[#9a6a1f]" },
        { label: "완료", value: tasks.filter((task) => task.workflowStatus === "completed").length, color: "text-[#267440]" },
      ];
  const activeTasks = visibleTasks.filter((task) => task.workflowStatus !== "completed");
  const tasksByDesigner = new Map<string, ProductDesignTaskItem[]>();
  activeTasks.forEach((task) => {
    const designerTasks = tasksByDesigner.get(task.assigneeName) ?? [];
    designerTasks.push(task);
    tasksByDesigner.set(task.assigneeName, designerTasks);
  });

  return (
    <div className="product-design-dashboard-print-area space-y-7">
        <header className="product-design-print-heading hidden">
          <p>파스텔크래프트</p>
          <h1>{teamName} 대시보드</h1>
        </header>
      <div className="product-design-summary-cards overflow-hidden rounded-[18px] border border-[#d8e5dc] bg-[#f0f7f2] shadow-[0_10px_28px_rgba(40,83,55,0.04)]">
        <div className={cn("grid grid-cols-2", workspaceType !== "product_design" ? "sm:grid-cols-5" : "sm:grid-cols-6")}>
          {cards.map((card, index) => (
            <div
              key={card.label}
              className={cn(
                "px-4 py-5 text-center sm:py-6",
                index > 0 && "border-l border-[#d4e1d8]",
                index > 0 && index % 2 === 0 && "border-l-0 sm:border-l",
                cards.length % 2 === 1 && index === cards.length - 1 && "col-span-2 sm:col-span-1",
              )}
            >
              <span className="text-[12px] font-extrabold text-[#4e6055]">{card.label}</span>
              <strong className={cn("mt-2 block text-[34px] font-black leading-none", card.color)}>{card.value}</strong>
            </div>
          ))}
        </div>
      </div>

      <section className="product-design-summary-section">
        <DashboardSectionTitle>{itemLabel}별 진행 및 수정 요약</DashboardSectionTitle>
        <div className="mt-3 overflow-x-auto rounded-[16px] border border-[#cbded1] bg-white">
          <table className="product-design-summary-table w-full min-w-[1040px] table-fixed border-collapse text-left [&_td+td]:border-l [&_td+td]:border-[#d8e4dc] [&_th+th]:border-l [&_th+th]:border-[#c9d9ce]">
            <thead className="bg-[#edf5ef] text-[11px] font-extrabold text-[#3f5548]">
              <tr><th className="w-[20%] px-4 py-3">{itemLabel} 이름</th><th className="w-[8%] px-3 py-3">담당자</th><th className="w-[15%] px-4 py-3">상태</th><th className="w-[13%] px-4 py-3">등록일 / 종료일</th><th className="w-[30%] px-4 py-3">작업내용</th><th className="w-[14%] px-4 py-3">비고</th></tr>
            </thead>
            <tbody className="divide-y divide-[#dfe8e2]">
              {visibleTasks.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-14 text-center text-[12px] text-[#909a94]">등록된 {teamName} 작업이 없습니다.</td></tr>
              ) : visibleTasks.map((task) => (
                <tr key={task.id} className="align-top text-[11px] text-[#536158] hover:bg-[#f9fbf9]">
                  <td className="px-4 py-4"><div className="flex items-center gap-3"><TaskImage src={task.imageUrl} name={task.productName} className="size-14" /><strong className="min-w-0 truncate text-[14px] text-[#27382e]">{task.productName}</strong></div></td>
                  <td className="px-4 py-4"><strong className="text-[15px] font-black text-[#344a3d]">{task.assigneeName}</strong></td>
                  <td className="px-4 py-4"><WorkflowStatusBadge status={task.workflowStatus} workspaceType={workspaceType} /><p className="mt-2 font-bold leading-5 text-[#52645a]">{task.currentStage ?? "현재 단계 미입력"}</p></td>
                  <td className="px-4 py-4 font-semibold leading-5 text-[#65736a]">{formatShortDate(task.startedAt)}<span className="mx-1">/</span>{task.completedAt ? formatShortDate(task.completedAt) : "—"}</td>
                  <td className="px-4 py-4">{task.logs.length === 0 ? <span className="text-[#9ba49e]">작업 기록 없음</span> : <ul className="space-y-2">{task.logs.slice(0, 3).map((log) => <li key={log.id} className="leading-5"><span className="mr-2 font-extrabold text-[#708078]">{formatDashboardLogDate(log.createdAt)}</span>{log.changeSummary}</li>)}</ul>}</td>
                  <td className="whitespace-pre-wrap px-4 py-4 font-semibold leading-5 text-[#5c685f]">{task.note || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="product-design-designer-section">
        <DashboardSectionTitle>디자이너별 진행 현황</DashboardSectionTitle>
        {tasksByDesigner.size === 0 ? (
          <div className="mt-3 rounded-[15px] border border-[#dce7df] bg-white px-5 py-10 text-center text-[12px] text-[#929c96]">현재 진행 중인 작업이 없습니다.</div>
        ) : (
          <div className="product-design-designer-grid mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {[...tasksByDesigner.entries()].map(([designer, designerTasks]) => (
              <article key={designer} className="rounded-[15px] border border-[#cfe1d4] bg-[#f7fbf8] p-4">
                <div className="product-design-designer-heading flex items-center gap-4"><span className="flex size-12 items-center justify-center rounded-full bg-[#43825e] text-xl font-black text-white">{designer.slice(0, 1)}</span><div><h4 className="text-[20px] font-black tracking-[-0.03em] text-[#2f4136]">{designer} · {designerTasks.length}건</h4><p className="mt-1 text-[12px] font-semibold text-[#839087]">현재 진행 중인 {teamName} 작업</p></div></div>
                <div className="mt-4 space-y-2.5">{designerTasks.map((task) => <Link key={task.id} href={`${basePath}?view=ongoing`} className="product-design-designer-task flex min-h-14 items-center justify-between gap-4 rounded-[11px] border border-[#e0e9e3] bg-white px-4 py-3 hover:bg-[#edf6f0]"><strong className="product-design-designer-product-name min-w-0 truncate text-[17px] font-extrabold text-[#34463b]">{task.productName}</strong><WorkflowStatusBadge status={task.workflowStatus} workspaceType={workspaceType} /></Link>)}</div>
              </article>
            ))}
          </div>
        )}
      </section>

      <DashboardHistoryCalendar
        tasks={visibleTasks}
        workspaceType={workspaceType}
        itemLabel={itemLabel}
        teamName={teamName}
      />
    </div>
  );
}

function CompletedProductDesignTasks({
  workspaceType,
  tasks,
  teamName,
  itemLabel,
}: {
  workspaceType: DesignWorkspaceType;
  tasks: ProductDesignTaskItem[];
  teamName: string;
  itemLabel: "제품" | "작업";
}) {
  const completedTasks = [...tasks]
    .filter((task) => task.workflowStatus === "completed")
    .sort((left, right) => {
      const leftDate = Date.parse(left.completedAt ?? left.updatedAt);
      const rightDate = Date.parse(right.completedAt ?? right.updatedAt);
      return rightDate - leftDate;
    });

  return (
    <div className="space-y-7">
      <div className="rounded-[16px] border border-[#cde2d2] bg-[#f0f8f2] px-5 py-4">
        <span className="text-[12px] font-extrabold text-[#4e6055]">완료 작업</span>
        <strong className="mt-1 block text-[30px] font-black leading-none text-[#267440]">
          {completedTasks.length}건
        </strong>
      </div>

      <section>
        <DashboardSectionTitle>완료된 {itemLabel} 목록</DashboardSectionTitle>
        <div className="mt-3 overflow-x-auto rounded-[16px] border border-[#cbded1] bg-white">
          <table className="product-design-summary-table w-full min-w-[980px] table-fixed border-collapse text-left [&_td+td]:border-l [&_td+td]:border-[#d8e4dc] [&_th+th]:border-l [&_th+th]:border-[#c9d9ce]">
            <thead className="bg-[#edf5ef] text-[11px] font-extrabold text-[#3f5548]">
              <tr>
                <th className="w-[23%] px-4 py-3">{itemLabel} 이름</th>
                <th className="w-[14%] px-4 py-3">담당자</th>
                <th className="w-[14%] px-4 py-3">등록일</th>
                <th className="w-[14%] px-4 py-3">종료일</th>
                <th className="w-[35%] px-4 py-3">최근 작업내용</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#dfe8e2]">
              {completedTasks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-14 text-center text-[12px] text-[#909a94]">
                    완료된 {teamName} 작업이 없습니다.
                  </td>
                </tr>
              ) : (
                completedTasks.map((task) => (
                  <tr key={task.id} className="align-top text-[11px] text-[#536158] hover:bg-[#f9fbf9]">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <TaskImage src={task.imageUrl} name={task.productName} className="size-12" />
                        <strong className="min-w-0 truncate text-[14px] text-[#27382e]">{task.productName}</strong>
                      </div>
                    </td>
                    <td className="px-4 py-4"><strong className="text-[14px] font-black text-[#344a3d]">{task.assigneeName}</strong></td>
                    <td className="px-4 py-4 font-semibold text-[#65736a]">{formatShortDate(task.createdAt)}</td>
                    <td className="px-4 py-4 font-semibold text-[#65736a]">{formatShortDate(task.completedAt ?? task.updatedAt)}</td>
                    <td className="px-4 py-4">
                      {task.logs.length === 0 ? (
                        <span className="text-[#9ba49e]">작업 기록 없음</span>
                      ) : (
                        <ul className="space-y-2">
                          {task.logs.slice(0, 3).map((log) => (
                            <li key={log.id} className="leading-5">
                              <span className="mr-2 font-extrabold text-[#708078]">{formatDashboardLogDate(log.createdAt)}</span>
                              {log.changeSummary}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <CompletedTasksCalendar
        tasks={completedTasks}
        workspaceType={workspaceType}
        itemLabel={itemLabel}
        teamName={teamName}
      />
    </div>
  );
}

function CompletedTasksCalendar({
  tasks,
  workspaceType,
  itemLabel,
  teamName,
}: {
  tasks: ProductDesignTaskItem[];
  workspaceType: DesignWorkspaceType;
  itemLabel: "제품" | "작업";
  teamName: string;
}) {
  const today = calendarDateValue(new Date().toISOString());
  const monthStart = `${today.slice(0, 7)}-01`;
  const calendarRef = useRef<FullCalendar | null>(null);
  const [selectedRange, setSelectedRange] = useState({ start: monthStart, end: today });
  const [rangeStart, setRangeStart] = useState(monthStart);
  const [rangeEnd, setRangeEnd] = useState(today);

  const events = useMemo<EventInput[]>(
    () => tasks.map((task) => {
      const completedDate = calendarDateValue(task.completedAt ?? task.updatedAt);
      return {
        id: `${task.id}:completed`,
        title: `완료 · ${task.productName}`,
        start: completedDate,
        allDay: true,
        backgroundColor: "#e6f7e9",
        borderColor: "#8dd19d",
        textColor: "#267440",
      };
    }),
    [tasks],
  );
  const rangeTasks = useMemo(
    () => tasks.filter((task) => {
      const completedDate = calendarDateValue(task.completedAt ?? task.updatedAt);
      return completedDate >= selectedRange.start && completedDate <= selectedRange.end;
    }),
    [selectedRange, tasks],
  );

  function applyRange(start: string, end: string) {
    if (!start || !end) return;
    const normalized = start <= end ? { start, end } : { start: end, end: start };
    setRangeStart(normalized.start);
    setRangeEnd(normalized.end);
    setSelectedRange(normalized);
    calendarRef.current?.getApi().gotoDate(normalized.start);
  }

  return (
    <section className="rounded-[18px] border border-[#d5e3d9] bg-white p-4 shadow-[0_10px_28px_rgba(40,83,55,0.035)] sm:p-6">
      <div className="mb-5 flex flex-col justify-between gap-3 border-b border-[#e8eee9] pb-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-[12px] bg-[#e7f5eb] text-[#377451]"><CalendarDays className="size-5" /></span>
          <div>
            <h3 className="text-[17px] font-black text-[#294232]">완료일 캘린더</h3>
            <p className="mt-1 text-[11px] font-semibold text-[#849087]">캘린더에서 날짜를 누르거나 드래그해 기간을 선택하면 완료된 {itemLabel}이 표시됩니다.</p>
          </div>
        </div>
      </div>

      <form
        className="mb-5 flex flex-col gap-3 rounded-[13px] border border-[#dce8df] bg-[#f7faf8] p-4 sm:flex-row sm:items-end"
        onSubmit={(event) => { event.preventDefault(); applyRange(rangeStart, rangeEnd); }}
      >
        <label className="flex-1">
          <span className="mb-1.5 block text-[11px] font-extrabold text-[#526158]">기간 시작일</span>
          <input type="date" value={rangeStart} onChange={(event) => setRangeStart(event.target.value)} className={inputClass} />
        </label>
        <label className="flex-1">
          <span className="mb-1.5 block text-[11px] font-extrabold text-[#526158]">기간 종료일</span>
          <input type="date" value={rangeEnd} onChange={(event) => setRangeEnd(event.target.value)} className={inputClass} />
        </label>
        <Button type="submit" className="h-11 px-5" disabled={!rangeStart || !rangeEnd}>기간 조회</Button>
        <Button type="button" variant="secondary" className="h-11 px-4" onClick={() => applyRange(monthStart, today)}>이번 달</Button>
      </form>

      <div className="pc-calendar overflow-x-auto pb-2">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          initialDate={monthStart}
          locale={koLocale}
          firstDay={0}
          height="auto"
          selectable
          selectMirror
          events={events}
          select={(selection) => applyRange(selection.startStr, previousCalendarDate(selection.endStr))}
          dateClick={(selection) => applyRange(selection.dateStr, selection.dateStr)}
          eventContent={renderDesignHistoryEvent}
          dayMaxEvents={3}
          headerToolbar={{ left: "prev,next today", center: "title", right: "" }}
          buttonText={{ today: "오늘" }}
          moreLinkText={(count) => `+${count}건 더보기`}
          noEventsText="완료된 작업이 없습니다."
        />
      </div>

      <div className="mt-5 overflow-hidden rounded-[14px] border border-[#dce7df]">
        <div className="flex flex-col justify-between gap-2 bg-[#eef6f0] px-4 py-3 sm:flex-row sm:items-center">
          <h4 className="text-[14px] font-black text-[#304b39]">선택 기간 완료 작업</h4>
          <span className="text-[11px] font-bold text-[#6f7d74]">{`${formatCalendarDate(selectedRange.start)} ~ ${formatCalendarDate(selectedRange.end)} · ${rangeTasks.length}건`}</span>
        </div>
        {rangeTasks.length === 0 ? (
          <p className="px-5 py-10 text-center text-[12px] font-semibold text-[#929c96]">선택한 기간에 완료된 {teamName} 작업이 없습니다.</p>
        ) : (
          <div className="divide-y divide-[#e2e9e4]">
            {rangeTasks.map((task) => (
              <article key={task.id} className="grid gap-3 px-4 py-4 lg:grid-cols-[0.9fr_0.55fr_1.8fr] lg:items-start">
                <div className="flex items-center gap-3">
                  <TaskImage src={task.imageUrl} name={task.productName} className="size-12" />
                  <div>
                    <strong className="block text-[14px] font-black text-[#2f4136]">{task.productName}</strong>
                    <span className="mt-1 block text-[11px] font-bold text-[#7b8880]">담당자 · {task.assigneeName}</span>
                  </div>
                </div>
                <div>
                  <WorkflowStatusBadge status="completed" workspaceType={workspaceType} />
                  <p className="mt-2 text-[10px] font-semibold text-[#7b8780]">{formatCalendarDate(calendarDateValue(task.completedAt ?? task.updatedAt))} 완료</p>
                </div>
                <div>
                  {task.logs.length === 0 ? (
                    <p className="text-[11px] leading-5 text-[#8a948e]">저장된 작업 기록이 없습니다.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {task.logs.slice(0, 3).map((log) => (
                        <li key={log.id} className="flex gap-3 text-[11px] leading-5 text-[#56645b]">
                          <time className="shrink-0 font-extrabold text-[#718078]">{formatCalendarDate(calendarDateValue(log.createdAt))}</time>
                          <span>{log.changeSummary}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function DashboardHistoryCalendar({
  tasks,
  workspaceType,
  itemLabel,
  teamName,
}: {
  tasks: ProductDesignTaskItem[];
  workspaceType: DesignWorkspaceType;
  itemLabel: "제품" | "작업";
  teamName: string;
}) {
  const today = calendarDateValue(new Date().toISOString());
  const calendarRef = useRef<FullCalendar | null>(null);
  const [selectedRange, setSelectedRange] = useState<{
    start: string;
    end: string;
  }>({ start: today, end: today });
  const [rangeStart, setRangeStart] = useState(today);
  const [rangeEnd, setRangeEnd] = useState(today);

  useEffect(() => {
    const clearCalendarPrintMode = () => {
      document.body.classList.remove("product-design-calendar-print-mode");
    };
    window.addEventListener("afterprint", clearCalendarPrintMode);
    return () => {
      window.removeEventListener("afterprint", clearCalendarPrintMode);
      clearCalendarPrintMode();
    };
  }, []);
  const events = useMemo<EventInput[]>(
    () =>
      tasks.flatMap((task) => {
        const taskEvents: EventInput[] = [
          {
            id: `${task.id}:start`,
            title: `시작 · ${task.productName}`,
            start: calendarDateValue(task.startedAt),
            allDay: true,
            backgroundColor: "#e5f4ea",
            borderColor: "#78ae8a",
            textColor: "#245b3d",
          },
        ];
        if (task.completedAt) {
          taskEvents.push({
            id: `${task.id}:completed`,
            title: `완료 · ${task.productName}`,
            start: calendarDateValue(task.completedAt),
            allDay: true,
            backgroundColor: "#e8f1ff",
            borderColor: "#7da9df",
            textColor: "#275f9c",
          });
        }
        return taskEvents;
      }),
    [tasks],
  );
  const rangeTasks = useMemo(() => {
    return tasks.filter((task) => {
      const started = calendarDateValue(task.startedAt);
      const completed = task.completedAt
        ? calendarDateValue(task.completedAt)
        : null;
      return started <= selectedRange.end && (!completed || completed >= selectedRange.start);
    });
  }, [selectedRange, tasks]);

  function applyRange(start: string, end: string) {
    if (!start || !end) return;
    const normalized = start <= end
      ? { start, end }
      : { start: end, end: start };
    setRangeStart(normalized.start);
    setRangeEnd(normalized.end);
    setSelectedRange(normalized);
    calendarRef.current?.getApi().gotoDate(normalized.start);
  }

  function printCalendarHistory() {
    document.body.classList.add("product-design-calendar-print-mode");
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => window.print());
    });
  }

  return (
    <section className="product-design-dashboard-interactive rounded-[18px] border border-[#d5e3d9] bg-white p-4 shadow-[0_10px_28px_rgba(40,83,55,0.035)] sm:p-6">
      <header className="product-design-calendar-print-heading hidden">
        <p>파스텔크래프트 · {teamName}</p>
        <h1>작업 캘린더 및 기간별 작업 이력</h1>
        <span>{formatCalendarDate(selectedRange.start)} ~ {formatCalendarDate(selectedRange.end)}</span>
      </header>
      <div className="product-design-calendar-screen-heading mb-5 flex flex-col justify-between gap-3 border-b border-[#e8eee9] pb-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-[12px] bg-[#e7f5eb] text-[#377451]">
            <CalendarDays className="size-5" />
          </span>
          <div>
            <h3 className="text-[17px] font-black text-[#294232]">작업 시작·완료 캘린더</h3>
            <p className="mt-1 text-[11px] font-semibold text-[#849087]">날짜를 누르거나 드래그해 기간을 선택하면 해당 기간의 진행 이력을 확인할 수 있습니다.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
          <span className="rounded-full border border-[#a8ceb4] bg-[#e5f4ea] px-3 py-1.5 text-[#2e6847]">시작일</span>
          <span className="rounded-full border border-[#a8c3e5] bg-[#e8f1ff] px-3 py-1.5 text-[#315f94]">완료일</span>
          <Button
            type="button"
            variant="secondary"
            onClick={printCalendarHistory}
            className="product-design-calendar-print-button h-10 rounded-[12px] border border-[#b8d1c0] bg-white px-4 text-[12px] font-black text-[#326a49] hover:bg-[#edf7f0]"
          >
            <Printer className="size-4" />
            선택 기간 인쇄
          </Button>
        </div>
      </div>

      <form
        className="product-design-calendar-controls mb-5 flex flex-col gap-3 rounded-[13px] border border-[#dce8df] bg-[#f7faf8] p-4 sm:flex-row sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          applyRange(rangeStart, rangeEnd);
        }}
      >
        <label className="flex-1">
          <span className="mb-1.5 block text-[11px] font-extrabold text-[#526158]">조회 시작일</span>
          <input
            type="date"
            value={rangeStart}
            onChange={(event) => setRangeStart(event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex-1">
          <span className="mb-1.5 block text-[11px] font-extrabold text-[#526158]">조회 종료일</span>
          <input
            type="date"
            value={rangeEnd}
            onChange={(event) => setRangeEnd(event.target.value)}
            className={inputClass}
          />
        </label>
        <Button type="submit" className="h-11 px-5" disabled={!rangeStart || !rangeEnd}>
          선택 날짜 기록 조회
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="h-11 px-4"
          onClick={() => applyRange(today, today)}
        >
          오늘
        </Button>
      </form>

      <div className="pc-calendar product-design-history-calendar overflow-x-auto pb-2">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          locale={koLocale}
          firstDay={0}
          height="auto"
          selectable
          selectMirror
          events={events}
          select={(selection) =>
            applyRange(selection.startStr, previousCalendarDate(selection.endStr))
          }
          dateClick={(selection) => applyRange(selection.dateStr, selection.dateStr)}
          eventContent={renderDesignHistoryEvent}
          dayMaxEvents={3}
          headerToolbar={{ left: "prev,next today", center: "title", right: "" }}
          buttonText={{ today: "오늘" }}
          moreLinkText={(count) => `+${count}건 더보기`}
          noEventsText="표시할 작업 일정이 없습니다."
        />
      </div>

      <div className="mt-5 overflow-hidden rounded-[14px] border border-[#dce7df]">
        <div className="flex flex-col justify-between gap-2 bg-[#eef6f0] px-4 py-3 sm:flex-row sm:items-center">
          <h4 className="text-[14px] font-black text-[#304b39]">선택 기간 작업 이력</h4>
          <span className="text-[11px] font-bold text-[#6f7d74]">
            {`${formatCalendarDate(selectedRange.start)} ~ ${formatCalendarDate(selectedRange.end)} · ${rangeTasks.length}건`}
          </span>
        </div>
        {rangeTasks.length === 0 ? (
          <p className="px-5 py-10 text-center text-[12px] font-semibold text-[#929c96]">선택한 기간에 진행된 작업이 없습니다.</p>
        ) : (
          <div className="divide-y divide-[#e2e9e4]">
            {rangeTasks.map((task) => {
              const history = designHistoryInRange(task, selectedRange);
              const completedInRange = Boolean(
                task.completedAt && calendarDateValue(task.completedAt) <= selectedRange.end,
              );
              return (
                <article key={task.id} className="grid gap-3 px-4 py-4 lg:grid-cols-[1.1fr_0.55fr_2fr] lg:items-start">
                  <div>
                    <strong className="block text-[14px] font-black text-[#2f4136]">{task.productName}</strong>
                    <span className="mt-1 block text-[11px] font-bold text-[#7b8880]">담당자 · {task.assigneeName}</span>
                  </div>
                  <div>
                    <WorkflowStatusBadge
                      status={completedInRange ? "completed" : "in_progress"}
                      workspaceType={workspaceType}
                    />
                    <p className="mt-2 text-[10px] font-semibold text-[#7b8780]">{formatCalendarDate(calendarDateValue(task.startedAt))} 시작</p>
                  </div>
                  <div>
                    {history.length === 0 ? (
                      <p className="text-[11px] leading-5 text-[#8a948e]">선택 기간에 별도 기록은 없지만 이 {itemLabel}은 진행 중이었습니다.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {history.map((entry) => (
                          <li key={entry.key} className="flex gap-3 text-[11px] leading-5 text-[#56645b]">
                            <time className="shrink-0 font-extrabold text-[#718078]">{formatCalendarDate(entry.date)}</time>
                            <span>{entry.content}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function renderDesignHistoryEvent(arg: EventContentArg) {
  return (
    <span className="block min-w-0 truncate px-1 py-0.5 text-[10px] font-extrabold">
      {arg.event.title}
    </span>
  );
}

function designHistoryInRange(
  task: ProductDesignTaskItem,
  range: { start: string; end: string },
) {
  const entries: { key: string; date: string; content: string }[] = [];
  const startedAt = calendarDateValue(task.startedAt);
  if (startedAt >= range.start && startedAt <= range.end) {
    entries.push({ key: `${task.id}:started`, date: startedAt, content: "작업 시작" });
  }
  task.logs.forEach((log) => {
    const date = calendarDateValue(log.createdAt);
    if (date >= range.start && date <= range.end) {
      entries.push({ key: log.id, date, content: log.changeSummary });
    }
  });
  if (task.completedAt) {
    const completedAt = calendarDateValue(task.completedAt);
    if (completedAt >= range.start && completedAt <= range.end) {
      entries.push({ key: `${task.id}:completed`, date: completedAt, content: "작업 완료" });
    }
  }
  return entries.sort((a, b) => a.date.localeCompare(b.date));
}

function calendarDateValue(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function previousCalendarDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function formatCalendarDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${year}.${month}.${day}`;
}

function DashboardSectionTitle({ children }: { children: React.ReactNode }) { return <div className="flex items-center gap-4"><h3 className="shrink-0 text-[19px] font-black tracking-[-0.03em] text-[#23402f]">{children}</h3><span className="h-px flex-1 bg-[#8eb49b]" /></div>; }

function WorkflowStatusBadge({ status, compact = false, workspaceType = "product_design" }: { status: ProductDesignTaskItem["workflowStatus"]; compact?: boolean; workspaceType?: DesignWorkspaceType }) {
  const styles: Record<ProductDesignTaskItem["workflowStatus"], string> = {
    planned: "border-[#b9c2bc] bg-[#f3f5f4] text-[#59665e] before:bg-[#7d8981]",
    in_progress: "border-[#8cbdec] bg-[#e8f3ff] text-[#1f67ad] before:bg-[#2784d6]",
    in_production: "border-[#efb770] bg-[#fff2df] text-[#a45b10] before:bg-[#df841b]",
    on_hold: "border-[#e7c16f] bg-[#fff6dc] text-[#8c641c] before:bg-[#d09a24]",
    awaiting_approval: "border-[#c6a4e9] bg-[#f3eaff] text-[#7040a0] before:bg-[#8e52c2]",
    completed: "border-[#8dd19d] bg-[#e6f7e9] text-[#267440] before:bg-[#2c9b4d]",
  };
  return <span className={cn("inline-flex items-center rounded-[9px] border font-extrabold shadow-[0_2px_6px_rgba(37,63,46,0.06)] before:mr-1.5 before:size-2 before:shrink-0 before:rounded-full before:content-['']", compact ? "px-2 py-1 text-[8px]" : "px-3 py-1.5 text-[10px]", styles[status])}>{workflowStatusLabel(status, workspaceType)}</span>;
}

function workflowStatusLabel(status: ProductDesignTaskItem["workflowStatus"], workspaceType: DesignWorkspaceType = "product_design") {
  if (workspaceType !== "product_design" && status === "in_progress") return "작업중";
  return { planned: "예정", in_progress: "진행중", in_production: "생산중", on_hold: "보류중", awaiting_approval: "컨펌 필요", completed: "완료" }[status];
}

function SectionTitle({ title, description }: { title: string; description: string }) { return <div className="border-b border-[#dbe8df] bg-[#edf6f0] px-4 py-3.5 sm:px-6"><h3 className="text-[16px] font-black text-[#254232]">{title}</h3><p className="mt-0.5 text-[10px] text-[#819087]">{description}</p></div>; }
function AutoField({ label, value }: { label: string; value: string }) { return <div className="grid gap-2 sm:grid-cols-[150px_1fr] sm:items-center"><span className="text-[12px] font-extrabold text-[#45544b]">{label}</span><span className="flex h-10 items-center rounded-[10px] border border-[#e0e5e2] bg-[#f4f6f5] px-3 text-[12px] text-[#849087]">{value}<small className="ml-auto rounded-md bg-[#c9d0cc] px-2 py-0.5 text-[9px] font-extrabold text-white">자동</small></span></div>; }
function FormField({ label, error, required, children }: { label: string; error?: string; required?: boolean; children: React.ReactNode }) { return <label className="grid gap-2 sm:grid-cols-[150px_1fr] sm:items-start"><span className="pt-2.5 text-[12px] font-extrabold text-[#45544b]">{label}{required && <b className="ml-1 text-[#d45d58]">*</b>}</span><span>{children}{error && <small className="mt-1.5 block text-[10px] font-semibold text-[#ad514b]">{error}</small>}</span></label>; }
function MobileLabel({ children }: { children: React.ReactNode }) { return <small className="mr-2 font-extrabold text-[#96a098] md:hidden">{children}</small>; }
function TaskImage({ src, name, className }: { src: string | null; name: string; className?: string }) { return <span className={cn("relative block shrink-0 overflow-hidden rounded-[10px] bg-[#edf2ee]", className)}>{src ? <Image src={src} alt={name} fill unoptimized className="object-cover" /> : <PackageOpen className="absolute inset-0 m-auto size-5 text-[#9ca8a0]" />}</span>; }
function workTypeLabel(value: ProductDesignTaskItem["workType"]) {
  return {
    new_product: "신제품",
    existing_product_update: "기존 제품 수정",
    planned: "예정",
    renewal: "리뉴얼",
    banner: "배너",
    html: "HTML",
  }[value];
}
function formatShortDate(value: string) { return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit" }).format(new Date(value)); }
function formatDashboardLogDate(value: string) { return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value)); }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value)); }
const inputClass = "h-11 w-full rounded-[11px] border border-[#ced8d1] bg-white px-3.5 text-[13px] font-medium text-[#344139] outline-none transition placeholder:text-[#a4ada7] hover:border-[#b7c8bd] focus:border-[#72aa88] focus:ring-3 focus:ring-emerald-100";
