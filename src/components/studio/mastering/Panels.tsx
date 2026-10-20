'use client'

/** 아래 탭 패널 — 템플릿 · 분석 · 레퍼런스 · 편집 · 앨범 · 스템 · 내보내기 */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Star, Play, Check, X, Wand2, Search, FolderOpen, Library, ArrowUp, ArrowDown, Trash2, Scissors, Download, Save, Loader2 } from 'lucide-react'
import { AUTO_TARGETS, MATCH_FREQS, type AutoTarget, type FadeCurve } from '@/lib/mastering/dsp'
import { TEMPLATES, TEMPLATE_CATEGORY_LABEL, type TemplateCategory, type MasterTemplate } from '@/lib/mastering/templates'
import { detectSilence, normalizeBands, type Analysis } from '@/lib/mastering/analyze'
import { MONO, Segmented, Led, NumField, Knob } from './controls'
import { AUTO_RANGE, fmtClock } from './Timeline'
import { useMastering, type TrackItem, type LibrarySong } from './store'
import {
  useUi, getEngine, applyTemplate, previewTemplate, endPreview, runAutoMaster, analyzeOutput, loadReference, matchToReference,
  fetchSongBlob, loadErrorText, decodeTrack, exportActive, saveToLibrary, exportAlbumZip, exportAlbumJoined, albumLoudness, addStemFiles,
  enterStems, activate, type ExportOpts,
} from './actions'

const btn = 'h-7 px-2.5 rounded-md border border-white/15 bg-black/40 text-[12px] font-semibold inline-flex items-center gap-1.5 hover:bg-white/10 disabled:opacity-40'
const btnPrimary = 'h-7 px-2.5 rounded-md bg-[var(--cm-brand)] text-white text-[12px] font-semibold inline-flex items-center gap-1.5 hover:brightness-110 disabled:opacity-40'
const input = 'h-7 rounded-md bg-black/50 border border-white/10 px-2 text-[12px] text-white outline-none focus:border-[var(--cm-brand)]'

const fmt = (v: number | undefined, d = 1) => (v === undefined || !Number.isFinite(v) ? '—' : v.toFixed(d))

// ───────────────────────── 템플릿 ─────────────────────────

const LS_FAV = 'cm.mastering.favTemplates.v1'

