-- Superadmins can delete a client and everything under it (for mistakes and test data).
-- Only callable with the secret key (from the HQ page, after the superadmin check).
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.

-- What would be deleted, shown before confirming.
create or replace function public.client_deletion_preview(p_client_id uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with s as (select id from public.schools where client_id = p_client_id)
  select jsonb_build_object(
    'schools', (select count(*) from s),
    'students', (select count(*) from public.students where school_id in (select id from s)),
    'orders', (select count(*) from public.orders where school_id in (select id from s)),
    'wallet_balance', (select coalesce(sum(balance), 0) from public.wallets where school_id in (select id from s)),
    'staff', (select count(distinct profile_id) from public.school_memberships where school_id in (select id from s)),
    -- Accounts whose current school is here and who have no other school to move to.
    'accounts_deleted', (
      select count(*) from public.profiles p
      where p.school_id in (select id from s)
        and not exists (
          select 1 from public.school_memberships m
          where m.profile_id = p.id and m.school_id not in (select id from s)
        )
        and not exists (
          select 1 from public.parent_schools ps
          where ps.parent_id = p.id and ps.school_id not in (select id from s)
        )
    )
  )
$$;

create or replace function public.delete_client(p_client_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_schools uuid[];
  v_person record;
  v_next_school uuid;
  v_next_role text;
  v_deleted int := 0;
begin
  if not exists (select 1 from public.clients where id = p_client_id) then
    raise exception 'Client not found';
  end if;

  select coalesce(array_agg(id), '{}') into v_schools from public.schools where client_id = p_client_id;

  -- People currently working in (or a parent at) one of these schools: move them to another school
  -- they belong to, or delete their account if they have none.
  for v_person in select id from public.profiles where school_id = any (v_schools) loop
    v_next_school := null;
    v_next_role := null;

    select school_id, role::text into v_next_school, v_next_role
    from public.school_memberships
    where profile_id = v_person.id and not (school_id = any (v_schools))
    order by created_at limit 1;

    if v_next_school is null then
      select school_id into v_next_school
      from public.parent_schools
      where parent_id = v_person.id and not (school_id = any (v_schools))
      limit 1;
      v_next_role := 'parent';
    end if;

    if v_next_school is not null then
      update public.profiles set school_id = v_next_school, role = v_next_role::public.user_role where id = v_person.id;
    else
      delete from auth.users where id = v_person.id;
      v_deleted := v_deleted + 1;
    end if;
  end loop;

  -- Everything else (menus, orders, bills, students, wallets, memberships, breaks...) goes with the schools.
  delete from public.schools where id = any (v_schools);
  delete from public.clients where id = p_client_id;

  return jsonb_build_object('schools', cardinality(v_schools), 'accounts_deleted', v_deleted);
end;
$$;

-- Only the server (secret key) may call these; never a logged-in user directly.
revoke execute on function public.client_deletion_preview(uuid) from public, anon, authenticated;
revoke execute on function public.delete_client(uuid) from public, anon, authenticated;
grant execute on function public.client_deletion_preview(uuid) to service_role;
grant execute on function public.delete_client(uuid) to service_role;
