alter table public.product_design_tasks
  add column if not exists workspace_type varchar(30) not null default 'product_design';

alter table public.product_design_tasks
  drop constraint if exists product_design_tasks_work_type_check;

alter table public.product_design_tasks
  add constraint product_design_tasks_work_type_check
  check (work_type in ('new_product', 'existing_product_update', 'renewal', 'banner'));

alter table public.product_design_tasks
  drop constraint if exists product_design_tasks_workspace_type_check;

alter table public.product_design_tasks
  add constraint product_design_tasks_workspace_type_check
  check (workspace_type in ('product_design', 'web_design'));

create index if not exists idx_product_design_tasks_workspace_assignee
  on public.product_design_tasks (workspace_type, assigned_to, workflow_status, started_at desc);

comment on column public.product_design_tasks.workspace_type is
  '작업 영역: product_design(제품 디자인팀), web_design(웹 디자인팀)';
