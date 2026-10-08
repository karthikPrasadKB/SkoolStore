-- Clients: only the admin's details are required. Client name/email/phone are optional.
-- A new client's admin creates their own schools after their first login.
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.

alter table public.clients alter column email drop not null;
alter table public.clients alter column phone drop not null;

-- The admins HQ creates for a client (before and after they've made their first school).
create table if not exists public.client_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  full_name text not null,
  username text not null unique,
  phone text not null,
  contact_email text,
  created_at timestamptz not null default now()
);

alter table public.client_admins enable row level security;

drop policy if exists "Client admins can view themselves" on public.client_admins;
create policy "Client admins can view themselves"
  on public.client_admins for select to authenticated
  using (user_id = auth.uid());

revoke insert, update, delete on public.client_admins from anon, authenticated;

-- New accounts: skip the school profile for superadmins and new client admins. --------

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_school_id uuid;
begin
  -- Superadmin logins (made by scripts/create-superadmin.mjs) sit above all schools, so they get no school
  -- profile. The marker arrives with the new account's details. Anyone could send it, but it only skips the
  -- profile: such an account can do nothing unless the secret key also adds it to platform_admins.
  -- Superadmins and new client admins (who haven't created a school yet) get no school profile here.
  -- Anyone could send these markers, but they only skip the profile: the account can do nothing unless
  -- the secret key also adds it to platform_admins or client_admins.
  if coalesce(new.raw_user_meta_data ->> 'account_type', '') in ('superadmin', 'client_admin')
     or coalesce(new.raw_app_meta_data ->> 'platform_admin', '') = 'true' then
    return new;
  end if;

  select id into v_school_id
  from public.schools
  where join_code = upper(trim(new.raw_user_meta_data ->> 'school_code'));

  if v_school_id is null then
    raise exception 'Invalid school code';
  end if;

  insert into public.profiles (id, school_id, full_name, phone)
  values (
    new.id,
    v_school_id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'phone', '')
  );

  insert into public.parent_schools (parent_id, school_id) values (new.id, v_school_id);

  -- Extra schools for parents whose children go to more than one school.
  insert into public.parent_schools (parent_id, school_id)
  select new.id, s.id
  from public.schools s
  where s.join_code in (
    select upper(trim(code))
    from jsonb_array_elements_text(coalesce(new.raw_user_meta_data -> 'school_codes', '[]'::jsonb)) as code
  )
  on conflict do nothing;

  return new;
end;
$$;

-- For a client admin with no school yet: their client's name (or null if this isn't one).
create or replace function public.my_pending_client()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('client_name', c.name, 'full_name', ca.full_name, 'disabled', c.is_disabled)
  from public.client_admins ca
  join public.clients c on c.id = ca.client_id
  where ca.user_id = auth.uid()
    and not exists (select 1 from public.profiles p where p.id = auth.uid())
$$;

revoke execute on function public.my_pending_client() from public, anon;
grant execute on function public.my_pending_client() to authenticated;

-- A client admin creates their first school; this also creates their profile as its admin.
create or replace function public.create_first_school(p_name text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_admin public.client_admins;
  v_disabled boolean;
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text;
  v_school_id uuid;
begin
  select * into v_admin from public.client_admins where user_id = auth.uid();
  if v_admin.user_id is null then
    raise exception 'Only client admins can create a school here';
  end if;
  if exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'You already have a school. Add more from the school switcher.';
  end if;
  select is_disabled into v_disabled from public.clients where id = v_admin.client_id;
  if v_disabled then
    raise exception 'Your organisation''s access has been paused';
  end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 then
    raise exception 'Please enter the school name';
  end if;

  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.schools where join_code = v_code);
  end loop;

  insert into public.schools (name, join_code, client_id) values (left(trim(p_name), 200), v_code, v_admin.client_id)
  returning id into v_school_id;

  insert into public.profiles (id, school_id, role, full_name, phone, username, contact_email)
  values (auth.uid(), v_school_id, 'admin', v_admin.full_name, v_admin.phone, v_admin.username, v_admin.contact_email);

  insert into public.school_memberships (profile_id, school_id, role) values (auth.uid(), v_school_id, 'admin');

  return jsonb_build_object('id', v_school_id, 'join_code', v_code);
end;
$$;

revoke execute on function public.create_first_school(text) from public, anon;
grant execute on function public.create_first_school(text) to authenticated;

-- Deleting a client also removes its admins who never created a school. -----------------

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
    'staff', (select count(distinct profile_id) from public.school_memberships where school_id in (select id from s))
             + (select count(*) from public.client_admins ca
                where ca.client_id = p_client_id and not exists (select 1 from public.profiles p where p.id = ca.user_id)),
    -- Accounts whose current school is here and who have no other school to move to,
    -- plus this client's admins who never created a school.
    'accounts_deleted', (
      select count(*) from public.client_admins ca
      where ca.client_id = p_client_id and not exists (select 1 from public.profiles p where p.id = ca.user_id)
    ) + (
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

  -- This client's admins who never created a school have no profile: delete their logins too.
  for v_person in
    select ca.user_id as id from public.client_admins ca
    where ca.client_id = p_client_id and not exists (select 1 from public.profiles p where p.id = ca.user_id)
  loop
    delete from auth.users where id = v_person.id;
    v_deleted := v_deleted + 1;
  end loop;

  -- Everything else (menus, orders, bills, students, wallets, memberships, breaks...) goes with the schools.
  delete from public.schools where id = any (v_schools);
  delete from public.clients where id = p_client_id;

  return jsonb_build_object('schools', cardinality(v_schools), 'accounts_deleted', v_deleted);
end;
$$;

