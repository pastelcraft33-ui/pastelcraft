-- 웹 디자인팀 등록: 메인배너/팝업배너 구분과 수량 저장. 기존 작업은 유지합니다.
begin;

alter table public.product_design_tasks
  add column if not exists work_quantity integer;

alter table public.product_design_tasks
  drop constraint if exists product_design_tasks_work_quantity_check;
alter table public.product_design_tasks
  add constraint product_design_tasks_work_quantity_check
  check (work_quantity is null or work_quantity between 1 and 999999);

alter table public.product_design_tasks
  drop constraint if exists product_design_tasks_work_type_check;
alter table public.product_design_tasks
  add constraint product_design_tasks_work_type_check
  check (work_type in (
    'new_product', 'existing_product_update', 'planned', 'renewal',
    'banner', 'main_banner', 'popup_banner', 'html', 'other'
  ));

commit;
