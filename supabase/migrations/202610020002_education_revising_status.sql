-- 교육팀 업무에만 사용할 '수정중' 상태를 저장할 수 있도록 상태 제약을 확장합니다.
alter table public.product_design_tasks
  drop constraint if exists product_design_tasks_workflow_status_check;

alter table public.product_design_tasks
  add constraint product_design_tasks_workflow_status_check
  check (workflow_status in (
    'planned', 'in_progress', 'revising', 'in_production',
    'on_hold', 'awaiting_approval', 'completed'
  ));

alter table public.product_design_work_logs
  drop constraint if exists product_design_work_logs_workflow_status_check;

alter table public.product_design_work_logs
  add constraint product_design_work_logs_workflow_status_check
  check (workflow_status in (
    'planned', 'in_progress', 'revising', 'in_production',
    'on_hold', 'awaiting_approval', 'completed'
  ));
