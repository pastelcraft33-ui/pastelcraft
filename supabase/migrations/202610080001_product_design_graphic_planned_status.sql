-- 제품 디자인팀 전용 '그래픽 예정' 작업 상태를 추가합니다.
-- 업무 기록 테이블은 워크스페이스를 직접 저장하지 않으므로 앱/API에서
-- 제품 디자인팀에만 이 상태를 허용합니다.

alter table public.product_design_tasks
  drop constraint if exists product_design_tasks_workflow_status_check;

alter table public.product_design_tasks
  add constraint product_design_tasks_workflow_status_check
  check (
    workflow_status in (
      'planned', 'graphic_planned', 'in_progress', 'revising',
      'in_production', 'on_hold', 'awaiting_approval', 'completed'
    )
    and (workflow_status <> 'graphic_planned' or workspace_type = 'product_design')
  );

alter table public.product_design_work_logs
  drop constraint if exists product_design_work_logs_workflow_status_check;

alter table public.product_design_work_logs
  add constraint product_design_work_logs_workflow_status_check
  check (workflow_status in (
    'planned', 'graphic_planned', 'in_progress', 'revising',
    'in_production', 'on_hold', 'awaiting_approval', 'completed'
  ));
