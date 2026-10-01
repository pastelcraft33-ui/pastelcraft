-- 제품 디자인 작업 구분에 '예정' 선택지를 추가합니다.
alter table public.product_design_tasks
  drop constraint if exists product_design_tasks_work_type_check;

alter table public.product_design_tasks
  add constraint product_design_tasks_work_type_check
  check (work_type in ('new_product', 'existing_product_update', 'planned', 'renewal', 'banner', 'html'));
