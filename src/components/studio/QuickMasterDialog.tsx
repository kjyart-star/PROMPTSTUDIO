'use client'

import { useState } from 'react'
import { quickMaster, QUICK_LUFS, QUICK_PEAK, QUICK_TONES, type QuickTone, type QuickResult } from './mastering/quickMaster'
import { cancelRef } from './mastering/actions'

const LUFS_TXT: Record<number, string> = { '-14': '자연스럽게', '-12': '적당히', '-10': '강하게', '-8': '더 강하게' }
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
  onAdvanced: () => void
}) {
  const [lufs, setLufs] = useState<number>(-14)
  const [tp, setTp] = useState<number>(-1)
  const [tone, setTone] = useState<QuickTone>('balanced')
  const [run, setRun] = useState<{ label: string; p: number } | null>(null)
  const [error, setError] = useState('')
  const [result, setResult] = useState<QuickResult | null>(null)

  const start = async () => {
    setError('')
    setRun({ label: '준비 중', p: 0 })
    try {
      const r = await quickMaster(song, { lufs, tp, tone }, (label, p) => setRun({ label, p }))
      setResult(r)
      onDone(r)
    } catch (e) {
      const m = (e as Error)?.message
      setError(m === 'cancelled' ? '마스터링을 멈췄어요.' : m === 'login' ? '로그인하면 보관함에 저장할 수 있어요.' : '마스터링하지 못했어요. 잠시 뒤 다시 시도해 주세요.')
    } finally { setRun(null) }
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

        <fieldset className="space-y-2" disabled={!!run}>
          <legend className="text-xs font-bold text-zinc-300">목표 음량</legend>
          <div className="flex flex-wrap gap-2">
            {QUICK_LUFS.map((v) => (
              <button key={v} type="button" aria-pressed={lufs === v} onClick={() => setLufs(v)} className={chip(lufs === v)}>
                {v} LUFS <span className="font-medium text-zinc-400">{LUFS_TXT[v]}</span>
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

        <p className="text-[11px] text-zinc-500">원곡은 그대로 두고, 마스터링한 곡을 별도 WAV 로 보관함에 새로 저장합니다. 처리는 이 브라우저에서 하며 크레딧이 들지 않습니다(무료).</p>

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

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button type="button" onClick={onAdvanced} disabled={!!run} className="text-xs font-bold text-zinc-400 hover:text-white cursor-pointer disabled:opacity-40">고급 마스터링 →</button>
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
