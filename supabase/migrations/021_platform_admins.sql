-- Superadmins (organisation heads) who see and manage every school from the hidden /hq page.
-- There is NO way to become one from the app: add people only by running SQL here.
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Locked down: no one can read or change this list through the app.
alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from anon, authenticated;

-- The only thing the app can ask: "is the logged-in person a superadmin?"
create or replace function public.is_platform_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid())
$$;

revoke execute on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated;

-- To give someone superadmin access (after they've created a normal account):
--   insert into public.platform_admins (user_id)
--   select id from auth.users where email = 'head@yourorg.com';
--
-- To take it away:
--   delete from public.platform_admins
--   where user_id = (select id from auth.users where email = 'head@yourorg.com');
