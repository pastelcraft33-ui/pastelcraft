-- 직원 가입 및 관리자 직원 등록에서 사용할 강사 직급을 추가합니다.
-- 기존 직원 데이터에는 영향을 주지 않습니다.
alter type public.employee_position
  add value if not exists 'instructor' after 'staff';
