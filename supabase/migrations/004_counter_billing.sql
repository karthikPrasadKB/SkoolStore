-- Phase 3: school settings, orders, counter billing and online bills.
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.

-- School settings ---------------------------------------------------------

alter table public.schools
  add column address text not null default '',
  add column phone text not null default '',
  add column gstin text not null default '',
  -- Prices include GST. This is the rate used for items that don't set their own.
  add column gst_rate numeric(5, 2) not null default 5 check (gst_rate between 0 and 100),
  -- Pre-orders for a day close at this time, either the day before or the same day.
  add column preorder_cutoff_time time not null default '21:00',
  add column preorder_cutoff_same_day boolean not null default false,
  add column counter_discount_allowed boolean not null default true,
  add column counter_max_discount_percent numeric(5, 2) not null default 20
    check (counter_max_discount_percent between 0 and 100),
  add column next_bill_number int not null default 1;

create policy "Admins can update their school"
  on public.schools for update to authenticated
  using (id = public.my_school_id() and public.my_role() = 'admin')
  with check (id = public.my_school_id() and public.my_role() = 'admin');

-- Admins may change settings, but never the join code or bill numbering.
revoke update on public.schools from anon, authenticated;
grant update (
  name, address, phone, gstin, gst_rate, preorder_cutoff_time, preorder_cutoff_same_day,
  counter_discount_allowed, counter_max_discount_percent
) on public.schools to authenticated;

-- Per-item GST rate. Empty = use the school's rate.
alter table public.products
  add column gst_rate numeric(5, 2) check (gst_rate between 0 and 100);

-- Orders -------------------------------------------------------------------

create type public.order_source as enum ('counter', 'preorder');
create type public.order_status as enum ('placed', 'paid', 'packed', 'collected', 'not_collected', 'cancelled');
create type public.payment_method as enum ('cash', 'upi', 'pluxee', 'wallet', 'online');

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  bill_number int not null,
  source public.order_source not null,
  status public.order_status not null,
  -- The day the food is handed over (India time). Used for daily limits and reports.
  pickup_date date not null,
  customer_name text check (char_length(customer_name) <= 100),
  customer_phone text check (char_length(customer_phone) <= 20),
  subtotal numeric(10, 2) not null,
  discount_amount numeric(10, 2) not null default 0,
  discount_reason text check (char_length(discount_reason) <= 200),
  total numeric(10, 2) not null,
  gst_amount numeric(10, 2) not null default 0,
  payment_method public.payment_method,
  amount_received numeric(10, 2),
  paid_at timestamptz,
  collected_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  created_by uuid references public.profiles (id) on delete set null,
  -- Secret part of the online bill link.
  public_token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now(),
  unique (school_id, bill_number)
);

create index orders_school_date_idx on public.orders (school_id, pickup_date);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  -- Copies of the item details at the time of sale, so old bills never change.
  name text not null,
  food_type public.food_type not null,
  options jsonb not null default '[]',
  unit_price numeric(10, 2) not null,
  quantity int not null check (quantity > 0),
  gst_rate numeric(5, 2) not null,
  line_total numeric(10, 2) not null
);

create index order_items_order_id_idx on public.order_items (order_id);
create index order_items_product_id_idx on public.order_items (product_id);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Staff see their school's orders. Orders are only created or changed through the functions below.
create policy "Staff can view school orders"
  on public.orders for select to authenticated
  using (school_id = public.my_school_id() and public.my_role() <> 'parent');

create policy "Staff can view school order items"
  on public.order_items for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_id and o.school_id = public.my_school_id() and public.my_role() <> 'parent'
  ));

revoke insert, update, delete on public.orders, public.order_items from anon, authenticated;

-- How many of each item are already ordered for a day (for daily limits).
create function public.product_sold_on(p_date date)
returns table (product_id uuid, quantity bigint)
language sql stable security invoker set search_path = ''
as $$
  select oi.product_id, sum(oi.quantity)
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where o.pickup_date = p_date
    and o.status <> 'cancelled'
    and o.school_id = public.my_school_id()
    and oi.product_id is not null
  group by oi.product_id
$$;

-- Counter sale ---------------------------------------------------------------
-- Checks every item, customisation, stock and discount, takes the stock,
-- and records a paid order, all in one step so two tills can never oversell.
--
-- p_items looks like: [{"product_id": "...", "quantity": 2, "option_ids": ["...", "..."]}]
create function public.create_counter_order(
  p_items jsonb,
  p_payment_method public.payment_method,
  p_amount_received numeric default null,
  p_discount_amount numeric default 0,
  p_discount_reason text default null,
  p_customer_name text default null,
  p_customer_phone text default null
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_role public.user_role := public.my_role();
  v_school public.schools;
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
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

  -- Lock the school row so bill numbers are handed out one at a time.
  select * into v_school from public.schools where id = public.my_school_id() for update;

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
    school_id, bill_number, source, status, pickup_date, customer_name, customer_phone,
    subtotal, discount_amount, discount_reason, total, gst_amount, payment_method,
    amount_received, paid_at, collected_at, created_by
  )
  values (
    v_school.id, v_school.next_bill_number, 'counter', 'collected', v_today,
    nullif(trim(p_customer_name), ''), nullif(trim(p_customer_phone), ''),
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

revoke execute on function public.create_counter_order(jsonb, public.payment_method, numeric, numeric, text, text, text) from public, anon;
grant execute on function public.create_counter_order(jsonb, public.payment_method, numeric, numeric, text, text, text) to authenticated;

-- Cancel an order (e.g. a billing mistake). Puts counted stock back.
create function public.cancel_order(p_order_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.orders;
begin
  if not public.can_edit_menu() then
    raise exception 'Only admins and canteen staff can cancel orders';
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

  update public.orders
  set status = 'cancelled', cancelled_at = now(), cancel_reason = nullif(trim(p_reason), '')
  where id = v_order.id;
end;
$$;

revoke execute on function public.cancel_order(uuid, text) from public, anon;
grant execute on function public.cancel_order(uuid, text) to authenticated;

-- Online bill: anyone with the secret link can view it, no login needed.
create function public.get_bill(p_token text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'school', jsonb_build_object('name', s.name, 'address', s.address, 'phone', s.phone, 'gstin', s.gstin),
    'bill_number', o.bill_number,
    'status', o.status,
    'source', o.source,
    'created_at', o.created_at,
    'customer_name', o.customer_name,
    'subtotal', o.subtotal,
    'discount_amount', o.discount_amount,
    'total', o.total,
    'gst_amount', o.gst_amount,
    'payment_method', o.payment_method,
    'amount_received', o.amount_received,
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'name', oi.name, 'food_type', oi.food_type, 'options', oi.options,
        'unit_price', oi.unit_price, 'quantity', oi.quantity, 'gst_rate', oi.gst_rate, 'line_total', oi.line_total
      ) order by oi.name), '[]')
      from public.order_items oi where oi.order_id = o.id
    )
  )
  from public.orders o
  join public.schools s on s.id = o.school_id
  where o.public_token = p_token
$$;

grant execute on function public.get_bill(text) to anon, authenticated;
