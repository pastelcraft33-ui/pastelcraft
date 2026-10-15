-- MD팀: 작업 구분/수량 및 한국 시간 기준 일자별 시간표
begin;

alter table public.product_design_tasks
  add column if not exists work_quantity integer,
  add column if not exists scheduled_start_at timestamptz,
  add column if not exists scheduled_end_at timestamptz;

alter table public.product_design_tasks
  drop constraint if exists product_design_tasks_workspace_type_check;
alter table public.product_design_tasks
  add constraint product_design_tasks_workspace_type_check
  check (workspace_type in ('product_design', 'web_design', 'web_marketing', 'web_education', 'web_md'));

alter table public.product_design_tasks
  drop constraint if exists product_design_tasks_work_type_check;
alter table public.product_design_tasks
  add constraint product_design_tasks_work_type_check
  check (work_type in (
    'new_product', 'existing_product_update', 'planned', 'renewal', 'banner',
    'main_banner', 'popup_banner', 'html', 'other',
    'order_collection', 'product_registration', 'stock_deduction', 'product_management'
  ));

alter table public.product_design_tasks
  drop constraint if exists product_design_tasks_work_quantity_check;
alter table public.product_design_tasks
  add constraint product_design_tasks_work_quantity_check
  check (work_quantity is null or work_quantity between 1 and 999999);

alter table public.product_design_tasks
  drop constraint if exists product_design_tasks_md_schedule_check;
alter table public.product_design_tasks
  add constraint product_design_tasks_md_schedule_check
  check (workspace_type <> 'web_md' or (
    work_quantity is not null and scheduled_start_at is not null
    and (scheduled_end_at is null or (
      scheduled_end_at > scheduled_start_at
    ))
    and workflow_status in ('in_progress', 'completed')
    and work_type in ('order_collection', 'product_registration', 'stock_deduction', 'product_management', 'other')
  ));

create index if not exists product_design_tasks_workspace_schedule_idx
  on public.product_design_tasks (workspace_type, scheduled_start_at);

commit;
