-- 202610210002 실행 완료 후 별도로 실행하세요.
begin;
do $$
declare
  target public.employees%rowtype;
begin
  select * into strict target from public.employees
  where id = '5da8c37a-a1aa-4294-b586-31db17cd421d'
    and login_id = 'pastelcraft' and name = '김도아';

  if target.department::text <> 'unassigned' or target.role::text <> 'admin'
      or target.position::text <> 'representative' then
    update public.employees
    set department = 'unassigned', role = 'admin', position = 'representative',
        updated_at = now()
    where id = target.id;

    insert into public.activity_logs(employee_id, action_type, target_type, target_id, changed_data)
    values (target.id, 'employee_updated', 'employee', target.id,
      jsonb_build_object('department', jsonb_build_object('before', target.department, 'after', 'unassigned'),
        'role', jsonb_build_object('before', target.role, 'after', 'admin'),
        'position', jsonb_build_object('before', target.position, 'after', 'representative')));
  end if;
end $$;
commit;
