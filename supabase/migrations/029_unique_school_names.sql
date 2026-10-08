-- Parents find schools by name, so school names must be unique across SkoolStore (ignoring capitals and spaces).
-- Names usually include the area, e.g. "William Richards School - KGF".
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.

create unique index if not exists schools_name_unique on public.schools (lower(trim(name)));

-- Friendly messages when a new school's name is already taken. -------------------------

create or replace function public.create_school(p_name text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text;
  v_school_id uuid;
  v_client_id uuid;
begin
  if public.my_role() is distinct from 'admin' then
    raise exception 'Only school admins can add schools';
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

  -- The new school belongs to the same client as the school the admin is working in.
  select client_id into v_client_id from public.schools where id = public.my_school_id();

  begin
    insert into public.schools (name, join_code, client_id) values (left(trim(p_name), 200), v_code, v_client_id)
    returning id into v_school_id;
  exception when unique_violation then
    raise exception 'A school named "%" already exists. Add the area to make it unique, e.g. "% - KGF"', trim(p_name), trim(p_name);
  end;

  insert into public.school_memberships (profile_id, school_id, role) values (auth.uid(), v_school_id, 'admin');
  update public.profiles set school_id = v_school_id, role = 'admin' where id = auth.uid();

  return jsonb_build_object('id', v_school_id, 'join_code', v_code);
end;
$$;

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

  begin
    insert into public.schools (name, join_code, client_id) values (left(trim(p_name), 200), v_code, v_admin.client_id)
    returning id into v_school_id;
  exception when unique_violation then
    raise exception 'A school named "%" already exists. Add the area to make it unique, e.g. "% - KGF"', trim(p_name), trim(p_name);
  end;

  insert into public.profiles (id, school_id, role, full_name, phone, username, contact_email)
  values (auth.uid(), v_school_id, 'admin', v_admin.full_name, v_admin.phone, v_admin.username, v_admin.contact_email);

  insert into public.school_memberships (profile_id, school_id, role) values (auth.uid(), v_school_id, 'admin');

  return jsonb_build_object('id', v_school_id, 'join_code', v_code);
end;
$$;
