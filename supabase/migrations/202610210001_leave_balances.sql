-- 연차 이관 잔액 + 부여/조정 원장 + 경리 제출 마감본. 기존 휴가 기록은 변경하지 않습니다.
begin;
create table if not exists public.leave_balance_accounts (
  employee_id uuid primary key references public.employees(id) on delete cascade,
  opening_date date not null,
  opening_days numeric(9,2) not null check (opening_days * 4 = trunc(opening_days * 4)),
  monthly_enabled boolean not null default true,
  work_days integer[] not null default array[1,2,3,4,5] check (cardinality(work_days) between 1 and 7 and work_days <@ array[0,1,2,3,4,5,6]),
  exclude_holidays boolean not null default true,
  reason text not null check (length(trim(reason)) > 0),
  created_by uuid references public.employees(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.leave_balance_entries (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.leave_balance_accounts(employee_id) on delete cascade,
  effective_date date not null,
  days numeric(9,2) not null check (days <> 0 and days * 4 = trunc(days * 4)),
  kind text not null check (kind in ('grant','adjustment')),
  reason text not null check (length(trim(reason)) > 0),
  expires_on date,
  created_by uuid references public.employees(id) on delete set null,
  created_at timestamptz not null default now(),
  check (expires_on is null or expires_on >= effective_date),
  check (kind <> 'grant' or days > 0)
);
create index if not exists leave_balance_entries_employee_date on public.leave_balance_entries(employee_id,effective_date);
create table if not exists public.leave_balance_closings (
  id uuid primary key default gen_random_uuid(),
  period_month text not null unique check (period_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  snapshot jsonb not null,
  created_by uuid references public.employees(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.leave_balance_accounts enable row level security;
alter table public.leave_balance_entries enable row level security;
alter table public.leave_balance_closings enable row level security;
revoke all on public.leave_balance_accounts, public.leave_balance_entries, public.leave_balance_closings from anon, authenticated;
grant all on public.leave_balance_accounts, public.leave_balance_entries, public.leave_balance_closings to service_role;

-- 같은 트랜잭션에서 관리자 변경 이력을 기록합니다. 실패하면 원장 변경도 취소됩니다.
create or replace function public.audit_leave_balance_write() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.activity_logs(employee_id,action_type,target_type,target_id,changed_data)
  values(new.created_by, 'leave_balance.' || tg_table_name, tg_table_name,
    case when tg_table_name = 'leave_balance_accounts' then (to_jsonb(new)->>'employee_id')::uuid else (to_jsonb(new)->>'id')::uuid end,
    to_jsonb(new));
  return new;
end $$;
revoke all on function public.audit_leave_balance_write() from public, anon, authenticated;
drop trigger if exists audit_leave_balance_account on public.leave_balance_accounts;
create trigger audit_leave_balance_account after insert on public.leave_balance_accounts for each row execute function public.audit_leave_balance_write();
drop trigger if exists audit_leave_balance_entry on public.leave_balance_entries;
create trigger audit_leave_balance_entry after insert on public.leave_balance_entries for each row execute function public.audit_leave_balance_write();
drop trigger if exists audit_leave_balance_closing on public.leave_balance_closings;
create trigger audit_leave_balance_closing after insert on public.leave_balance_closings for each row execute function public.audit_leave_balance_write();
commit;
