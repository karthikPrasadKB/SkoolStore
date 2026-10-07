-- Alphanumeric student codes, and saved walk-in customers.
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.

-- Student codes: letters and numbers ------------------------------------------

alter table public.students drop constraint students_code_check;
alter table public.students add constraint students_code_format check (code ~ '^[A-Z0-9]{4,12}$');

-- New codes are 6 characters from an alphabet without look-alikes (no 0/O, 1/I/L).
-- Admins may supply their own code (e.g. for a school-specific format); otherwise one is generated.
create or replace function public.assign_student_code()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text;
begin
  if new.code is not null and coalesce(public.my_role() = 'admin', false) then
    new.code := upper(trim(new.code));
    return new;
  end if;

  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (
      select 1 from public.students where school_id = new.school_id and code = v_code
    );
  end loop;
  new.code := v_code;
  return new;
end;
$$;

-- Only admins can change a student's code. Nobody can move a student to another school.
create or replace function public.keep_student_code()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.code is distinct from old.code and coalesce(public.my_role() = 'admin', false) then
    new.code := upper(trim(new.code));
  else
    new.code := old.code;
  end if;
  new.school_id := old.school_id;
  return new;
end;
$$;

-- Walk-in customers ------------------------------------------------------------

-- Turns "+91 98765-43210", "098765 43210" etc. into "9876543210". Empty if not a valid Indian mobile.
create function public.normalize_phone(p_phone text)
returns text
language plpgsql immutable set search_path = ''
as $$
declare
  v_digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
begin
  if length(v_digits) = 12 and left(v_digits, 2) = '91' then
    v_digits := right(v_digits, 10);
  elsif length(v_digits) = 11 and left(v_digits, 1) = '0' then
    v_digits := right(v_digits, 10);
  end if;
  if v_digits ~ '^[6-9][0-9]{9}$' then
    return v_digits;
  end if;
  return null;
end;
$$;

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  phone text not null check (phone ~ '^[6-9][0-9]{9}$'),
  name text check (char_length(name) <= 100),
  created_at timestamptz not null default now(),
  unique (school_id, phone)
);

alter table public.customers enable row level security;

-- Staff can look customers up. Customers are only created through a counter sale.
create policy "Staff can view school customers"
  on public.customers for select to authenticated
  using (school_id = public.my_school_id() and public.my_role() <> 'parent');

revoke insert, update, delete on public.customers from anon, authenticated;

alter table public.orders
  add column customer_id uuid references public.customers (id) on delete set null;

create index orders_customer_id_idx on public.orders (customer_id);

-- Counter sale: same as before, plus saving the customer by phone number. -------

