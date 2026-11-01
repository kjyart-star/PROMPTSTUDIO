import type { Track } from '@/types/music'

/** 공개 곡 정보 배지 — 값이 있는 것만 보인다(싱크 가사 · 마스터링본) */
export default function TrackBadges({ track }: { track: Pick<Track, 'has_lrc' | 'lrc_by' | 'is_mastered'> }) {
  if (!track.has_lrc && !track.is_mastered) return null
  const cls = 'shrink-0 px-1 py-px rounded bg-primary/15 text-[9px] font-bold leading-none text-primary'
  return (
    <>
      {track.has_lrc && (track.lrc_by === 'auto'
        ? <span className={cls} title="자동으로 맞춘 싱크 가사가 있어요">자동</span>
        : <span className={cls} title="싱크 가사가 있어요">LRC</span>)}
      {track.is_mastered && <span className={cls} title="마스터링한 곡이에요">마스터링</span>}
    </>
  )
}
