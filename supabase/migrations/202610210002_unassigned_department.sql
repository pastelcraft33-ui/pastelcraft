-- 먼저 실행 후 완료되어야 다음 SQL에서 새 enum 값을 사용할 수 있습니다.
alter type public.employee_department add value if not exists 'unassigned';
