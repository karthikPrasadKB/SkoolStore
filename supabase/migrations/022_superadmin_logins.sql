-- Superadmin logins without a school or a sign-up.
-- Created with: node scripts/create-superadmin.mjs <email> <password>
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_school_id uuid;
begin
  -- Superadmin logins are created by the setup script with the secret key. They sit above all schools,
  -- so they get no school profile. (app_metadata can only be set with the secret key, never at sign-up.)
  if coalesce(new.raw_app_meta_data ->> 'platform_admin', '') = 'true' then
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
