"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  ImagePlus,
  LayoutDashboard,
  Loader2,
  PackageOpen,
  PenLine,
  Plus,
  Save,
  Sparkles,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PRODUCT_DESIGN_IMAGE_ACCEPT } from "@/lib/product-design/files";
import {
  productDesignLogSchema,
  productDesignTaskSchema,
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
  workType: "new_product" | "existing_product_update";
  imageUrl: string | null;
  detailedWorkContent: string;
  currentStage: string | null;
  startedAt: string;
  createdAt: string;
  updatedAt: string;
  creatorName: string;
  logs: ProductDesignWorkLogItem[];
};

type ProductDesignView = "register" | "ongoing" | "dashboard";

const tabs = [
  { value: "register", label: "작업등록", icon: Plus },
  { value: "ongoing", label: "진행중 작업", icon: ClipboardList },
  { value: "dashboard", label: "제품 디자인팀 전체 대시보드", icon: LayoutDashboard },
] as const;

export function ProductDesignWorkspace({
  currentView,
  currentUserName,
  tasks,
  schemaAvailable,
}: {
  currentView: ProductDesignView;
  currentUserName: string;
  tasks: ProductDesignTaskItem[];
  schemaAvailable: boolean;
}) {
  return (
    <section className="mx-auto w-full max-w-[1480px] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <div className="mb-5 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e2f3e8] px-3 py-1 text-[11px] font-extrabold text-[#397253]">
            <Sparkles className="size-3.5" /> 제품 디자인팀
          </span>
          <h2 className="mt-3 text-[28px] font-black tracking-[-0.045em] text-[#21342a] sm:text-[34px]">
            제품 디자인 작업 관리
          </h2>
          <p className="mt-1 text-[13px] text-[#7c8880]">
            제품별 작업을 등록하고 오늘의 진행 내용과 변경 이력을 관리하세요.
          </p>
        </div>
        <p className="text-[11px] font-semibold text-[#9aa39d]">
          시작일과 기록 일시는 저장 시 자동으로 기록됩니다.
        </p>
      </div>

      <nav className="mb-5 grid gap-2 rounded-[16px] border border-[#dfe8e2] bg-white p-2 shadow-[0_8px_24px_rgba(34,63,45,0.035)] sm:grid-cols-3">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <Link
              key={tab.value}
              href={`/web/product-design?view=${tab.value}`}
              prefetch
              className={cn(
                "flex min-h-12 items-center justify-center gap-2 rounded-[11px] px-4 text-[13px] font-extrabold transition",
                currentView === tab.value
                  ? "bg-[#2f7250] text-white shadow-[0_7px_16px_rgba(47,114,80,0.2)]"
                  : "bg-[#f3f7f4] text-[#526159] hover:bg-[#eaf2ed]",
              )}
            >
              <Icon className="size-4" /> {tab.label}
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
          제품 디자인 데이터베이스가 아직 없습니다. Supabase SQL Editor에서 <code>202609280002_product_design_work.sql</code>을 실행해 주세요.
        </div>
      )}

      {currentView === "register" && (
        <ProductDesignRegistrationForm
          currentUserName={currentUserName}
          schemaAvailable={schemaAvailable}
        />
      )}
      {currentView === "ongoing" && (
        <OngoingProductDesignTasks tasks={tasks} schemaAvailable={schemaAvailable} />
      )}
      {currentView === "dashboard" && <ProductDesignDashboard tasks={tasks} />}
    </section>
  );
}

