-- 메인 캘린더의 기본 탭을 휴가 캘린더로 변경합니다.
alter table public.system_settings
  alter column default_calendar_tab set default 'leave';

update public.system_settings
set default_calendar_tab = 'leave'
where id = true;
