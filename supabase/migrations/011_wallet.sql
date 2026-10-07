-- Phase 4a: family wallets (one balance per school), parent controls per child,
-- children at different schools, and pre-order only items.
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.

-- Pre-order only items are not sold at the counter. ---------------------------

alter table public.products add column if not exists preorder_only boolean not null default false;

-- Children at any school ---------------------------------------------------------

-- Parents add a child with that child's school code (empty = the parent's own school).
drop policy if exists "Parents can add their children" on public.students;

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

  return jsonb_build_object('id', v_student.id, 'code', v_student.code);
end;
$$;

revoke execute on function public.add_child(text, text, text) from public, anon;
grant execute on function public.add_child(text, text, text) to authenticated;

-- Parents can see the name of each school their children attend.
drop policy if exists "Parents can view their children's schools" on public.schools;
create policy "Parents can view their children's schools"
  on public.schools for select to authenticated
  using (exists (select 1 from public.students s where s.school_id = schools.id and s.parent_id = auth.uid()));

-- Parent controls per child ------------------------------------------------------

alter table public.students
  add column if not exists wallet_allowed boolean not null default false,
  -- Most the child can spend from the wallet at the counter per day. Empty = no limit.
  add column if not exists wallet_daily_limit numeric(10, 2) check (wallet_daily_limit >= 0);

-- Wallets: one balance per parent per school ------------------------------------

create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.profiles (id) on delete cascade,
  school_id uuid not null references public.schools (id) on delete cascade,
  balance numeric(10, 2) not null default 0 check (balance >= 0),
  created_at timestamptz not null default now(),
  unique (parent_id, school_id)
);

do $$ begin
  create type public.wallet_txn_type as enum ('topup', 'purchase', 'refund', 'adjustment');
exception when duplicate_object then null;
end $$;

-- Every change to a wallet, with the balance after it. Money in is positive, money out negative.
create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets (id) on delete cascade,
  type public.wallet_txn_type not null,
  amount numeric(10, 2) not null,
  balance_after numeric(10, 2) not null,
  order_id uuid references public.orders (id) on delete set null,
  student_id uuid references public.students (id) on delete set null,
  payment_method public.payment_method,
  note text check (char_length(note) <= 200),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists wallet_transactions_wallet_idx on public.wallet_transactions (wallet_id, created_at desc);

alter table public.wallets enable row level security;
alter table public.wallet_transactions enable row level security;

drop policy if exists "Parents and school staff can view wallets" on public.wallets;
create policy "Parents and school staff can view wallets"
  on public.wallets for select to authenticated
  using (parent_id = auth.uid() or (school_id = public.my_school_id() and public.my_role() <> 'parent'));

drop policy if exists "Parents and school staff can view wallet transactions" on public.wallet_transactions;
create policy "Parents and school staff can view wallet transactions"
  on public.wallet_transactions for select to authenticated
  using (exists (
    select 1 from public.wallets w
    where w.id = wallet_id
      and (w.parent_id = auth.uid() or (w.school_id = public.my_school_id() and public.my_role() <> 'parent'))
  ));

-- Wallets only change through the functions below.
revoke insert, update, delete on public.wallets, public.wallet_transactions from anon, authenticated;

-- Internal: get (creating if needed) and lock a family's wallet at a school.
create or replace function public.lock_wallet(p_parent_id uuid, p_school_id uuid)
returns public.wallets
language plpgsql security definer set search_path = ''
as $$
declare
  v_wallet public.wallets;
begin
  insert into public.wallets (parent_id, school_id) values (p_parent_id, p_school_id)
  on conflict (parent_id, school_id) do nothing;
  select * into v_wallet from public.wallets
  where parent_id = p_parent_id and school_id = p_school_id
  for update;
  return v_wallet;
end;
$$;

revoke execute on function public.lock_wallet(uuid, uuid) from public, anon, authenticated;

-- Counter: find a student by code, with their wallet details. -------------------

create or replace function public.counter_student_lookup(p_code text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_student public.students;
  v_balance numeric := 0;
  v_spent numeric := 0;
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if public.my_role() is null or public.my_role() = 'parent' then
    raise exception 'Only staff can look up students';
  end if;

  select * into v_student from public.students
  where school_id = public.my_school_id() and code = upper(trim(p_code));
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
    'code', v_student.code,
    'has_wallet', v_student.parent_id is not null,
    'balance', coalesce(v_balance, 0),
    'wallet_allowed', v_student.wallet_allowed,
    'daily_limit', v_student.wallet_daily_limit,
    'spent_today', v_spent
  );
end;
$$;

revoke execute on function public.counter_student_lookup(text) from public, anon;
grant execute on function public.counter_student_lookup(text) to authenticated;

-- Counter: top up a family's wallet using a student's code. --------------------