export function TemplatesPanel() {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<'all' | TemplateCategory | 'fav'>('all')
  const [fav, setFav] = useState<string[]>([])
  const preview = useUi(s => s.preview)
  const busy = useUi(s => s.busy)
  const hasTrack = useMastering(s => !!s.activeId)
  const templateId = useMastering(s => s.templateId)
  const listenOriginal = useMastering(s => s.params.listenOriginal)
  useEffect(() => { try { setFav(JSON.parse(localStorage.getItem(LS_FAV) ?? '[]')) } catch {} }, []) // eslint-disable-line react-hooks/set-state-in-effect
  const toggleFav = (id: string) => {
    const next = fav.includes(id) ? fav.filter(x => x !== id) : [...fav, id]
    setFav(next)
    try { localStorage.setItem(LS_FAV, JSON.stringify(next)) } catch {}
  }
  const list = TEMPLATES.filter(t =>
    (cat === 'all' || (cat === 'fav' ? fav.includes(t.id) : t.category === cat)) &&
    (!q.trim() || [t.label, t.why, ...t.tags].join(' ').toLowerCase().includes(q.trim().toLowerCase())))
  const pv = preview && TEMPLATES.find(t => t.id === preview.templateId)
  return (
    <div className="flex flex-col gap-2">
      {pv && (
        <div className="rounded-md border border-amber-400/40 bg-amber-400/10 px-3 py-2 flex flex-wrap items-center gap-2 text-[12px]">
          <span className="text-amber-100">「{pv.label}」 미리듣기 — 곡에서 가장 큰 8초를 반복해요</span>
          <Segmented size="xs" value={listenOriginal ? 'a' : 'b'} onChange={v => useMastering.setState(s => ({ params: { ...s.params, listenOriginal: v === 'a', originalTrim: 0 } }))}
            options={[{ value: 'a', label: 'A 원본' }, { value: 'b', label: 'B 템플릿' }]} />
          <button type="button" className={btnPrimary} onClick={() => endPreview(true)}><Check className="w-3.5 h-3.5" /> 적용</button>
          <button type="button" className={btn} onClick={() => endPreview(false)}><X className="w-3.5 h-3.5" /> 취소</button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="장르·용도·질감 검색" className={`${input} pl-7 w-[200px]`} aria-label="템플릿 검색" />
        </div>
        <Segmented value={cat} onChange={setCat} options={[
          { value: 'all', label: `전체 ${TEMPLATES.length}` }, { value: 'genre', label: '장르' }, { value: 'use', label: '용도' },
          { value: 'texture', label: '질감' }, { value: 'fav', label: `즐겨찾기 ${fav.length}` },
        ]} />
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
        {list.map(t => (
          <TemplateCard key={t.id} t={t} fav={fav.includes(t.id)} onFav={() => toggleFav(t.id)} active={templateId === t.id} previewing={preview?.templateId === t.id} disabled={!hasTrack || !!busy} />
        ))}
        {!list.length && <p className="text-[12px] text-zinc-500 p-2">맞는 템플릿이 없어요.</p>}
      </div>
    </div>
  )
}

function TemplateCard({ t, fav, onFav, active, previewing, disabled }: { t: MasterTemplate; fav: boolean; onFav: () => void; active: boolean; previewing: boolean; disabled: boolean }) {
  return (
    <div className={`rounded-md border p-2 flex flex-col gap-1.5 ${active ? 'border-[var(--cm-brand)] bg-[var(--cm-brand)]/10' : previewing ? 'border-amber-400/60' : 'border-white/10 bg-black/30'}`}>
      <div className="flex items-start gap-1">
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-bold text-white truncate">{t.label}</div>
          <div className="text-[10px] text-zinc-500" style={MONO}>{TEMPLATE_CATEGORY_LABEL[t.category]} · {t.lufs} LUFS · {t.tp} dBTP</div>
        </div>
        <button type="button" onClick={onFav} aria-label={fav ? `${t.label} 즐겨찾기 빼기` : `${t.label} 즐겨찾기`} aria-pressed={fav} className={fav ? 'text-amber-300' : 'text-zinc-600 hover:text-zinc-300'}>
          <Star className="w-4 h-4" fill={fav ? 'currentColor' : 'none'} />
        </button>
      </div>
      <p className="text-[11px] text-zinc-400 leading-snug">{t.why}</p>
      <div className="flex flex-wrap gap-1 mt-auto">
        <button type="button" className={btn} disabled={disabled} onClick={() => previewTemplate(t)} aria-label={`${t.label} 미리듣기`}><Play className="w-3 h-3" /> 8초 듣기</button>
        <button type="button" className={btn} disabled={disabled} onClick={() => applyTemplate(t)} aria-label={`${t.label} 적용`}>적용</button>
        <button type="button" className={btnPrimary} disabled={disabled} onClick={() => runAutoMaster(t)} aria-label={`${t.label} 템플릿과 곡 분석으로 자동 마스터링`}><Wand2 className="w-3 h-3" /> 분석+자동</button>
      </div>
    </div>
  )
}

export function AutoNotes() {
  const notes = useUi(s => s.autoNotes)
  if (!notes.length) return null
  return (
    <div className="rounded-md border border-[var(--cm-brand)]/40 bg-[var(--cm-brand)]/5 px-3 py-2">
      <div className="text-[11px] font-bold text-emerald-200 mb-1">자동 마스터링이 바꾼 것</div>
      <ul className="text-[11px] text-zinc-300 list-disc pl-4 space-y-0.5">{notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
    </div>
  )
}

// ───────────────────────── 분석 ─────────────────────────

export function AnalysisPanel() {
  const activeId = useMastering(s => s.activeId)
  const src = useMastering(s => (s.activeId ? s.srcAnalysis[s.activeId] : undefined))
  const out = useMastering(s => (s.activeId ? s.outAnalysis[s.activeId] : undefined))
  const target = useMastering(s => s.target)
  const busy = useUi(s => s.busy)
  const [spec, setSpec] = useState<'src' | 'out'>('src')
  if (!activeId) return <p className="text-[12px] text-zinc-500">곡을 먼저 불러오세요.</p>
  const rows: [string, (a?: Analysis) => string][] = [
    ['통합 라우드니스', a => `${fmt(a?.integrated)} LUFS`],
    ['라우드니스 레인지(LRA)', a => `${fmt(a?.lra)} LU`],
    ['최대 순간 / 단기', a => `${fmt(a?.maxMomentary)} / ${fmt(a?.maxShortTerm)}`],
    ['트루 피크', a => `${fmt(a?.truePeak)} dBTP`],
    ['샘플 피크', a => `${fmt(a?.samplePeak)} dBFS`],
    ['크레스트 팩터', a => `${fmt(a?.crest)} dB`],
    ['PLR (피크-라우드니스)', a => `${fmt(a?.plr)} dB`],
    ['PSR 평균 / 최소', a => `${fmt(a?.psrAvg)} / ${fmt(a?.psrMin)} dB`],
    ['위상 상관', a => fmt(a?.correlation, 2)],
    ['클리핑', a => (a ? `${a.clipSamples}샘플 · ${a.clips.length}곳` : '—')],
  ]
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={btnPrimary} disabled={!!busy} onClick={analyzeOutput}>{busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} 처리본 분석하기</button>
        <span className="text-[11px] text-zinc-500">원본은 불러올 때 자동으로 재요. 처리본은 지금 체인으로 곡 전체를 렌더해서 재요.</span>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)] gap-3">
        <table className="text-[11px] w-full" style={MONO}>
          <thead><tr className="text-zinc-500"><th className="text-left font-normal py-1">항목</th><th className="text-right font-normal">원본</th><th className="text-right font-normal">처리본</th></tr></thead>
          <tbody>
            {rows.map(([k, f]) => (
              <tr key={k} className="border-t border-white/5"><td className="py-1 text-zinc-400" style={{ fontFamily: 'inherit' }}>{k}</td><td className="text-right text-zinc-300">{f(src)}</td><td className="text-right text-white">{f(out)}</td></tr>
            ))}
          </tbody>
        </table>
        <div className="flex flex-col gap-2 min-w-0">
          <div className="text-[11px] text-zinc-400">LUFS 시간 그래프 (단기 3초) — 클릭하면 그 위치로</div>
          <LufsGraph src={src} out={out} target={target.lufs} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-zinc-400">스펙트로그램</span>
          <Segmented size="xs" value={spec} onChange={setSpec} options={[{ value: 'src', label: '원본' }, { value: 'out', label: '처리본' }]} />
          {spec === 'out' && !out && <span className="text-[11px] text-zinc-500">처리본 분석을 먼저 해 주세요.</span>}
        </div>
        <Spectrogram a={spec === 'src' ? src : out} />
      </div>
      <ClipList a={out ?? src} which={out ? '처리본' : '원본'} />
    </div>
  )
}

