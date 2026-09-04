'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Music, X, ChevronLeft, ChevronRight, Copy, Check,
  Play, Pause, Heart, Download, Globe, Wand2
} from 'lucide-react'

interface TrackDetailPanelProps {
  track: any | null
  collapsed: boolean
  onToggleCollapse: () => void
  onClose: () => void
  uiLanguage: string
  isPlaying: boolean
  onPlayToggle: () => void
  onLikeToggle: () => void
  onDownload: () => void
  onLoadIntoForm: () => void
  durationSlot?: React.ReactNode
}

const t = (lang: string, ko: string, ja: string, en: string) =>
  lang === 'KO' ? ko : lang === 'JA' ? ja : en

/** [Verse 1] 같은 섹션 머리말은 굵게 떼어 보여 준다. */
function LyricsBody({ lyrics }: { lyrics: string }) {
  return (
    <div className="text-[11px] leading-relaxed text-zinc-300 whitespace-pre-wrap break-words">
      {lyrics.split('\n').map((line, i) => {
        const isSection = /^\s*[\[(].+[\])]\s*$/.test(line)
        return isSection ? (
          <p key={i} className="mt-3 first:mt-0 font-black text-primary tracking-wide">
            {line.trim()}
          </p>
        ) : (
          <p key={i} className="min-h-[1em]">{line}</p>
        )
      })}
    </div>
  )
}

