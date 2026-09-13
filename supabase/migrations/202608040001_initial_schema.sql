-- 파스텔크래프트 워크스페이스 초기 스키마
-- Supabase SQL Editor 또는 Supabase CLI에서 실행합니다.

-- 이전 빈 MVP 스키마가 있는 프로젝트를 위한 호환 정리입니다.
-- 기존 leave_requests에 employee_id가 없을 때만 이전 스키마로 판단합니다.
-- 이전 테이블 중 데이터가 한 건이라도 있으면 삭제하지 않고 즉시 중단합니다.
do $$
declare
  legacy_table text;
  legacy_tables text[] := array[
    'audit_logs',
    'holidays',
    'leave_actions',
    'leave_balances',
    'leave_requests',
    'leave_types',
    'profiles',
    'work_assignees',
    'work_attachments',
    'work_comments',
    'work_items'
  ];
  legacy_drop_order text[] := array[
    'audit_logs',
    'work_comments',
    'work_attachments',
    'work_assignees',
    'work_items',
    'leave_actions',
    'leave_balances',
    'leave_requests',
    'leave_types',
    'holidays',
    'profiles'
  ];
  has_rows boolean;
begin
  if to_regclass('public.leave_requests') is not null
     and not exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'leave_requests'
         and column_name = 'employee_id'
     ) then
    foreach legacy_table in array legacy_tables loop
      if to_regclass(format('public.%I', legacy_table)) is not null then
        execute format(
          'select exists (select 1 from public.%I limit 1)',
          legacy_table
        ) into has_rows;

        if has_rows then
          raise exception
            '기존 테이블 public.%에 데이터가 있어 자동 초기화를 중단했습니다.',
            legacy_table;
        end if;
      end if;
    end loop;

    foreach legacy_table in array legacy_drop_order loop
      execute format('drop table if exists public.%I cascade', legacy_table);
    end loop;
  end if;
end $$;

create extension if not exists pgcrypto;
create extension if not exists citext;