function ProductDesignRegistrationForm({
  currentUserName,
  schemaAvailable,
}: {
  currentUserName: string;
  schemaAvailable: boolean;
}) {
  const router = useRouter();
  const [image, setImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    reset,
  } = useForm<ProductDesignTaskInput>({
    resolver: zodResolver(productDesignTaskSchema),
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
    if (!image) {
      setNotice("대표 이미지를 등록해 주세요.");
      return;
    }
    setNotice(null);
    const formData = new FormData();
    formData.set("productName", values.productName);
    formData.set("workType", values.workType);
    formData.set("detailedWorkContent", values.detailedWorkContent);
    formData.set("representativeImage", image);

    try {
      const response = await fetch("/api/web/product-design/tasks", {
        method: "POST",
        body: formData,
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "작업을 등록하지 못했습니다.");
      reset();
      chooseImage(null);
      window.dispatchEvent(new Event("workspace-content-created"));
      router.replace("/web/product-design?view=ongoing");
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
        <SectionTitle title="기본 정보" description="상품과 작업 성격을 먼저 등록합니다." />
        <div className="space-y-4 p-4 sm:p-6">
          <AutoField label="작업번호" value="등록 시 자동 생성" />
          <AutoField label="담당자" value={`${currentUserName} · 로그인 정보`} />
          <AutoField label="등록일시" value="저장 시 자동 기록" />
          <FormField label="상품명" error={errors.productName?.message} required>
            <input {...register("productName")} className={inputClass} placeholder="예: 봄꽃 클레이 액자" />
          </FormField>
          <FormField label="작업 구분" error={errors.workType?.message} required>
            <select {...register("workType")} className={inputClass}>
              <option value="new_product">신규 제품</option>
              <option value="existing_product_update">기존 제품 수정</option>
            </select>
          </FormField>
          <FormField label="대표 이미지" required>
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
                <p className="mt-2 text-[11px] leading-5 text-[#87928b]">JPG, PNG, WEBP · 최대 5MB</p>
                {image && <p className="mt-1 max-w-xs truncate text-[11px] font-semibold text-[#526159]">{image.name}</p>}
              </div>
            </div>
          </FormField>
        </div>
      </div>

      <div className="overflow-hidden rounded-[18px] border border-[#bcd8c6] bg-white shadow-[0_10px_30px_rgba(42,91,60,0.04)]">
        <SectionTitle title="작업 계획" description="예정된 세부 작업내용을 작성합니다." />
        <div className="p-4 sm:p-6">
          <FormField label="세부 작업내용" error={errors.detailedWorkContent?.message} required>
            <textarea {...register("detailedWorkContent")} rows={7} className={cn(inputClass, "h-auto resize-y py-3 leading-6")} placeholder={"① 제품 도안 제작\n② 색상 선정 및 샘플 제작\n③ 구성품과 설명서 확인"} />
          </FormField>
        </div>
      </div>

      {(notice || errors.root?.message) && (
        <p role="alert" className="rounded-[12px] border border-[#efc7c3] bg-[#fff3f2] px-4 py-3 text-[13px] font-semibold text-[#994f48]">{notice ?? errors.root?.message}</p>
      )}
      <div className="flex justify-end">
        <Button type="submit" className="h-11 px-6" disabled={isSubmitting || !schemaAvailable}>
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
          작업 등록
        </Button>
      </div>
    </form>
  );
}

function OngoingProductDesignTasks({
  tasks,
  schemaAvailable,
}: {
  tasks: ProductDesignTaskItem[];
  schemaAvailable: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(tasks[0]?.id ?? null);
  const selectedTask =
    tasks.find((task) => task.id === selectedId) ?? tasks[0] ?? null;

  if (!schemaAvailable || tasks.length === 0) {
    return (
      <div className="rounded-[18px] border border-[#dfe7e2] bg-white px-6 py-16 text-center">
        <PackageOpen className="mx-auto size-10 text-[#a1ada5]" />
        <h3 className="mt-4 text-lg font-extrabold text-[#405047]">등록된 작업이 없습니다.</h3>
        <p className="mt-1 text-[12px] text-[#89938d]">작업등록에서 첫 제품 디자인 작업을 등록해 주세요.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-[18px] border border-[#bfd6c7] bg-white">
        <div className="hidden grid-cols-[1.35fr_0.7fr_1.5fr_0.55fr_0.42fr] bg-[#edf5ef] px-5 py-3 text-[11px] font-extrabold text-[#45564c] md:grid">
          <span>제품 · 담당자</span><span>현재 단계</span><span>최근 작업 내용</span><span>시작일</span><span>관리</span>
        </div>
        <div className="divide-y divide-[#e7ece8]">
          {tasks.map((task) => {
            const latest = task.logs[0];
            return (
              <button key={task.id} type="button" onClick={() => setSelectedId(task.id)} className={cn("grid w-full gap-3 px-4 py-4 text-left transition hover:bg-[#f6faf7] md:grid-cols-[1.35fr_0.7fr_1.5fr_0.55fr_0.42fr] md:items-center md:px-5", selectedTask?.id === task.id && "bg-[#f0f8f3]")}> 
                <span className="flex min-w-0 items-center gap-3">
                  <TaskImage src={task.imageUrl} name={task.productName} className="size-14" />
                  <span className="min-w-0"><strong className="block truncate text-[13px] text-[#29382f]">{task.productName}</strong><small className="mt-1 block text-[10px] text-[#849087]">{task.creatorName} · {workTypeLabel(task.workType)}</small></span>
                </span>
                <span className="text-[12px] font-bold text-[#496154]"><MobileLabel>현재 단계</MobileLabel>{task.currentStage ?? "미입력"}</span>
                <span className="line-clamp-2 text-[12px] leading-5 text-[#657169]"><MobileLabel>최근 작업</MobileLabel>{latest?.workContent ?? "아직 작업 기록이 없습니다."}</span>
                <span className="text-[11px] font-semibold text-[#68756d]"><MobileLabel>시작일</MobileLabel>{formatShortDate(task.startedAt)}</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#397253]">상세 <ArrowRight className="size-3.5" /></span>
              </button>
            );
          })}
        </div>
      </div>
      {selectedTask && <ProductDesignTaskDetail key={selectedTask.id} task={selectedTask} />}
    </div>
  );
}

function ProductDesignTaskDetail({ task }: { task: ProductDesignTaskItem }) {
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    resetField,
  } = useForm<ProductDesignLogInput>({
    resolver: zodResolver(productDesignLogSchema),
    defaultValues: { currentStage: task.currentStage ?? "", workContent: "" },
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

  return (
    <article className="overflow-hidden rounded-[18px] border border-[#bfd6c7] bg-white">
      <div className="border-b border-[#dce8df] bg-[#edf5ef] px-5 py-4">
        <h3 className="text-[17px] font-black tracking-[-0.025em] text-[#24372c]">작업 상세 · {task.productName}</h3>
      </div>
      <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[0.85fr_1.15fr]">
        <div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-[15px] bg-[#f3f6f4]">
            {task.imageUrl ? <Image src={task.imageUrl} alt={task.productName} fill unoptimized className="object-cover" /> : <PackageOpen className="absolute inset-0 m-auto size-10 text-[#a8b2ac]" />}
          </div>
          <div className="mt-3 rounded-[12px] bg-[#f5f8f6] p-3">
            <p className="text-[10px] font-extrabold text-[#8a958e]">세부 작업내용</p>
            <p className="mt-1.5 whitespace-pre-wrap text-[12px] leading-5 text-[#5d6b62]">{task.detailedWorkContent}</p>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <FormField label="현재 단계" error={errors.currentStage?.message} required>
            <input {...register("currentStage")} className={inputClass} placeholder="예: 샘플 제작" />
          </FormField>
          <FormField label="오늘 작업내용" error={errors.workContent?.message} required>
            <textarea {...register("workContent")} rows={5} className={cn(inputClass, "h-auto resize-y py-3 leading-6")} placeholder="오늘 진행한 작업과 변경 내용을 적어 주세요." />
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

function ProductDesignDashboard({ tasks }: { tasks: ProductDesignTaskItem[] }) {
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  const todayLogs = tasks.flatMap((task) => task.logs).filter((log) => new Date(log.createdAt).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }) === today).length;
  const creators = new Set(tasks.map((task) => task.creatorName));
  const cards = [
    { label: "전체 등록 작업", value: tasks.length, icon: PackageOpen, tone: "green" },
    { label: "단계 기록 완료", value: tasks.filter((task) => task.currentStage).length, icon: CheckCircle2, tone: "blue" },
    { label: "오늘 작업 기록", value: todayLogs, icon: PenLine, tone: "yellow" },
    { label: "작업 참여 직원", value: creators.size, icon: CalendarDays, tone: "gray" },
  ] as const;
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map((card) => { const Icon = card.icon; return <div key={card.label} className="rounded-[16px] border border-[#dfe7e2] bg-white p-5"><div className="flex items-center justify-between"><span className="text-[12px] font-bold text-[#77837b]">{card.label}</span><Icon className="size-4 text-[#4c8061]" /></div><strong className="mt-3 block text-3xl font-black text-[#28382f]">{card.value}</strong></div>; })}</div>
      <div className="rounded-[18px] border border-[#dfe7e2] bg-white p-5 sm:p-6"><h3 className="text-[16px] font-extrabold text-[#304038]">최근 등록 작업</h3>{tasks.length === 0 ? <p className="py-10 text-center text-[12px] text-[#929c96]">등록된 작업이 없습니다.</p> : <div className="mt-4 grid gap-3 md:grid-cols-2">{tasks.slice(0, 6).map((task) => <Link key={task.id} href="/web/product-design?view=ongoing" className="flex items-center gap-3 rounded-[13px] border border-[#e2e9e4] p-3 hover:bg-[#f6faf7]"><TaskImage src={task.imageUrl} name={task.productName} className="size-12" /><span className="min-w-0"><strong className="block truncate text-[12px] text-[#34443a]">{task.productName}</strong><small className="mt-1 block text-[10px] text-[#87928b]">{task.currentStage ?? "단계 미입력"} · {formatShortDate(task.startedAt)} 시작</small></span></Link>)}</div>}</div>
    </div>
  );
}

function SectionTitle({ title, description }: { title: string; description: string }) { return <div className="border-b border-[#dbe8df] bg-[#edf6f0] px-4 py-3.5 sm:px-6"><h3 className="text-[16px] font-black text-[#254232]">{title}</h3><p className="mt-0.5 text-[10px] text-[#819087]">{description}</p></div>; }
function AutoField({ label, value }: { label: string; value: string }) { return <div className="grid gap-2 sm:grid-cols-[150px_1fr] sm:items-center"><span className="text-[12px] font-extrabold text-[#45544b]">{label}</span><span className="flex h-10 items-center rounded-[10px] border border-[#e0e5e2] bg-[#f4f6f5] px-3 text-[12px] text-[#849087]">{value}<small className="ml-auto rounded-md bg-[#c9d0cc] px-2 py-0.5 text-[9px] font-extrabold text-white">자동</small></span></div>; }
function FormField({ label, error, required, children }: { label: string; error?: string; required?: boolean; children: React.ReactNode }) { return <label className="grid gap-2 sm:grid-cols-[150px_1fr] sm:items-start"><span className="pt-2.5 text-[12px] font-extrabold text-[#45544b]">{label}{required && <b className="ml-1 text-[#d45d58]">*</b>}</span><span>{children}{error && <small className="mt-1.5 block text-[10px] font-semibold text-[#ad514b]">{error}</small>}</span></label>; }
function MobileLabel({ children }: { children: React.ReactNode }) { return <small className="mr-2 font-extrabold text-[#96a098] md:hidden">{children}</small>; }
function TaskImage({ src, name, className }: { src: string | null; name: string; className?: string }) { return <span className={cn("relative block shrink-0 overflow-hidden rounded-[10px] bg-[#edf2ee]", className)}>{src ? <Image src={src} alt={name} fill unoptimized className="object-cover" /> : <PackageOpen className="absolute inset-0 m-auto size-5 text-[#9ca8a0]" />}</span>; }
function workTypeLabel(value: ProductDesignTaskItem["workType"]) { return value === "new_product" ? "신규 제품" : "기존 제품 수정"; }
function formatShortDate(value: string) { return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit" }).format(new Date(value)); }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value)); }
const inputClass = "h-11 w-full rounded-[11px] border border-[#ced8d1] bg-white px-3.5 text-[13px] font-medium text-[#344139] outline-none transition placeholder:text-[#a4ada7] hover:border-[#b7c8bd] focus:border-[#72aa88] focus:ring-3 focus:ring-emerald-100";
