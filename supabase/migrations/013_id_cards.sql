-- School ID cards are the main way to identify a student at the counter.
-- Canteen codes become optional, switched on per school.
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.

-- The admission / ID number printed on the student's school ID card.
alter table public.students
  add column if not exists id_card_number text check (char_length(id_card_number) between 1 and 30);

-- No two students at a school can share an ID card number (ignoring capitals).
create unique index if not exists students_school_id_card_idx
  on public.students (school_id, upper(id_card_number))
  where id_card_number is not null;

-- Schools choose whether to also use canteen codes. Off by default.
alter table public.schools add column if not exists use_canteen_codes boolean not null default false;
grant update (use_canteen_codes) on public.schools to authenticated;

-- Counter lookup: by ID card number, or by canteen code if the school uses codes. ----

create or replace function public.counter_student_lookup(p_code text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_student public.students;
  v_uses_codes boolean;
  v_value text := upper(trim(coalesce(p_code, '')));
  v_balance numeric := 0;
  v_spent numeric := 0;
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if public.my_role() is null or public.my_role() = 'parent' then
    raise exception 'Only staff can look up students';
  end if;
  if v_value = '' then
    return null;
  end if;

  select use_canteen_codes into v_uses_codes from public.schools where id = public.my_school_id();

  select * into v_student from public.students
  where school_id = public.my_school_id() and upper(id_card_number) = v_value;

  if v_student.id is null and v_uses_codes then
    select * into v_student from public.students
    where school_id = public.my_school_id() and code = v_value;
  end if;

  if v_student.id is null then
    return null;
  end if;

  if v_student.parent_id is not null then
    select balance into v_balance from public.wallets
    where parent_id = v_student.parent_id and school_id = v_student.school_id;

    select coalesce(sum(total), 0) into v_spent
    from public.orders
    where student_id = v_student.id and source = 'counter' and payment_method = 'wallet'
      and pickup_date = v_today and status <> 'cancelled';
  end if;

  return jsonb_build_object(
    'name', v_student.full_name,
    'class_name', v_student.class_name,
    -- The canteen code identifies the student internally for the sale, even if the school doesn't show codes.
    'code', v_student.code,
    'id_card_number', v_student.id_card_number,
    'has_wallet', v_student.parent_id is not null,
    'balance', coalesce(v_balance, 0),
    'wallet_allowed', v_student.wallet_allowed,
    'daily_limit', v_student.wallet_daily_limit,
    'spent_today', v_spent
  );
end;
$$;

-- Adding a child now includes their ID card number. ----------------------------------

drop function if exists public.add_child(text, text, text);

create or replace function public.add_child(
  p_full_name text,
  p_class_name text,
  p_school_code text default null,
  p_id_card_number text default null
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_school_id uuid;
  v_student public.students;
  v_id_card text := nullif(trim(coalesce(p_id_card_number, '')), '');
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

  begin
    insert into public.students (school_id, parent_id, full_name, class_name, id_card_number)
    values (v_school_id, auth.uid(), left(trim(p_full_name), 100), left(trim(coalesce(p_class_name, '')), 30),
            left(v_id_card, 30))
    returning * into v_student;
  exception when unique_violation then
    raise exception 'Another student at this school already has ID card number %', v_id_card;
  end;

  insert into public.parent_schools (parent_id, school_id) values (auth.uid(), v_school_id)
  on conflict do nothing;

  return jsonb_build_object('id', v_student.id, 'code', v_student.code);
end;
$$;

revoke execute on function public.add_child(text, text, text, text) from public, anon;
grant execute on function public.add_child(text, text, text, text) to authenticated;
