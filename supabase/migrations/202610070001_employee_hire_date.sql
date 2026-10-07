-- 직원 관리에서 팀장·대표자·관리자가 직원별 입사일을 기록할 수 있도록 합니다.
alter table public.employees
  add column if not exists hire_date date;

comment on column public.employees.hire_date is '회사 입사일';
