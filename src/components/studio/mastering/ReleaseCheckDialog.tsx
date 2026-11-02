'use client'

/**
 * 「발매 점검」 단독 도구 — 내 곡(보관함)이나 파일을 고르면 이 브라우저 안에서만 분석해 6항목을 신호등으로 보여 준다.
 * 파일은 어디에도 올리지 않는다(보관함 곡은 내 저장소에서 받아 오기만 한다). 분석은 Web Worker 에서 한다.
 */
import { useRef, useState } from 'react'
import { X, Library, FolderOpen, Loader2 } from 'lucide-react'
import { decodeAudio } from '@/lib/mastering/render'
import { analyzeAudio } from '@/lib/mastering/analyze'
import { releaseCheck, type CheckItem } from '@/lib/mastering/releaseCheck'
import { fetchSongBlob, loadErrorText } from './actions'
import type { LibrarySong } from './store'
import { ReleaseCheckCard } from './ReleaseCheckCard'

export type CheckSource = { song: LibrarySong } | { file: File }

export function ReleaseCheckDialog({ onClose, pickFromLibrary, onMaster }: {
  onClose: () => void
  pickFromLibrary: (cb: (s: LibrarySong) => void) => void
  /** 결과를 보고 「이 곡 마스터링하기」 */
  onMaster: (src: CheckSource) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<{ label: string; p: number } | null>(null)
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ title: string; items: CheckItem[]; src: CheckSource } | null>(null)

  const run = async (src: CheckSource, title: string, getBlob: () => Promise<Blob>) => {
    setError(''); setDone(null)
    try {
      setBusy({ label: '곡을 여는 중', p: 0.02 })
      const blob = await getBlob()
      setBusy({ label: '소리로 푸는 중', p: 0.08 })
      const dec = await decodeAudio(await blob.arrayBuffer(), 44100)
      const a = await analyzeAudio(dec.channels, dec.sampleRate, { spectrogramCols: 8, harsh: true, onProgress: p => setBusy({ label: '6가지를 재는 중', p: 0.1 + p * 0.9 }) })
      setDone({ title, items: releaseCheck(a, null), src })
    } catch (e) {
      setError('song' in src ? loadErrorText(e) : '이 파일을 소리로 풀지 못했어요. WAV·MP3 로 다시 시도해 주세요.')
    } finally { setBusy(null) }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="발매 점검" className="fixed inset-0 z-[95] flex items-center justify-center bg-black/80 p-4" onClick={() => !busy && onClose()}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-[#232323] bg-[#141414] p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-white">발매 점검</h3>
            <p className="text-xs text-zinc-400">음량·트루피크·클리핑·강약·모노 호환·고음 거칠기를 재서 발매해도 되는지 알려 드려요.</p>
          </div>
          <button type="button" aria-label="닫기" onClick={onClose} disabled={!!busy} className="text-zinc-500 hover:text-white disabled:opacity-40"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={!!busy} onClick={() => pickFromLibrary(s => run({ song: s }, s.title || '제목 없음', () => fetchSongBlob(s)))}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#262626] bg-[#161616] text-xs font-bold text-zinc-200 hover:border-zinc-600 cursor-pointer disabled:opacity-40">
            <Library className="w-3.5 h-3.5" /> 보관함에서 고르기
          </button>
          <button type="button" disabled={!!busy} onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#262626] bg-[#161616] text-xs font-bold text-zinc-200 hover:border-zinc-600 cursor-pointer disabled:opacity-40">
            <FolderOpen className="w-3.5 h-3.5" /> 내 컴퓨터 파일 고르기
          </button>
          <input ref={fileRef} type="file" accept="audio/*,.wav,.mp3,.flac,.aif,.aiff,.m4a" hidden aria-label="점검할 파일"
            onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) run({ file: f }, f.name.replace(/\.[^/.]+$/, ''), async () => f) }} />
        </div>
        <p className="text-[11px] text-zinc-500">파일은 이 브라우저 안에서만 분석해요. 어디에도 올리지 않고, 크레딧도 들지 않아요(무료).</p>

        {busy && (
          <div role="status" className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-zinc-400"><Loader2 className="w-3.5 h-3.5 animate-spin" /> {busy.label} · {Math.round(busy.p * 100)}%</div>
            <div className="h-1.5 rounded-full bg-[#222] overflow-hidden"><div className="h-full bg-primary transition-[width]" style={{ width: `${Math.round(busy.p * 100)}%` }} /></div>
          </div>
        )}
        {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
        {done && (
          <>
            <ReleaseCheckCard items={done.items} title={`「${done.title}」 점검 결과`} />
            <p className="text-[10px] text-zinc-500">음량·트루피크는 음원 스트리밍 기준(-14 LUFS · -1 dBTP)으로 봐요. 고음 거칠기는 앱이 정한 참고 기준이에요.</p>
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => { onMaster(done.src); onClose() }} className="px-4 py-2 text-xs font-extrabold text-black bg-primary rounded-xl cursor-pointer">이 곡 마스터링하기</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
