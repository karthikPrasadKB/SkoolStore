-- Parents can move a child to a different school (e.g. the child changed schools).
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.

-- A student's school and code still can't be changed by a normal update; only change_child_school()
-- below switches this on for its own transaction. Admins may still change codes as before.
create or replace function public.keep_student_code()
returns trigger
language plpgsql set search_path = ''
as $$
declare
  v_moving boolean := coalesce(current_setting('skoolstore.moving_student', true), '') = 'on';
begin
  if v_moving then
    return new;
  end if;
  if new.code is distinct from old.code and coalesce(public.my_role() = 'admin', false) then
    new.code := upper(trim(new.code));
  else
    new.code := old.code;
  end if;
  new.school_id := old.school_id;
  return new;
end;
$$;

create or replace function public.change_child_school(p_student_id uuid, p_school_code text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_student public.students;
  v_school_id uuid;
  v_code text := upper(trim(coalesce(p_school_code, '')));
  v_new_code text;
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
begin
  select * into v_student from public.students where id = p_student_id and parent_id = auth.uid() for update;
  if v_student.id is null then
    raise exception 'Child not found';
  end if;

  select id into v_school_id from public.schools where join_code = v_code;
  if v_school_id is null then
    raise exception 'No school found with code %', v_code;
  end if;
  if v_school_id = v_student.school_id then
    return;
  end if;

  -- Food can't be prepared at the old school for a child who has moved.
  if exists (
    select 1 from public.orders
    where student_id = v_student.id and source = 'preorder' and status in ('placed', 'paid', 'packed')
  ) then
    raise exception 'Please cancel this child''s upcoming pre-orders before changing school';
  end if;

  -- The ID card number must be free at the new school.
  if v_student.id_card_number is not null and exists (
    select 1 from public.students
    where school_id = v_school_id and upper(id_card_number) = upper(v_student.id_card_number)
  ) then
    raise exception 'Another student at this school already has ID card number %', v_student.id_card_number;
  end if;

  -- Keep the canteen code unless it's already used at the new school.
  v_new_code := v_student.code;
  while exists (select 1 from public.students where school_id = v_school_id and code = v_new_code) loop
    v_new_code := '';
    for i in 1..6 loop
      v_new_code := v_new_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
  end loop;

  perform set_config('skoolstore.moving_student', 'on', true);
  update public.students set school_id = v_school_id, code = v_new_code where id = v_student.id;
  perform set_config('skoolstore.moving_student', 'off', true);

  insert into public.parent_schools (parent_id, school_id) values (auth.uid(), v_school_id)
  on conflict do nothing;
end;
$$;

revoke execute on function public.change_child_school(uuid, text) from public, anon;
grant execute on function public.change_child_school(uuid, text) to authenticated;
