-- Email, phone and username are unique across everyone (parents, staff, admins, superadmins).
-- Phones are compared by their last 10 digits ("+91 98765 43210" = "9876543210"); emails ignore capitals.
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.

-- Database backstops within each table.
create unique index if not exists profiles_contact_email_unique
  on public.profiles (lower(trim(contact_email)))
  where contact_email is not null and trim(contact_email) <> '';

create unique index if not exists profiles_phone_unique
  on public.profiles (right(regexp_replace(phone, '\D', '', 'g'), 10))
  where phone is not null and length(regexp_replace(phone, '\D', '', 'g')) >= 10;

create unique index if not exists client_admins_contact_email_unique
  on public.client_admins (lower(trim(contact_email)))
  where contact_email is not null and trim(contact_email) <> '';

create unique index if not exists client_admins_phone_unique
  on public.client_admins (right(regexp_replace(phone, '\D', '', 'g'), 10));

-- Is this email or phone already used by someone else? Checks login emails, staff contact emails and phones.
-- Returns 'email', 'phone' or null. p_exclude is the person being edited (so they don't clash with themselves).
-- Server only (secret key).
create or replace function public.contact_in_use(p_email text, p_phone text, p_exclude uuid default null)
returns text
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_phone text := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10);
begin
  if v_email <> '' and (
    exists (select 1 from auth.users u where lower(u.email) = v_email and u.id is distinct from p_exclude)
    or exists (select 1 from public.profiles p
               where lower(trim(p.contact_email)) = v_email and p.id is distinct from p_exclude)
    or exists (select 1 from public.client_admins c
               where lower(trim(c.contact_email)) = v_email and c.user_id is distinct from p_exclude)
  ) then
    return 'email';
  end if;

  if length(v_phone) = 10 and (
    exists (select 1 from public.profiles p
            where right(regexp_replace(coalesce(p.phone, ''), '\D', '', 'g'), 10) = v_phone
              and p.id is distinct from p_exclude)
    or exists (select 1 from public.client_admins c
               where right(regexp_replace(c.phone, '\D', '', 'g'), 10) = v_phone
                 and c.user_id is distinct from p_exclude)
  ) then
    return 'phone';
  end if;

  return null;
end;
$$;

revoke execute on function public.contact_in_use(text, text, uuid) from public, anon, authenticated;
grant execute on function public.contact_in_use(text, text, uuid) to service_role;

-- Staff can log in with the email saved on their account: find which username account it belongs to.
-- Server only (secret key), so it can't be used to look people up.
create or replace function public.staff_login_for_email(p_email text)
returns text
language sql stable security definer set search_path = ''
as $$
  select u.email
  from auth.users u
  where u.id = coalesce(
    (select p.id from public.profiles p where lower(trim(p.contact_email)) = lower(trim(p_email)) limit 1),
    (select c.user_id from public.client_admins c where lower(trim(c.contact_email)) = lower(trim(p_email)) limit 1)
  )
$$;

revoke execute on function public.staff_login_for_email(text) from public, anon, authenticated;
grant execute on function public.staff_login_for_email(text) to service_role;
