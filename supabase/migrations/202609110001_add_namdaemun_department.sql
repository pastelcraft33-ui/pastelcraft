-- 직원·업무에 사용할 남대문팀 부서 코드 추가
alter type public.employee_department add value if not exists 'namdaemun';
