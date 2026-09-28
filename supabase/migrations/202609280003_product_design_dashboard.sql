-- 제품 디자인 대시보드 상태, 비고, 완료 시각 추가

alter table public.product_design_tasks
  add column if not exists workflow_status varchar(30) not null default 'planned',
  add column if not exists note text,
  add column if not exists completed_at timestamptz;

alter table public.product_design_work_logs
  add column if not exists workflow_status varchar(30) not null default 'in_progress',
  add column if not exists note_snapshot text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'product_design_tasks_workflow_status_check'
      and conrelid = 'public.product_design_tasks'::regclass
  ) then
    alter table public.product_design_tasks
      add constraint product_design_tasks_workflow_status_check
      check (workflow_status in (
        'planned', 'in_progress', 'in_production',
        'on_hold', 'awaiting_approval', 'completed'
      ));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'product_design_tasks_note_check'
      and conrelid = 'public.product_design_tasks'::regclass
  ) then
    alter table public.product_design_tasks
      add constraint product_design_tasks_note_check
      check (note is null or char_length(note) <= 1000);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'product_design_work_logs_workflow_status_check'
      and conrelid = 'public.product_design_work_logs'::regclass
  ) then
    alter table public.product_design_work_logs
      add constraint product_design_work_logs_workflow_status_check
      check (workflow_status in (
        'planned', 'in_progress', 'in_production',
        'on_hold', 'awaiting_approval', 'completed'
      ));
  end if;
end $$;

create index if not exists product_design_tasks_workflow_status_idx
  on public.product_design_tasks (workflow_status, started_at desc);
