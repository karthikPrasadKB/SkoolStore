-- Phase 4b: parents pre-order for their children (up to 7 days ahead), paid from the school wallet.
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.

-- Each school decides what happens to pre-orders that aren't collected (applied at pickup, Phase 5).
alter table public.schools add column if not exists refund_uncollected boolean not null default false;
grant update (refund_uncollected) on public.schools to authenticated;

-- Parents can see the menus of their children's schools. -------------------------

drop policy if exists "Parents can view their schools' categories" on public.categories;
create policy "Parents can view their schools' categories"
  on public.categories for select to authenticated
  using (exists (
    select 1 from public.parent_schools ps
    where ps.parent_id = auth.uid() and ps.school_id = categories.school_id
  ));

drop policy if exists "Parents can view their schools' products" on public.products;
create policy "Parents can view their schools' products"
  on public.products for select to authenticated
  using (exists (
    select 1 from public.parent_schools ps
    where ps.parent_id = auth.uid() and ps.school_id = products.school_id
  ));

drop policy if exists "Parents can view their schools' option groups" on public.option_groups;
create policy "Parents can view their schools' option groups"
  on public.option_groups for select to authenticated
  using (exists (
    select 1 from public.products p
    join public.parent_schools ps on ps.school_id = p.school_id
    where p.id = option_groups.product_id and ps.parent_id = auth.uid()
  ));

drop policy if exists "Parents can view their schools' options" on public.options;
create policy "Parents can view their schools' options"
  on public.options for select to authenticated
  using (exists (
    select 1 from public.option_groups g
    join public.products p on p.id = g.product_id
    join public.parent_schools ps on ps.school_id = p.school_id
    where g.id = options.group_id and ps.parent_id = auth.uid()
  ));

-- How many of each limited item are already ordered for a day at a school (to show "only 3 left").
create or replace function public.sold_for_date(p_school_id uuid, p_date date)
returns table (product_id uuid, quantity bigint)
language sql stable security definer set search_path = ''
as $$
  select oi.product_id, sum(oi.quantity)
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where o.school_id = p_school_id
    and o.pickup_date = p_date
    and o.status <> 'cancelled'
    and oi.product_id is not null
    -- Only for the school's staff, or parents linked to the school.
    and (
      p_school_id = public.my_school_id()
      or exists (select 1 from public.parent_schools ps where ps.parent_id = auth.uid() and ps.school_id = p_school_id)
    )
  group by oi.product_id
$$;

revoke execute on function public.sold_for_date(uuid, date) from public, anon;
grant execute on function public.sold_for_date(uuid, date) to authenticated;

-- Internal: when orders for a pickup day close, in India time.
create or replace function public.preorder_deadline(p_school public.schools, p_date date)
returns timestamp
language sql immutable set search_path = ''
as $$
  select (case when p_school.preorder_cutoff_same_day then p_date else p_date - 1 end) + p_school.preorder_cutoff_time
$$;

-- Place a pre-order --------------------------------------------------------------
-- p_items looks like: [{"product_id": "...", "quantity": 2, "option_ids": ["..."]}]
create or replace function public.create_preorder(
  p_student_id uuid,
  p_pickup_date date,
  p_items jsonb,
  p_payment_method public.payment_method default 'wallet'
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
    school_id, bill_number, source, status, pickup_date, student_id,
    subtotal, discount_amount, total, gst_amount, payment_method, paid_at, created_by
  )
  values (
    v_school.id, v_school.next_bill_number, 'preorder', 'paid', p_pickup_date, v_student.id,
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

revoke execute on function public.create_preorder(uuid, date, jsonb, public.payment_method) from public, anon;
grant execute on function public.create_preorder(uuid, date, jsonb, public.payment_method) to authenticated;

-- Parents cancel a pre-order before that day's orders close: stock and money go back. ----

create or replace function public.cancel_preorder(p_order_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.orders;
  v_school public.schools;
  v_purchase public.wallet_transactions;
  v_wallet public.wallets;
begin
  select o.* into v_order
  from public.orders o
  join public.students s on s.id = o.student_id
  where o.id = p_order_id and s.parent_id = auth.uid()
  for update of o;

  if v_order.id is null then
    raise exception 'Order not found';
  end if;
  if v_order.source <> 'preorder' or v_order.status not in ('placed', 'paid') then
    raise exception 'This order can no longer be cancelled';
  end if;

  select * into v_school from public.schools where id = v_order.school_id;
  if (now() at time zone 'Asia/Kolkata') >= public.preorder_deadline(v_school, v_order.pickup_date) then
    raise exception 'Too late to cancel: orders for that day have closed. Please contact the school.';
  end if;

  update public.products p
  set stock_qty = p.stock_qty + returned.quantity
  from (
    select product_id, sum(quantity) as quantity
    from public.order_items
    where order_id = v_order.id and product_id is not null
    group by product_id
  ) as returned
  where returned.product_id = p.id and p.stock_mode = 'count';

  if v_order.payment_method = 'wallet' then
    select * into v_purchase from public.wallet_transactions
    where order_id = v_order.id and type = 'purchase'
    limit 1;
    if v_purchase.id is not null then
      select * into v_wallet from public.wallets where id = v_purchase.wallet_id for update;
      update public.wallets set balance = balance + v_order.total where id = v_wallet.id;
      insert into public.wallet_transactions (wallet_id, type, amount, balance_after, order_id, student_id, note, created_by)
      values (v_wallet.id, 'refund', v_order.total, v_wallet.balance + v_order.total, v_order.id,
              v_order.student_id, 'Pre-order cancelled', auth.uid());
    end if;
  end if;

  update public.orders
  set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(), cancel_reason = 'Cancelled by parent'
  where id = v_order.id;
end;
$$;

revoke execute on function public.cancel_preorder(uuid) from public, anon;
grant execute on function public.cancel_preorder(uuid) to authenticated;

-- Bills now include the pickup day (shown on pre-order bills). ------------------------

create or replace function public.get_bill(p_token text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'school', jsonb_build_object('name', s.name, 'address', s.address, 'phone', s.phone, 'gstin', s.gstin),
    'bill_number', o.bill_number,
    'status', o.status,
    'source', o.source,
    'pickup_date', o.pickup_date,
    'created_at', o.created_at,
    'customer_name', o.customer_name,
    'student', case when st.id is not null
      then jsonb_build_object('name', st.full_name, 'class_name', st.class_name) end,
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
  left join public.students st on st.id = o.student_id
  where o.public_token = p_token
$$;
