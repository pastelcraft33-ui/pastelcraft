-- 관리자 기본 운영 설정

create table if not exists public.system_settings (
  id boolean primary key default true,
  company_name varchar(100) not null default '파스텔크래프트',
  default_calendar_tab varchar(10) not null default 'leave',
  week_starts_on smallint not null default 0,
  session_ttl_hours smallint not null default 168,
  updated_by uuid references public.employees(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint system_settings_single_row check (id = true),
  constraint system_settings_company_name_length check (char_length(trim(company_name)) between 1 and 100),
  constraint system_settings_calendar_tab_check check (default_calendar_tab in ('task', 'leave')),
  constraint system_settings_week_starts_on_check check (week_starts_on in (0, 1)),
  constraint system_settings_session_ttl_check check (session_ttl_hours between 1 and 720)
);

insert into public.system_settings (id)
values (true)
on conflict (id) do nothing;

drop trigger if exists system_settings_set_updated_at on public.system_settings;
create trigger system_settings_set_updated_at before update on public.system_settings
for each row execute function public.set_updated_at();

alter table public.system_settings enable row level security;
revoke all on table public.system_settings from anon, authenticated;
