-- 마케팅 팀 업무를 웹 디자인·제품 디자인 작업과 분리해 저장합니다.
alter table public.product_design_tasks
  drop constraint if exists product_design_tasks_workspace_type_check;

alter table public.product_design_tasks
  add constraint product_design_tasks_workspace_type_check
  check (workspace_type in ('product_design', 'web_design', 'web_marketing'));

comment on column public.product_design_tasks.workspace_type is
  '작업 영역: product_design(제품 디자인팀), web_design(웹 디자인팀), web_marketing(마케팅 팀)';
