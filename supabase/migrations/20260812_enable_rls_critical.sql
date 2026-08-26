-- =====================================================================
-- CRITICAL SECURITY FIX — 2026-08-12
-- Enable RLS on public tables exposed via the public anon key, and lock
-- down an unused privileged RPC.
--
-- WHY: Supabase security advisor + direct inspection confirmed that
--   public.profiles, public.announcements, public.system_guides have
--   RLS DISABLED while anon/authenticated hold full SELECT/INSERT/UPDATE/
--   DELETE grants. Because the anon key is shipped to the browser, anyone
--   could hit /rest/v1/profiles directly to read every email, self-grant
--   is_admin/credits, or delete rows — bypassing all API-route auth.
--
-- SAFE-BY-CONSTRUCTION: public reads are preserved (app needs them);
--   writes are restricted to the owning user (profiles) or admins
--   (announcements/system_guides); privileged columns are protected by a
--   trigger so a user cannot escalate on their own row. service_role
--   (admin API routes / scripts) bypasses RLS and the trigger.
-- =====================================================================

-- ================= profiles =================
alter table public.profiles enable row level security;

-- Keep existing "Enable read access for all users" (SELECT, public, USING true).
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);
-- No DELETE policy: only service_role can delete profiles.

-- RLS is row-level, not column-level. Prevent privileged/credit/vanity columns
-- from being set by anyone other than service_role, even on one's own row.
create or replace function public.enforce_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
declare
  jwt_role text := coalesce(nullif(current_setting('request.jwt.claims', true), '')::json ->> 'role', '');
begin
  if jwt_role <> 'service_role' then
    if tg_op = 'INSERT' then
      new.is_admin := false;
      new.credits := 120;
      new.followers := 0;
      new.following := 0;
      new.plays := 0;
      new.likes := 0;
    elsif tg_op = 'UPDATE' then
      new.is_admin := old.is_admin;
      new.credits := old.credits;
      new.followers := old.followers;
      new.following := old.following;
      new.plays := old.plays;
      new.likes := old.likes;
    end if;
  end if;
  return new;
end;
$func$;

drop trigger if exists enforce_profile_privileges on public.profiles;
create trigger enforce_profile_privileges
  before insert or update on public.profiles
  for each row execute function public.enforce_profile_privileges();

-- ================= announcements =================
alter table public.announcements enable row level security;

drop policy if exists "announcements_public_read" on public.announcements;
create policy "announcements_public_read" on public.announcements
  for select to anon, authenticated using (true);

drop policy if exists "announcements_admin_write" on public.announcements;
create policy "announcements_admin_write" on public.announcements
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ================= system_guides =================
alter table public.system_guides enable row level security;

drop policy if exists "system_guides_public_read" on public.system_guides;
create policy "system_guides_public_read" on public.system_guides
  for select to anon, authenticated using (true);

drop policy if exists "system_guides_admin_write" on public.system_guides;
create policy "system_guides_admin_write" on public.system_guides
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ================= lock down unused privileged RPC =================
-- public.update_user_credits is NOT called anywhere in the app; only
-- reachable via direct REST rpc. Any anon could grant themselves credits.
revoke execute on function public.update_user_credits(uuid, integer) from anon, authenticated;