function LufsGraph({ src, out, target }: { src?: Analysis; out?: Analysis; target: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const draw = () => {
      const dpr = window.devicePixelRatio || 1
      const w = c.clientWidth, h = c.clientHeight
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr)
      const g = c.getContext('2d')!
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.fillStyle = '#0b0b0b'; g.fillRect(0, 0, w, h)
      const lo = -40, hi = 0
      const Y = (v: number) => h - ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * h
      g.font = '9px ui-monospace, monospace'; g.fillStyle = '#5a5a5a'; g.strokeStyle = '#1f1f1f'
      for (const d of [-10, -20, -30]) { g.beginPath(); g.moveTo(0, Y(d)); g.lineTo(w, Y(d)); g.stroke(); g.fillText(String(d), 2, Y(d) - 2) }
      g.strokeStyle = '#e4e4e4'; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(0, Y(target)); g.lineTo(w, Y(target)); g.stroke(); g.setLineDash([])
      const dur = (src ?? out)?.duration ?? 1
      const line = (a: Analysis | undefined, color: string) => {
        if (!a) return
        g.strokeStyle = color; g.lineWidth = 1.5; g.beginPath()
        a.shortSeries.forEach((v, i) => { const t = (i + 30) * 0.1; const x = (t / dur) * w; if (i === 0) g.moveTo(x, Y(v)); else g.lineTo(x, Y(v)) })
        g.stroke(); g.lineWidth = 1
      }
      line(src, 'rgba(180,180,180,0.6)')
      line(out, 'rgb(20,173,130)')
    }
    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(c)
    return () => ro.disconnect()
  }, [src, out, target])
  const dur = (src ?? out)?.duration ?? 0
  return (
    <canvas ref={ref} className="w-full h-[140px] rounded-md border border-white/5 cursor-pointer" aria-label="LUFS 시간 그래프"
      onClick={e => { const r = e.currentTarget.getBoundingClientRect(); getEngine()?.seek(((e.clientX - r.left) / r.width) * dur) }} />
  )
}

function Spectrogram({ a }: { a?: Analysis }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c || !a) return
    const { cols, rows, data } = a.spectrogram
    c.width = cols; c.height = rows
    const g = c.getContext('2d')!
    const img = g.createImageData(cols, rows)
    for (let x = 0; x < cols; x++) for (let r = 0; r < rows; r++) {
      const v = data[x * rows + r] / 255
      const y = rows - 1 - r
      const o = (y * cols + x) * 4
      // 어두운 남색 → 청록 → 노랑
      img.data[o] = Math.round(255 * Math.max(0, v * 1.6 - 0.6))
      img.data[o + 1] = Math.round(255 * Math.min(1, v * 1.3))
      img.data[o + 2] = Math.round(255 * Math.max(0, 0.5 - Math.abs(v - 0.45)) * 1.6)
      img.data[o + 3] = 255
    }
    g.putImageData(img, 0, 0)
  }, [a])
  const dur = a?.duration ?? 0
  return a ? (
    <canvas ref={ref} className="w-full h-[150px] rounded-md border border-white/5 cursor-pointer" style={{ imageRendering: 'pixelated' }} aria-label="스펙트로그램"
      onClick={e => { const r = e.currentTarget.getBoundingClientRect(); getEngine()?.seek(((e.clientX - r.left) / r.width) * dur) }} />
  ) : <div className="h-[150px] rounded-md border border-dashed border-white/10" />
}

function ClipList({ a, which }: { a?: Analysis; which: string }) {
  if (!a) return null
  return (
    <div>
      <div className="text-[11px] text-zinc-400 mb-1">{which} 클리핑 위치 {a.clips.length ? `(${a.clips.length}곳 — 누르면 이동)` : ''}</div>
      {a.clips.length ? (
        <div className="flex flex-wrap gap-1">
          {a.clips.slice(0, 120).map((c, i) => (
            <button key={i} type="button" onClick={() => getEngine()?.seek(Math.max(0, c.t - 1))} className="h-6 px-1.5 rounded bg-red-500/15 border border-red-500/30 text-[10px] text-red-200 hover:bg-red-500/25" style={MONO}>
              {fmtClock(c.t)} ×{c.count}
            </button>
          ))}
        </div>
      ) : <p className="text-[11px] text-emerald-300/80">클리핑이 없어요.</p>}
    </div>
  )
}

// ───────────────────────── 레퍼런스 ─────────────────────────

