-- 기존 웹팀 소속을 보존하면서 웹디자인팀과 웹마케팅팀을 추가합니다.
-- 기존 직원의 실제 배치는 관리자 직원 관리 화면에서 지정합니다.
alter type public.employee_department add value if not exists 'web_design';
alter type public.employee_department add value if not exists 'web_marketing';

-- 직원 부서를 바꾸면 담당 업무도 같은 팀으로 이동시켜 본인 업무 접근을 유지합니다.
create or replace function public.sync_tasks_department_on_employee_department_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.department is distinct from old.department then
    update public.tasks
    set department = new.department,
        updated_at = now()
    where owner_id = new.id
      and department = old.department;
  end if;
  return new;
end;
$$;

drop trigger if exists employees_sync_tasks_department on public.employees;
create trigger employees_sync_tasks_department
after update of department on public.employees
for each row
execute function public.sync_tasks_department_on_employee_department_change();
