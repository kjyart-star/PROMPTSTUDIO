-- RLS already limits updates to auth.uid() = profiles.id. The table-level
-- UPDATE grant was missing, so PostgREST rejected every profile save with
-- SQLSTATE 42501 before the ownership policy could run.
grant update on table public.profiles to authenticated;
