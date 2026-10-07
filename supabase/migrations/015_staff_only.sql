-- School admins see their staff, not every parent.
-- They can still see parents linked to their students (shown on the Students page)
-- and parents who sent them a request (already allowed in 014).
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.

drop policy if exists "Admins can view profiles in their school" on public.profiles;

drop policy if exists "Admins can view their staff" on public.profiles;
create policy "Admins can view their staff"
  on public.profiles for select to authenticated
  using (school_id = public.my_school_id() and role <> 'parent' and public.my_role() = 'admin');

drop policy if exists "Admins can view parents of their students" on public.profiles;
create policy "Admins can view parents of their students"
  on public.profiles for select to authenticated
  using (
    public.my_role() = 'admin'
    and exists (
      select 1 from public.students s
      where s.parent_id = profiles.id and s.school_id = public.my_school_id()
    )
  );