export function ReferencePanel({ onPickLibrary }: { onPickLibrary: (cb: (s: LibrarySong) => void) => void }) {
  const ref = useMastering(s => s.reference)
  const src = useMastering(s => (s.activeId ? s.srcAnalysis[s.activeId] : undefined))
  const out = useMastering(s => (s.activeId ? s.outAnalysis[s.activeId] : undefined))
  const [strength, setStrength] = useState(70)
  const fileRef = useRef<HTMLInputElement>(null)
  const busy = useUi(s => s.busy)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={btn} onClick={() => onPickLibrary(async s => { try { const b = await fetchSongBlob(s); await loadReference(b, s.title, s.id) } catch (e) { useUi.getState().set({ notice: { kind: 'err', text: loadErrorText(e, '레퍼런스') } }) } })}><Library className="w-3.5 h-3.5" /> 보관함에서</button>
        <button type="button" className={btn} onClick={() => fileRef.current?.click()}><FolderOpen className="w-3.5 h-3.5" /> 파일에서</button>
        <input ref={fileRef} type="file" accept="audio/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) loadReference(f, f.name.replace(/\.[^/.]+$/, '')); e.target.value = '' }} />
        {ref && <span className="text-[12px] text-zinc-200">레퍼런스: <b>{ref.title}</b> <span className="text-zinc-500" style={MONO}>{fmt(ref.analysis?.integrated)} LUFS · LRA {fmt(ref.analysis?.lra)} · TP {fmt(ref.analysis?.truePeak)}</span></span>}
        {ref && <button type="button" className="text-zinc-500 hover:text-white" aria-label="레퍼런스 빼기" onClick={() => { useMastering.getState().setReference(null); getEngine()?.loadReference(null) }}><X className="w-4 h-4" /></button>}
      </div>
      <p className="text-[11px] text-zinc-500">위쪽 전송 바의 「R 레퍼런스」로 원본(A)·처리본(B)·레퍼런스(R)를 오가며 들어요. 「음량 맞춤」이 켜져 있으면 레퍼런스를 처리본과 같은 라우드니스로 맞춰 들려줘요.</p>
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_260px] gap-3">
        <SpectrumOverlay src={src} out={out} ref_={ref?.analysis ?? undefined} />
        <div className="flex flex-col gap-2">
          <div className="text-[12px] font-semibold text-zinc-200">레퍼런스 톤 맞추기</div>
          <p className="text-[11px] text-zinc-500">원곡과 레퍼런스의 평균 스펙트럼 차이로 매칭 EQ(리니어 페이즈)를 만들어요.</p>
          <Knob label="강도" value={strength} min={0} max={100} def={70} step={1} unit="%" onChange={setStrength} />
          <button type="button" className={btnPrimary} disabled={!ref?.analysis || !src || !!busy} onClick={() => matchToReference(strength)}><Wand2 className="w-3.5 h-3.5" /> 레퍼런스 톤 맞추기</button>
        </div>
      </div>
    </div>
  )
}

function SpectrumOverlay({ src, out, ref_ }: { src?: Analysis; out?: Analysis; ref_?: Analysis }) {
  const W = 600, H = 170
  const lines: [Analysis | undefined, string, string][] = [[src, 'rgba(180,180,180,0.8)', '원본'], [out, 'rgb(20,173,130)', '처리본'], [ref_, '#f59e0b', '레퍼런스']]
  const x = (i: number) => (i / (MATCH_FREQS.length - 1)) * W
  const y = (v: number) => H / 2 - (v / 24) * (H / 2 - 10)
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[170px] rounded-md bg-[#0b0b0b] border border-white/5" preserveAspectRatio="none" aria-label="평균 스펙트럼 겹쳐 보기">
        {[-12, 0, 12].map(d => <line key={d} x1={0} x2={W} y1={y(d)} y2={y(d)} stroke={d === 0 ? '#333' : '#1f1f1f'} />)}
        {[100, 1000, 10000].map(f => { const i = Math.log2(f / 20) * 3; return <line key={f} x1={x(i)} x2={x(i)} y1={0} y2={H} stroke="#1f1f1f" /> })}
        {lines.map(([a, color]) => a && (
          <polyline key={color} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke"
            points={normalizeBands(a.bands).map((v, i) => `${x(i)},${y(v)}`).join(' ')} />
        ))}
      </svg>
      <div className="flex gap-3 mt-1 text-[10px]">
        {lines.map(([a, color, label]) => <span key={label} className={a ? 'text-zinc-300' : 'text-zinc-600'}><span className="inline-block w-2.5 h-0.5 align-middle mr-1" style={{ background: color }} />{label}</span>)}
        <span className="text-zinc-600 ml-auto" style={MONO}>20Hz · 100 · 1k · 10k · 20k (평균 0 기준)</span>
      </div>
    </div>
  )
}

// ───────────────────────── 편집 ─────────────────────────

const CURVES: { value: FadeCurve; label: string }[] = [
  { value: 'lin', label: '직선' }, { value: 'scurve', label: 'S자' }, { value: 'equal', label: '등전력' }, { value: 'exp', label: '느리게' }, { value: 'log', label: '빠르게' },
]

