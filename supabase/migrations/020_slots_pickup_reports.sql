-- Break slots (pickup times for pre-orders), handing over pre-orders, and the admin sales report.
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.

-- Break slots -----------------------------------------------------------------------
-- e.g. "After 1st period" at 10:15 for up to 80 students. Same every school day.

create table if not exists public.break_slots (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  starts_at time not null,
  capacity int not null check (capacity between 1 and 5000),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists break_slots_school_idx on public.break_slots (school_id);

alter table public.break_slots enable row level security;

drop policy if exists "School members can view break slots" on public.break_slots;
create policy "School members can view break slots"
  on public.break_slots for select to authenticated
  using (school_id = public.my_school_id());

drop policy if exists "Parents can view their schools' break slots" on public.break_slots;
create policy "Parents can view their schools' break slots"
  on public.break_slots for select to authenticated
  using (
    public.my_role() = 'parent'
    and exists (select 1 from public.parent_schools ps where ps.parent_id = auth.uid() and ps.school_id = break_slots.school_id)
  );

drop policy if exists "Admins can manage break slots" on public.break_slots;
create policy "Admins can manage break slots"
  on public.break_slots for all to authenticated
  using (school_id = public.my_school_id() and public.my_role() = 'admin')
  with check (school_id = public.my_school_id() and public.my_role() = 'admin');

alter table public.orders
  add column if not exists break_slot_id uuid references public.break_slots (id) on delete set null,
  add column if not exists collected_by uuid references public.profiles (id) on delete set null;

create index if not exists orders_slot_date_idx on public.orders (break_slot_id, pickup_date);

-- Places taken in each slot on a day (for "12 left").
create or replace function public.slot_availability(p_school_id uuid, p_date date)
returns table (slot_id uuid, taken bigint)
language sql stable security definer set search_path = ''
as $$
  select o.break_slot_id, count(*)
  from public.orders o
  where o.school_id = p_school_id
    and o.pickup_date = p_date
    and o.status <> 'cancelled'
    and o.break_slot_id is not null
    and (
      p_school_id = public.my_school_id()
      or exists (select 1 from public.parent_schools ps where ps.parent_id = auth.uid() and ps.school_id = p_school_id)
    )
  group by o.break_slot_id
$$;

revoke execute on function public.slot_availability(uuid, date) from public, anon;
grant execute on function public.slot_availability(uuid, date) to authenticated;

-- Pre-orders now take a pickup slot. ------------------------------------------------

drop function if exists public.create_preorder(uuid, date, jsonb, public.payment_method);

create or replace function public.create_preorder(
  p_student_id uuid,
  p_pickup_date date,
  p_items jsonb,
  p_payment_method public.payment_method default 'wallet',
  p_slot_id uuid default null
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_student public.students;
  v_school public.schools;
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_now timestamp := now() at time zone 'Asia/Kolkata';
  v_dow int := extract(dow from p_pickup_date)::int;
  v_wallet public.wallets;
  v_slot public.break_slots;
  v_taken int;
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
  v_order_id uuid;
  v_token text;
begin
  select * into v_student from public.students where id = p_student_id and parent_id = auth.uid();
  if v_student.id is null then
    raise exception 'Child not found';
  end if;
  if p_payment_method <> 'wallet' then
    raise exception 'Only wallet payments are available for now';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'The cart is empty';
  end if;

  -- Lock the school row so bill numbers are handed out one at a time.
  select * into v_school from public.schools where id = v_student.school_id for update;

  if p_pickup_date < v_today or p_pickup_date > v_today + 7 then
    raise exception 'You can order up to 7 days ahead';
  end if;
  if v_dow = 0 or (v_dow = 6 and v_school.saturday_open is null) then
    raise exception 'The school is closed on that day';
  end if;
  if v_now >= public.preorder_deadline(v_school, p_pickup_date) then
    raise exception 'Orders for that day have closed';
  end if;

  -- Pickup time: required if the school has set up break slots, and the slot must have room.
  if exists (select 1 from public.break_slots where school_id = v_school.id and is_active) then
    if p_slot_id is null then
      raise exception 'Please choose when your child will collect the order';
    end if;
    select * into v_slot from public.break_slots
    where id = p_slot_id and school_id = v_school.id and is_active
    for update;
    if v_slot.id is null then
      raise exception 'That pickup time is no longer available. Please choose another.';
    end if;
    select count(*) into v_taken from public.orders
    where break_slot_id = v_slot.id and pickup_date = p_pickup_date and status <> 'cancelled';
    if v_taken >= v_slot.capacity then
      raise exception '"%" is full for that day. Please choose another pickup time.', v_slot.name;
    end if;
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item ->> 'quantity')::int;
    if v_qty is null or v_qty < 1 or v_qty > 20 then
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
    if cardinality(v_product.available_days) > 0 and not (v_dow::smallint = any (v_product.available_days)) then
      raise exception '% is not sold on that day', v_product.name;
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

    -- Stock: counted items are reserved now; daily limits count every order for the pickup day.
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
      where oi.product_id = v_product.id and o.pickup_date = p_pickup_date and o.status <> 'cancelled';
      if v_sold + v_already + v_qty > v_product.daily_limit then
        raise exception 'Only % % left for that day', greatest(v_product.daily_limit - v_sold - v_already, 0), v_product.name;
      end if;
    end if;

    v_unit := v_product.price + v_delta;
    v_line := v_unit * v_qty;
    v_rate := coalesce(v_product.gst_rate, v_school.gst_rate);
    v_subtotal := v_subtotal + v_line;
    v_gst := v_gst + v_line * v_rate / (100 + v_rate);

    v_lines := v_lines || jsonb_build_object(
      'product_id', v_product.id, 'name', v_product.name, 'food_type', v_product.food_type,
      'options', v_options, 'unit_price', v_unit, 'quantity', v_qty, 'gst_rate', v_rate, 'line_total', v_line
    );
  end loop;

  -- Pay from the family wallet at this school.
  v_wallet := public.lock_wallet(auth.uid(), v_school.id);
  if v_wallet.balance < v_subtotal then
    raise exception 'Not enough money in the wallet (balance ₹%). Please top up at the canteen counter.', v_wallet.balance;
  end if;
  update public.wallets set balance = balance - v_subtotal where id = v_wallet.id;

  insert into public.orders (
    school_id, bill_number, source, status, pickup_date, student_id, break_slot_id,
    subtotal, discount_amount, total, gst_amount, payment_method, paid_at, created_by
  )
  values (
    v_school.id, v_school.next_bill_number, 'preorder', 'paid', p_pickup_date, v_student.id, v_slot.id,
    v_subtotal, 0, v_subtotal, round(v_gst, 2), 'wallet', now(), auth.uid()
  )
  returning id, public_token into v_order_id, v_token;

  insert into public.order_items (order_id, product_id, name, food_type, options, unit_price, quantity, gst_rate, line_total)
  select v_order_id, l.product_id, l.name, l.food_type, l.options, l.unit_price, l.quantity, l.gst_rate, l.line_total
  from jsonb_to_recordset(v_lines) as l (
    product_id uuid, name text, food_type public.food_type, options jsonb,
    unit_price numeric, quantity int, gst_rate numeric, line_total numeric
  );

  insert into public.wallet_transactions (wallet_id, type, amount, balance_after, order_id, student_id, note, created_by)
  values (v_wallet.id, 'purchase', -v_subtotal, v_wallet.balance - v_subtotal, v_order_id, v_student.id,
          'Pre-order for ' || to_char(p_pickup_date, 'DD Mon'), auth.uid());

  update public.schools set next_bill_number = next_bill_number + 1 where id = v_school.id;

  return jsonb_build_object(
    'order_id', v_order_id,
    'bill_number', v_school.next_bill_number,
    'public_token', v_token,
    'total', v_subtotal
  );
end;
$$;

revoke execute on function public.create_preorder(uuid, date, jsonb, public.payment_method, uuid) from public, anon;
grant execute on function public.create_preorder(uuid, date, jsonb, public.payment_method, uuid) to authenticated;

-- Staff hand over a pre-order (or undo it if tapped by mistake). ------------------------

create or replace function public.set_order_collected(p_order_id uuid, p_collected boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.orders;
begin
  if public.my_role() is null or public.my_role() = 'parent' then
    raise exception 'Only staff can hand over orders';
  end if;

  select * into v_order from public.orders
  where id = p_order_id and school_id = public.my_school_id() and source = 'preorder'
  for update;
  if v_order.id is null then
    raise exception 'Order not found';
  end if;

  if p_collected then
    if v_order.status not in ('paid', 'packed') then
      raise exception 'This order can''t be handed over (it is %)', v_order.status;
    end if;
    update public.orders set status = 'collected', collected_at = now(), collected_by = auth.uid() where id = v_order.id;
  else
    if v_order.status <> 'collected' then
      raise exception 'This order hasn''t been handed over';
    end if;
    update public.orders set status = 'paid', collected_at = null, collected_by = null where id = v_order.id;
  end if;
end;
$$;

revoke execute on function public.set_order_collected(uuid, boolean) from public, anon;
grant execute on function public.set_order_collected(uuid, boolean) to authenticated;

-- Admin sales report for a date range. ---------------------------------------------------
-- p_group: 'hour' (one day), 'day' or 'month' (a year). Cancelled bills are left out.
-- Categories are based on each item's price (before any bill discount).

create or replace function public.sales_report(p_from date, p_to date, p_group text default 'day')
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_school uuid := public.my_school_id();
  v_result jsonb;
begin
  if public.my_role() is distinct from 'admin' then
    raise exception 'Only school admins can see reports';
  end if;
  if p_group not in ('hour', 'day', 'month') then
    raise exception 'Invalid grouping';
  end if;

  with bills as (
    select o.*
    from public.orders o
    where o.school_id = v_school and o.pickup_date between p_from and p_to and o.status <> 'cancelled'
  ),
  lines as (
    select oi.line_total, coalesce(c.name, 'No category') as category
    from bills b
    join public.order_items oi on oi.order_id = b.id
    left join public.products p on p.id = oi.product_id
    left join public.categories c on c.id = p.category_id
  )
  select jsonb_build_object(
    'total', coalesce((select sum(total) from bills), 0),
    'bills', (select count(*) from bills),
    'discounts', coalesce((select sum(discount_amount) from bills), 0),
    'gst', coalesce((select sum(gst_amount) from bills), 0),
    'preorders', (select count(*) from bills where source = 'preorder'),
    'by_method', coalesce((
      select jsonb_agg(jsonb_build_object('method', payment_method, 'total', t) order by t desc)
      from (select payment_method, sum(total) as t from bills group by payment_method) m
    ), '[]'),
    'by_category', coalesce((
      select jsonb_agg(jsonb_build_object('name', category, 'total', t) order by t desc)
      from (select category, sum(line_total) as t from lines group by category) c
    ), '[]'),
    'by_period', coalesce((
      select jsonb_agg(jsonb_build_object('period', period, 'total', t) order by period)
      from (
        select case p_group
                 when 'hour' then to_char(created_at at time zone 'Asia/Kolkata', 'HH24')
                 when 'day' then to_char(pickup_date, 'YYYY-MM-DD')
                 else to_char(pickup_date, 'YYYY-MM')
               end as period,
               sum(total) as t
        from bills group by 1
      ) pr
    ), '[]'),
    'by_biller', coalesce((
      select jsonb_agg(jsonb_build_object('name', name, 'bills', n, 'total', t) order by t desc)
      from (
        select case when b.source = 'preorder' then 'Parents (online)' else coalesce(pf.full_name, 'Former staff') end as name,
               count(*) as n, sum(b.total) as t
        from bills b left join public.profiles pf on pf.id = b.created_by
        group by 1
      ) bl
    ), '[]')
  ) into v_result;

  return v_result;
end;
$$;

revoke execute on function public.sales_report(date, date, text) from public, anon;
grant execute on function public.sales_report(date, date, text) to authenticated;
