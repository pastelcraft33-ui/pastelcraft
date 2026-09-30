-- 웹 디자인팀 HTML 작업 구분과 작업별 엑셀 자료
alter table public.product_design_tasks
  drop constraint if exists product_design_tasks_work_type_check;

alter table public.product_design_tasks
  add constraint product_design_tasks_work_type_check
  check (work_type in ('new_product', 'existing_product_update', 'renewal', 'banner', 'html'));

alter table public.product_design_tasks
  add column if not exists spreadsheet_path text,
  add column if not exists spreadsheet_file_name varchar(255),
  add column if not exists spreadsheet_size_bytes bigint;

alter table public.product_design_tasks
  drop constraint if exists product_design_tasks_spreadsheet_metadata_check;

alter table public.product_design_tasks
  add constraint product_design_tasks_spreadsheet_metadata_check
  check (
    (spreadsheet_path is null and spreadsheet_file_name is null and spreadsheet_size_bytes is null)
    or
    (spreadsheet_path is not null and spreadsheet_file_name is not null
      and spreadsheet_size_bytes between 1 and 4194304)
  );

comment on column public.product_design_tasks.spreadsheet_path is
  '웹 디자인 작업에 첨부한 비공개 엑셀 파일의 Supabase Storage 경로';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-design-files',
  'product-design-files',
  false,
  4194304,
  array[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/octet-stream',
    'text/csv',
    'application/csv',
    'text/plain'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- 업로드와 다운로드는 서버의 service_role 클라이언트가 서명 URL로 처리합니다.
-- 브라우저의 직접 접근 정책은 추가하지 않습니다.
