'use client'

import { Search } from 'lucide-react'
import type { LibraryKind, LibraryQuery, LibrarySort } from './libraryFilter'

type Lang = 'KO' | 'JA' | 'EN'

const T = {
  search: { KO: '제목 · 스타일 · 가사 검색', JA: 'タイトル・スタイル・歌詞を検索', EN: 'Search title, style, lyrics' },
  all: { KO: '전체', JA: 'すべて', EN: 'All' },
  vocal: { KO: '보컬', JA: 'ボーカル', EN: 'Vocal' },
  instrumental: { KO: '경음악', JA: 'インスト', EN: 'Instrumental' },
  newest: { KO: '최신순', JA: '新しい順', EN: 'Newest' },
  oldest: { KO: '오래된순', JA: '古い順', EN: 'Oldest' },
  title: { KO: '제목순', JA: 'タイトル順', EN: 'Title' },
  playlist: { KO: '재생목록 순서', JA: 'プレイリスト順', EN: 'Playlist order' },
  addTo: { KO: '재생목록에 추가…', JA: 'プレイリストに追加…', EN: 'Add to playlist…' },
  selectAll: { KO: '전체 선택', JA: 'すべて選択', EN: 'Select all' },
  selected: { KO: '곡 선택됨', JA: '曲を選択中', EN: 'selected' },
  download: { KO: '내려받기', JA: 'ダウンロード', EN: 'Download' },
  trash: { KO: '휴지통으로', JA: 'ゴミ箱へ', EN: 'Move to trash' },
  filtering: { KO: '필터 적용 중', JA: 'フィルター適用中', EN: 'Filtered' },
  reset: { KO: '모두 보기', JA: 'すべて表示', EN: 'Show all' },
  clear: { KO: '선택 해제', JA: '選択解除', EN: 'Clear' },
  publishedSkip: { KO: '공개된 곡은 제외됩니다', JA: '公開中の曲は除外されます', EN: 'Published tracks are skipped' },
}

export default function LibraryToolbar({
  uiLanguage, value, onChange, total, shown, selectedCount, allSelected,
  onToggleAll, onClear, onDownload, onTrash, hasPublishedSelected, playlists, onAddToPlaylist, onReset,
}: {
  uiLanguage: Lang
  value: LibraryQuery
  onChange: (v: LibraryQuery) => void
  total: number
  shown: number
  selectedCount: number
  allSelected: boolean
  onToggleAll: () => void
  onClear: () => void
  onDownload: () => void
  onTrash: () => void
  hasPublishedSelected: boolean
  playlists: { id: string; title: string }[]
  onAddToPlaylist: (playlistId: string) => void
  /** 필터를 모두 지운다(검색·종류·폴더) */
  onReset: () => void
}) {
  const l = uiLanguage
  const kinds: LibraryKind[] = ['all', 'vocal', 'instrumental']
  const field = 'bg-[#0f0f0f] border border-[#232323] rounded-xl text-xs text-zinc-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60'
  return (
    <div className="space-y-2" role="toolbar" aria-label={T.search[l]}>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs font-bold text-zinc-300 cursor-pointer">
          <input type="checkbox" checked={allSelected} onChange={onToggleAll} aria-label={T.selectAll[l]} className="accent-[#d4f000] w-4 h-4" />
          {T.selectAll[l]}
        </label>
        <div className="relative flex-1 min-w-[12rem]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="search"
            value={value.query}
            onChange={(e) => onChange({ ...value, query: e.target.value })}
            placeholder={T.search[l]}
            aria-label={T.search[l]}
            className={`${field} w-full pl-8 pr-3 py-2`}
          />
        </div>
        <div role="group" className="flex items-center gap-0.5 p-0.5 rounded-xl bg-[#0f0f0f] border border-[#232323]">
          {kinds.map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={value.kind === k}
              onClick={() => onChange({ ...value, kind: k })}
              className={`px-3 py-1.5 rounded-[10px] text-xs font-bold cursor-pointer ${value.kind === k ? 'bg-primary/15 text-primary border border-primary/40' : 'border border-transparent text-zinc-400 hover:text-zinc-100'}`}
            >
              {T[k][l]}
            </button>
          ))}
        </div>
        <select
          value={value.sort}
          onChange={(e) => onChange({ ...value, sort: e.target.value as LibrarySort })}
          aria-label="sort"
          className={`${field} px-3 py-2`}
        >
          {(value.playlistId ? (['playlist', 'newest', 'oldest', 'title'] as const) : (['newest', 'oldest', 'title'] as const)).map((s) => (
            <option key={s} value={s}>{T[s][l]}</option>
          ))}
        </select>
        <span className="text-[11px] text-zinc-500">{shown}/{total}</span>
      </div>
      {(value.query.trim() || value.kind !== 'all' || value.playlistId) && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-1.5 text-xs text-amber-300" role="status">
          <span className="font-bold">{T.filtering[l]}</span>
          <span className="text-zinc-300">
            {[value.playlistId ? (playlists.find((p) => p.id === value.playlistId)?.title ?? '') : '', value.kind !== 'all' ? T[value.kind][l] : '', value.query.trim() ? `“${value.query.trim()}”` : ''].filter(Boolean).join(' · ')}
          </span>
          <button type="button" onClick={onReset} className="ml-auto font-bold text-amber-300 hover:underline cursor-pointer">{T.reset[l]}</button>
        </div>
      )}
      {selectedCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2">
          <span className="text-xs font-bold text-primary">{selectedCount} {T.selected[l]}</span>
          <button type="button" onClick={onDownload} className="px-3 py-1 rounded-lg border border-[#262626] bg-[#161616] text-xs font-bold text-zinc-200 hover:text-primary cursor-pointer">{T.download[l]}</button>
          {playlists.length > 0 && (
            <select aria-label={T.addTo[l]} value="" onChange={(e) => { if (e.target.value) onAddToPlaylist(e.target.value) }} className={`${field} px-2 py-1`}>
              <option value="">{T.addTo[l]}</option>
              {playlists.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          )}
          <button type="button" onClick={onTrash} className="px-3 py-1 rounded-lg border border-red-500/40 text-xs font-bold text-red-400 hover:bg-red-500/10 cursor-pointer">{T.trash[l]}</button>
          <button type="button" onClick={onClear} className="px-3 py-1 text-xs font-bold text-zinc-400 hover:text-white cursor-pointer">{T.clear[l]}</button>
          {hasPublishedSelected && <span className="text-[11px] text-zinc-500">{T.publishedSkip[l]}</span>}
        </div>
      )}
    </div>
  )
}
