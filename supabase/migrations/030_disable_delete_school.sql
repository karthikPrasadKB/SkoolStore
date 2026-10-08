-- School admins can disable (pause) or delete an individual school.
-- Disabled school: parents can't see it and its counter/canteen staff can't use it; its admins still can
-- (so they can turn it back on). A disabled client (from HQ) still blocks everyone, admins included.
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.

alter table public.schools
  add column if not exists is_disabled boolean not null default false,
  add column if not exists disabled_at timestamptz;

-- For parents and ordering: is this school unavailable (its own switch, or its client's)?
create or replace function public.school_is_disabled(p_school_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select s.is_disabled or coalesce(c.is_disabled, false)
    from public.schools s left join public.clients c on c.id = s.client_id
    where s.id = p_school_id
  ), false)
$$;

-- For staff: is the logged-in person locked out of this school?
-- Yes if the client is disabled, or the school is disabled and they aren't one of its admins.
create or replace function public.access_paused_at(p_school_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select coalesce(c.is_disabled, false)
        or (s.is_disabled and coalesce((
              select m.role::text from public.school_memberships m
              where m.profile_id = auth.uid() and m.school_id = s.id
            ), '') <> 'admin')
    from public.schools s left join public.clients c on c.id = s.client_id
    where s.id = p_school_id
  ), false)
$$;

grant execute on function public.access_paused_at(uuid) to authenticated;

-- Staff who are locked out lose their role, so every staff security rule stops working for them.
create or replace function public.my_role()
returns public.user_role
language sql stable security definer set search_path = ''
as $$
  select case
    when p.role <> 'parent' and public.access_paused_at(p.school_id) then null
    else p.role
  end
  from public.profiles p
  where p.id = auth.uid()
$$;

-- Switching into a school you're locked out of isn't allowed (admins may switch into their disabled school).
create or replace function public.switch_school(p_school_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_role public.user_role;
begin
  select role into v_role from public.school_memberships
  where profile_id = auth.uid() and school_id = p_school_id;
  if v_role is null then
    raise exception 'You don''t work at that school';
  end if;
  if public.access_paused_at(p_school_id) then
    raise exception 'That school''s access has been paused';
  end if;
  update public.profiles set school_id = p_school_id, role = v_role where id = auth.uid();
end;
$$;

-- Internal: is the logged-in person an admin of this school (and is its client active)?
create or replace function public.is_school_admin(p_school_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.school_memberships m
    join public.schools s on s.id = m.school_id
    left join public.clients c on c.id = s.client_id
    where m.profile_id = auth.uid() and m.school_id = p_school_id and m.role = 'admin'
      and not coalesce(c.is_disabled, false)
  )
$$;

-- Turn a school off or on. ------------------------------------------------------------

create or replace function public.set_school_disabled(p_school_id uuid, p_disabled boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_school_admin(p_school_id) then
    raise exception 'Only this school''s admins can do that';
  end if;
  update public.schools
  set is_disabled = p_disabled, disabled_at = case when p_disabled then now() end
  where id = p_school_id;
end;
$$;

revoke execute on function public.set_school_disabled(uuid, boolean) from public, anon;
grant execute on function public.set_school_disabled(uuid, boolean) to authenticated;

-- Delete a school. ---------------------------------------------------------------------

create or replace function public.school_deletion_preview(p_school_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_school_admin(p_school_id) then
    raise exception 'Only this school''s admins can do that';
  end if;
  return jsonb_build_object(
    'students', (select count(*) from public.students where school_id = p_school_id),
    'orders', (select count(*) from public.orders where school_id = p_school_id),
    'wallet_balance', (select coalesce(sum(balance), 0) from public.wallets where school_id = p_school_id),
    'staff', (select count(*) from public.school_memberships where school_id = p_school_id),
    -- True if this is the caller's only school and they aren't the client's main admin: their login is removed.
    'removes_you', not exists (
        select 1 from public.school_memberships where profile_id = auth.uid() and school_id <> p_school_id
      ) and not exists (select 1 from public.client_admins where user_id = auth.uid()),
    -- True if this is the client admin's only school: they'll be asked to create a new one.
    'last_school', not exists (
        select 1 from public.school_memberships where profile_id = auth.uid() and school_id <> p_school_id
      )
  );
end;
$$;

create or replace function public.delete_school(p_school_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_person record;
  v_next_school uuid;
  v_next_role text;
  v_deleted int := 0;
begin
  if not public.is_school_admin(p_school_id) then
    raise exception 'Only this school''s admins can do that';
  end if;

  -- People working in (or a parent at) this school: move them to another school they belong to.
  -- A client's admin with no other school keeps their login and creates a new school.
  -- Anyone else with nowhere to go has their account removed.
  for v_person in select id from public.profiles where school_id = p_school_id loop
    v_next_school := null;
    v_next_role := null;

    select school_id, role::text into v_next_school, v_next_role
    from public.school_memberships
    where profile_id = v_person.id and school_id <> p_school_id
    order by created_at limit 1;

    if v_next_school is null then
      select school_id into v_next_school
      from public.parent_schools
      where parent_id = v_person.id and school_id <> p_school_id
      limit 1;
      v_next_role := 'parent';
    end if;

    if v_next_school is not null then
      update public.profiles set school_id = v_next_school, role = v_next_role::public.user_role where id = v_person.id;
    elsif exists (select 1 from public.client_admins where user_id = v_person.id) then
      delete from public.profiles where id = v_person.id;
    else
      delete from auth.users where id = v_person.id;
      v_deleted := v_deleted + 1;
    end if;
  end loop;

  -- Menus, orders, bills, students, wallets, memberships and breaks go with the school.
  delete from public.schools where id = p_school_id;

  return jsonb_build_object('accounts_deleted', v_deleted);
end;
$$;

revoke execute on function public.school_deletion_preview(uuid) from public, anon;
revoke execute on function public.delete_school(uuid) from public, anon;
grant execute on function public.school_deletion_preview(uuid) to authenticated;
grant execute on function public.delete_school(uuid) to authenticated;
