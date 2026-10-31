'use client'

import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'

export interface FolderItem { id: string; title: string; is_published?: boolean }

/**
 * 보관함 폴더(= 재생목록) 사이드바 — 새로 만들기 · 이름 바꾸기 · 삭제 · 곡 끌어 넣기.
 * 삭제는 폴더만 지운다(곡은 그대로 「보관함」에 남는다). 공개된 폴더는 지울 수 없다.
 */
export const DRAG_TYPE = 'application/x-studio-song'

export default function FolderSidebar({
  folders, counts, activeId, onPick, onCreate, onRename, onDelete, onDropSong, total,
}: {
  folders: FolderItem[]
  counts: Record<string, number>
  activeId: string | null
  onPick: (id: string | null) => void
  onCreate: (title: string) => Promise<boolean> | boolean
  onRename: (id: string, title: string) => Promise<boolean> | boolean
  onDelete: (id: string) => Promise<boolean> | boolean
  /** 곡을 폴더 위로 끌어 놓았을 때. folderId 가 null 이면 폴더에서 빼기(보관함으로) */
  onDropSong: (songId: string, folderId: string | null) => void
  total: number
}) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const [error, setError] = useState('')

  const submitNew = async () => {
    const t = draft.trim()
    if (!t) { setAdding(false); return }
    setError('')
    if (await onCreate(t)) { setAdding(false); setDraft('') } else setError('폴더를 만들지 못했어요.')
  }
  const submitRename = async (id: string) => {
    const t = draft.trim()
    if (!t) { setEditing(null); return }
    setError('')
    if (await onRename(id, t)) { setEditing(null); setDraft('') } else setError('이름을 바꾸지 못했어요.')
  }
  const dropProps = (folderId: string | null) => ({
    onDragOver: (e: React.DragEvent) => { if (e.dataTransfer.types.includes(DRAG_TYPE)) { e.preventDefault(); setOver(folderId ?? '__root') } },
    onDragLeave: () => setOver(null),
    onDrop: (e: React.DragEvent) => {
      const id = e.dataTransfer.getData(DRAG_TYPE)
      setOver(null)
      if (id) { e.preventDefault(); onDropSong(id, folderId) }
    },
  })

  return (
    <div className="ml-3 pl-2 border-l border-white/[0.06] flex flex-col gap-0.5" aria-label="폴더">
      <div className="flex items-center gap-1 px-2 pt-1">
        <span className="text-[10px] font-black text-zinc-500 tracking-wider">폴더</span>
        <button type="button" aria-label="새 폴더 만들기" title="새 폴더 만들기" onClick={() => { setAdding(true); setDraft(''); setError('') }}
          className="ml-auto w-5 h-5 rounded-md flex items-center justify-center text-zinc-400 hover:text-primary hover:bg-white/[0.05] cursor-pointer">
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 폴더에서 빼려면 여기로 끌어 놓는다 */}
      <div {...dropProps(null)} className={`px-2 py-1 rounded-lg text-[10px] text-zinc-600 ${over === '__root' ? 'bg-primary/10 text-primary' : ''}`}>
        {over === '__root' ? '여기에 놓으면 폴더에서 빠져요' : `폴더 밖 ${total}곡 포함 전체`}
      </div>

      {adding && (
        <input autoFocus value={draft} placeholder="폴더 이름" aria-label="새 폴더 이름" maxLength={40}
          onChange={(e) => setDraft(e.target.value)} onBlur={submitNew}
          onKeyDown={(e) => { if (e.key === 'Enter') submitNew(); if (e.key === 'Escape') { setAdding(false) } }}
          className="mx-1 rounded-lg bg-[#0a0a0a] border border-primary/40 px-2 py-1 text-[11px] text-zinc-100 focus:outline-none" />
      )}
      {error && <p role="alert" className="px-2 text-[10px] text-red-400">{error}</p>}

      {folders.map((f) => {
        const active = activeId === f.id
        if (editing === f.id) {
          return (
            <input key={f.id} autoFocus value={draft} aria-label="폴더 이름 바꾸기" maxLength={40}
              onChange={(e) => setDraft(e.target.value)} onBlur={() => submitRename(f.id)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitRename(f.id); if (e.key === 'Escape') setEditing(null) }}
              className="mx-1 rounded-lg bg-[#0a0a0a] border border-primary/40 px-2 py-1 text-[11px] text-zinc-100 focus:outline-none" />
          )
        }
        return (
          <div key={f.id} {...dropProps(f.id)} className={`group/folder flex items-center rounded-lg ${over === f.id ? 'ring-1 ring-primary bg-primary/10' : ''}`}>
            <button type="button" onClick={() => onPick(active ? null : f.id)} aria-pressed={active}
              className={`flex-1 min-w-0 px-2 py-1.5 rounded-lg flex items-center gap-2 text-[11px] font-bold cursor-pointer ${active ? 'text-primary bg-primary/10' : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'}`}>
              <span className="truncate">{f.title}</span>
              <span className="ml-auto font-mono text-[10px] text-zinc-500">{counts[f.id] ?? 0}</span>
            </button>
            {confirmDel === f.id ? (
              <span className="flex items-center gap-1 pr-1">
                <button type="button" onClick={async () => { setConfirmDel(null); await onDelete(f.id) }} className="text-[10px] font-bold text-red-400 hover:underline cursor-pointer">폴더만 삭제</button>
                <button type="button" onClick={() => setConfirmDel(null)} className="text-[10px] text-zinc-500 hover:text-white cursor-pointer">취소</button>
              </span>
            ) : (
              <span className="flex items-center opacity-0 group-hover/folder:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
                <button type="button" aria-label={`${f.title} 이름 바꾸기`} title="이름 바꾸기" onClick={() => { setEditing(f.id); setDraft(f.title); setError('') }}
                  className="w-5 h-5 flex items-center justify-center text-zinc-500 hover:text-primary cursor-pointer"><Pencil className="w-3 h-3" /></button>
                <button type="button" aria-label={`${f.title} 폴더 삭제`} disabled={!!f.is_published}
                  title={f.is_published ? '공개된 폴더는 지울 수 없어요' : '폴더 삭제 (곡은 남아요)'} onClick={() => setConfirmDel(f.id)}
                  className="w-5 h-5 flex items-center justify-center text-zinc-500 hover:text-red-400 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"><Trash2 className="w-3 h-3" /></button>
              </span>
            )}
          </div>
        )
      })}
      {confirmDel && <p className="px-2 text-[10px] text-zinc-500">폴더만 지워지고 곡은 「보관함」에 그대로 남아요.</p>}
    </div>
  )
}
