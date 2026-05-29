-- =====================================================
-- AI Music Platform — Supabase Setup
-- 실행 방법: Supabase Dashboard → SQL Editor → New Query → 전체 붙여넣기 → Run
-- =====================================================

-- =====================================================
-- 0. 확장 (UUID 생성용)
-- =====================================================
create extension if not exists "pgcrypto";


-- =====================================================
-- 1. 사용자 역할 (Supabase Auth 확장)
-- =====================================================
create table if not exists user_roles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       text not null default 'user'
             check (role in ('user', 'artist', 'admin')),
  created_at timestamptz default now()
);

-- 헬퍼 함수: 현재 사용자가 admin인지 확인 (RLS 정책에서 사용)
create or replace function is_admin()
returns boolean
language sql security definer stable
as $$
  select exists (
    select 1 from user_roles
    where user_id = auth.uid() and role = 'admin'
  );
$$;


-- =====================================================
-- 2. 아티스트
-- =====================================================
create table if not exists artists (
  id              uuid primary key default gen_random_uuid(),
  slug            text unique not null,
  name            text not null,
  bio             text,
  avatar_url      text,
  banner_url      text,
  links           jsonb default '{}'::jsonb,
  is_ai_generated boolean default true,
  owner_user_id   uuid references auth.users(id) on delete set null,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists idx_artists_slug on artists(slug);


-- =====================================================
-- 3. 앨범 (싱글/EP/LP 통합)
-- =====================================================
create table if not exists albums (
  id              uuid primary key default gen_random_uuid(),
  slug            text unique not null,
  artist_id       uuid references artists(id) on delete cascade,
  title           text not null,
  release_type    text not null default 'single'
                  check (release_type in ('single', 'ep', 'lp', 'compilation')),
  cover_url       text,
  release_date    date,
  genres          text[] default '{}',
  moods           text[] default '{}',
  description     text,
  status          text not null default 'draft'
                  check (status in ('draft', 'published', 'archived')),
  generation_tool text,
  total_plays     bigint default 0,
  total_likes     bigint default 0,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists idx_albums_slug on albums(slug);
create index if not exists idx_albums_status on albums(status);
create index if not exists idx_albums_artist on albums(artist_id);
create index if not exists idx_albums_release on albums(release_date desc);


-- =====================================================
-- 4. 트랙
-- =====================================================
create table if not exists tracks (
  id              uuid primary key default gen_random_uuid(),
  album_id        uuid references albums(id) on delete cascade,
  track_number    int not null default 1,
  title           text not null,
  duration_sec    int,
  file_url        text not null,
  file_size       bigint,
  waveform_data   jsonb,
  -- AI 메타 (차별점)
  lyrics          text,
  style_prompt    text,
  bpm             int,
  song_key        text,
  prompt_meta     jsonb default '{}'::jsonb,
  -- 통계
  play_count      bigint default 0,
  like_count      bigint default 0,
  status          text not null default 'draft'
                  check (status in ('draft', 'published', 'archived')),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique(album_id, track_number)
);

create index if not exists idx_tracks_album on tracks(album_id);
create index if not exists idx_tracks_status on tracks(status);
create index if not exists idx_tracks_plays on tracks(play_count desc);


-- =====================================================
-- 5. 재생 이벤트 (차트 원본)
-- =====================================================
create table if not exists play_events (
  id              bigserial primary key,
  track_id        uuid references tracks(id) on delete cascade,
  user_id         uuid,
  played_at       timestamptz default now(),
  duration_played int,                          -- 30초 이상만 카운트
  ip_hash         text,                         -- 해시만 저장 (개인정보 X)
  country_code    text
);

create index if not exists idx_play_events_track_time
  on play_events(track_id, played_at desc);
create index if not exists idx_play_events_time
  on play_events(played_at desc);


-- =====================================================
-- 6. 좋아요
-- =====================================================
create table if not exists likes (
  user_id    uuid not null references auth.users(id) on delete cascade,
  track_id   uuid not null references tracks(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, track_id)
);

create index if not exists idx_likes_track on likes(track_id);


-- =====================================================
-- 7. 차트 스냅샷 (Phase 3 — pg_cron으로 매일 갱신)
-- =====================================================
create table if not exists chart_snapshots (
  id          bigserial primary key,
  period_type text not null check (period_type in ('daily', 'weekly', 'monthly')),
  period_date date not null,
  track_id    uuid references tracks(id) on delete cascade,
  rank        int not null,
  play_count  bigint,
  rank_change int,                              -- 전 기간 대비 (양수/음수, null이면 NEW)
  created_at  timestamptz default now()
);

create index if not exists idx_chart_lookup
  on chart_snapshots(period_type, period_date, rank);


-- =====================================================
-- 8. 자동 updated_at 트리거
-- =====================================================
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_artists_updated on artists;
create trigger trg_artists_updated before update on artists
  for each row execute function set_updated_at();

drop trigger if exists trg_albums_updated on albums;
create trigger trg_albums_updated before update on albums
  for each row execute function set_updated_at();

drop trigger if exists trg_tracks_updated on tracks;
create trigger trg_tracks_updated before update on tracks
  for each row execute function set_updated_at();


-- =====================================================
-- 9. 재생수 자동 집계 (Phase 2~3 활성화)
--    play_events INSERT → tracks.play_count + albums.total_plays 증가
-- =====================================================
create or replace function increment_play_counts()
returns trigger language plpgsql as $$
begin
  -- 30초 이상 재생만 카운트
  if new.duration_played >= 30 then
    update tracks set play_count = play_count + 1 where id = new.track_id;
    update albums set total_plays = total_plays + 1
      where id = (select album_id from tracks where id = new.track_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_play_increment on play_events;
create trigger trg_play_increment after insert on play_events
  for each row execute function increment_play_counts();


-- =====================================================
-- 10. Row Level Security (RLS)
-- =====================================================

-- user_roles: 본인 것만 읽기, admin만 수정
alter table user_roles enable row level security;

drop policy if exists "users read own role" on user_roles;
create policy "users read own role" on user_roles
  for select using (user_id = auth.uid() or is_admin());

drop policy if exists "admin manage roles" on user_roles;
create policy "admin manage roles" on user_roles
  for all using (is_admin()) with check (is_admin());


-- artists: published 앨범 가진 아티스트는 모두 읽기, admin은 모두
alter table artists enable row level security;

drop policy if exists "public read artists" on artists;
create policy "public read artists" on artists
  for select using (true);

drop policy if exists "admin write artists" on artists;
create policy "admin write artists" on artists
  for all using (is_admin()) with check (is_admin());


-- albums: published만 공개 읽기, admin은 모두
alter table albums enable row level security;

drop policy if exists "public read published albums" on albums;
create policy "public read published albums" on albums
  for select using (status = 'published' or is_admin());

drop policy if exists "admin write albums" on albums;
create policy "admin write albums" on albums
  for all using (is_admin()) with check (is_admin());


-- tracks: published 앨범의 published 트랙만 공개, admin은 모두
alter table tracks enable row level security;

drop policy if exists "public read published tracks" on tracks;
create policy "public read published tracks" on tracks
  for select using (
    is_admin() or (
      status = 'published'
      and exists (
        select 1 from albums
        where albums.id = tracks.album_id
        and albums.status = 'published'
      )
    )
  );

drop policy if exists "admin write tracks" on tracks;
create policy "admin write tracks" on tracks
  for all using (is_admin()) with check (is_admin());


-- play_events: 누구나 INSERT (재생 기록), 본인 것만 SELECT
alter table play_events enable row level security;

drop policy if exists "anyone insert play events" on play_events;
create policy "anyone insert play events" on play_events
  for insert with check (true);

drop policy if exists "admin read play events" on play_events;
create policy "admin read play events" on play_events
  for select using (is_admin());


-- likes: 본인 것만 관리, 공개 카운트는 tracks.like_count에서
alter table likes enable row level security;

drop policy if exists "users manage own likes" on likes;
create policy "users manage own likes" on likes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());


-- chart_snapshots: 모두 읽기, admin만 쓰기
alter table chart_snapshots enable row level security;

drop policy if exists "public read charts" on chart_snapshots;
create policy "public read charts" on chart_snapshots
  for select using (true);

drop policy if exists "admin write charts" on chart_snapshots;
create policy "admin write charts" on chart_snapshots
  for all using (is_admin()) with check (is_admin());


-- =====================================================
-- 11. Storage 버킷 생성
--    Supabase Dashboard → Storage에서 수동 생성하거나 아래 사용
-- =====================================================

insert into storage.buckets (id, name, public)
values
  ('artists', 'artists', true),
  ('albums', 'albums', true),
  ('tracks', 'tracks', false)        -- mp3는 서명 URL로만 접근
on conflict (id) do nothing;


-- Storage RLS: admin만 업로드, 공개 버킷은 모두 읽기

drop policy if exists "admin upload artists" on storage.objects;
create policy "admin upload artists" on storage.objects
  for insert with check (bucket_id = 'artists' and is_admin());

drop policy if exists "public read artists bucket" on storage.objects;
create policy "public read artists bucket" on storage.objects
  for select using (bucket_id = 'artists');


drop policy if exists "admin upload albums" on storage.objects;
create policy "admin upload albums" on storage.objects
  for insert with check (bucket_id = 'albums' and is_admin());

drop policy if exists "public read albums bucket" on storage.objects;
create policy "public read albums bucket" on storage.objects
  for select using (bucket_id = 'albums');


drop policy if exists "admin upload tracks" on storage.objects;
create policy "admin upload tracks" on storage.objects
  for insert with check (bucket_id = 'tracks' and is_admin());

drop policy if exists "admin read tracks bucket" on storage.objects;
create policy "admin read tracks bucket" on storage.objects
  for select using (bucket_id = 'tracks' and is_admin());

-- 일반 사용자 재생은 서버에서 서명 URL 발급 후 접근 (RLS 통과 불필요)


-- =====================================================
-- 12. 본인 계정을 admin으로 등록
--    ⚠️ 아래 'YOUR_USER_ID_HERE'를 본인 user_id로 바꿔서 실행
--    user_id 찾는 방법:
--      1) Supabase Dashboard → Authentication → Users → 본인 행 클릭
--      2) UID 복사 (예: 12345678-abcd-...)
-- =====================================================

-- 예시 (주석 풀어서 사용):
-- insert into user_roles (user_id, role)
-- values ('YOUR_USER_ID_HERE', 'admin')
-- on conflict (user_id) do update set role = 'admin';


-- =====================================================
-- 13. 검증 쿼리 (실행해서 확인)
-- =====================================================

-- 테이블 목록
-- select tablename from pg_tables where schemaname = 'public' order by tablename;

-- RLS 활성화 상태
-- select tablename, rowsecurity from pg_tables
-- where schemaname = 'public' and tablename in
--   ('user_roles', 'artists', 'albums', 'tracks', 'play_events', 'likes', 'chart_snapshots');

-- Storage 버킷
-- select id, name, public from storage.buckets;

-- 본인 admin 권한 확인
-- select * from user_roles;


-- =====================================================
-- 완료! 다음 단계:
-- 1. 본인 계정 admin 등록 (위 12번 섹션)
-- 2. Next.js 프로젝트에서 02 Task부터 진행
-- =====================================================