create or replace function public.topup_wallet(
  p_student_code text,
  p_amount numeric,
  p_method public.payment_method,
  p_note text default null
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_student public.students;
  v_wallet public.wallets;
  v_amount numeric := round(coalesce(p_amount, 0), 2);
begin
  if public.my_role() is null or public.my_role() = 'parent' then
    raise exception 'Only staff can top up wallets';
  end if;
  if p_method not in ('cash', 'upi') then
    raise exception 'Top-ups at the counter are by cash or UPI';
  end if;
  if v_amount <= 0 or v_amount > 10000 then
    raise exception 'Top-up must be between ₹1 and ₹10,000';
  end if;

  select * into v_student from public.students
  where school_id = public.my_school_id() and code = upper(trim(p_student_code));
  if v_student.id is null then
    raise exception 'No student found with that code';
  end if;
  if v_student.parent_id is null then
    raise exception 'This student has no parent account, so no wallet';
  end if;

  v_wallet := public.lock_wallet(v_student.parent_id, v_student.school_id);
  update public.wallets set balance = balance + v_amount where id = v_wallet.id;

  insert into public.wallet_transactions (wallet_id, type, amount, balance_after, student_id, payment_method, note, created_by)
  values (v_wallet.id, 'topup', v_amount, v_wallet.balance + v_amount, v_student.id, p_method,
          nullif(left(trim(coalesce(p_note, '')), 200), ''), auth.uid());

  return jsonb_build_object('balance', v_wallet.balance + v_amount);
end;
$$;

revoke execute on function public.topup_wallet(text, numeric, public.payment_method, text) from public, anon;
grant execute on function public.topup_wallet(text, numeric, public.payment_method, text) to authenticated;

-- Cancelling a wallet bill refunds the wallet. ------------------------------------

create or replace function public.cancel_order(p_order_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.orders;
  v_purchase public.wallet_transactions;
  v_wallet public.wallets;
begin
  if public.my_role() is distinct from 'admin' then
    raise exception 'Only the school admin can cancel bills';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Please give a reason for cancelling';
  end if;

  select * into v_order from public.orders
  where id = p_order_id and school_id = public.my_school_id()
  for update;

  if not found then
    raise exception 'Order not found';
  end if;
  if v_order.status = 'cancelled' then
    raise exception 'This order is already cancelled';
  end if;

  -- Totalled per item, since one item can appear on several lines (e.g. small and large).
  update public.products p
  set stock_qty = p.stock_qty + returned.quantity
  from (
    select product_id, sum(quantity) as quantity
    from public.order_items
    where order_id = v_order.id and product_id is not null
    group by product_id
  ) as returned
  where returned.product_id = p.id and p.stock_mode = 'count';

  -- Money paid from a wallet goes back to that wallet.
  if v_order.payment_method = 'wallet' then
    select * into v_purchase from public.wallet_transactions
    where order_id = v_order.id and type = 'purchase'
    limit 1;
    if v_purchase.id is not null then
      select * into v_wallet from public.wallets where id = v_purchase.wallet_id for update;
      update public.wallets set balance = balance + v_order.total where id = v_wallet.id;
      insert into public.wallet_transactions (wallet_id, type, amount, balance_after, order_id, student_id, note, created_by)
      values (v_wallet.id, 'refund', v_order.total, v_wallet.balance + v_order.total, v_order.id,
              v_order.student_id, 'Bill #' || v_order.bill_number || ' cancelled', auth.uid());
    end if;
  end if;

  update public.orders
  set status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = auth.uid(),
      cancel_reason = left(trim(p_reason), 200)
  where id = v_order.id;
end;
$$;

-- Counter sale: now also accepts wallet payments and skips pre-order only items. ---

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
  v_student public.students;
  v_student_id uuid;
  v_wallet public.wallets;
  v_spent_today numeric;
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
  if p_payment_method not in ('cash', 'upi', 'pluxee', 'wallet') then
    raise exception 'Choose cash, UPI, Pluxee or wallet';
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
    select * into v_student from public.students
    where school_id = v_school.id and code = upper(trim(p_student_code));
    if v_student.id is null then
      raise exception 'No student found with code %', upper(trim(p_student_code));
    end if;
    v_student_id := v_student.id;
  end if;

  if p_payment_method = 'wallet' then
    if v_student_id is null then
      raise exception 'Enter the student code to pay with the wallet';
    end if;
    if v_student.parent_id is null then
      raise exception 'This student has no parent account, so no wallet';
    end if;
    if not v_student.wallet_allowed then
      raise exception 'The parent has not allowed % to pay with the wallet', v_student.full_name;
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
    if v_product.preorder_only then
      raise exception '% is pre-order only', v_product.name;
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

  -- Wallet: check the daily limit set by the parent and the balance, then take the money.
  if p_payment_method = 'wallet' then
    select coalesce(sum(total), 0) into v_spent_today
    from public.orders
    where student_id = v_student_id and source = 'counter' and payment_method = 'wallet'
      and pickup_date = v_today and status <> 'cancelled';

    if v_student.wallet_daily_limit is not null and v_spent_today + v_total > v_student.wallet_daily_limit then
      raise exception 'Daily limit reached: only ₹% left today for %',
        greatest(v_student.wallet_daily_limit - v_spent_today, 0), v_student.full_name;
    end if;

    v_wallet := public.lock_wallet(v_student.parent_id, v_school.id);
    if v_wallet.balance < v_total then
      raise exception 'Not enough money in the wallet (balance ₹%)', v_wallet.balance;
    end if;
    update public.wallets set balance = balance - v_total where id = v_wallet.id;
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

  if p_payment_method = 'wallet' then
    insert into public.wallet_transactions (wallet_id, type, amount, balance_after, order_id, student_id, created_by)
    values (v_wallet.id, 'purchase', -v_total, v_wallet.balance - v_total, v_order_id, v_student_id, auth.uid());
  end if;

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
