'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, RotateCcw, Trash2 } from 'lucide-react'

export const TRASH_KEEP_DAYS = 30
const DAY_MS = 86_400_000

type Lang = 'KO' | 'JA' | 'EN'

/** 휴지통에 들어간 지 며칠 됐는지 → 남은 일수(0 이하면 정리 대상). 자동 삭제는 하지 않는다. */
export function trashDaysLeft(trashedAt: string | null | undefined, now = Date.now()): number {
  const t = trashedAt ? new Date(trashedAt).getTime() : NaN
  if (!Number.isFinite(t)) return TRASH_KEEP_DAYS
  return TRASH_KEEP_DAYS - Math.floor((now - t) / DAY_MS)
}

const L = {
  title: { KO: '휴지통', JA: 'ゴミ箱', EN: 'Trash' },
  hint: {
    KO: `지운 곡은 ${TRASH_KEEP_DAYS}일 동안 여기에 보관됩니다. 기간이 지나도 저절로 지워지지 않으니 직접 비워 주세요.`,
    JA: `削除した曲は${TRASH_KEEP_DAYS}日間ここに保管されます。期間を過ぎても自動では削除されません。`,
    EN: `Deleted tracks stay here for ${TRASH_KEEP_DAYS} days. Nothing is removed automatically after that.`,
  },
  empty: { KO: '휴지통이 비어 있습니다.', JA: 'ゴミ箱は空です。', EN: 'Trash is empty.' },
  restore: { KO: '복원', JA: '復元', EN: 'Restore' },
  del: { KO: '영구 삭제', JA: '完全に削除', EN: 'Delete forever' },
  emptyAll: { KO: '휴지통 비우기', JA: 'ゴミ箱を空にする', EN: 'Empty trash' },
  cancel: { KO: '취소', JA: 'キャンセル', EN: 'Cancel' },
  confirmOne: {
    KO: '이 곡을 영구 삭제할까요? 되돌릴 수 없습니다.',
    JA: 'この曲を完全に削除しますか？元に戻せません。',
    EN: 'Delete this track forever? This cannot be undone.',
  },
  confirmAll: {
    KO: '휴지통의 곡을 모두 영구 삭제할까요? 되돌릴 수 없습니다.',
    JA: 'ゴミ箱の曲をすべて完全に削除しますか？元に戻せません。',
    EN: 'Delete everything in the trash forever? This cannot be undone.',
  },
  confirmBtn: { KO: '영구 삭제', JA: '削除する', EN: 'Delete forever' },
  fail: { KO: '처리하지 못했습니다. 잠시 뒤 다시 시도해 주세요.', JA: '処理できませんでした。', EN: 'Something went wrong. Please try again.' },
}

function daysLabel(left: number, lang: Lang) {
  if (left <= 0) return lang === 'KO' ? '정리 대상' : lang === 'JA' ? '整理対象' : 'Ready to clear'
  return lang === 'KO' ? `${left}일 남음` : lang === 'JA' ? `残り${left}日` : `${left} days left`
}

export default function LibraryTrash({
  uiLanguage,
  refreshKey,
  onRestored,
  defaultOpen = false,
}: {
  uiLanguage: Lang
  /** 보관함에서 곡을 지울 때마다 바뀌어 목록을 다시 읽게 한다 */
  refreshKey: number
  onRestored: () => void
  /** 사이드바 「휴지통」으로 연 화면에서는 처음부터 펼쳐 둔다 */
  defaultOpen?: boolean
}) {
  const lang = uiLanguage
  const [open, setOpen] = useState(defaultOpen)
  const [items, setItems] = useState<any[]>([])
  const [confirm, setConfirm] = useState<{ id: string | null } | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/song-history?trash=1')
      if (res.ok) {
        const data = await res.json()
        setItems(Array.isArray(data) ? data : [])
      }
    } catch (e) {
      console.error('Failed to load trash:', e)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  const call = async (url: string, init: RequestInit) => {
    setError('')
    try {
      const res = await fetch(url, init)
      if (!res.ok) {
        setError(L.fail[lang])
        return false
      }
      await load()
      return true
    } catch {
      setError(L.fail[lang])
      return false
    }
  }

  const restore = async (id: string) => {
    const ok = await call(`/api/song-history/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trashed: false }),
    })
    if (ok) onRestored()
  }

  const confirmed = async () => {
    if (!confirm) return
    const url = confirm.id
      ? `/api/song-history?id=${confirm.id}&permanent=1`
      : '/api/song-history?empty=1'
    await call(url, { method: 'DELETE' })
    setConfirm(null)
  }

  return (
    <section className="rounded-2xl border border-[#232323] bg-[#0f0f0f]" aria-label={L.title[lang]}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-4 py-3 text-sm font-bold text-zinc-300 hover:text-white cursor-pointer"
      >
        <Trash2 className="w-4 h-4" />
        <span>{L.title[lang]}</span>
        <span className="text-zinc-500 font-medium">({items.length})</span>
        <ChevronDown className={`w-4 h-4 ml-auto transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3">
          <p className="text-xs text-zinc-500">{L.hint[lang]}</p>
          {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
          {items.length === 0 ? (
            <p className="text-xs text-zinc-500 py-4">{L.empty[lang]}</p>
          ) : (
            <>
              <ul className="divide-y divide-[#1c1c1c]">
                {items.map((item) => {
                  const left = trashDaysLeft(item.trashed_at)
                  return (
                    <li key={item.id} className="flex flex-wrap items-center gap-2 py-2">
                      <span className="flex-1 min-w-0 truncate text-sm text-zinc-200">{item.title || 'Untitled'}</span>
                      <span className={`text-[11px] font-bold ${left <= 0 ? 'text-amber-400' : 'text-zinc-500'}`}>
                        {daysLabel(left, lang)}
                      </span>
                      <button
                        type="button"
                        onClick={() => restore(item.id)}
                        className="px-2.5 py-1 rounded-lg border border-[#262626] bg-[#161616] text-xs font-bold text-zinc-300 hover:text-primary hover:border-primary/40 flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        {L.restore[lang]}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirm({ id: item.id })}
                        className="px-2.5 py-1 rounded-lg border border-[#262626] bg-[#161616] text-xs font-bold text-zinc-400 hover:text-red-400 hover:border-red-500/40 cursor-pointer"
                      >
                        {L.del[lang]}
                      </button>
                    </li>
                  )
                })}
              </ul>
              <button
                type="button"
                onClick={() => setConfirm({ id: null })}
                className="px-3 py-1.5 rounded-lg border border-red-500/40 text-xs font-bold text-red-400 hover:bg-red-500/10 cursor-pointer"
              >
                {L.emptyAll[lang]}
              </button>
            </>
          )}
        </div>
      )}
      {confirm && typeof document !== 'undefined' && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setConfirm(null)}
        >
          <div className="w-full max-w-sm rounded-2xl border border-[#232323] bg-[#141414] p-6" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm text-zinc-300 mb-5">{confirm.id ? L.confirmOne[lang] : L.confirmAll[lang]}</p>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setConfirm(null)} className="px-4 py-2 text-xs font-bold text-zinc-300 rounded-xl border border-[#262626] cursor-pointer">
                {L.cancel[lang]}
              </button>
              <button type="button" onClick={confirmed} className="px-5 py-2 text-xs font-extrabold text-white bg-[#FF2D55] rounded-xl cursor-pointer">
                {L.confirmBtn[lang]}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </section>
  )
}
