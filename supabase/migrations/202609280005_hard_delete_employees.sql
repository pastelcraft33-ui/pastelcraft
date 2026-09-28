-- 관리자 직원 삭제를 익명화가 아닌 실제 삭제로 전환합니다.
-- 직원 소유 데이터는 함께 삭제하고, 다른 직원 기록에 남은 승인자·작성자 참조는 null로 정리합니다.

alter table public.tasks drop constraint if exists tasks_owner_id_fkey;
alter table public.tasks
  add constraint tasks_owner_id_fkey foreign key (owner_id)
  references public.employees(id) on delete cascade;

alter table public.task_attachments drop constraint if exists task_attachments_uploaded_by_fkey;
alter table public.task_attachments
  add constraint task_attachments_uploaded_by_fkey foreign key (uploaded_by)
  references public.employees(id) on delete cascade;

alter table public.task_participants drop constraint if exists task_participants_employee_id_fkey;
alter table public.task_participants
  add constraint task_participants_employee_id_fkey foreign key (employee_id)
  references public.employees(id) on delete cascade;

alter table public.leave_requests drop constraint if exists leave_requests_employee_id_fkey;
alter table public.leave_requests
  add constraint leave_requests_employee_id_fkey foreign key (employee_id)
  references public.employees(id) on delete cascade;

alter table public.leave_requests drop constraint if exists leave_requests_approved_by_fkey;
alter table public.leave_requests
  add constraint leave_requests_approved_by_fkey foreign key (approved_by)
  references public.employees(id) on delete set null;

alter table public.leave_requests drop constraint if exists leave_requests_team_lead_reviewed_by_fkey;
alter table public.leave_requests
  add constraint leave_requests_team_lead_reviewed_by_fkey foreign key (team_lead_reviewed_by)
  references public.employees(id) on delete set null;

alter table public.leave_requests drop constraint if exists leave_requests_representative_reviewed_by_fkey;
alter table public.leave_requests
  add constraint leave_requests_representative_reviewed_by_fkey foreign key (representative_reviewed_by)
  references public.employees(id) on delete set null;

alter table public.leave_requests drop constraint if exists leave_requests_approval_fields;
alter table public.leave_requests
  add constraint leave_requests_approval_fields
  check (status <> 'approved' or approved_at is not null);

alter table public.company_holidays alter column created_by drop not null;
alter table public.company_holidays drop constraint if exists company_holidays_created_by_fkey;
alter table public.company_holidays
  add constraint company_holidays_created_by_fkey foreign key (created_by)
  references public.employees(id) on delete set null;

alter table public.meetings drop constraint if exists meetings_created_by_fkey;
alter table public.meetings
  add constraint meetings_created_by_fkey foreign key (created_by)
  references public.employees(id) on delete cascade;

alter table public.meeting_participants drop constraint if exists meeting_participants_employee_id_fkey;
alter table public.meeting_participants
  add constraint meeting_participants_employee_id_fkey foreign key (employee_id)
  references public.employees(id) on delete cascade;

alter table public.announcements drop constraint if exists announcements_created_by_fkey;
alter table public.announcements
  add constraint announcements_created_by_fkey foreign key (created_by)
  references public.employees(id) on delete cascade;

alter table public.daily_work_reports drop constraint if exists daily_work_reports_employee_id_fkey;
alter table public.daily_work_reports
  add constraint daily_work_reports_employee_id_fkey foreign key (employee_id)
  references public.employees(id) on delete cascade;

alter table public.product_design_tasks alter column created_by drop not null;
alter table public.product_design_tasks drop constraint if exists product_design_tasks_created_by_fkey;
alter table public.product_design_tasks
  add constraint product_design_tasks_created_by_fkey foreign key (created_by)
  references public.employees(id) on delete set null;

alter table public.product_design_tasks drop constraint if exists product_design_tasks_assigned_to_fkey;
alter table public.product_design_tasks
  add constraint product_design_tasks_assigned_to_fkey foreign key (assigned_to)
  references public.employees(id) on delete cascade;

alter table public.product_design_work_logs alter column author_id drop not null;
alter table public.product_design_work_logs drop constraint if exists product_design_work_logs_author_id_fkey;
alter table public.product_design_work_logs
  add constraint product_design_work_logs_author_id_fkey foreign key (author_id)
  references public.employees(id) on delete set null;

create or replace function public.hard_delete_employee(
  target_employee_id uuid,
  actor_employee_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_login_id text;
begin
  if target_employee_id = actor_employee_id then
    raise exception '현재 로그인한 계정은 삭제할 수 없습니다.';
  end if;

  select login_id::text
  into target_login_id
  from public.employees
  where id = target_employee_id
  for update;

  if target_login_id is null then
    raise exception '직원 계정을 찾을 수 없습니다.';
  end if;
  if target_login_id = 'pastelcraft' then
    raise exception '대표 계정은 삭제할 수 없습니다.';
  end if;

  -- 1:1 대화방은 삭제 직원이 남지 않도록 방과 메시지를 함께 제거합니다.
  delete from public.chat_rooms
  where id in (
    select room_id
    from public.chat_room_members
    where employee_id = target_employee_id
  );

  delete from public.activity_logs
  where employee_id = target_employee_id
     or (target_type = 'employee' and target_id = target_employee_id);

  delete from public.login_attempts where login_id = target_login_id;
  delete from public.employees where id = target_employee_id;

  insert into public.activity_logs (
    employee_id,
    action_type,
    target_type,
    target_id,
    changed_data
  ) values (
    actor_employee_id,
    'admin.employee.hard_delete',
    'employee',
    null,
    jsonb_build_object('account_permanently_deleted', true)
  );
end;
$$;

revoke all on function public.hard_delete_employee(uuid, uuid) from public, anon, authenticated;
grant execute on function public.hard_delete_employee(uuid, uuid) to service_role;

-- 과거 방식으로 익명화된 직원과 연결 데이터를 실제로 제거합니다.
delete from public.chat_rooms
where id in (
  select room_id
  from public.chat_room_members
  where employee_id in (
    select id from public.employees
    where login_id::text like 'deleted-%'
  )
);

delete from public.activity_logs
where employee_id in (
    select id from public.employees
    where login_id::text like 'deleted-%'
  )
   or (
     target_type = 'employee'
     and target_id in (
       select id from public.employees
       where login_id::text like 'deleted-%'
     )
   );

delete from public.employees where login_id::text like 'deleted-%';