create or replace function public.create_counter_order(
  p_items jsonb,
  p_payment_method public.payment_method,
  p_amount_received numeric default null,
  p_discount_amount numeric default 0,
  p_discount_reason text default null,
  p_customer_name text default null,
  p_customer_phone text default null,
  p_student_code text default null
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_role public.user_role := public.my_role();
  v_school public.schools;
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_student_id uuid;
  v_customer_id uuid;
  v_phone text;
  v_item jsonb;
  v_product public.products;
  v_qty int;
  v_option_ids uuid[];
  v_options jsonb;
  v_delta numeric;
  v_unit numeric;
  v_rate numeric;
  v_line numeric;
  v_valid int;
  v_group record;
  v_sold bigint;
  v_in_cart jsonb := '{}';
  v_already int;
  v_lines jsonb := '[]';
  v_subtotal numeric := 0;
  v_gst numeric := 0;
  v_discount numeric := round(coalesce(p_discount_amount, 0), 2);
  v_total numeric;
  v_received numeric;
  v_order_id uuid;
  v_token text;
begin
  if v_role is null or v_role = 'parent' then
    raise exception 'Only staff can take counter orders';
  end if;
  if p_payment_method not in ('cash', 'upi', 'pluxee') then
    raise exception 'Choose cash, UPI or Pluxee';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'The cart is empty';
  end if;
  if nullif(trim(p_student_code), '') is not null
     and (nullif(trim(p_customer_phone), '') is not null or nullif(trim(p_customer_name), '') is not null) then
    raise exception 'A sale can be for a student or a customer, not both';
  end if;

  -- Lock the school row so bill numbers are handed out one at a time.
  select * into v_school from public.schools where id = public.my_school_id() for update;

  if nullif(trim(p_student_code), '') is not null then
    select id into v_student_id from public.students
    where school_id = v_school.id and code = upper(trim(p_student_code));
    if v_student_id is null then
      raise exception 'No student found with code %', upper(trim(p_student_code));
    end if;
  end if;

  -- A phone number saves (or finds) a walk-in customer, so their bills are kept together.
  if nullif(trim(p_customer_phone), '') is not null then
    v_phone := public.normalize_phone(p_customer_phone);
    if v_phone is null then
      raise exception 'Enter a valid 10-digit mobile number';
    end if;
    insert into public.customers (school_id, phone, name)
    values (v_school.id, v_phone, nullif(trim(p_customer_name), ''))
    on conflict (school_id, phone) do update
      set name = coalesce(excluded.name, public.customers.name)
    returning id into v_customer_id;
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item ->> 'quantity')::int;
    if v_qty is null or v_qty < 1 or v_qty > 100 then
      raise exception 'Invalid quantity';
    end if;

    select * into v_product from public.products
    where id = (v_item ->> 'product_id')::uuid and school_id = v_school.id
    for update;

    if not found then
      raise exception 'An item in the cart no longer exists';
    end if;
    if not v_product.is_active then
      raise exception '% is not on the menu right now', v_product.name;
    end if;

    -- Customisations must belong to this item and follow each group's rules.
    v_option_ids := coalesce(
      array(select jsonb_array_elements_text(coalesce(v_item -> 'option_ids', '[]')))::uuid[],
      '{}'
    );
    select count(*) into v_valid
    from public.options o
    join public.option_groups g on g.id = o.group_id
    where o.id = any (v_option_ids) and g.product_id = v_product.id;
    if v_valid <> cardinality(v_option_ids) then
      raise exception 'Invalid customisation for %', v_product.name;
    end if;

    for v_group in
      select g.name, g.is_required, g.max_select,
             (select count(*) from public.options o where o.group_id = g.id and o.id = any (v_option_ids)) as chosen
      from public.option_groups g
      where g.product_id = v_product.id
    loop
      if v_group.is_required and v_group.chosen = 0 then
        raise exception 'Choose a % for %', v_group.name, v_product.name;
      end if;
      if v_group.chosen > v_group.max_select then
        raise exception 'Too many % choices for %', v_group.name, v_product.name;
      end if;
    end loop;

    select coalesce(jsonb_agg(jsonb_build_object('group', g.name, 'name', o.name, 'price_delta', o.price_delta)
                              order by g.sort_order, o.sort_order), '[]'),
           coalesce(sum(o.price_delta), 0)
    into v_options, v_delta
    from public.options o
    join public.option_groups g on g.id = o.group_id
    where o.id = any (v_option_ids);

    -- Stock checks. v_in_cart counts the same item appearing on several cart lines.
    v_already := coalesce((v_in_cart ->> v_product.id::text)::int, 0);
    v_in_cart := v_in_cart || jsonb_build_object(v_product.id::text, v_already + v_qty);

    if v_product.stock_mode = 'count' then
      if v_product.stock_qty < v_qty then
        raise exception 'Only % % left', v_product.stock_qty, v_product.name;
      end if;
      update public.products set stock_qty = stock_qty - v_qty where id = v_product.id;
    elsif v_product.stock_mode = 'daily_limit' then
      select coalesce(sum(oi.quantity), 0) into v_sold
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where oi.product_id = v_product.id and o.pickup_date = v_today and o.status <> 'cancelled';
      if v_sold + v_already + v_qty > v_product.daily_limit then
        raise exception 'Only % % left for today', greatest(v_product.daily_limit - v_sold - v_already, 0), v_product.name;
      end if;
    end if;

    v_unit := v_product.price + v_delta;
    v_line := v_unit * v_qty;
    v_rate := coalesce(v_product.gst_rate, v_school.gst_rate);
    v_subtotal := v_subtotal + v_line;
    -- Prices include GST, so the tax is the part of the price above the base amount.
    v_gst := v_gst + v_line * v_rate / (100 + v_rate);

    v_lines := v_lines || jsonb_build_object(
      'product_id', v_product.id,
      'name', v_product.name,
      'food_type', v_product.food_type,
      'options', v_options,
      'unit_price', v_unit,
      'quantity', v_qty,
      'gst_rate', v_rate,
      'line_total', v_line
    );
  end loop;

  -- Discount rules set by the school apply to counter staff.
  if v_discount < 0 or v_discount > v_subtotal then
    raise exception 'Invalid discount';
  end if;
  if v_discount > 0 and v_role = 'counter_staff' then
    if not v_school.counter_discount_allowed then
      raise exception 'Counter staff cannot give discounts at this school';
    end if;
    if v_discount > round(v_subtotal * v_school.counter_max_discount_percent / 100, 2) then
      raise exception 'The maximum discount is % percent', v_school.counter_max_discount_percent;
    end if;
  end if;

  v_total := v_subtotal - v_discount;
  if v_subtotal > 0 then
    v_gst := round(v_gst * v_total / v_subtotal, 2);
  end if;

  v_received := case when p_payment_method = 'cash' then coalesce(p_amount_received, v_total) end;
  if v_received is not null and v_received < v_total then
    raise exception 'Cash received is less than the total';
  end if;

  insert into public.orders (
    school_id, bill_number, source, status, pickup_date, student_id, customer_id, customer_name, customer_phone,
    subtotal, discount_amount, discount_reason, total, gst_amount, payment_method,
    amount_received, paid_at, collected_at, created_by
  )
  values (
    v_school.id, v_school.next_bill_number, 'counter', 'collected', v_today, v_student_id, v_customer_id,
    nullif(trim(p_customer_name), ''), v_phone,
    v_subtotal, v_discount, nullif(trim(p_discount_reason), ''), v_total, v_gst, p_payment_method,
    v_received, now(), now(), auth.uid()
  )
  returning id, public_token into v_order_id, v_token;

  insert into public.order_items (order_id, product_id, name, food_type, options, unit_price, quantity, gst_rate, line_total)
  select v_order_id, l.product_id, l.name, l.food_type, l.options, l.unit_price, l.quantity, l.gst_rate, l.line_total
  from jsonb_to_recordset(v_lines) as l (
    product_id uuid, name text, food_type public.food_type, options jsonb,
    unit_price numeric, quantity int, gst_rate numeric, line_total numeric
  );

  update public.schools set next_bill_number = next_bill_number + 1 where id = v_school.id;

  return jsonb_build_object(
    'order_id', v_order_id,
    'bill_number', v_school.next_bill_number,
    'public_token', v_token,
    'total', v_total,
    'change', coalesce(v_received - v_total, 0)
  );
end;
$$;
