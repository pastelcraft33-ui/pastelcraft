-- 교육팀 작업 공간을 마케팅팀과 같은 형태로 분리 저장합니다.
alter table public.product_design_tasks
  drop constraint if exists product_design_tasks_workspace_type_check;

alter table public.product_design_tasks
  add constraint product_design_tasks_workspace_type_check
  check (workspace_type in ('product_design', 'web_design', 'web_marketing', 'web_education'));

comment on column public.product_design_tasks.workspace_type is
  '작업 영역: product_design(제품 디자인팀), web_design(웹 디자인팀), web_marketing(마케팅팀), web_education(교육팀)';
