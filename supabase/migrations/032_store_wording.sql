-- Wording: "canteen" is now "store" in the messages parents see when ordering.
-- (Same pre-order function as before; only two messages changed.)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.

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

  if public.school_is_disabled(v_school.id) then
    raise exception 'This school''s store isn''t taking orders right now';
  end if;

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
    raise exception 'Not enough money in the wallet (balance ₹%). Please top up at the store counter.', v_wallet.balance;
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
