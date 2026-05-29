-- Song History Table
create table if not exists song_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  prompt text default '',
  lyrics text default '',
  notes text default '',
  form jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table song_history enable row level security;

create policy "Users can read own song history"
on song_history for select
using (auth.uid() = user_id);

create policy "Users can insert own song history"
on song_history for insert
with check (auth.uid() = user_id);

create policy "Users can delete own song history"
on song_history for delete
using (auth.uid() = user_id);

-- Profiles Table
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  is_admin boolean default false,
  active_guide_ids text[] default '{}'::text[],
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "Enable read access for all authenticated users"
on profiles for select
using (auth.role() = 'authenticated');

create policy "Users can insert own profile"
on profiles for insert
with check (auth.uid() = id and is_admin = false);

create policy "Users can update own profile"
on profiles for update
using (auth.uid() = id)
with check (
  (is_admin = false) or 
  exists (
    select 1 from profiles
    where profiles.id = auth.uid() and profiles.is_admin = true
  )
);

create policy "Admins can update any profile"
on profiles for update
using (
  exists (
    select 1 from profiles
    where profiles.id = auth.uid() and profiles.is_admin = true
  )
);

-- System Guides Table
create table if not exists system_guides (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

alter table system_guides enable row level security;

create policy "Enable read access for all users"
on system_guides for select
using (true);

create policy "Enable all access for admins only"
on system_guides for all
using (
  exists (
    select 1 from profiles
    where profiles.id = auth.uid() and profiles.is_admin = true
  )
);

-- User Guides Table
create table if not exists user_guides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

alter table user_guides enable row level security;

create policy "Users can read own guides"
on user_guides for select
using (auth.uid() = user_id);

create policy "Users can insert own guides"
on user_guides for insert
with check (auth.uid() = user_id);

create policy "Users can update own guides"
on user_guides for update
using (auth.uid() = user_id);

create policy "Users can delete own guides"
on user_guides for delete
using (auth.uid() = user_id);

-- Announcements Table
create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  created_at timestamptz not null default now()
);

alter table announcements enable row level security;

create policy "Enable read access for all users"
on announcements for select
using (true);

create policy "Enable all access for admins only"
on announcements for all
using (
  exists (
    select 1 from profiles
    where profiles.id = auth.uid() and profiles.is_admin = true
  )
);

-- System Settings Table (Global API Keys, etc.)
create table if not exists system_settings (
  key text primary key,
  value text not null,
  created_at timestamptz not null default now()
);

alter table system_settings enable row level security;

create policy "Enable read access for all users"
on system_settings for select
using (true);

create policy "Enable all access for admins only"
on system_settings for all
using (
  exists (
    select 1 from profiles
    where profiles.id = auth.uid() and profiles.is_admin = true
  )
);

-- User Withdrawal Function
create or replace function delete_user()
returns void
language plpgsql
security definer
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

-- Playlists table for Library Folders
create table if not exists playlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  cover_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table playlists enable row level security;

create policy "Users can read own playlists"
on playlists for select
using (auth.uid() = user_id);

create policy "Users can insert own playlists"
on playlists for insert
with check (auth.uid() = user_id);

create policy "Users can update own playlists"
on playlists for update
using (auth.uid() = user_id);

create policy "Users can delete own playlists"
on playlists for delete
using (auth.uid() = user_id);