export function TrackDetailPanel({
  track,
  collapsed,
  onToggleCollapse,
  onClose,
  uiLanguage,
  isPlaying,
  onPlayToggle,
  onLikeToggle,
  onDownload,
  onLoadIntoForm,
  durationSlot
}: TrackDetailPanelProps) {
  const [copied, setCopied] = useState<'style' | 'lyrics' | null>(null)
  const [styleExpanded, setStyleExpanded] = useState(false)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const asideRef = useRef<HTMLElement | null>(null)
  const [paneHeight, setPaneHeight] = useState<number | null>(null)

  /* 패널 높이는 화면(100vh)이 아니라 스크롤을 맡는 「판」에 맞춘다.
     판은 상단 바·헤더·재생 바를 뺀 만큼만 높은데 100vh-13rem 은 그보다 커서
     (실측: 판 670px, 카드 692px, 시작 위치가 판 위에서 24px 아래) 패널 아래쪽이
     판 밖으로 밀려났다. 그래서 가사 끝을 보려면 패널이 아니라 판 전체를 스크롤해야 했다. */
  useEffect(() => {
    const row = asideRef.current?.parentElement
    if (!row) return

    let pane: HTMLElement | null = null
    for (let n = row.parentElement; n; n = n.parentElement) {
      if (/(auto|scroll)/.test(getComputedStyle(n).overflowY)) {
        pane = n
        break
      }
    }
    // 스크롤 판을 못 찾으면 클래스의 100vh 계산을 그대로 쓴다.
    if (!pane) return

    const scroller = pane
    const measure = () => {
      // row 는 sticky 가 아니라서 판 안에서의 위치가 스크롤과 무관하게 일정하다.
      const offset =
        row.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop
      setPaneHeight(Math.max(0, Math.round(scroller.clientHeight - offset)))
    }
    measure()

    const ro = new ResizeObserver(measure)
    ro.observe(scroller)
    return () => ro.disconnect()
    // 곡이 없을 때는 이 컴포넌트가 null 을 그리므로 잴 DOM 이 없다 — 패널이 실제로 뜰 때 잰다.
  }, [track?.id])

  // 곡이 바뀌면 스타일 펼침 상태를 처음으로 되돌린다.
  useEffect(() => {
    setStyleExpanded(false)
  }, [track?.id])

  useEffect(() => {
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current)
    }
  }, [])

  useEffect(() => {
    if (!track) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [track, onClose])

  if (!track) return null

  const styleText: string = track.prompt || track.form?.style || ''
  const lyricsText: string = track.lyrics || track.form?.prompt || ''
  const createdAt: string = track.created_at
    ? new Date(track.created_at).toLocaleDateString(
        uiLanguage === 'KO' ? 'ko-KR' : uiLanguage === 'JA' ? 'ja-JP' : 'en-US'
      )
    : ''

  const handleCopy = async (kind: 'style' | 'lyrics', text: string) => {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(kind)
      if (copyTimer.current) clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopied(null), 1600)
    } catch (e) {
      console.error('Clipboard copy failed:', e)
    }
  }

  const copyButton = (kind: 'style' | 'lyrics', text: string) => (
    <button
      type="button"
      onClick={() => handleCopy(kind, text)}
      disabled={!text}
      aria-label={t(uiLanguage, '복사하기', 'コピー', 'Copy')}
      className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors motion-reduce:transition-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-primary/60"
    >
      {copied === kind
        ? <Check className="w-3.5 h-3.5 text-primary" />
        : <Copy className="w-3.5 h-3.5 text-zinc-500" />}
    </button>
  )

  const emptyNote = (
    <p className="text-[11px] text-zinc-600 italic">
      {t(uiLanguage, '아직 없음', 'まだありません', 'Not available yet')}
    </p>
  )

  const body = (
    <>
      {/* 헤더: 닫기 */}
      <div className="flex justify-end px-3 pt-3 shrink-0">
        <button
          type="button"
          onClick={onClose}
          aria-label={t(uiLanguage, '상세 패널 닫기', '詳細パネルを閉じる', 'Close details panel')}
          className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors motion-reduce:transition-none cursor-pointer focus-visible:ring-2 focus-visible:ring-primary/60"
        >
          <X className="w-4 h-4 text-zinc-500" />
        </button>
      </div>

      {/* overscroll-contain: 가사 끝까지 굴려도 그 힘이 뒤쪽 판으로 넘어가지 않는다 */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain custom-scrollbar px-4 pb-5 space-y-4">
        {/* 1. 커버 */}
        <div className="flex justify-center">
          {track.image_url ? (
            <img
              src={track.image_url}
              alt={track.title || ''}
              className="w-40 h-40 rounded-2xl object-cover shadow-xl"
            />
          ) : (
            <div className="w-40 h-40 rounded-2xl bg-surface-container-lowest border border-outline-variant flex items-center justify-center">
              <Music className="w-10 h-10 text-zinc-700" />
            </div>
          )}
        </div>

        {/* 2. 지표 알약 줄 — 실제로 값이 있는 것만 */}
        <div className="flex items-center justify-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={onPlayToggle}
            aria-label={isPlaying ? t(uiLanguage, '일시정지', '一時停止', 'Pause') : t(uiLanguage, '재생', '再生', 'Play')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container-lowest border border-outline-variant text-[10px] font-bold text-zinc-300 hover:border-primary/50 transition-colors motion-reduce:transition-none cursor-pointer focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            {isPlaying ? <Pause className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
            {durationSlot ? <span className="font-mono">{durationSlot}</span> : null}
          </button>

          <button
            type="button"
            onClick={onLikeToggle}
            aria-label={t(uiLanguage, '좋아요', 'いいね', 'Like')}
            aria-pressed={!!track.liked}
            className="flex items-center px-2.5 py-1 rounded-full bg-surface-container-lowest border border-outline-variant hover:border-primary/50 transition-colors motion-reduce:transition-none cursor-pointer focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <Heart className={`w-3 h-3 ${track.liked ? 'text-primary fill-current' : 'text-zinc-500'}`} />
          </button>

          <button
            type="button"
            onClick={onDownload}
            aria-label={t(uiLanguage, '다운로드', 'ダウンロード', 'Download')}
            className="flex items-center px-2.5 py-1 rounded-full bg-surface-container-lowest border border-outline-variant hover:border-primary/50 transition-colors motion-reduce:transition-none cursor-pointer focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <Download className="w-3 h-3 text-zinc-500" />
          </button>

          {track.is_published && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/30 text-[10px] font-bold text-primary">
              <Globe className="w-3 h-3" />
              {t(uiLanguage, '공개', '公開', 'Public')}
            </span>
          )}
        </div>

        {/* 3. 제목 + 캡션 */}
        <div className="text-center space-y-1">
          <h3 className="text-base font-black text-white break-words leading-snug">
            {track.title || t(uiLanguage, '제목 없음', 'タイトルなし', 'Untitled')}
          </h3>
          <p className="text-[10px] text-zinc-500">
            {[track.genre, createdAt].filter(Boolean).join(' · ')}
          </p>
        </div>

        {/* 4. 폭 전체 버튼 */}
        <button
          type="button"
          onClick={onLoadIntoForm}
          className="w-full py-2.5 rounded-xl bg-primary text-black text-xs font-extrabold flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.99] transition-all motion-reduce:transition-none cursor-pointer focus-visible:ring-2 focus-visible:ring-primary/60"
        >
          <Wand2 className="w-3.5 h-3.5" />
          {t(uiLanguage, '이 설정으로 다시 만들기', 'この設定で作り直す', 'Rebuild with these settings')}
        </button>

        {/* 5. 스타일(프롬프트) 카드 */}
        <section className="rounded-xl bg-surface-container-lowest border border-outline-variant p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
              {t(uiLanguage, '스타일', 'スタイル', 'Styles')}
            </h4>
            {copyButton('style', styleText)}
          </div>
          {styleText ? (
            <>
              <p className={`text-[11px] leading-relaxed text-zinc-300 break-words ${styleExpanded ? '' : 'line-clamp-3'}`}>
                {styleText}
              </p>
              {styleText.length > 90 && (
                <button
                  type="button"
                  onClick={() => setStyleExpanded(v => !v)}
                  aria-expanded={styleExpanded}
                  className="text-[10px] font-bold text-primary hover:underline cursor-pointer focus-visible:ring-2 focus-visible:ring-primary/60 rounded"
                >
                  {styleExpanded
                    ? t(uiLanguage, '접기', '閉じる', 'Show Less')
                    : t(uiLanguage, '더 보기', 'もっと見る', 'Show More')}
                </button>
              )}
            </>
          ) : emptyNote}
        </section>

        {/* 6. 가사 카드 */}
        <section className="rounded-xl bg-surface-container-lowest border border-outline-variant p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
              {t(uiLanguage, '가사', '歌詞', 'Lyrics')}
            </h4>
            {copyButton('lyrics', lyricsText)}
          </div>
          {lyricsText ? <LyricsBody lyrics={lyricsText} /> : emptyNote}
        </section>
      </div>
    </>
  )

  return (
    <>
      {/* 데스크톱: 오른쪽 고정 칼럼 */}
      {/* 폭에는 전환을 걸지 않는다 — 접힘/펼침이 서로 다른 하위 트리라, 전환을 걸면
          접힌 레일이 원래 폭에 붙잡혀 자리를 안 비운다(실측). 등장 효과는 안쪽에서 준다. */}
      <aside
        ref={asideRef}
        className={`hidden lg:block shrink-0 self-start sticky top-0 ${
          collapsed ? 'w-9' : 'w-[21rem]'
        }`}
      >
        {collapsed ? (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={t(uiLanguage, '상세 패널 펼치기', '詳細パネルを開く', 'Expand details panel')}
            aria-expanded={false}
            className="w-9 h-[26rem] rounded-2xl bg-surface-container-low border border-outline-variant flex items-center justify-center hover:border-primary/50 transition-colors motion-reduce:transition-none cursor-pointer focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <ChevronLeft className="w-4 h-4 text-zinc-400" />
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label={t(uiLanguage, '상세 패널 접기', '詳細パネルを閉じる', 'Collapse details panel')}
              aria-expanded={true}
              className="absolute left-0 top-8 -translate-x-1/2 z-20 w-6 h-12 rounded-full bg-surface-container-high border border-outline-variant flex items-center justify-center hover:border-primary/50 transition-colors motion-reduce:transition-none cursor-pointer focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
            </button>
            <div
              key={track?.id ?? 'panel'}
              /* 아래 100vh·26rem 은 판을 재기 전 첫 프레임용 대비값이다 — 실측이 끝나면 덮인다.
                 minHeight 까지 같이 덮어야 한다: 창이 낮으면 26rem 바닥값이 실측 높이를
                 밀어내 패널이 다시 판 밖으로 나갔다(1280x650 에서 판 420 · 카드 416 실측). */
              style={paneHeight != null ? { height: paneHeight, minHeight: paneHeight } : undefined}
              className="h-[calc(100vh-13rem)] min-h-[26rem] rounded-2xl bg-[#111111] border border-outline-variant shadow-xl flex flex-col overflow-hidden animate-panel-in"
            >
              {body}
            </div>
          </>
        )}
      </aside>

      {/* 모바일: 아래에서 올라오는 시트 */}
      <div className="lg:hidden fixed inset-0 z-50" role="dialog" aria-modal="true">
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
        <div className="absolute inset-x-0 bottom-24 max-h-[calc(85vh-6rem)] rounded-t-2xl bg-[#111111] border-t border-outline-variant shadow-2xl flex flex-col animate-sheet-in">
          <div className="flex justify-center pt-2 shrink-0">
            <div className="w-10 h-1 rounded-full bg-zinc-700" />
          </div>
          {body}
        </div>
      </div>
    </>
  )
}
