-- 직원 직급 선택지에 신입직원을 추가하고, 남대문팀 팀장은 관리자 권한으로 설정합니다.
alter type public.employee_position
  add value if not exists 'new_employee' after 'staff';

update public.employees
set role = 'admin'
where department = 'namdaemun'
  and position = 'team_lead'
  and role is distinct from 'admin'
  and login_id not like 'deleted-%';
