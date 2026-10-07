-- Messages sent from the "Contact us" form on the landing page.
-- Read them in Supabase: Table Editor -> contact_messages.

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  email text not null check (char_length(email) between 3 and 320),
  phone text check (char_length(phone) <= 40),
  school_name text check (char_length(school_name) <= 200),
  message text not null check (char_length(message) between 1 and 5000),
  created_at timestamptz not null default now()
);

alter table public.contact_messages enable row level security;

-- Anyone (even logged out) can send a message, but nobody can read them through the app.
create policy "Anyone can send a contact message"
  on public.contact_messages for insert to anon, authenticated
  with check (true);

revoke select, update, delete on public.contact_messages from anon, authenticated;
