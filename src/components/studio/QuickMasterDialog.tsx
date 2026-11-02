'use client'

import { useState } from 'react'
import { quickMaster, QUICK_LOUDNESS, QUICK_PEAK, QUICK_TONES, QUICK_USES, type QuickTone, type QuickResult } from './mastering/quickMaster'
import { cancelRef } from './mastering/actions'
import { ReleaseCheckCard } from './mastering/ReleaseCheckCard'
import { ABCompare } from './mastering/ABCompare'
import type { MasteringHandoff } from './mastering/handoff'
import type { UseId } from '@/lib/mastering/compose'
import type { AiCleanMode } from '@/lib/mastering/aiclean'

const AI_TXT: { id: AiCleanMode | null; label: string }[] = [
  { id: null, label: '끄기' }, { id: 'natural', label: '자연스럽게' }, { id: 'strong', label: '강하게' },
]
const TONE_TXT: Record<QuickTone, [string, string]> = {
  balanced: ['균형 있게', '곡의 느낌을 그대로 살려요'],
  clear: ['선명하고 안정적인 사운드', '맑고 또렷하게 정리해요'],
  warm: ['따뜻한 사운드', '저음을 두껍게, 고음은 둥글게'],
  punch: ['펀치감 있는 사운드', '킥·스네어가 앞으로 나와요'],
}