export function EditPanel({ autoTarget, setAutoTarget }: { autoTarget: AutoTarget | null; setAutoTarget: (t: AutoTarget | null) => void }) {
  const t = useMastering(s => s.tracks.find(x => x.id === s.activeId))
  const update = useMastering(s => s.updateTrack)
  const loop = useUi(s => s.loop)
  const [thr, setThr] = useState(-60)
  if (!t) return <p className="text-[12px] text-zinc-500">곡을 먼저 불러오세요.</p>
  const e = t.edit
  const dur = getEngine()?.duration || 0
  const ue = (patch: Partial<typeof e>, key = 'edit') => update(t.id, x => ({ ...x, edit: { ...x.edit, ...patch } }), key)
  const autoSilence = async () => {
    const dec = await decodeTrack(t)
    const r = detectSilence(dec.channels, dec.sampleRate, thr)
    ue({ start: Math.round(r.start * 1000) / 1000, end: Math.round(r.end * 1000) / 1000 }, 'trim')
  }
  const markers = t.markers
  const setMarkers = (m: typeof markers) => update(t.id, x => ({ ...x, markers: m }), 'markers')
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
      <div className="flex flex-col gap-3">
        <div>
          <div className="text-[12px] font-semibold text-zinc-200 mb-1.5">앞뒤 자르기</div>
          <div className="flex flex-wrap items-end gap-2">
            <NumField label="시작(초)" value={e.start} min={0} max={Math.max(0, dur)} def={0} step={0.01} width={84} onChange={v => ue({ start: v }, 'trim')} />
            <NumField label="끝(초, 0=끝까지)" value={e.end} min={0} max={Math.max(0, dur)} def={0} step={0.01} width={110} onChange={v => ue({ end: v }, 'trim')} />
            <NumField label="무음 기준" value={thr} min={-90} max={-30} def={-60} step={1} unit="dB" width={84} onChange={setThr} />
            <button type="button" className={btn} onClick={autoSilence}><Scissors className="w-3.5 h-3.5" /> 앞뒤 무음 자르기</button>
          </div>
        </div>
        <div>
          <div className="text-[12px] font-semibold text-zinc-200 mb-1.5">페이드</div>
          <div className="flex flex-wrap items-end gap-2">
            <NumField label="페이드 인(초)" value={e.fadeIn.dur} min={0} max={30} def={0} step={0.1} width={90} onChange={v => ue({ fadeIn: { ...e.fadeIn, dur: v } }, 'fade')} />
            <Segmented size="xs" value={e.fadeIn.curve} onChange={v => ue({ fadeIn: { ...e.fadeIn, curve: v } }, 'fade')} options={CURVES} />
          </div>
          <div className="flex flex-wrap items-end gap-2 mt-2">
            <NumField label="페이드 아웃(초)" value={e.fadeOut.dur} min={0} max={60} def={0} step={0.1} width={90} onChange={v => ue({ fadeOut: { ...e.fadeOut, dur: v } }, 'fade')} />
            <Segmented size="xs" value={e.fadeOut.curve} onChange={v => ue({ fadeOut: { ...e.fadeOut, curve: v } }, 'fade')} options={CURVES} />
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">페이드 아웃은 「끝」(없으면 곡 끝)에서 끝나요. 파형 위 노란 선으로 보여요.</p>
        </div>
        <div>
          <div className="text-[12px] font-semibold text-zinc-200 mb-1.5">구간만 처리</div>
          <div className="flex flex-wrap items-center gap-2">
            <Led on={!!e.region} onClick={() => ue({ region: e.region ? null : loop ? { ...loop } : null }, 'region')} label={e.region ? `${fmtClock(e.region.start)} – ${fmtClock(e.region.end)}` : '꺼짐'} />
            {!e.region && <span className="text-[11px] text-zinc-500">{loop ? '켜면 지금 반복 구간에만 체인이 걸리고 나머지는 원본이에요.' : '파형을 드래그해 반복 구간을 먼저 정하세요.'}</span>}
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <div>
          <div className="text-[12px] font-semibold text-zinc-200 mb-1.5">오토메이션 레인</div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={autoTarget ?? ''} onChange={ev => setAutoTarget((ev.target.value || null) as AutoTarget | null)} className={input} aria-label="오토메이션 대상">
              <option value="">레인 숨기기</option>
              {AUTO_TARGETS.map(k => <option key={k} value={k}>{AUTO_RANGE[k].label}{e.automation[k]?.length ? ` (${e.automation[k]!.length}점)` : ''}</option>)}
            </select>
            {autoTarget && !!e.automation[autoTarget]?.length && (
              <button type="button" className={btn} onClick={() => ue({ automation: { ...e.automation, [autoTarget]: [] } }, 'auto-clear')}><Trash2 className="w-3.5 h-3.5" /> 이 레인 지우기</button>
            )}
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">파형 아래 레인에서 클릭하면 점이 생기고, 끌어서 옮기고, 더블클릭하면 지워요. EQ 게인 오토메이션은 최소 위상 모드에서만 움직여요.</p>
        </div>
        <div>
          <div className="text-[12px] font-semibold text-zinc-200 mb-1.5">마커 (메모리 로케이션)</div>
          {!markers.length && <p className="text-[11px] text-zinc-500">M 키나 전송 바의 깃발로 추가해요. 파형 위 번호 깃발을 끌면 옮겨져요.</p>}
          <div className="flex flex-col gap-1">
            {markers.map((m, i) => (
              <div key={m.id} className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded bg-sky-500 text-black text-[10px] font-bold inline-flex items-center justify-center" style={MONO}>{i + 1}</span>
                <input value={m.name} onChange={ev => setMarkers(markers.map(x => (x.id === m.id ? { ...x, name: ev.target.value } : x)))} className={`${input} w-[140px]`} aria-label={`마커 ${i + 1} 이름`} />
                <NumField label={`마커 ${i + 1} 위치(초)`} value={Math.round(m.time * 1000) / 1000} min={0} max={Math.max(0, dur)} def={m.time} step={0.01} width={84}
                  onChange={v => setMarkers(markers.map(x => (x.id === m.id ? { ...x, time: v } : x)).sort((a, b) => a.time - b.time))} />
                <button type="button" className={btn} onClick={() => getEngine()?.seek(m.time)}>이동</button>
                <button type="button" className="text-zinc-500 hover:text-white" aria-label={`마커 ${i + 1} 지우기`} onClick={() => setMarkers(markers.filter(x => x.id !== m.id))}><X className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ───────────────────────── 앨범 ─────────────────────────

export function AlbumPanel() {
  const tracks = useMastering(s => s.tracks)
  const activeId = useMastering(s => s.activeId)
  const update = useMastering(s => s.updateTrack)
  const move = useMastering(s => s.moveTrack)
  const target = useMastering(s => s.target)
  const busy = useUi(s => s.busy)
  const [album, setAlbum] = useState(''), [artist, setArtist] = useState('')
  if (!tracks.length) return <p className="text-[12px] text-zinc-500">곡을 여러 개 불러오면 앨범 순서로 놓고 한꺼번에 마스터링할 수 있어요.</p>
  const applyAll = () => tracks.forEach(t => update(t.id, x => ({ ...x, meta: { ...x.meta, album: album || x.meta.album, artist: artist || x.meta.artist } }), 'meta-all'))
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-0.5 text-[10px] text-zinc-400">앨범 이름<input value={album} onChange={e => setAlbum(e.target.value)} className={`${input} w-[180px]`} /></label>
        <label className="flex flex-col gap-0.5 text-[10px] text-zinc-400">아티스트<input value={artist} onChange={e => setArtist(e.target.value)} className={`${input} w-[160px]`} /></label>
        <button type="button" className={btn} onClick={applyAll} disabled={!album && !artist}>모든 곡에 넣기</button>
      </div>
      <div className="flex flex-col gap-1">
        {tracks.map((t, i) => (
          <div key={t.id} className={`flex flex-wrap items-center gap-2 rounded-md border px-2 py-1.5 ${t.id === activeId ? 'border-[var(--cm-brand)]/60 bg-[var(--cm-brand)]/5' : 'border-white/10 bg-black/30'}`}>
            <span className="w-6 text-[11px] text-zinc-500" style={MONO}>{String(i + 1).padStart(2, '0')}</span>
            <button type="button" className="text-[12px] text-white truncate max-w-[200px] text-left hover:underline" onClick={() => activate(t.id)}>{t.meta.title || t.title}</button>
            <span className="text-[10px] text-zinc-500" style={MONO}>보정 {t.edit.gainOffset > 0 ? '+' : ''}{t.edit.gainOffset.toFixed(1)}dB</span>
            <div className="flex items-center gap-1 ml-auto">
              <NumField label="다음까지 간격(초)" value={t.gapAfter} min={0} max={10} def={2} step={0.1} width={96} disabled={i === tracks.length - 1 || t.xfadeAfter > 0} onChange={v => update(t.id, x => ({ ...x, gapAfter: v }), 'gap')} />
              <NumField label="크로스페이드(초)" value={t.xfadeAfter} min={0} max={10} def={0} step={0.1} width={96} disabled={i === tracks.length - 1} onChange={v => update(t.id, x => ({ ...x, xfadeAfter: v }), 'xfade')} />
              <button type="button" aria-label={`${t.title} 위로`} className="p-1 text-zinc-400 hover:text-white disabled:opacity-20" disabled={i === 0} onClick={() => move(t.id, -1)}><ArrowUp className="w-3.5 h-3.5" /></button>
              <button type="button" aria-label={`${t.title} 아래로`} className="p-1 text-zinc-400 hover:text-white disabled:opacity-20" disabled={i === tracks.length - 1} onClick={() => move(t.id, 1)}><ArrowDown className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btn} disabled={!!busy} onClick={() => albumLoudness('each')}>곡마다 {target.lufs} LUFS 로 맞추기</button>
        <button type="button" className={btn} disabled={!!busy} onClick={() => albumLoudness('album')}>앨범 평균만 맞추기(곡 간 차이 유지)</button>
        <button type="button" className={btnPrimary} disabled={!!busy} onClick={exportAlbumZip}><Download className="w-3.5 h-3.5" /> 앨범 ZIP 내보내기</button>
        <button type="button" className={btn} disabled={!!busy || tracks.length < 2} onClick={exportAlbumJoined}><Download className="w-3.5 h-3.5" /> 한 파일로 이어 붙이기</button>
      </div>
      <p className="text-[11px] text-zinc-500">모든 곡에 같은 체인을 쓰고, 곡마다 「보정」 게인만 달라요. 내보내기 설정(형식·비트·샘플레이트)은 「내보내기」 탭을 따라요.</p>
    </div>
  )
}

// ───────────────────────── 스템 ─────────────────────────

export function StemsPanel() {
  const t = useMastering(s => s.tracks.find(x => x.id === s.activeId))
  const update = useMastering(s => s.updateTrack)
  const fileRef = useRef<HTMLInputElement>(null)
  const stemCfg = useMemo(() => t?.stems ?? [], [t?.stems])
  useEffect(() => {
    const eng = getEngine()
    if (eng?.stemMode && t?.useStems) eng.updateStems(stemCfg.map(s => ({ buffer: null as unknown as AudioBuffer, ...s })))
  }, [stemCfg, t?.useStems])
  if (!t) return <p className="text-[12px] text-zinc-500">곡을 먼저 불러오세요.</p>
  const us = (id: string, patch: Partial<TrackItem['stems'][number]>) => update(t.id, x => ({ ...x, stems: x.stems.map(s => (s.id === id ? { ...s, ...patch } : s)) }), `stem:${id}`)
  const toggle = async () => {
    const on = !t.useStems
    update(t.id, x => ({ ...x, useStems: on }), 'useStems')
    const eng = getEngine()
    if (on) await enterStems({ ...t, useStems: true })
    else eng?.leaveStems()
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={btn} onClick={() => fileRef.current?.click()}><FolderOpen className="w-3.5 h-3.5" /> 스템 파일 추가</button>
        <input ref={fileRef} type="file" accept="audio/*" multiple hidden onChange={e => { if (e.target.files) addStemFiles(t.id, Array.from(e.target.files)); e.target.value = '' }} />
        <Led on={t.useStems} onClick={toggle} label={t.useStems ? '스템으로 마스터링 중' : '스템으로 마스터링'} title="켜면 원곡 대신 스템을 섞은 소리로 재생·내보내기해요" />
        <span className="text-[11px] text-zinc-500">보컬·드럼·베이스·반주처럼 나뉜 파일을 이 곡의 스템으로 넣어요. 스템마다 게인·팬·EQ 를 맞춘 뒤 합쳐서 마스터 체인으로 보내요.</span>
      </div>
      {!t.stems.length && <p className="text-[12px] text-zinc-500">스템이 없어요.</p>}
      <div className="flex flex-col gap-1.5">
        {t.stems.map(s => (
          <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-md border border-white/10 bg-black/30 px-2 py-1.5">
            <span className="text-[12px] text-white truncate w-[140px]" title={s.title}>{s.title}</span>
            <Led on={!s.mute} onClick={() => us(s.id, { mute: !s.mute })} label={s.mute ? '꺼짐' : '켜짐'} />
            <Led on={s.solo} onClick={() => us(s.id, { solo: !s.solo })} label="솔로" tone="solo" />
            <NumField label="게인" value={s.gain} min={-24} max={12} def={0} step={0.1} unit="dB" width={70} onChange={v => us(s.id, { gain: v })} />
            <NumField label="팬" value={s.pan} min={-100} max={100} def={0} step={1} width={60} format={v => (v === 0 ? 'C' : v < 0 ? `L${-v}` : `R${v}`)} onChange={v => us(s.id, { pan: v })} />
            <NumField label="저역" value={s.eq.low} min={-12} max={12} def={0} unit="dB" width={64} onChange={v => us(s.id, { eq: { ...s.eq, low: v } })} />
            <NumField label="중역" value={s.eq.mid} min={-12} max={12} def={0} unit="dB" width={64} onChange={v => us(s.id, { eq: { ...s.eq, mid: v } })} />
            <NumField label="고역" value={s.eq.high} min={-12} max={12} def={0} unit="dB" width={64} onChange={v => us(s.id, { eq: { ...s.eq, high: v } })} />
            <button type="button" aria-label={`${s.title} 빼기`} className="ml-auto text-zinc-500 hover:text-white" onClick={() => update(t.id, x => ({ ...x, stems: x.stems.filter(y => y.id !== s.id) }), 'stems')}><X className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ───────────────────────── 내보내기 ─────────────────────────

export function ExportPanel() {
  const opts = useUi(s => s.exportOpts)
  const reports = useUi(s => s.reports)
  const busy = useUi(s => s.busy)
  const loop = useUi(s => s.loop)
  const t = useMastering(s => s.tracks.find(x => x.id === s.activeId))
  const ntracks = useMastering(s => s.tracks.length)
  const update = useMastering(s => s.updateTrack)
  const coverRef = useRef<HTMLInputElement>(null)
  const set = (p: Partial<ExportOpts>) => useUi.getState().set({ exportOpts: { ...opts, ...p } })
  const um = (patch: Partial<TrackItem['meta']>) => t && update(t.id, x => ({ ...x, meta: { ...x.meta, ...patch } }), 'meta')
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented value={opts.format} onChange={v => set({ format: v })} options={[{ value: 'wav', label: 'WAV' }, { value: 'mp3', label: 'MP3 320k' }]} />
          {opts.format === 'wav' && <Segmented value={opts.bits} onChange={v => set({ bits: v, dither: v === 16 ? 'shaped' : v === 32 ? 'none' : opts.dither })} options={[{ value: 16, label: '16bit' }, { value: 24, label: '24bit' }, { value: 32, label: '32bit float' }]} />}
          <Segmented value={opts.rate} onChange={v => set({ rate: v })} options={[{ value: 44100, label: '44.1kHz' }, { value: 48000, label: '48kHz' }, { value: 96000, label: '96kHz' }]} />
        </div>
        {opts.format === 'wav' && opts.bits !== 32 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-zinc-400">디더</span>
            <Segmented value={opts.dither} onChange={v => set({ dither: v })} options={[{ value: 'none', label: '없음' }, { value: 'tpdf', label: 'TPDF' }, { value: 'shaped', label: '노이즈 셰이핑' }]} />
            <span className="text-[11px] text-zinc-500">16bit 는 노이즈 셰이핑을 권해요 — 잡음을 잘 안 들리는 고역으로 옮겨요.</span>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Segmented value={opts.range} onChange={v => set({ range: v })} options={[{ value: 'all', label: '곡 전체(자르기 반영)' }, { value: 'loop', label: '반복 구간만' }]} />
          {opts.range === 'loop' && !loop && <span className="text-[11px] text-amber-300/80">반복 구간이 없어 곡 전체를 내보내요.</span>}
        </div>
        {t && (
          <div className="rounded-md border border-white/10 bg-black/30 p-2 flex flex-col gap-1.5">
            <div className="text-[11px] font-semibold text-zinc-300">태그(메타데이터) — WAV·MP3 에 함께 넣어요</div>
            <div className="flex flex-wrap gap-2">
              <label className="flex flex-col gap-0.5 text-[10px] text-zinc-400">제목<input value={t.meta.title ?? ''} onChange={e => um({ title: e.target.value })} className={`${input} w-[170px]`} /></label>
              <label className="flex flex-col gap-0.5 text-[10px] text-zinc-400">아티스트<input value={t.meta.artist ?? ''} onChange={e => um({ artist: e.target.value })} className={`${input} w-[130px]`} /></label>
              <label className="flex flex-col gap-0.5 text-[10px] text-zinc-400">앨범<input value={t.meta.album ?? ''} onChange={e => um({ album: e.target.value })} className={`${input} w-[130px]`} /></label>
              <label className="flex flex-col gap-0.5 text-[10px] text-zinc-400">ISRC<input value={t.meta.isrc ?? ''} onChange={e => um({ isrc: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12) })} placeholder="KRA402600001" className={`${input} w-[130px]`} style={MONO} /></label>
            </div>
            <div className="flex items-center gap-2">
              {t.meta.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.meta.coverUrl} alt="" className="w-10 h-10 rounded object-cover bg-black" />
              ) : <div className="w-10 h-10 rounded bg-white/5" />}
              <button type="button" className={btn} onClick={() => coverRef.current?.click()}>커버 이미지 바꾸기</button>
              {t.meta.coverUrl && <button type="button" className="text-[11px] text-zinc-500 hover:text-white" onClick={() => um({ coverUrl: null })}>커버 빼기</button>}
              <input ref={coverRef} type="file" accept="image/jpeg,image/png" hidden onChange={e => { const f = e.target.files?.[0]; if (f) um({ coverUrl: URL.createObjectURL(f) }); e.target.value = '' }} />
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btn} disabled={!t || !!busy} onClick={exportActive}><Download className="w-3.5 h-3.5" /> 내려받기</button>
          <button type="button" className={btnPrimary} disabled={!t || !!busy} onClick={saveToLibrary}><Save className="w-3.5 h-3.5" /> 보관함에 새 곡으로 저장</button>
          {ntracks > 1 && <button type="button" className={btn} disabled={!!busy} onClick={exportAlbumZip}><Download className="w-3.5 h-3.5" /> {ntracks}곡 ZIP</button>}
        </div>
      </div>
      <div className="flex flex-col gap-1.5 min-w-0">
        <div className="text-[12px] font-semibold text-zinc-200">재측정 리포트</div>
        <p className="text-[11px] text-zinc-500">내보낸 파일을 다시 열어 쟀어요. 라우드니스는 목표 ±1 LU, 트루 피크는 천장 이하면 합격이에요.</p>
        {!reports.length && <p className="text-[12px] text-zinc-500">아직 내보낸 파일이 없어요.</p>}
        {!!reports.length && (
          <div className="overflow-y-auto max-h-[260px] custom-scrollbar">
            <table className="w-full text-[11px]" style={MONO}>
              <thead><tr className="text-zinc-500"><th className="text-left font-normal">파일</th><th className="text-right font-normal">LUFS</th><th className="text-right font-normal">TP</th><th className="text-right font-normal">LRA</th><th className="text-right font-normal">PLR</th><th className="text-right font-normal">판정</th></tr></thead>
              <tbody>
                {reports.map((r, i) => {
                  const ok = r.pass.loudness && r.pass.peak
                  return (
                    <tr key={i} className="border-t border-white/5">
                      <td className="py-1 pr-2 text-zinc-300 truncate max-w-[180px]" title={`${r.file} · ${r.format}`}>{r.file}</td>
                      <td className={`text-right ${r.pass.loudness ? 'text-zinc-100' : 'text-amber-300'}`}>{fmt(r.integrated)}</td>
                      <td className={`text-right ${r.pass.peak ? 'text-zinc-100' : 'text-red-300'}`}>{fmt(r.truePeak)}</td>
                      <td className="text-right text-zinc-300">{fmt(r.lra)}</td>
                      <td className="text-right text-zinc-300">{fmt(r.plr)}</td>
                      <td className={`text-right font-bold ${ok ? 'text-emerald-300' : 'text-red-300'}`}>{ok ? '합격' : '불합격'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="text-[10px] text-zinc-600 mt-1">목표: {reports[0].target.label} {reports[0].target.lufs} LUFS · {reports[0].target.tp} dBTP</p>
          </div>
        )}
      </div>
    </div>
  )
}
