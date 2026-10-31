'use client'

import { useEffect, useRef, useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import LyricsHelper from './LyricsHelper'
import { parseTiming, toLrc, type TimedLine } from './lrc'
import { PriceBadge } from './PaidConfirm'
import { stemAvailability } from '@/lib/studio/stem'
import { createPortal } from 'react-dom'

type Lang = 'KO' | 'JA' | 'EN'

const T = {
  more: { KO: '더보기', JA: 'メニュー', EN: 'More' },
  edit: { KO: '제목 · 가사 수정', JA: 'タイトル・歌詞を編集', EN: 'Edit title & lyrics' },
  lrc: { KO: 'LRC · SRT 올리기', JA: 'LRC・SRT をアップロード', EN: 'Upload LRC / SRT' },
  lrcClear: { KO: '가사 시간표 지우기', JA: '歌詞タイミングを削除', EN: 'Remove lyric timing' },
  mastering: { KO: '고급 마스터링', JA: '詳細マスタリング', EN: 'Advanced mastering' },
  quick: { KO: '마스터링', JA: 'マスタリング', EN: 'Mastering' },
  timing: { KO: '가사 시간 편집', JA: '歌詞タイミング編集', EN: 'Edit lyric timing' },
  art: { KO: '앨범아트 만들기 · 올리기', JA: 'アルバムアート', EN: 'Album art' },
  stem: { KO: '스템 분리 (보컬/악기)', JA: 'ステム分離', EN: 'Split stems' },
  stemView: { KO: '스템 보기', JA: 'ステムを見る', EN: 'View stems' },
  stemBusy: { KO: '스템 분리 중…', JA: '分離中…', EN: 'Splitting…' },
  up: { KO: '재생목록에서 한 칸 앞으로', JA: '1つ前へ', EN: 'Move up' },
  down: { KO: '재생목록에서 한 칸 뒤로', JA: '1つ後ろへ', EN: 'Move down' },
  lrcOut: { KO: 'LRC 내보내기', JA: 'LRC を書き出す', EN: 'Export LRC' },
  restore: { KO: '프롬프트로 되돌리기', JA: 'プロンプトに戻す', EN: 'Restore to prompt' },
  publish: { KO: '공개하기 (음악 생성 탭)', JA: '公開する', EN: 'Publish' },
  unpublish: { KO: '비공개로 설정', JA: '非公開にする', EN: 'Make private' },
  playlist: { KO: '재생목록에 추가', JA: 'プレイリストに追加', EN: 'Add to playlist' },
  noPlaylist: { KO: '재생목록에서 빼기', JA: 'プレイリストから外す', EN: 'Remove from playlist' },
  download: { KO: '내려받기', JA: 'ダウンロード', EN: 'Download' },
  dlMp3: { KO: 'MP3 내려받기', JA: 'MP3 をダウンロード', EN: 'Download MP3' },
  dlWav: { KO: 'WAV 내려받기', JA: 'WAV をダウンロード', EN: 'Download WAV' },
  wavNote: { KO: 'MP3 를 WAV 로 변환한 파일', JA: 'MP3 を WAV に変換したファイル', EN: 'MP3 converted to WAV' },
  trash: { KO: '휴지통으로 이동', JA: 'ゴミ箱へ移動', EN: 'Move to trash' },
  trashLocked: { KO: '쿠키뮤직에 공개된 곡은 휴지통으로 보낼 수 없습니다', JA: '公開中の曲はゴミ箱へ移動できません', EN: 'Published tracks cannot be moved to trash' },
  title: { KO: '제목', JA: 'タイトル', EN: 'Title' },
  lyrics: { KO: '가사', JA: '歌詞', EN: 'Lyrics' },
  save: { KO: '저장', JA: '保存', EN: 'Save' },
  cancel: { KO: '취소', JA: 'キャンセル', EN: 'Cancel' },
  lrcDone: { KO: '줄 가사 시간표를 저장했습니다', JA: '行のタイミングを保存しました', EN: 'lines of timing saved' },
  lrcBad: { KO: '시간표를 읽지 못했습니다. LRC 또는 SRT 파일인지 확인해 주세요.', JA: '読み取れませんでした。LRC / SRT を確認してください。', EN: 'Could not read timing. Use an LRC or SRT file.' },
}

export interface TrackMenuProps {
  uiLanguage: Lang
  item: any
  playlists: any[]
  signedIn: boolean
  buttonClass: string
  iconClass: string
  onUpdate: (payload: Record<string, any>) => Promise<void> | void
  onRestorePrompt: () => void
  onPublish: () => void
  onMastering: () => void
  onQuickMaster: () => void
  onEditTiming: () => void
  onAlbumArt: () => void
  onStem: () => void
  /** 밀리크레딧 — 모르면 undefined(「유료」만 보인다) */
  artMilli?: number | null
  stemMilli?: number | null
  /** 재생목록 보기에서만 넘긴다 */
  onMove?: (dir: -1 | 1) => void
  onDownload: () => void
  /** 있으면 「MP3 내려받기」·「WAV 내려받기」 두 줄로 보인다 */
  onDownloadWav?: () => void
  onTrash: () => void
}

export default function TrackMenu(p: TrackMenuProps) {
  const l = p.uiLanguage
  const [open, setOpen] = useState(false)
  const [sub, setSub] = useState(false)
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState('')
  const [lyrics, setLyrics] = useState('')
  const [notice, setNotice] = useState('')
  const [pos, setPos] = useState<React.CSSProperties>({})
  const wrap = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const area = useRef<HTMLTextAreaElement>(null)
  const stemStatus = p.item.form?.stems?.status as string | undefined
  const stemOk = stemAvailability(p.item) !== 'none'
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const hasLrc = Array.isArray(p.item.form?.lrc) && p.item.form.lrc.length > 0

  useEffect(() => {
    if (!open) return
    // 목록 칸의 overflow 에 잘리지 않게 화면 기준(fixed)으로 띄운다 — 위쪽 공간이 모자라면 아래로 연다
    const r = wrap.current?.getBoundingClientRect()
    if (r) {
      const right = Math.max(8, window.innerWidth - r.right)
      setPos(r.top > 380 ? { right, bottom: window.innerHeight - r.top + 4 } : { right, top: r.bottom + 4 })
    }
    const closeOnScroll = () => { setOpen(false); setSub(false) }
    window.addEventListener('scroll', closeOnScroll, true)
    window.addEventListener('resize', closeOnScroll)
    const off = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node) && !menuRef.current?.contains(e.target as Node)) { setOpen(false); setSub(false) } }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); setSub(false) } }
    document.addEventListener('mousedown', off)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', off); document.removeEventListener('keydown', esc)
      window.removeEventListener('scroll', closeOnScroll, true); window.removeEventListener('resize', closeOnScroll)
    }
  }, [open])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(''), 3500)
    return () => clearTimeout(t)
  }, [notice])

  const close = () => { setOpen(false); setSub(false) }
  const row = 'w-full text-left px-3 py-2 text-xs font-bold text-zinc-300 hover:bg-white/[0.05] hover:text-white rounded-lg cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'

  const readFile = async (file: File) => {
    const lines: TimedLine[] = parseTiming(file.name, await file.text())
    if (!lines.length) { setNotice(T.lrcBad[l]); return }
    await p.onUpdate({ lrc: lines })
    setNotice(`${lines.length}${T.lrcDone[l]}`)
  }

  return (
    <div ref={wrap} className="relative" onClick={(e) => e.stopPropagation()}>
      <button type="button" aria-haspopup="menu" aria-expanded={open} aria-label={T.more[l]} title={T.more[l]}
        onClick={() => setOpen((v) => !v)} className={`${p.buttonClass} text-zinc-300 hover:text-primary hover:border-primary/40`}>
        <MoreHorizontal className={p.iconClass} />
      </button>
      {open && mounted && createPortal(
        <div ref={menuRef} role="menu" style={pos} className="fixed z-[60] max-h-[70vh] overflow-y-auto w-56 rounded-xl border border-[#262626] bg-[#141414] p-1 shadow-2xl shadow-black/70">
          <button role="menuitem" className={row} onClick={() => { setTitle(p.item.title || ''); setLyrics(p.item.lyrics || ''); setEditing(true); close() }}>{T.edit[l]}</button>
          <button role="menuitem" className={row} onClick={() => { p.onRestorePrompt(); close() }}>{T.restore[l]}</button>
          <button role="menuitem" className={row} onClick={() => { p.onQuickMaster(); close() }}>{T.quick[l]}</button>
          <button role="menuitem" className={row} onClick={() => { p.onMastering(); close() }}>{T.mastering[l]}</button>
          <button role="menuitem" className={`${row} flex items-center gap-2`} onClick={() => { p.onAlbumArt(); close() }}>
            {T.art[l]} <PriceBadge milli={p.artMilli} className="ml-auto" />
          </button>
          {stemOk && <button role="menuitem" className={`${row} flex items-center gap-2`} onClick={() => { p.onStem(); close() }}>
            {stemStatus === 'done' ? T.stemView[l] : stemStatus === 'processing' ? T.stemBusy[l] : T.stem[l]}
            {stemStatus === 'done' || stemStatus === 'processing' ? null : <PriceBadge milli={p.stemMilli} className="ml-auto" />}
          </button>}
          <button role="menuitem" className={row} onClick={() => { p.onEditTiming(); close() }}>{T.timing[l]}</button>
          <button role="menuitem" className={row} onClick={() => { fileRef.current?.click(); close() }}>{T.lrc[l]}</button>
          {hasLrc && <button role="menuitem" className={row} onClick={() => {
            const url = URL.createObjectURL(new Blob([toLrc(p.item.form.lrc)], { type: 'text/plain;charset=utf-8' }))
            const a = document.createElement('a'); a.href = url; a.download = `${(p.item.title || 'lyrics').replace(/[\\/:*?"<>|]/g, '_')}.lrc`; a.click()
            setTimeout(() => URL.revokeObjectURL(url), 1000); close()
          }}>{T.lrcOut[l]}</button>}
          {hasLrc && <button role="menuitem" className={row} onClick={() => { p.onUpdate({ lrc: null }); close() }}>{T.lrcClear[l]}</button>}
          {p.signedIn && (
            <button role="menuitem" className={row} onClick={() => { p.onPublish(); close() }}>{p.item.is_published ? T.unpublish[l] : T.publish[l]}</button>
          )}
          {p.signedIn && (
            <>
              <button role="menuitem" className={row} aria-expanded={sub} onClick={() => setSub((v) => !v)}>{T.playlist[l]} ›</button>
              {sub && (
                <div className="mx-1 mb-1 max-h-40 overflow-y-auto rounded-lg bg-black/30 p-1">
                  {p.playlists.map((pl) => (
                    <button key={pl.id} role="menuitem" className={row} onClick={() => { p.onUpdate({ playlist_id: pl.id }); close() }}>
                      {pl.title}{p.item.playlist_id === pl.id ? ' ✓' : ''}
                    </button>
                  ))}
                  {p.item.playlist_id && <button role="menuitem" className={row} onClick={() => { p.onUpdate({ playlist_id: null }); close() }}>{T.noPlaylist[l]}</button>}
                </div>
              )}
            </>
          )}
          {p.onMove && <button role="menuitem" className={row} onClick={() => { p.onMove!(-1); close() }}>{T.up[l]}</button>}
          {p.onMove && <button role="menuitem" className={row} onClick={() => { p.onMove!(1); close() }}>{T.down[l]}</button>}
          {!p.onDownloadWav && <button role="menuitem" className={row} onClick={() => { p.onDownload(); close() }}>{T.download[l]}</button>}
          {p.onDownloadWav && !/\.wav(\?|$)/i.test(p.item.audio_url || '') && (
            <button role="menuitem" className={row} onClick={() => { p.onDownload(); close() }}>{T.dlMp3[l]}</button>
          )}
          {p.onDownloadWav && (
            <button role="menuitem" className={row} onClick={() => { p.onDownloadWav!(); close() }}>
              {T.dlWav[l]}
              {!/\.wav(\?|$)/i.test(p.item.audio_url || '') && <span className="block text-[10px] text-zinc-500">{T.wavNote[l]}</span>}
            </button>
          )}
          <div className="my-1 h-px bg-[#232323]" />
          <button role="menuitem" disabled={!!p.item.is_published} title={p.item.is_published ? T.trashLocked[l] : undefined}
            className={`${row} !text-red-400 hover:!bg-red-500/10`} onClick={() => { p.onTrash(); close() }}>{T.trash[l]}</button>
          {p.item.is_published && <p className="px-3 pb-2 text-[10px] text-zinc-500">{T.trashLocked[l]}</p>}
        </div>,
        document.body,
      )}
      <input ref={fileRef} type="file" accept=".lrc,.srt,.txt" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) readFile(f) }} />
      {notice && mounted && createPortal(
        <div role="status" className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[130] rounded-xl border border-[#262626] bg-[#141414] px-4 py-2 text-xs text-zinc-200">{notice}</div>,
        document.body,
      )}
      {editing && mounted && createPortal(
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 p-4" onClick={() => setEditing(false)}>
          <div className="w-full max-w-lg rounded-2xl border border-[#232323] bg-[#141414] p-5 space-y-3 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <label className="block text-xs font-bold text-zinc-300">{T.title[l]}
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] p-2.5 text-sm text-zinc-100 focus:outline-none focus:border-primary/60" />
            </label>
            <label className="block text-xs font-bold text-zinc-300">{T.lyrics[l]}
              <textarea ref={area} value={lyrics} onChange={(e) => setLyrics(e.target.value)} rows={10}
                className="mt-1 w-full rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] p-2.5 text-xs font-mono text-zinc-200 focus:outline-none focus:border-primary/60" />
            </label>
            <LyricsHelper uiLanguage={l} value={lyrics} getCursor={() => area.current?.selectionStart ?? lyrics.length}
              onChange={(next, pos) => { setLyrics(next); if (pos !== undefined) requestAnimationFrame(() => { area.current?.focus(); area.current?.setSelectionRange(pos, pos) }) }} />
            <div className="flex justify-end gap-3 pt-1">
              <button type="button" onClick={() => setEditing(false)} className="px-4 py-2 text-xs font-bold text-zinc-300 rounded-xl border border-[#262626] cursor-pointer">{T.cancel[l]}</button>
              <button type="button" disabled={!title.trim()} onClick={async () => { await p.onUpdate({ title, lyrics }); setEditing(false) }}
                className="px-5 py-2 text-xs font-extrabold text-black bg-primary rounded-xl cursor-pointer disabled:opacity-40">{T.save[l]}</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
