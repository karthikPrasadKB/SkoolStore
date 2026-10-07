-- Phase 1: schools, user profiles and roles.
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.

-- The four kinds of users in the app.
create type public.user_role as enum ('admin', 'canteen_staff', 'counter_staff', 'parent');

-- Each school (canteen) using the app. Parents join a school using its join code.
create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  join_code text not null unique check (join_code = upper(join_code)),
  created_at timestamptz not null default now()
);

-- One profile per logged-in user. Created automatically on sign up (see trigger below).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  school_id uuid not null references public.schools (id) on delete restrict,
  role public.user_role not null default 'parent',
  full_name text not null default '',
  phone text,
  created_at timestamptz not null default now()
);

create index profiles_school_id_idx on public.profiles (school_id);

-- Helpers used by security rules: the current user's school and role.
create function public.my_school_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select school_id from public.profiles where id = auth.uid()
$$;

create function public.my_role()
returns public.user_role
language sql stable security definer set search_path = ''
as $$
  select role from public.profiles where id = auth.uid()
$$;

-- Security rules (row level security): users only ever see their own school's data.
alter table public.schools enable row level security;
alter table public.profiles enable row level security;

create policy "Members can view their school"
  on public.schools for select to authenticated
  using (id = public.my_school_id());

create policy "Users can view their own profile"
  on public.profiles for select to authenticated
  using (id = auth.uid());

create policy "Admins can view profiles in their school"
  on public.profiles for select to authenticated
  using (school_id = public.my_school_id() and public.my_role() = 'admin');

create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Users may only edit their name and phone. Role and school change through set_member_role().
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

-- Lets the sign up page check a join code before creating the account.
create function public.find_school_by_code(code text)
returns table (id uuid, name text)
language sql stable security definer set search_path = ''
as $$
  select s.id, s.name from public.schools s where s.join_code = upper(trim(code))
$$;

grant execute on function public.find_school_by_code(text) to anon, authenticated;

-- Creates the profile when someone signs up. Everyone starts as a parent;
-- a school admin can then promote staff.
create function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_school_id uuid;
begin
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

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Lets a school admin change the role of someone in their school.
create function public.set_member_role(member_id uuid, new_role public.user_role)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if public.my_role() is distinct from 'admin' then
    raise exception 'Only school admins can change roles';
  end if;

  if member_id = auth.uid() then
    raise exception 'You cannot change your own role';
  end if;

  update public.profiles
  set role = new_role
  where id = member_id and school_id = public.my_school_id();

  if not found then
    raise exception 'Member not found in your school';
  end if;
end;
$$;

revoke execute on function public.set_member_role(uuid, public.user_role) from public, anon;
grant execute on function public.set_member_role(uuid, public.user_role) to authenticated;