export default function QuickMasterDialog({
  song, onClose, onDone, onAdvanced,
}: {
  song: any
  onClose: () => void
  onDone: (r: QuickResult) => void
  /** 고급 마스터링으로 — 결과가 있으면 그 설정을, 없으면 고른 고음 정리·목표만 넘긴다 */
  onAdvanced: (h?: MasteringHandoff) => void
}) {
  const [use, setUse] = useState<UseId>('use-stream')
  const [lufs, setLufs] = useState<number>(-14)
  // 보관함 곡은 우리 서비스가 만든 AI 곡 — 고음 정리를 기본으로 켠다
  const [aiClean, setAiClean] = useState<AiCleanMode | null>('natural')
  const [tp, setTp] = useState<number>(-1)
  const [tone, setTone] = useState<QuickTone>('balanced')
  const [run, setRun] = useState<{ label: string; p: number } | null>(null)
  const [error, setError] = useState('')
  const [result, setResult] = useState<QuickResult | null>(null)
  const [wav, setWav] = useState<{ busy: boolean; p: number; err: string }>({ busy: false, p: 0, err: '' })

  /** 같은 처리 결과를 브라우저에서 WAV 로 만들어 바로 내려받는다(업로드 없음) */
  const downloadWav = async () => {
    if (!result || wav.busy) return
    setWav({ busy: true, p: 0, err: '' })
    try {
      const blob = await result.makeWav(p => setWav(w => ({ ...w, p })))
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `${result.title.replace(/[\\/:*?"<>|]/g, '_')}.wav`
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
      setWav({ busy: false, p: 1, err: '' })
    } catch {
      setWav({ busy: false, p: 0, err: 'WAV 를 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.' })
    }
  }

  const start = async () => {
    setError('')
    setRun({ label: '준비 중', p: 0 })
    try {
      const r = await quickMaster(song, { lufs, tp, tone, use, aiClean }, (label, p) => setRun({ label, p }))
      setResult(r)
      onDone(r)
    } catch (e) {
      const m = (e as Error)?.message
      setError(m === 'cancelled' ? '마스터링을 멈췄어요.' : m === 'login' ? '로그인하면 보관함에 저장할 수 있어요.' : '마스터링하지 못했어요. 잠시 뒤 다시 시도해 주세요.')
    } finally { setRun(null) }
  }

  const pickUse = (id: UseId) => {
    setUse(id)
    const l = QUICK_LOUDNESS.find(x => x.id === QUICK_USES.find(u => u.id === id)?.loud)
    if (l) setLufs(l.lufs)
  }
  const advanced = () => {
    const target = { id: 'custom', label: '간단 마스터링 설정', lufs: result?.targetLufs ?? lufs, tp }
    onAdvanced(result ? { song, params: result.params, aiClean: result.options.aiClean ?? null, target } : { song, aiClean, target })
  }

  const chip = (active: boolean) => `px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer ${active ? 'border-primary/50 bg-primary/10 text-primary' : 'border-[#262626] bg-[#161616] text-zinc-300 hover:border-zinc-600'}`

  return (
    <div role="dialog" aria-modal="true" aria-label="마스터링" className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 p-4" onClick={() => !run && onClose()}>
      <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl border border-[#232323] bg-[#141414] p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          {song.image_url ? <img src={song.image_url} alt="" className="w-14 h-14 rounded-lg object-cover" /> : <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-[#14b48b]/40 to-[#3688e9]/40" aria-hidden />}
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-white truncate">{song.title || '제목 없음'}</h3>
            <p className="text-xs text-zinc-400">음량과 피크를 정돈해 완성하세요.</p>
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="qm-use" className="text-xs font-bold text-zinc-300">어디에 쓸 곡인가요</label>
          <select id="qm-use" value={use} disabled={!!run} onChange={(e) => pickUse(e.target.value as UseId)}
            className="w-full rounded-xl border border-[#262626] bg-[#161616] px-3 py-2 text-xs font-bold text-zinc-200 cursor-pointer">
            {QUICK_USES.map(u => <option key={u.id} value={u.id}>{u.label} — {u.plain}</option>)}
          </select>
        </div>
        <fieldset className="space-y-2" disabled={!!run}>
          <legend className="text-xs font-bold text-zinc-300">음량</legend>
          <div className="grid grid-cols-3 gap-2">
            {QUICK_LOUDNESS.map((l) => (
              <button key={l.id} type="button" aria-pressed={lufs === l.lufs} onClick={() => setLufs(l.lufs)} className={`${chip(lufs === l.lufs)} text-center`}>
                <span className="block">{l.label}</span>
                <span className="block font-medium text-[10px] text-zinc-500">약 {l.lufs} LUFS</span>
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="space-y-2" disabled={!!run}>
          <legend className="text-xs font-bold text-zinc-300">최대 피크</legend>
          <div className="flex flex-wrap gap-2">
            {QUICK_PEAK.map((v) => (
              <button key={v} type="button" aria-pressed={tp === v} onClick={() => setTp(v)} className={chip(tp === v)}>{v} dBTP</button>
            ))}
          </div>
        </fieldset>
        <fieldset className="space-y-2" disabled={!!run}>
          <legend className="text-xs font-bold text-zinc-300">사운드 성향</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {QUICK_TONES.map((v) => (
              <button key={v} type="button" aria-pressed={tone === v} onClick={() => setTone(v)} className={`${chip(tone === v)} text-left`}>
                <span className="block">{TONE_TXT[v][0]}</span>
                <span className="block font-medium text-[11px] text-zinc-500">{TONE_TXT[v][1]}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-2" disabled={!!run}>
          <legend className="text-xs font-bold text-zinc-300">AI 곡 고음 정리</legend>
          <div className="flex flex-wrap gap-2">
            {AI_TXT.map((v) => (
              <button key={v.label} type="button" aria-pressed={aiClean === v.id} onClick={() => setAiClean(v.id)} className={chip(aiClean === v.id)}>{v.label}</button>
            ))}
          </div>
          <p className="text-[10px] text-zinc-500">AI로 만든 곡의 쇳소리·지글거림이 튈 때만 줄이고, 평소 고음은 그대로 둬요. 음량을 올리기 전에 먼저 처리해요.</p>
        </fieldset>

        <p className="text-[11px] text-zinc-500">원곡은 그대로 두고, 마스터링한 곡을 별도 MP3(320kbps)로 보관함에 새로 저장합니다. 처리는 이 브라우저에서 하며 크레딧이 들지 않습니다(무료).</p>

        {run && (
          <div role="status" className="space-y-1">
            <div className="h-1.5 rounded-full bg-[#222] overflow-hidden"><div className="h-full bg-primary transition-[width]" style={{ width: `${Math.round(run.p * 100)}%` }} /></div>
            <p className="text-xs text-zinc-400">{run.label} · {Math.round(run.p * 100)}%</p>
          </div>
        )}
        {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
        {result && (
          <p role="status" className="text-xs text-primary">
            완료: 「{result.title}」을 보관함에 저장했어요 ({result.integrated.toFixed(1)} LUFS · {result.truePeak.toFixed(1)} dBTP).
          </p>
        )}
        {result && (
          <ReleaseCheckCard
            items={result.checks}
            title="마스터링 결과 점검"
            retried={result.retried}
            note={result.aiCleanMaxCut !== null ? (result.aiCleanMaxCut < -0.05 ? `줄인 고음: 최대 ${result.aiCleanMaxCut.toFixed(1)} dB (튀는 순간에만)` : '고음 정리: 튀는 고음이 없어 거의 줄이지 않았어요') : undefined}
          />
        )}
        {result && <ABCompare srcBlob={result.srcBlob} outBlob={result.outBlob} srcLufs={result.srcIntegrated} outLufs={result.integrated} />}
        {result && (
          <div className="space-y-1">
            <button type="button" onClick={downloadWav} disabled={wav.busy} className="px-4 py-2 text-xs font-bold text-zinc-200 rounded-xl border border-[#262626] cursor-pointer disabled:opacity-40">
              {wav.busy ? `WAV 만드는 중 ${Math.round(wav.p * 100)}%` : 'WAV 로 내려받기'}
            </button>
            <p className="text-[10px] text-zinc-500">WAV 는 이 브라우저에서 바로 만들어 내려받고, 보관함에는 올리지 않아요.</p>
            {wav.err && <p role="alert" className="text-[11px] text-red-400">{wav.err}</p>}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button type="button" onClick={advanced} disabled={!!run} className={result ? 'px-4 py-2 text-xs font-bold text-primary rounded-xl border border-primary/40 cursor-pointer disabled:opacity-40' : 'text-xs font-bold text-zinc-400 hover:text-white cursor-pointer disabled:opacity-40'}>
            {result ? '고급 마스터링에서 이어서' : '고급 마스터링 →'}
          </button>
          <div className="ml-auto flex gap-3">
            <button type="button" onClick={() => { if (run) cancelRef.cancelled = true; else onClose() }} className="px-4 py-2 text-xs font-bold text-zinc-300 rounded-xl border border-[#262626] cursor-pointer">
              {run ? '멈추기' : result ? '닫기' : '취소'}
            </button>
            {!result && (
              <button type="button" onClick={start} disabled={!!run} className="px-5 py-2 text-xs font-extrabold text-black bg-primary rounded-xl cursor-pointer disabled:opacity-40">마스터링 시작</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