do $$ begin
  create type employee_position as enum (
    'staff', 'assistant_manager', 'manager', 'deputy_general_manager',
    'general_manager', 'team_lead', 'representative'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type employee_department as enum ('web', 'logistics', 'namdaemun');
exception when duplicate_object then null; end $$;

do $$ begin
  create type employee_role as enum ('employee', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type account_status as enum ('pending', 'active', 'rejected', 'suspended');
exception when duplicate_object then null; end $$;

do $$ begin
  create type leave_type as enum (
    'annual', 'morning_half', 'afternoon_half', 'morning_quarter',
    'afternoon_quarter', 'sick', 'bereavement',
    'official', 'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type leave_day_type as enum (
    'full_day', 'morning_half', 'afternoon_half',
    'morning_quarter', 'afternoon_quarter'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type leave_status as enum ('pending', 'approved', 'rejected', 'cancelled');
exception when duplicate_object then null; end $$;

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  login_id citext not null,
  password_hash text not null,
  name varchar(50) not null,
  position employee_position not null,
  department employee_department not null,
  phone varchar(13) not null,
  profile_image_url text,
  role employee_role not null default 'employee',
  account_status account_status not null default 'pending',
  failed_login_count smallint not null default 0,
  locked_until timestamptz,
  security_question varchar(64),
  security_answer_hash text,
  password_changed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz,
  constraint employees_login_id_unique unique (login_id),
  constraint employees_login_id_format check (login_id ~ '^[a-z0-9._-]{4,32}$'),
  constraint employees_password_hash_format check (password_hash ~ '^\$2[aby]\$'),
  constraint employees_name_length check (char_length(trim(name)) between 2 and 50),
  constraint employees_phone_format check (phone ~ '^010-[0-9]{4}-[0-9]{4}$'),
  constraint employees_failed_login_count_check check (failed_login_count between 0 and 20),
  constraint employees_security_question_value_check check (
    security_question is null or security_question in (
      'high_school', 'first_pet', 'childhood_neighborhood',
      'favorite_teacher', 'first_company'
    )
  ),
  constraint employees_security_answer_hash_format check (
    security_answer_hash is null or security_answer_hash ~ '^\$2[aby]\$'
  ),
  constraint employees_security_recovery_pair_check check (
    (security_question is null and security_answer_hash is null)
    or (security_question is not null and security_answer_hash is not null)
  )
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  session_token_hash char(64) not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint sessions_token_hash_unique unique (session_token_hash),
  constraint sessions_token_hash_format check (session_token_hash ~ '^[0-9a-f]{64}$'),
  constraint sessions_expiry_check check (expires_at > created_at)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title varchar(120) not null,
  description text not null,
  owner_id uuid not null references public.employees(id) on delete restrict,
  department employee_department not null,
  start_date date not null,
  end_date date not null,
  related_link text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_title_length check (char_length(trim(title)) between 1 and 120),
  constraint tasks_description_length check (char_length(description) <= 10000),
  constraint tasks_date_range check (end_date >= start_date),
  constraint tasks_related_link_length check (related_link is null or char_length(related_link) <= 2048)
);

create table if not exists public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  file_name varchar(255) not null,
  file_url text not null,
  mime_type varchar(120) not null,
  file_size_bytes integer not null,
  uploaded_by uuid not null references public.employees(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint task_attachments_size_check check (file_size_bytes > 0 and file_size_bytes <= 4194304),
  constraint task_attachments_name_length check (char_length(trim(file_name)) between 1 and 255)
);

create table if not exists public.task_participants (
  task_id uuid not null references public.tasks(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (task_id, employee_id)
);

create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  leave_type leave_type not null,
  start_date date not null,
  end_date date not null,
  day_type leave_day_type not null default 'full_day',
  reason text not null,
  handover_note text,
  attachment_url text,
  attachment_name varchar(255),
  attachment_mime_type varchar(120),
  attachment_size_bytes integer,
  status leave_status not null default 'pending',
  rejection_reason text,
  approved_by uuid references public.employees(id) on delete restrict,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leave_requests_date_range check (end_date >= start_date),
  constraint leave_requests_reason_length check (char_length(trim(reason)) between 1 and 3000),
  constraint leave_requests_handover_length check (handover_note is null or char_length(handover_note) <= 5000),
  constraint leave_requests_attachment_size check (
    attachment_size_bytes is null or (attachment_size_bytes > 0 and attachment_size_bytes <= 4194304)
  ),
  constraint leave_requests_approval_fields check (
    status <> 'approved' or (approved_by is not null and approved_at is not null)
  ),
  constraint leave_requests_rejection_reason check (
    status <> 'rejected' or char_length(trim(rejection_reason)) > 0
  )
);

create table if not exists public.company_holidays (
  id uuid primary key default gen_random_uuid(),
  title varchar(100) not null,
  holiday_date date not null,
  description text,
  created_by uuid not null references public.employees(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint company_holidays_date_unique unique (holiday_date),
  constraint company_holidays_title_length check (char_length(trim(title)) between 1 and 100),
  constraint company_holidays_description_length check (description is null or char_length(description) <= 2000)
);

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  subject varchar(120) not null,
  content text not null,
  meeting_date date not null,
  start_time time not null,
  end_time time not null,
  created_by uuid not null references public.employees(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meetings_subject_length check (char_length(trim(subject)) between 1 and 120),
  constraint meetings_content_length check (char_length(trim(content)) between 1 and 5000),
  constraint meetings_time_range check (end_time > start_time)
);

create table if not exists public.meeting_participants (
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (meeting_id, employee_id)
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title varchar(120) not null,
  content text not null,
  created_by uuid not null references public.employees(id) on delete restrict,
  meeting_id uuid unique references public.meetings(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint announcements_title_length check (char_length(trim(title)) between 1 and 120),
  constraint announcements_content_length check (char_length(trim(content)) between 1 and 5000)
);

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

create table if not exists public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  direct_key varchar(73) not null unique,
  created_by uuid references public.employees(id) on delete set null,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chat_rooms_direct_key_length check (char_length(direct_key) = 73)
);

create table if not exists public.chat_room_members (
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  primary key (room_id, employee_id)
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  sender_id uuid references public.employees(id) on delete set null,
  content text,
  attachment_path text,
  attachment_name varchar(255),
  attachment_mime_type varchar(150),
  attachment_size_bytes bigint,
  created_at timestamptz not null default now(),
  constraint chat_messages_content_length check (content is null or char_length(content) between 1 and 3000),
  constraint chat_messages_payload_check check (content is not null or attachment_path is not null),
  constraint chat_messages_attachment_fields_check check (
    (attachment_path is null and attachment_name is null and attachment_mime_type is null and attachment_size_bytes is null)
    or
    (attachment_path is not null and attachment_name is not null and attachment_mime_type is not null and attachment_size_bytes between 1 and 4194304)
  )
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id) on delete set null,
  action_type varchar(80) not null,
  target_type varchar(50) not null,
  target_id uuid,
  changed_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint activity_logs_action_type_length check (char_length(trim(action_type)) between 1 and 80),
  constraint activity_logs_target_type_length check (char_length(trim(target_type)) between 1 and 50)
);

-- IP 원문은 저장하지 않고 애플리케이션에서 SHA-256 해시한 값만 기록합니다.
create table if not exists public.login_attempts (
  id bigserial primary key,
  login_id citext not null,
  ip_hash char(64) not null,
  succeeded boolean not null default false,
  created_at timestamptz not null default now(),
  constraint login_attempts_ip_hash_format check (ip_hash ~ '^[0-9a-f]{64}$')
);

create index if not exists employees_status_department_idx
  on public.employees (account_status, department);
create index if not exists employees_position_idx on public.employees (position);
create index if not exists sessions_employee_id_idx on public.sessions (employee_id);
create index if not exists sessions_expires_at_idx on public.sessions (expires_at);
create index if not exists tasks_owner_dates_idx on public.tasks (owner_id, start_date, end_date);
create index if not exists tasks_calendar_dates_idx on public.tasks (start_date, end_date);
create index if not exists task_attachments_task_id_idx on public.task_attachments (task_id);
create index if not exists task_participants_employee_id_idx
  on public.task_participants (employee_id, task_id);
create index if not exists leave_requests_employee_dates_idx
  on public.leave_requests (employee_id, start_date, end_date);
create index if not exists leave_requests_status_dates_idx
  on public.leave_requests (status, start_date, end_date);
create index if not exists activity_logs_employee_created_idx
  on public.activity_logs (employee_id, created_at desc);
create index if not exists activity_logs_target_idx
  on public.activity_logs (target_type, target_id, created_at desc);
create index if not exists login_attempts_guard_idx
  on public.login_attempts (login_id, ip_hash, created_at desc);
create index if not exists announcements_created_at_idx
  on public.announcements (created_at desc);
create index if not exists meetings_schedule_idx
  on public.meetings (meeting_date, start_time);
create index if not exists meeting_participants_employee_idx
  on public.meeting_participants (employee_id, meeting_id);
create index if not exists daily_work_reports_date_idx
  on public.daily_work_reports (report_date desc, employee_id);
create index if not exists chat_room_members_employee_idx
  on public.chat_room_members (employee_id, room_id);
create index if not exists chat_messages_room_created_idx
  on public.chat_messages (room_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists employees_set_updated_at on public.employees;
create trigger employees_set_updated_at before update on public.employees
for each row execute function public.set_updated_at();

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at before update on public.tasks
for each row execute function public.set_updated_at();

drop trigger if exists leave_requests_set_updated_at on public.leave_requests;
create trigger leave_requests_set_updated_at before update on public.leave_requests
for each row execute function public.set_updated_at();

drop trigger if exists announcements_set_updated_at on public.announcements;
create trigger announcements_set_updated_at before update on public.announcements
for each row execute function public.set_updated_at();

drop trigger if exists meetings_set_updated_at on public.meetings;
create trigger meetings_set_updated_at before update on public.meetings
for each row execute function public.set_updated_at();

drop trigger if exists daily_work_reports_set_updated_at on public.daily_work_reports;
create trigger daily_work_reports_set_updated_at before update on public.daily_work_reports
for each row execute function public.set_updated_at();

drop trigger if exists chat_rooms_set_updated_at on public.chat_rooms;
create trigger chat_rooms_set_updated_at before update on public.chat_rooms
for each row execute function public.set_updated_at();

-- 커스텀 직원 세션을 사용하므로 데이터 접근은 서버의 service role을 통해서만 수행합니다.
alter table public.employees enable row level security;
alter table public.sessions enable row level security;
alter table public.tasks enable row level security;
alter table public.task_attachments enable row level security;
alter table public.task_participants enable row level security;
alter table public.leave_requests enable row level security;
alter table public.company_holidays enable row level security;
alter table public.announcements enable row level security;
alter table public.meetings enable row level security;
alter table public.meeting_participants enable row level security;
alter table public.daily_work_reports enable row level security;
alter table public.chat_rooms enable row level security;
alter table public.chat_room_members enable row level security;
alter table public.chat_messages enable row level security;
alter table public.activity_logs enable row level security;
alter table public.login_attempts enable row level security;

revoke all on table public.employees from anon, authenticated;
revoke all on table public.sessions from anon, authenticated;
revoke all on table public.tasks from anon, authenticated;
revoke all on table public.task_attachments from anon, authenticated;
revoke all on table public.task_participants from anon, authenticated;
revoke all on table public.leave_requests from anon, authenticated;
revoke all on table public.company_holidays from anon, authenticated;
revoke all on table public.announcements from anon, authenticated;
revoke all on table public.meetings from anon, authenticated;
revoke all on table public.meeting_participants from anon, authenticated;
revoke all on table public.daily_work_reports from anon, authenticated;
revoke all on table public.chat_rooms from anon, authenticated;
revoke all on table public.chat_room_members from anon, authenticated;
revoke all on table public.chat_messages from anon, authenticated;
revoke all on table public.activity_logs from anon, authenticated;
revoke all on table public.login_attempts from anon, authenticated;

-- 모두 비공개 버킷입니다. 업로드/다운로드는 권한 검사 후 서버에서 서명 URL로 처리합니다.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('profile-images', 'profile-images', false, 4194304, array['image/jpeg', 'image/png', 'image/webp']),
  ('task-attachments', 'task-attachments', false, 4194304, null),
  ('leave-attachments', 'leave-attachments', false, 4194304, null),
  ('daily-work-reports', 'daily-work-reports', false, 4194304, array['image/jpeg', 'image/png', 'image/webp']),
  ('chat-attachments', 'chat-attachments', false, 4194304, null)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
