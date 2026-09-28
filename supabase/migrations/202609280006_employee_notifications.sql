-- 직원별 영구 알림: 제품 디자인 작업 배정 및 이관 알림

create table if not exists public.employee_notifications (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  notification_type varchar(50) not null,
  title varchar(200) not null,
  description text not null,
  href text not null,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint employee_notifications_type_check
    check (notification_type in ('product_design_assignment')),
  constraint employee_notifications_title_check
    check (char_length(trim(title)) between 1 and 200),
  constraint employee_notifications_description_check
    check (char_length(trim(description)) between 1 and 1000),
  constraint employee_notifications_href_check
    check (char_length(trim(href)) between 1 and 500)
);

create index if not exists employee_notifications_unread_idx
  on public.employee_notifications (employee_id, created_at desc)
  where read_at is null;

alter table public.employee_notifications enable row level security;
revoke all on table public.employee_notifications from anon, authenticated;

comment on table public.employee_notifications is
  '직원에게 배정된 제품 디자인 작업 등 확인 전까지 유지되는 알림';
