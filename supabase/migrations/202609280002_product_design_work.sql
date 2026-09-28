-- 제품 디자인팀 작업 등록 및 날짜별 작업 기록

create table if not exists public.product_design_tasks (
  id uuid primary key default gen_random_uuid(),
  product_name varchar(150) not null,
  work_type varchar(30) not null,
  representative_image_path text,
  detailed_work_content text not null,
  current_stage varchar(100),
  started_at timestamptz not null default now(),
  created_by uuid not null references public.employees(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_design_tasks_name_check
    check (char_length(trim(product_name)) between 1 and 150),
  constraint product_design_tasks_work_type_check
    check (work_type in ('new_product', 'existing_product_update')),
  constraint product_design_tasks_detail_check
    check (char_length(trim(detailed_work_content)) between 1 and 10000),
  constraint product_design_tasks_stage_check
    check (current_stage is null or char_length(trim(current_stage)) between 1 and 100)
);

create table if not exists public.product_design_work_logs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.product_design_tasks(id) on delete cascade,
  author_id uuid not null references public.employees(id) on delete restrict,
  current_stage varchar(100) not null,
  work_content text not null,
  change_summary text not null,
  created_at timestamptz not null default now(),
  constraint product_design_work_logs_stage_check
    check (char_length(trim(current_stage)) between 1 and 100),
  constraint product_design_work_logs_content_check
    check (char_length(trim(work_content)) between 1 and 5000),
  constraint product_design_work_logs_summary_check
    check (char_length(trim(change_summary)) between 1 and 6000)
);

create index if not exists product_design_tasks_started_at_idx
  on public.product_design_tasks (started_at desc);
create index if not exists product_design_tasks_created_by_idx
  on public.product_design_tasks (created_by, started_at desc);
create index if not exists product_design_work_logs_task_created_idx
  on public.product_design_work_logs (task_id, created_at desc);
create index if not exists product_design_work_logs_author_idx
  on public.product_design_work_logs (author_id, created_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-design-images',
  'product-design-images',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

comment on table public.product_design_tasks is '웹팀 제품 디자인 작업';
comment on table public.product_design_work_logs is '제품 디자인 작업의 날짜별 변경 기록';
