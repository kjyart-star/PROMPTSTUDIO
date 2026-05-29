-- =====================================================
-- AI Music Platform — Schema Update (Phase 2 & 3)
-- 실행 방법: Supabase Dashboard → SQL Editor → New Query → 붙여넣기 → Run
-- =====================================================

-- 1. 좋아요 카운트 자동 증감 트리거 함수
create or replace function update_like_counts()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update tracks set like_count = like_count + 1 where id = new.track_id;
    update albums set total_likes = total_likes + 1
      where id = (select album_id from tracks where id = new.track_id);
    return new;
  elsif tg_op = 'DELETE' then
    update tracks set like_count = greatest(0, like_count - 1) where id = old.track_id;
    update albums set total_likes = greatest(0, total_likes - 1)
      where id = (select album_id from tracks where id = old.track_id);
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_like_count_update on likes;
create trigger trg_like_count_update after insert or delete on likes
  for each row execute function update_like_counts();


-- 2. 차트 스냅샷 배치 집계 PL/pgSQL 함수
create or replace function aggregate_charts(period_type text, period_date date)
returns void language plpgsql security definer as $$
declare
  start_time timestamptz;
  end_time timestamptz;
begin
  if period_type = 'daily' then
    start_time := period_date::timestamptz;
    end_time := start_time + interval '1 day';
  elsif period_type = 'weekly' then
    start_time := date_trunc('week', period_date)::timestamptz;
    end_time := start_time + interval '7 days';
  elsif period_type = 'monthly' then
    start_time := date_trunc('month', period_date)::timestamptz;
    end_time := start_time + interval '1 month';
  else
    raise exception 'Invalid period type';
  end if;

  -- 기존 동일 스냅샷 삭제 (멱등성 보장)
  delete from chart_snapshots where period_type = $1 and period_date = $2;

  -- 집계 및 삽입
  insert into chart_snapshots (period_type, period_date, track_id, rank, play_count, rank_change)
  with current_rankings as (
    select
      track_id,
      count(*) as plays,
      row_number() over (order by count(*) desc, track_id) as current_rank
    from play_events
    where played_at >= start_time and played_at < end_time
    group by track_id
  ),
  previous_rankings as (
    select track_id, rank as prev_rank
    from chart_snapshots
    where period_type = $1
      and period_date = (
        case
          when $1 = 'daily' then $2 - interval '1 day'
          when $1 = 'weekly' then $2 - interval '7 days'
          when $1 = 'monthly' then $2 - interval '1 month'
        end
      )::date
  )
  select
    $1,
    $2,
    c.track_id,
    c.current_rank,
    c.plays,
    (p.prev_rank - c.current_rank) as rank_change
  from current_rankings c
  left join previous_rankings p on p.track_id = c.track_id
  where c.current_rank <= 100;
end;
$$;
