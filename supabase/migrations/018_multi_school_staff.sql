-- One person can run (or work at) several school canteens.
-- Staff belong to schools through memberships, each with its own role. profiles.school_id / profiles.role
-- are the school they're currently working in (picked with the school switcher), so every existing
-- security rule built on my_school_id() / my_role() keeps working for the chosen school.
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.

create table if not exists public.school_memberships (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  school_id uuid not null references public.schools (id) on delete cascade,
  role public.user_role not null check (role <> 'parent'),
  created_at timestamptz not null default now(),
  primary key (profile_id, school_id)
);

create index if not exists school_memberships_school_idx on public.school_memberships (school_id);

-- Everyone who is staff today becomes a member of their current school.
insert into public.school_memberships (profile_id, school_id, role)
select id, school_id, role from public.profiles where role <> 'parent'
on conflict do nothing;

alter table public.school_memberships enable row level security;

drop policy if exists "Staff can view their memberships" on public.school_memberships;
create policy "Staff can view their memberships"
  on public.school_memberships for select to authenticated
  using (profile_id = auth.uid());

drop policy if exists "Admins can view their school's memberships" on public.school_memberships;
create policy "Admins can view their school's memberships"
  on public.school_memberships for select to authenticated
  using (school_id = public.my_school_id() and public.my_role() = 'admin');

-- Memberships only change through the functions below (and when an admin creates staff).
revoke insert, update, delete on public.school_memberships from anon, authenticated;

-- Staff can see the names of all schools they work at (for the switcher).
drop policy if exists "Staff can view schools they work at" on public.schools;
create policy "Staff can view schools they work at"
  on public.schools for select to authenticated
  using (exists (
    select 1 from public.school_memberships m where m.school_id = schools.id and m.profile_id = auth.uid()
  ));

-- Admins see the staff of the school they're working in.
drop policy if exists "Admins can view their staff" on public.profiles;
create policy "Admins can view their staff"
  on public.profiles for select to authenticated
  using (
    public.my_role() = 'admin'
    and exists (
      select 1 from public.school_memberships m
      where m.profile_id = profiles.id and m.school_id = public.my_school_id()
    )
  );

-- Parent-only access rules apply to parent accounts only, so staff switching between
-- schools never see another school's menu mixed in. ---------------------------------

drop policy if exists "Parents can view their children's schools" on public.schools;
create policy "Parents can view their children's schools"
  on public.schools for select to authenticated
  using (
    public.my_role() = 'parent'
    and exists (select 1 from public.students s where s.school_id = schools.id and s.parent_id = auth.uid())
  );

drop policy if exists "Parents can view their linked schools" on public.schools;
create policy "Parents can view their linked schools"
  on public.schools for select to authenticated
  using (
    public.my_role() = 'parent'
    and exists (select 1 from public.parent_schools ps where ps.school_id = schools.id and ps.parent_id = auth.uid())
  );

drop policy if exists "Parents can view their schools' categories" on public.categories;
create policy "Parents can view their schools' categories"
  on public.categories for select to authenticated
  using (
    public.my_role() = 'parent'
    and exists (select 1 from public.parent_schools ps where ps.parent_id = auth.uid() and ps.school_id = categories.school_id)
  );

drop policy if exists "Parents can view their schools' products" on public.products;
create policy "Parents can view their schools' products"
  on public.products for select to authenticated
  using (
    public.my_role() = 'parent'
    and exists (select 1 from public.parent_schools ps where ps.parent_id = auth.uid() and ps.school_id = products.school_id)
  );

drop policy if exists "Parents can view their schools' option groups" on public.option_groups;
create policy "Parents can view their schools' option groups"
  on public.option_groups for select to authenticated
  using (
    public.my_role() = 'parent'
    and exists (
      select 1 from public.products p
      join public.parent_schools ps on ps.school_id = p.school_id
      where p.id = option_groups.product_id and ps.parent_id = auth.uid()
    )
  );

drop policy if exists "Parents can view their schools' options" on public.options;
create policy "Parents can view their schools' options"
  on public.options for select to authenticated
  using (
    public.my_role() = 'parent'
    and exists (
      select 1 from public.option_groups g
      join public.products p on p.id = g.product_id
      join public.parent_schools ps on ps.school_id = p.school_id
      where g.id = options.group_id and ps.parent_id = auth.uid()
    )
  );

-- Switch the school you're working in. --------------------------------------------

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
  update public.profiles set school_id = p_school_id, role = v_role where id = auth.uid();
end;
$$;

revoke execute on function public.switch_school(uuid) from public, anon;
grant execute on function public.switch_school(uuid) to authenticated;

-- Admins add a new school (canteen). They become its admin and switch to it. ----------

create or replace function public.create_school(p_name text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text;
  v_school_id uuid;
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

  insert into public.schools (name, join_code) values (left(trim(p_name), 200), v_code)
  returning id into v_school_id;

  insert into public.school_memberships (profile_id, school_id, role) values (auth.uid(), v_school_id, 'admin');
  update public.profiles set school_id = v_school_id, role = 'admin' where id = auth.uid();

  return jsonb_build_object('id', v_school_id, 'join_code', v_code);
end;
$$;

revoke execute on function public.create_school(text) from public, anon;
grant execute on function public.create_school(text) to authenticated;

-- Changing a staff member's role (or removing them) now works through memberships. ----

create or replace function public.set_member_role(member_id uuid, new_role public.user_role)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_school uuid := public.my_school_id();
  v_next record;
begin
  if public.my_role() is distinct from 'admin' then
    raise exception 'Only school admins can change roles';
  end if;
  if member_id = auth.uid() then
    raise exception 'You cannot change your own role';
  end if;
  if not exists (select 1 from public.school_memberships where profile_id = member_id and school_id = v_school) then
    raise exception 'Member not found in your school';
  end if;

  if new_role = 'parent' then
    -- Remove them from this school. If they were working here, move them to another school
    -- they work at, or make them a regular (parent) account.
    delete from public.school_memberships where profile_id = member_id and school_id = v_school;
    select school_id, role into v_next from public.school_memberships
    where profile_id = member_id order by created_at limit 1;
    update public.profiles
    set school_id = coalesce(v_next.school_id, school_id), role = coalesce(v_next.role, 'parent')
    where id = member_id and school_id = v_school;
  else
    update public.school_memberships set role = new_role where profile_id = member_id and school_id = v_school;
    update public.profiles set role = new_role where id = member_id and school_id = v_school;
  end if;
end;
$$;
