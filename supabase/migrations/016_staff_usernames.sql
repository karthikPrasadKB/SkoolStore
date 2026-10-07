-- Staff log in with a username instead of an email.
-- Behind the scenes their login email is "<username>@staff.skoolstore.invalid" (a reserved domain: no mail is sent).
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.

alter table public.profiles
  -- Lowercase letters, numbers, dots and underscores, 3 to 30 characters. Unique across SkoolStore.
  add column if not exists username text check (username ~ '^[a-z0-9._]{3,30}$'),
  -- Optional real email for contacting a staff member (their login doesn't use it).
  add column if not exists contact_email text check (char_length(contact_email) <= 320);

create unique index if not exists profiles_username_idx on public.profiles (username) where username is not null;
