-- 일일업무일지를 이미지 대신 구조화된 업무 항목으로 등록합니다.
-- 기존 이미지 자료는 계속 열람할 수 있도록 이미지 컬럼을 nullable로 전환합니다.
alter table public.daily_work_reports
  add column if not exists work_items jsonb not null default '[]'::jsonb;

alter table public.daily_work_reports
  alter column image_path drop not null,
  alter column mime_type drop not null,
  alter column file_size_bytes drop not null;

alter table public.daily_work_reports
  drop constraint if exists daily_work_reports_work_items_check;

alter table public.daily_work_reports
  add constraint daily_work_reports_work_items_check check (
    jsonb_typeof(work_items) = 'array'
    and jsonb_array_length(work_items) <= 50
    and (jsonb_array_length(work_items) > 0 or image_path is not null)
  );

comment on column public.daily_work_reports.work_items is
  '업무 내용(workContent), 사항(details), 특이사항(notes) 배열';
