-- No two clients can share an email (ignoring capitals) or a phone number (ignoring spaces, dashes and +91).
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.

create unique index if not exists clients_email_unique
  on public.clients (lower(trim(email)))
  where email is not null;

-- Compare phones by their last 10 digits, so "+91 98765 43210" and "9876543210" count as the same number.
create unique index if not exists clients_phone_unique
  on public.clients (right(regexp_replace(phone, '\D', '', 'g'), 10))
  where phone is not null;
