-- 제품 디자인 작업 담당자 및 이관 이력 지원

alter table public.product_design_tasks
  add column if not exists assigned_to uuid;

update public.product_design_tasks
set assigned_to = created_by
where assigned_to is null;

alter table public.product_design_tasks
  alter column assigned_to set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'product_design_tasks_assigned_to_fkey'
      and conrelid = 'public.product_design_tasks'::regclass
  ) then
    alter table public.product_design_tasks
      add constraint product_design_tasks_assigned_to_fkey
      foreign key (assigned_to) references public.employees(id) on delete restrict;
  end if;
end $$;

create index if not exists product_design_tasks_assigned_to_idx
  on public.product_design_tasks (assigned_to, workflow_status, started_at desc);

comment on column public.product_design_tasks.assigned_to
  is '현재 제품 디자인 작업 담당 직원. 담당자 이관 기록은 product_design_work_logs에 누적';
