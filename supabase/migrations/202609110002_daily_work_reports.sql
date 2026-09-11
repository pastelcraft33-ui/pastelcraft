-- 날짜별 일일업무일지와 비공개 이미지 Storage
create table if not exists public.daily_work_reports (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  report_date date not null,
  image_path text not null,
  mime_type varchar(100) not null,
  file_size_bytes bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_work_reports_employee_date_unique unique (employee_id, report_date),
  constraint daily_work_reports_image_path_unique unique (image_path),
  constraint daily_work_reports_image_path_length check (char_length(trim(image_path)) between 1 and 1024),
  constraint daily_work_reports_mime_type_check check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  constraint daily_work_reports_file_size_check check (file_size_bytes between 1 and 4194304)
);

create index if not exists daily_work_reports_date_idx
  on public.daily_work_reports (report_date desc, employee_id);

drop trigger if exists daily_work_reports_set_updated_at on public.daily_work_reports;
create trigger daily_work_reports_set_updated_at
before update on public.daily_work_reports
for each row execute function public.set_updated_at();

alter table public.daily_work_reports enable row level security;
revoke all on table public.daily_work_reports from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'daily-work-reports',
  'daily-work-reports',
  false,
  4194304,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
