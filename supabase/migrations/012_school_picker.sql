-- School picker on sign up, and parents linked to more than one school.
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.

-- Public list of schools for the sign up dropdown (name and code only). ------------

create or replace function public.list_schools()
returns table (id uuid, name text, join_code text)
language sql stable security definer set search_path = ''
as $$
  select s.id, s.name, s.join_code from public.schools s order by s.name
$$;

grant execute on function public.list_schools() to anon, authenticated;

-- The schools a parent uses (their children's schools). ----------------------------

create table if not exists public.parent_schools (
  parent_id uuid not null references public.profiles (id) on delete cascade,
  school_id uuid not null references public.schools (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (parent_id, school_id)
);

alter table public.parent_schools enable row level security;

drop policy if exists "Parents can view their schools" on public.parent_schools;
create policy "Parents can view their schools"
  on public.parent_schools for select to authenticated
  using (parent_id = auth.uid());

-- Rows are added on sign up and when adding a child, through the functions below.
revoke insert, update, delete on public.parent_schools from anon, authenticated;

-- Parents can see the names of the schools they're linked to.
drop policy if exists "Parents can view their linked schools" on public.schools;
create policy "Parents can view their linked schools"
  on public.schools for select to authenticated
  using (exists (select 1 from public.parent_schools ps where ps.school_id = schools.id and ps.parent_id = auth.uid()));

-- Existing users: link them to their own school and their children's schools.
insert into public.parent_schools (parent_id, school_id)
select id, school_id from public.profiles
on conflict do nothing;

insert into public.parent_schools (parent_id, school_id)
select distinct parent_id, school_id from public.students where parent_id is not null
on conflict do nothing;

-- Sign up: the first chosen school is the account's main school; all chosen schools are linked.
create or replace function public.handle_new_user()
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

-- Adding a child also links the parent to that child's school.
create or replace function public.add_child(p_full_name text, p_class_name text, p_school_code text default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_school_id uuid;
  v_student public.students;
begin
  if auth.uid() is null then
    raise exception 'Please log in';
  end if;
  if nullif(trim(p_full_name), '') is null then
    raise exception 'Please enter your child''s name';
  end if;

  if nullif(trim(p_school_code), '') is null then
    v_school_id := public.my_school_id();
  else
    select id into v_school_id from public.schools where join_code = upper(trim(p_school_code));
    if v_school_id is null then
      raise exception 'No school found with code %', upper(trim(p_school_code));
    end if;
  end if;

  insert into public.students (school_id, parent_id, full_name, class_name)
  values (v_school_id, auth.uid(), left(trim(p_full_name), 100), left(trim(coalesce(p_class_name, '')), 30))
  returning * into v_student;

  insert into public.parent_schools (parent_id, school_id) values (auth.uid(), v_school_id)
  on conflict do nothing;

  return jsonb_build_object('id', v_student.id, 'code', v_student.code);
end;
$$;
