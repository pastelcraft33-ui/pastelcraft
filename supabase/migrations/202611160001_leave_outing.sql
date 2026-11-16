-- 외출 시각은 회사 기준 한국 현지 시각으로 저장합니다.
alter type public.leave_day_type add value if not exists 'outing';
alter table public.leave_requests
  add column if not exists start_time time,
  add column if not exists end_time time;
alter table public.leave_requests drop constraint if exists leave_outing_times;
alter table public.leave_requests add constraint leave_outing_times check (
  (day_type::text = 'outing' and start_time is not null and end_time is not null
    and end_date + end_time > start_date + start_time)
  or (day_type::text <> 'outing' and start_time is null and end_time is null)
);
