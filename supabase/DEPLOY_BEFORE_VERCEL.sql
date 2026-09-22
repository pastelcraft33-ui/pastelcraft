-- 현재 Supabase 프로젝트를 배포 코드와 맞추기 위한 재실행 가능한 SQL입니다.
-- SQL Editor에서 전체를 한 번에 실행합니다. Storage 객체를 삭제하지 않습니다.

alter type public.employee_department add value if not exists 'namdaemun';
alter type public.employee_position add value if not exists 'section_chief' after 'assistant_manager';

do $$
begin
  if to_regclass('public.system_settings') is not null then
    alter table public.system_settings
      alter column default_calendar_tab set default 'leave';
    update public.system_settings
      set default_calendar_tab = 'leave'
      where id = true;
  end if;
end $$;

create table if not exists public.task_participants (
  task_id uuid not null references public.tasks(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (task_id, employee_id)
);

create index if not exists task_participants_employee_id_idx
  on public.task_participants (employee_id, task_id);

alter table public.task_participants enable row level security;
revoke all on table public.task_participants from anon, authenticated;

drop index if exists public.tasks_department_status_idx;
alter table public.tasks drop column if exists status;
drop type if exists public.task_status;

alter type public.leave_type add value if not exists 'morning_quarter';
alter type public.leave_type add value if not exists 'afternoon_quarter';
alter type public.leave_day_type add value if not exists 'morning_quarter';
alter type public.leave_day_type add value if not exists 'afternoon_quarter';

update storage.buckets
set file_size_limit = 4194304
where id in ('profile-images', 'task-attachments', 'leave-attachments');

-- 날짜별 일일업무일지와 비공개 이미지 Storage
create table if not exists public.daily_work_reports (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  report_date date not null,
  image_path text,
  mime_type varchar(100),
  file_size_bytes bigint,
  work_items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_work_reports_employee_date_unique unique (employee_id, report_date),
  constraint daily_work_reports_image_path_unique unique (image_path),
  constraint daily_work_reports_image_path_length check (char_length(trim(image_path)) between 1 and 1024),
  constraint daily_work_reports_mime_type_check check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  constraint daily_work_reports_file_size_check check (file_size_bytes between 1 and 4194304),
  constraint daily_work_reports_work_items_check check (
    jsonb_typeof(work_items) = 'array'
    and jsonb_array_length(work_items) <= 50
    and (jsonb_array_length(work_items) > 0 or image_path is not null)
  )
);

alter table public.daily_work_reports
  add column if not exists work_items jsonb not null default '[]'::jsonb;
alter table public.daily_work_reports
  alter column image_path drop not null,
  alter column mime_type drop not null,
  alter column file_size_bytes drop not null;
alter table public.daily_work_reports
  drop constraint if exists daily_work_reports_work_items_check;
alter table public.daily_work_reports
  add constraint daily_work_reports_work_items_check check (
    jsonb_typeof(work_items) = 'array'
    and jsonb_array_length(work_items) <= 50
    and (jsonb_array_length(work_items) > 0 or image_path is not null)
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
values ('daily-work-reports', 'daily-work-reports', false, 4194304, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 파스텔 메신저: 1:1 채팅, 읽음 상태, 비공개 첨부파일
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

create index if not exists chat_room_members_employee_idx on public.chat_room_members (employee_id, room_id);
create index if not exists chat_messages_room_created_idx on public.chat_messages (room_id, created_at desc);
drop trigger if exists chat_rooms_set_updated_at on public.chat_rooms;
create trigger chat_rooms_set_updated_at before update on public.chat_rooms
for each row execute function public.set_updated_at();
alter table public.chat_rooms enable row level security;
alter table public.chat_room_members enable row level security;
alter table public.chat_messages enable row level security;
revoke all on table public.chat_rooms from anon, authenticated;
revoke all on table public.chat_room_members from anon, authenticated;
revoke all on table public.chat_messages from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-attachments', 'chat-attachments', false, 4194304, null)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 캘린더 상단 공지사항
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title varchar(120) not null,
  content text not null,
  created_by uuid not null references public.employees(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint announcements_title_length check (char_length(trim(title)) between 1 and 120),
  constraint announcements_content_length check (char_length(trim(content)) between 1 and 5000)
);

create index if not exists announcements_created_at_idx
  on public.announcements (created_at desc);

drop trigger if exists announcements_set_updated_at on public.announcements;
create trigger announcements_set_updated_at
before update on public.announcements
for each row execute function public.set_updated_at();

alter table public.announcements enable row level security;
revoke all on table public.announcements from anon, authenticated;

-- 회의실과 참여자, 공지사항 자동 연결
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

alter table public.announcements add column if not exists meeting_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'announcements_meeting_id_fkey'
      and conrelid = 'public.announcements'::regclass
  ) then
    alter table public.announcements
      add constraint announcements_meeting_id_fkey
      foreign key (meeting_id) references public.meetings(id) on delete cascade;
  end if;
end $$;

create unique index if not exists announcements_meeting_id_unique_idx
  on public.announcements (meeting_id) where meeting_id is not null;
create index if not exists meetings_schedule_idx
  on public.meetings (meeting_date, start_time);
create index if not exists meeting_participants_employee_idx
  on public.meeting_participants (employee_id, meeting_id);

drop trigger if exists meetings_set_updated_at on public.meetings;
create trigger meetings_set_updated_at before update on public.meetings
for each row execute function public.set_updated_at();

alter table public.meetings enable row level security;
alter table public.meeting_participants enable row level security;
revoke all on table public.meetings from anon, authenticated;
revoke all on table public.meeting_participants from anon, authenticated;

-- 아이디 찾기와 보안 질문 기반 비밀번호 재설정
alter table public.employees
  add column if not exists security_question varchar(64),
  add column if not exists security_answer_hash text,
  add column if not exists password_changed_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'employees_security_question_value_check'
      and conrelid = 'public.employees'::regclass
  ) then
    alter table public.employees
      add constraint employees_security_question_value_check check (
        security_question is null or security_question in (
          'high_school', 'first_pet', 'childhood_neighborhood',
          'favorite_teacher', 'first_company'
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'employees_security_answer_hash_format'
      and conrelid = 'public.employees'::regclass
  ) then
    alter table public.employees
      add constraint employees_security_answer_hash_format check (
        security_answer_hash is null or security_answer_hash ~ '^\$2[aby]\$'
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'employees_security_recovery_pair_check'
      and conrelid = 'public.employees'::regclass
  ) then
    alter table public.employees
      add constraint employees_security_recovery_pair_check check (
        (security_question is null and security_answer_hash is null)
        or
        (security_question is not null and security_answer_hash is not null)
      );
  end if;
end $$;
