-- 모든 웹팀 작업 등록에 '기타' 구분을 추가합니다. 기존 데이터는 유지합니다.
begin;

alter table public.product_design_tasks
  drop constraint if exists product_design_tasks_work_type_check;

alter table public.product_design_tasks
  add constraint product_design_tasks_work_type_check
  check (work_type in (
    'new_product', 'existing_product_update', 'planned',
    'renewal', 'banner', 'html', 'other'
  ));

commit;
