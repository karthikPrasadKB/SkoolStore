-- Only school admins can cancel bills. A reason is required, and who cancelled is recorded.
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.

alter table public.orders
  add column if not exists cancelled_by uuid references public.profiles (id) on delete set null;

create or replace function public.cancel_order(p_order_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.orders;
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

  update public.orders
  set status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = auth.uid(),
      cancel_reason = left(trim(p_reason), 200)
  where id = v_order.id;
end;
$$;
