-- Phase 2: menu, items (SKUs), customisations, stock and photos.
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.

create type public.food_type as enum ('veg', 'non_veg', 'egg');

-- count: a fixed number in stock (e.g. 25 juice boxes)
-- daily_limit: a number that can be sold each day (e.g. 50 lunch combos)
-- unlimited: never runs out
create type public.stock_mode as enum ('count', 'daily_limit', 'unlimited');

-- Who can add and edit menu items.
create function public.can_edit_menu()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(public.my_role() in ('admin', 'canteen_staff'), false)
$$;

-- Menu sections like Snacks, Meals, Drinks.
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (school_id, name),
  unique (id, school_id)
);

-- Items the canteen sells.
create table public.products (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  category_id uuid,
  name text not null check (char_length(name) between 1 and 100),
  description text not null default '' check (char_length(description) <= 500),
  price numeric(10, 2) not null check (price >= 0),
  food_type public.food_type not null default 'veg',
  image_path text,
  is_active boolean not null default true,
  stock_mode public.stock_mode not null default 'unlimited',
  stock_qty int not null default 0 check (stock_qty >= 0),
  daily_limit int not null default 0 check (daily_limit >= 0),
  low_stock_threshold int not null default 5 check (low_stock_threshold >= 0),
  -- Days of the week the item is sold (0 = Sunday ... 6 = Saturday). Empty = every day.
  available_days smallint[] not null default '{}'
    check (available_days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  -- Time window the item is sold, in India time. Empty = all day.
  available_from time,
  available_until time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- The category must belong to the same school.
  foreign key (category_id, school_id)
    references public.categories (id, school_id) on delete set null (category_id)
);

create index products_school_id_idx on public.products (school_id);

-- Customisation groups, e.g. "Size" (pick one) or "Add-ons" (pick any).
create table public.option_groups (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  is_required boolean not null default false,
  max_select int not null default 1 check (max_select >= 1),
  sort_order int not null default 0
);

create index option_groups_product_id_idx on public.option_groups (product_id);

-- Choices inside a group, e.g. "Large (+₹20)".
create table public.options (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.option_groups (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  price_delta numeric(10, 2) not null default 0 check (price_delta >= 0),
  sort_order int not null default 0
);

create index options_group_id_idx on public.options (group_id);

-- Keep products.updated_at current.
create function public.touch_updated_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger products_touch_updated_at
  before update on public.products
  for each row execute function public.touch_updated_at();

-- Security rules: everyone in the school can see the menu; only admins and canteen staff edit it.
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.option_groups enable row level security;
alter table public.options enable row level security;

create policy "School members can view categories"
  on public.categories for select to authenticated
  using (school_id = public.my_school_id());

create policy "Menu editors can manage categories"
  on public.categories for all to authenticated
  using (school_id = public.my_school_id() and public.can_edit_menu())
  with check (school_id = public.my_school_id() and public.can_edit_menu());

create policy "School members can view products"
  on public.products for select to authenticated
  using (school_id = public.my_school_id());

create policy "Menu editors can manage products"
  on public.products for all to authenticated
  using (school_id = public.my_school_id() and public.can_edit_menu())
  with check (school_id = public.my_school_id() and public.can_edit_menu());

create policy "School members can view option groups"
  on public.option_groups for select to authenticated
  using (exists (
    select 1 from public.products p
    where p.id = product_id and p.school_id = public.my_school_id()
  ));

create policy "Menu editors can manage option groups"
  on public.option_groups for all to authenticated
  using (public.can_edit_menu() and exists (
    select 1 from public.products p
    where p.id = product_id and p.school_id = public.my_school_id()
  ))
  with check (public.can_edit_menu() and exists (
    select 1 from public.products p
    where p.id = product_id and p.school_id = public.my_school_id()
  ));

create policy "School members can view options"
  on public.options for select to authenticated
  using (exists (
    select 1 from public.option_groups g
    join public.products p on p.id = g.product_id
    where g.id = group_id and p.school_id = public.my_school_id()
  ));

create policy "Menu editors can manage options"
  on public.options for all to authenticated
  using (public.can_edit_menu() and exists (
    select 1 from public.option_groups g
    join public.products p on p.id = g.product_id
    where g.id = group_id and p.school_id = public.my_school_id()
  ))
  with check (public.can_edit_menu() and exists (
    select 1 from public.option_groups g
    join public.products p on p.id = g.product_id
    where g.id = group_id and p.school_id = public.my_school_id()
  ));

-- Replaces all customisations of an item in one go.
-- p_groups looks like: [{"name": "Size", "is_required": true, "max_select": 1,
--                        "options": [{"name": "Large", "price_delta": 20}]}]
create function public.save_product_options(p_product_id uuid, p_groups jsonb)
returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  v_group jsonb;
  v_option jsonb;
  v_group_id uuid;
  v_group_index int := 0;
  v_option_index int;
begin
  if not public.can_edit_menu() then
    raise exception 'Only admins and canteen staff can edit the menu';
  end if;

  delete from public.option_groups where product_id = p_product_id;

  for v_group in select * from jsonb_array_elements(coalesce(p_groups, '[]'::jsonb)) loop
    insert into public.option_groups (product_id, name, is_required, max_select, sort_order)
    values (
      p_product_id,
      v_group ->> 'name',
      coalesce((v_group ->> 'is_required')::boolean, false),
      greatest(coalesce((v_group ->> 'max_select')::int, 1), 1),
      v_group_index
    )
    returning id into v_group_id;

    v_option_index := 0;
    for v_option in select * from jsonb_array_elements(coalesce(v_group -> 'options', '[]'::jsonb)) loop
      insert into public.options (group_id, name, price_delta, sort_order)
      values (
        v_group_id,
        v_option ->> 'name',
        coalesce((v_option ->> 'price_delta')::numeric, 0),
        v_option_index
      );
      v_option_index := v_option_index + 1;
    end loop;

    v_group_index := v_group_index + 1;
  end loop;
end;
$$;

-- Lets counter staff (as well as admins and canteen staff) update stock numbers
-- and switch an item on or off, without being able to edit anything else.
create function public.update_product_stock(
  p_product_id uuid,
  p_stock_qty int,
  p_daily_limit int,
  p_is_active boolean
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if public.my_role() is null or public.my_role() = 'parent' then
    raise exception 'Only staff can update stock';
  end if;

  update public.products
  set stock_qty = greatest(p_stock_qty, 0),
      daily_limit = greatest(p_daily_limit, 0),
      is_active = p_is_active
  where id = p_product_id and school_id = public.my_school_id();

  if not found then
    raise exception 'Item not found';
  end if;
end;
$$;

revoke execute on function public.update_product_stock(uuid, int, int, boolean) from public, anon;
grant execute on function public.update_product_stock(uuid, int, int, boolean) to authenticated;

-- Photo storage. Anyone can view photos; only menu editors can upload them,
-- and only into their own school's folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']);

create policy "Menu editors can upload product images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = public.my_school_id()::text
    and public.can_edit_menu()
  );

create policy "Menu editors can replace product images"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = public.my_school_id()::text
    and public.can_edit_menu()
  );

create policy "Menu editors can delete product images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = public.my_school_id()::text
    and public.can_edit_menu()
  );
