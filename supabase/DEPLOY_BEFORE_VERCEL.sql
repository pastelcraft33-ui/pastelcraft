-- 현재 Supabase 프로젝트를 배포 코드와 맞추기 위한 재실행 가능한 SQL입니다.
-- SQL Editor에서 전체를 한 번에 실행합니다. Storage 객체를 삭제하지 않습니다.

alter type public.employee_department add value if not exists 'namdaemun';

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
