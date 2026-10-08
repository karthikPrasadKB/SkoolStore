-- Clients: the businesses that run school canteens (name, email, phone). Each school belongs to a client.
-- Superadmins create clients with their schools and first admin in HQ; client admins add partners and schools.
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 200),
  email text not null check (char_length(email) between 3 and 320),
  phone text not null check (char_length(phone) between 6 and 20),
  created_at timestamptz not null default now()
);

alter table public.schools add column if not exists client_id uuid references public.clients (id) on delete set null;
create index if not exists schools_client_idx on public.schools (client_id);

alter table public.clients enable row level security;

-- Staff can see the client that runs the schools they work at. Changes are made from HQ only.
drop policy if exists "Staff can view their client" on public.clients;
create policy "Staff can view their client"
  on public.clients for select to authenticated
  using (exists (
    select 1 from public.school_memberships m
    join public.schools s on s.id = m.school_id
    where m.profile_id = auth.uid() and s.client_id = clients.id
  ));

revoke insert, update, delete on public.clients from anon, authenticated;

-- A school added by a client's admin (from the switcher) belongs to that client. ----------

create or replace function public.create_school(p_name text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text;
  v_school_id uuid;
  v_client_id uuid;
begin
  if public.my_role() is distinct from 'admin' then
    raise exception 'Only school admins can add schools';
  end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 then
    raise exception 'Please enter the school name';
  end if;

  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.schools where join_code = v_code);
  end loop;

  -- The new school belongs to the same client as the school the admin is working in.
  select client_id into v_client_id from public.schools where id = public.my_school_id();

  insert into public.schools (name, join_code, client_id) values (left(trim(p_name), 200), v_code, v_client_id)
  returning id into v_school_id;

  insert into public.school_memberships (profile_id, school_id, role) values (auth.uid(), v_school_id, 'admin');
  update public.profiles set school_id = v_school_id, role = 'admin' where id = auth.uid();

  return jsonb_build_object('id', v_school_id, 'join_code', v_code);
end;
$$;

