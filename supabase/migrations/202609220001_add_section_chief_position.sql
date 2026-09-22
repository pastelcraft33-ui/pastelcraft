-- 직원 직급에 계장을 추가합니다. 기존 직원 데이터에는 영향을 주지 않습니다.
alter type public.employee_position
  add value if not exists 'section_chief' after 'assistant_manager';
