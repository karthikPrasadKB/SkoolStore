-- School hours, set by the school admin in Settings.
-- Items sold "all day" are available during these hours.
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.

alter table public.schools
  add column if not exists weekday_open time not null default '08:00',
  add column if not exists weekday_close time not null default '15:30',
  -- Saturday hours. Both empty = closed on Saturdays.
  add column if not exists saturday_open time default '08:00',
  add column if not exists saturday_close time default '12:30';

alter table public.schools drop constraint if exists schools_hours_valid;
alter table public.schools add constraint schools_hours_valid check (
  weekday_open < weekday_close
  and (saturday_open is null) = (saturday_close is null)
  and (saturday_open is null or saturday_open < saturday_close)
);

-- Admins may edit the hours (along with the settings they could already edit).
grant update (weekday_open, weekday_close, saturday_open, saturday_close) on public.schools to authenticated;
