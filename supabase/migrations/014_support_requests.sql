-- Parents can contact their school's admin (e.g. when a child's ID card number is already taken).
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.

do $$ begin
  create type public.request_status as enum ('open', 'resolved');
exception when duplicate_object then null;
end $$;

create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  parent_id uuid not null references public.profiles (id) on delete cascade,
  phone text not null check (char_length(phone) between 6 and 20),
  email text not null check (char_length(email) between 3 and 320),
  -- The ID card number or code the request is about, if any.
  id_card_number text check (char_length(id_card_number) <= 30),
  message text not null check (char_length(message) between 5 and 2000),
  status public.request_status not null default 'open',
  admin_reply text check (char_length(admin_reply) <= 2000),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists support_requests_school_idx on public.support_requests (school_id, status, created_at desc);

alter table public.support_requests enable row level security;

-- Logged-in parents can write to any school (including one they're adding a child to for the first time),
-- and see their own requests.
drop policy if exists "Parents can send requests to their schools" on public.support_requests;
create policy "Parents can send requests to their schools"
  on public.support_requests for insert to authenticated
  with check (parent_id = auth.uid() and status = 'open' and admin_reply is null);

drop policy if exists "Parents can view their requests" on public.support_requests;
create policy "Parents can view their requests"
  on public.support_requests for select to authenticated
  using (parent_id = auth.uid());

-- School admins see and answer their school's requests.
drop policy if exists "Admins can view school requests" on public.support_requests;
create policy "Admins can view school requests"
  on public.support_requests for select to authenticated
  using (school_id = public.my_school_id() and public.my_role() = 'admin');

drop policy if exists "Admins can answer school requests" on public.support_requests;
create policy "Admins can answer school requests"
  on public.support_requests for update to authenticated
  using (school_id = public.my_school_id() and public.my_role() = 'admin')
  with check (school_id = public.my_school_id() and public.my_role() = 'admin');

-- Admins may only change the status and reply, never the parent's message.
revoke update, delete on public.support_requests from anon, authenticated;
grant update (status, admin_reply, resolved_at, resolved_by) on public.support_requests to authenticated;

-- Admins see the names of parents who wrote to them (parents may belong to another school's account).
drop policy if exists "Admins can view parents who contacted them" on public.profiles;
create policy "Admins can view parents who contacted them"
  on public.profiles for select to authenticated
  using (
    public.my_role() = 'admin'
    and exists (
      select 1 from public.support_requests r
      where r.parent_id = profiles.id and r.school_id = public.my_school_id()
    )
  );
