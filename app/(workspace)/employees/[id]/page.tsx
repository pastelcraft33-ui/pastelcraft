import { ArrowLeft, BriefcaseBusiness, CalendarDays, ExternalLink, Pencil, Phone, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { requireCurrentEmployee } from "@/lib/auth/session";
import { departmentCodesInSameGroup, departmentLabel, positionLabel } from "@/lib/employees/constants";
import {
  canViewAllDepartments,
  canViewEmployeeWorkDetails,
} from "@/lib/employees/permissions";
import { createProfileImageSignedUrl } from "@/lib/storage/profile-image";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageTask } from "@/lib/tasks/permissions";
import { cn, formatPhone } from "@/lib/utils";

export const metadata: Metadata = { title: "직원별 업무" };
type TaskRow = {
  id: string;
  title: string;
  description: string;
  department: string;
  start_date: string;
  end_date: string;
  related_link: string | null;
  updated_at: string;
};

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const currentEmployee = await requireCurrentEmployee();
  const { id } = await params;

  const supabase = createAdminClient();
  const { data: employee } = await supabase
    .from("employees")
    .select("id, name, position, department, phone, profile_image_url, role, account_status")
    .eq("id", id)
    .maybeSingle();

  if (!employee || employee.account_status !== "active") notFound();
  if (!canViewEmployeeWorkDetails(currentEmployee, id, employee.department)) {
    redirect("/employees?denied=1");
  }

  let taskQuery = supabase
    .from("tasks")
    .select("id, title, description, department, start_date, end_date, related_link, updated_at")
    .eq("owner_id", id);
  if (!canViewAllDepartments(currentEmployee)) {
    taskQuery = taskQuery.in("department", departmentCodesInSameGroup(currentEmployee.departmentCode));
  }
  const { data: taskRows } = await taskQuery.order("start_date", {
    ascending: true,
  });

  const imageUrl = await createProfileImageSignedUrl(supabase, employee.profile_image_url);
  const tasks = (taskRows ?? []) as TaskRow[];
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
  }).format(new Date());
  const current = tasks.filter(
    (task) => task.start_date <= today && task.end_date >= today,
  );
  const upcoming = tasks.filter((task) => task.start_date > today);
  const recent = tasks
    .filter((task) => task.end_date < today)
    .sort((a, b) => b.end_date.localeCompare(a.end_date))
    .slice(0, 6);
  const canEdit = canManageTask(
    currentEmployee,
    employee.id,
    employee.department,
  );

  return (
    <section className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1080px]">
        <Link href="/employees" className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[#647169] hover:text-[#315f47]">
          <ArrowLeft className="size-4" /> 직원 목록으로 돌아가기
        </Link>

        <div className="mt-5 overflow-hidden rounded-[20px] border border-[#e0e6e2] bg-white shadow-[0_16px_45px_rgba(35,54,42,0.05)]">
          <div className="bg-[linear-gradient(120deg,#edf7f0_0%,#fffbed_100%)] px-5 py-6 sm:px-8 sm:py-8">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
              <div className="flex items-center gap-4">
                <Avatar name={employee.name} imageUrl={imageUrl} size="lg" className="size-20 text-2xl ring-4 ring-white/80" />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[26px] font-extrabold tracking-[-0.045em] text-[#2b3730]">{employee.name}</h2>
                    {employee.role === "admin" && <span className="inline-flex items-center gap-1 rounded-full bg-[#fff3bf] px-2.5 py-1 text-[11px] font-extrabold text-[#775d13]"><ShieldCheck className="size-3.5" />관리자</span>}
                  </div>
                  <p className="mt-1 text-[13px] font-bold text-[#5f7066]">{departmentLabel(employee.department)} · {positionLabel(employee.position)}</p>
                  <p className="mt-2 flex items-center gap-1.5 text-[13px] text-[#68756d]"><Phone className="size-3.5" /> {formatPhone(employee.phone)}</p>
                </div>
              </div>
              {employee.id === currentEmployee.id && (
                <Button asChild variant="secondary"><Link href="/my-profile"><Pencil className="size-4" />내 프로필 수정</Link></Button>
              )}
            </div>
          </div>
          <div className="grid divide-y divide-[#edf0ee] border-t border-[#e4eae6] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <Summary label="현재 일정" count={current.length} color="text-[#3971b9]" />
            <Summary label="예정 일정" count={upcoming.length} color="text-[#68736d]" />
            <Summary label="지난 일정" count={recent.length} color="text-[#3c8558]" />
          </div>
        </div>

        {!canEdit && (
          <div className="mt-4 rounded-[12px] border border-[#dce6df] bg-[#f7faf8] px-4 py-3 text-[12px] text-[#647169]">
            {positionLabel(currentEmployee.positionCode)} 권한으로 상세 내용을 조회 중입니다. 다른 직원의 업무는 수정하거나 삭제할 수 없습니다.
          </div>
        )}

        <div className="mt-6 grid gap-6">
          <TaskSection title="현재 일정" description="오늘이 업무 기간에 포함된 일정입니다." tasks={current} empty="현재 일정이 없습니다." canEdit={canEdit} accent="blue" />
          <TaskSection title="예정 일정" description="시작일이 오늘 이후인 일정입니다." tasks={upcoming} empty="예정 일정이 없습니다." canEdit={canEdit} accent="gray" />
          <TaskSection title="지난 일정" description="종료일이 최근인 순으로 최대 6개를 표시합니다." tasks={recent} empty="지난 일정이 없습니다." canEdit={canEdit} accent="green" />
        </div>
      </div>
    </section>
  );
}

function Summary({ label, count, color }: { label: string; count: number; color: string }) {
  return <div className="px-5 py-4 text-center"><p className={cn("text-[22px] font-extrabold", color)}>{count}</p><p className="mt-0.5 text-[11px] font-bold text-[#869089]">{label}</p></div>;
}

function TaskSection({
  title,
  description,
  tasks,
  empty,
  canEdit,
  accent,
}: {
  title: string;
  description: string;
  tasks: TaskRow[];
  empty: string;
  canEdit: boolean;
  accent: "blue" | "gray" | "green";
}) {
  const accentClass = { blue: "bg-[#e9f2ff] text-[#3971b9]", gray: "bg-[#eef1ef] text-[#68736d]", green: "bg-[#e8f6ec] text-[#3c8558]" }[accent];
  return (
    <div className="rounded-[17px] border border-[#e0e6e2] bg-white p-5 shadow-[0_10px_30px_rgba(35,54,42,0.035)] sm:p-6">
      <div className="flex items-center gap-3">
        <span className={cn("flex size-10 items-center justify-center rounded-[12px]", accentClass)}><BriefcaseBusiness className="size-4.5" /></span>
        <div><h3 className="text-[17px] font-extrabold text-[#303c35]">{title}</h3><p className="mt-0.5 text-[11px] text-[#89928d]">{description}</p></div>
      </div>
      {tasks.length ? (
        <div className="mt-5 divide-y divide-[#edf0ee] border-y border-[#edf0ee]">
          {tasks.map((task) => (
            <article key={task.id} className="py-4 first:pt-3 last:pb-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h4 className="font-extrabold text-[#37433c]">{task.title}</h4>
                  <p className="mt-2 whitespace-pre-wrap text-[12px] leading-5 text-[#6f7973]">{task.description}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-semibold text-[#7c8780]">
                    <span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5" />{formatDate(task.start_date)} ~ {formatDate(task.end_date)}</span>
                    <span>{departmentLabel(task.department)}</span>
                    {task.related_link && <a href={task.related_link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#47775a] hover:underline"><ExternalLink className="size-3.5" />관련 링크</a>}
                  </div>
                </div>
                {canEdit && <Button asChild size="sm" variant="secondary" className="shrink-0"><Link href={`/tasks/new?edit=${task.id}`}><Pencil className="size-3.5" />수정</Link></Button>}
              </div>
            </article>
          ))}
        </div>
      ) : <div className="mt-5 rounded-[12px] border border-dashed border-[#dce3de] bg-[#fafbfa] py-9 text-center text-[12px] text-[#8a948e]">{empty}</div>}
    </div>
  );
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${year}.${month}.${day}`;
}
