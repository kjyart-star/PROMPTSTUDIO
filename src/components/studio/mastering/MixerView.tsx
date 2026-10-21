'use client'

/**
 * 믹서 보기 — 스템마다 세로 채널 스트립을 가로로 나란히 + 맨 오른쪽 「마스터」 스트립.
 * 슬롯을 누르면 고정 패널에서 편집한다(한 번에 하나, 떠 있는 창 없음).
 * 스템이 없으면 믹서 영역은 작은 안내 카드로 접고, 남는 높이는 마스터 모듈 패널이 쓴다(빈 영역 없음).
 */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { FolderOpen, X } from 'lucide-react'
import type { SlotId } from '@/lib/mastering/dsp'
import { useMastering, type Stem, type TrackItem } from './store'
import { getEngine, enterStems, addStemFiles } from './actions'
import { Knob, Fader, Led, NumField } from './controls'
import { ModulePanel } from './ModulePanel'
import { MODULE_LABEL } from './labels'
import type { MasteringEngine } from './engine'
import './mixer.css'

type Band = 'low' | 'mid' | 'high'
const BANDS: { id: Band; label: string }[] = [{ id: 'low', label: '저음' }, { id: 'mid', label: '중음' }, { id: 'high', label: '고음' }]
const bandLabel = (b: Band) => BANDS.find(x => x.id === b)!.label

type Sel = { kind: 'stem'; id: string; band: Band } | { kind: 'master'; slot: SlotId } | null

const STRIP_MIN = 108, MASTER_W = 150, GAP = 4
const signed = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}`
const panText = (v: number) => (v === 0 ? 'C' : v < 0 ? `L${-v}` : `R${v}`)

/** 세그먼트 레벨 미터 — read() 가 선형 피크(채널별)를 돌려준다. height 'fill' 이면 세로로 늘어난다 */
function LevelMeter({ read, height, label }: { read: () => number[]; height: number | 'fill'; label: string }) {
  const cv = useRef<HTMLCanvasElement>(null)
  const readRef = useRef(read)
  useEffect(() => { readRef.current = read })
  useEffect(() => {
    let raf = 0
    const hold: number[] = []; const holdT: number[] = []
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const c = cv.current
      const g = c?.getContext('2d')
      if (!c || !g) return
      const dpr = window.devicePixelRatio || 1
      const w = c.clientWidth, h = c.clientHeight
      if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr) }
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.fillStyle = '#121314'; g.fillRect(0, 0, w, h)
      const lv = readRef.current().map(x => (x > 1e-6 ? 20 * Math.log10(x) : -90))
      const n = Math.max(1, lv.length)
      const bw = (w - (n - 1) * 2) / n
      const Y = (db: number) => h - ((Math.max(-60, Math.min(0, db)) + 60) / 60) * h
      lv.forEach((db, i) => {
        const x = i * (bw + 2)
        for (let s = 0; s < 60; s += 1.5) {
          const segDb = -60 + s
          if (db < segDb) break
          g.fillStyle = segDb > -1 ? '#e5484d' : segDb > -6 ? '#f0a43a' : '#52d27e'
          g.fillRect(x, Y(segDb + 1.5) + 0.5, bw, Math.max(1, Y(segDb) - Y(segDb + 1.5) - 1))
        }
        if (hold[i] === undefined) { hold[i] = -90; holdT[i] = 0 }
        if (db >= hold[i]) { hold[i] = db; holdT[i] = now } else if (now - holdT[i] > 1500) hold[i] -= 0.5
        if (hold[i] > -60) { g.fillStyle = hold[i] > -1 ? '#e5484d' : '#dddfe2'; g.fillRect(x, Y(hold[i]), bw, 1.5) }
      })
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])
  const st = label.includes('출력')
  const canvas = <canvas ref={cv} role="img" aria-label={label} className={st ? 'st' : undefined} style={height === 'fill' ? undefined : { height }} />
  // fill: 캔버스를 감싸는 상자가 늘어나고 캔버스는 그 안에 절대 배치 — 캔버스 속성 높이가 상자 높이를 키우는 되먹임을 막는다
  return height === 'fill' ? <div className={`ms-meterfill ${st ? 'st' : ''}`}>{canvas}</div> : canvas
}

function StemStrip({ s, index, engine, folded, sel, onSel, us }: {
  s: Stem; index: number; engine: MasteringEngine | null; folded: boolean; sel: Sel
  onSel: (b: Band) => void; us: (patch: Partial<Stem>) => void
}) {
  const readLevel = () => [engine?.stemLevels?.()[index] ?? 0]
  return (
    <div className={`ms-strip ${folded ? 'folded' : ''}`} data-strip="stem" aria-label={`${s.title} 채널`}>
      <h4 title={s.title}>{s.title}</h4>
      {!folded && (
        <>
          <span className="sub">처리</span>
          <div className="flex flex-col gap-[3px]">
            {BANDS.map(b => {
              const v = s.eq[b.id]
              const active = sel?.kind === 'stem' && sel.id === s.id && sel.band === b.id
              return (
                <button key={b.id} type="button" className={`ms-slot ${v === 0 ? 'flat' : 'on'}`} aria-pressed={active}
                  title={`${s.title} ${b.label} EQ — 눌러서 아래에서 편집`} onClick={() => onSel(b.id)}>
                  {b.label} {signed(v)}
                </button>
              )
            })}
          </div>
          <div className="flex justify-center">
            <Knob label="팬" value={s.pan} min={-100} max={100} def={0} step={1} size={32} bipolar format={panText} onChange={v => us({ pan: v })} />
          </div>
        </>
      )}
      <div className="ms-sm">
        <button type="button" className="mute" aria-pressed={s.mute} aria-label={`${s.title} 음소거`} title="음소거(M)" onClick={() => us({ mute: !s.mute })}>M</button>
        <button type="button" aria-pressed={s.solo} aria-label={`${s.title} 솔로`} title="솔로(S) — 이 채널만 듣기" onClick={() => us({ solo: !s.solo })}>S</button>
      </div>
      <div className="ms-fm">
        <Fader label="게인" value={s.gain} min={-24} max={12} def={0} step={0.1} unit="dB" height="fill" onChange={v => us({ gain: v })} />
        <LevelMeter read={readLevel} height="fill" label={`${s.title} 레벨`} />
      </div>
      <div className="ms-nametag" title={s.title}>{s.title}</div>
    </div>
  )
}

/** 마스터 스트립 — wide 면(스템 없음) 모듈 슬롯을 두 열로 놓아 높이를 줄인다 */
function MasterStrip({ engine, sel, onSel, wide }: { engine: MasteringEngine | null; sel: Sel; onSel: (s: SlotId) => void; wide?: boolean }) {
  const params = useMastering(s => s.params)
  const setParams = useMastering(s => s.setParams)
  const [dragSlot, setDragSlot] = useState<SlotId | null>(null)
  const dropSlot = (onto: SlotId) => {
    if (!dragSlot || dragSlot === onto) return
    setParams(p => { const o = p.order.filter(s => s !== dragSlot); o.splice(o.indexOf(onto), 0, dragSlot); return { ...p, order: o } }, 'order')
  }
  const toggle = (s: SlotId) => setParams(p => ({ ...p, bypass: { ...p.bypass, [s]: !p.bypass[s] } }), `bypass:${s}`)
  const readOut = () => {
    const m = engine?.meters
    return m && engine && !engine.paused ? [m.outLevel.peakL, m.outLevel.peakR] : [0, 0]
  }
  return (
    <div className={`ms-strip master ${wide ? 'wide' : ''}`} data-strip="master" aria-label="마스터 채널">
      <h4>마스터</h4>
      <span className="sub">처리 — 누르면 {wide ? '왼쪽' : '아래'}에서 편집</span>
      <div className="slots flex flex-col gap-[3px]">
        {params.order.map(s => (
          <button key={s} type="button" draggable
            className={`ms-slot ${params.bypass[s] ? 'flat' : 'on'} ${dragSlot === s ? 'drag' : ''}`}
            aria-pressed={sel?.kind === 'master' && sel.slot === s}
            title={`${MODULE_LABEL[s]}${params.bypass[s] ? ' (꺼짐)' : ''} — 눌러서 편집 · 더블클릭 켬/끔 · 끌어서 순서 바꾸기`}
            onClick={() => onSel(s)} onDoubleClick={() => toggle(s)}
            onDragStart={e => { setDragSlot(s); e.dataTransfer.effectAllowed = 'move' }}
            onDragOver={e => { if (dragSlot) e.preventDefault() }}
            onDrop={e => { e.preventDefault(); dropSlot(s); setDragSlot(null) }}
            onDragEnd={() => setDragSlot(null)}>
            {MODULE_LABEL[s]}
          </button>
        ))}
      </div>
      <div className="ms-mrow">
        <NumField label="입력 맞춤" value={params.inputTrim} min={-24} max={24} def={0} step={0.1} unit="dB" width={wide ? 120 : 136} onChange={v => setParams(p => ({ ...p, inputTrim: v }), 'inputTrim')} />
        <div className="ms-sm" style={{ gridTemplateColumns: '1fr' }}>
          <button type="button" className="ab" aria-pressed={params.listenOriginal} title="처리 전 원본 소리로 듣기"
            onClick={() => useMastering.setState(s => ({ params: { ...s.params, listenOriginal: !s.params.listenOriginal } }))}>원본 듣기(A)</button>
        </div>
      </div>
      <div className="ms-fm">
        <Fader label="출력 게인" value={params.limiter.gain} min={-12} max={24} def={0} step={0.1} unit="dB" height="fill"
          onChange={v => setParams(p => ({ ...p, limiter: { ...p.limiter, gain: v } }), 'slot:limiter')} />
        <LevelMeter read={readOut} height="fill" label="마스터 출력 레벨" />
      </div>
      <div className="ms-nametag">마스터</div>
    </div>
  )
}

function StemEqPanel({ s, band, onClose, us }: { s: Stem; band: Band; onClose: () => void; us: (patch: Partial<Stem>) => void }) {
  return (
    <section aria-label="스템 EQ 패널">
      <div className="ms-mixdock-head">
        <h3>{s.title} · {bandLabel(band)} EQ</h3>
        <span className="text-[11px] dim">저음 120Hz · 중음 1kHz · 고음 8kHz, ±12 dB</span>
        <button type="button" className="ms-btn ml-auto" aria-label="패널 닫기" onClick={onClose}><X className="w-3.5 h-3.5" /> 닫기</button>
      </div>
      <div className="flex flex-wrap gap-4">
        {BANDS.map(b => (
          <Knob key={b.id} label={b.label} value={s.eq[b.id]} min={-12} max={12} def={0} step={0.1} unit="dB" size={56} bipolar
            color={b.id === band ? 'var(--m-green)' : undefined}
            onChange={v => us({ eq: { ...s.eq, [b.id]: v } })} />
        ))}
      </div>
    </section>
  )
}

/** 처음 열 때 패널에 보일 마스터 모듈 — 켜진 것 중 첫 번째, 없으면 음량 상한 */
function firstSlot(): SlotId {
  const p = useMastering.getState().params
  return p.order.find(s => !p.bypass[s]) ?? 'limiter'
}

export function MixerView() {
  const t = useMastering(s => s.tracks.find(x => x.id === s.activeId)) as TrackItem | undefined
  const params = useMastering(s => s.params)
  const setParams = useMastering(s => s.setParams)
  const update = useMastering(s => s.updateTrack)
  const engine = getEngine()
  const fileRef = useRef<HTMLInputElement>(null)
  const rowRef = useRef<HTMLDivElement>(null)
  const [sel, setSel] = useState<Sel>(() => ({ kind: 'master', slot: firstSlot() }))
  const [foldWanted, setFoldWanted] = useState(false)
  const [tooWide, setTooWide] = useState(false)
  const stems = useMemo(() => t?.stems ?? [], [t?.stems])
  const noStems = stems.length === 0

  // 스템 값 → 재생 엔진(버퍼는 엔진이 이미 들고 있다)
  useEffect(() => {
    const eng = getEngine()
    if (eng?.stemMode && t?.useStems) eng.updateStems(stems.map(s => ({ buffer: null as unknown as AudioBuffer, ...s })))
  }, [stems, t?.useStems])

  // 7개 이상이면 폭을 줄이고, 그래도 넘치면 접는다
  useLayoutEffect(() => {
    const el = rowRef.current
    if (!el) return
    const check = () => {
      const need = stems.length * (STRIP_MIN + GAP) + MASTER_W + 12
      setTooWide(stems.length > 0 && el.clientWidth > 0 && need > el.clientWidth)
    }
    check()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [stems.length])
  const folded = foldWanted || tooWide

  const us = (id: string) => (patch: Partial<Stem>) => t && update(t.id, x => ({ ...x, stems: x.stems.map(s => (s.id === id ? { ...s, ...patch } : s)) }), `stem:${id}`)
  const toggleStems = async () => {
    if (!t) return
    const on = !t.useStems
    update(t.id, x => ({ ...x, useStems: on }), 'useStems')
    if (on) await enterStems({ ...t, useStems: true })
    else getEngine()?.leaveStems()
  }

  const selStem = sel?.kind === 'stem' ? stems.find(s => s.id === sel.id) : undefined
  const fileInput = <input ref={fileRef} type="file" accept="audio/*" multiple hidden onChange={e => { if (e.target.files && t) addStemFiles(t.id, Array.from(e.target.files)); e.target.value = '' }} />
  const stemLed = <Led on={!!t?.useStems} onClick={toggleStems} label={t?.useStems ? '스템으로 마스터링 중' : '스템으로 마스터링'} title="켜면 원곡 대신 스템을 섞은 소리로 재생·내보내기해요" />

  const dock = (
    <div className={`ms-mixdock ${sel ? '' : 'empty'}`}>
      {!sel && <span>마스터 스트립의 모듈을 누르면 여기에 설정이 열려요</span>}
      {sel?.kind === 'stem' && selStem && <StemEqPanel s={selStem} band={sel.band} onClose={() => setSel(null)} us={us(selStem.id)} />}
      {sel?.kind === 'master' && engine && (
        <ModulePanel slot={sel.slot} p={params} engine={engine} heading={`마스터 · ${MODULE_LABEL[sel.slot]}`}
          set={fn => setParams(fn, `slot:${sel.slot}`)} onClose={() => setSel(null)} />
      )}
    </div>
  )

  if (noStems) {
    // 스템 없음 — 작은 안내 카드 + 마스터 모듈 패널(왼쪽), 두 열 마스터 스트립(오른쪽)
    return (
      <div className="ms-mixer nostems" aria-label="믹서">
        {fileInput}
        <div className="ms-mixleft" ref={rowRef}>
          <div className="ms-mixempty">
            <div className="min-w-0">
              <p>스템(보컬·드럼·베이스·반주처럼 나뉜 파일)을 넣으면 채널이 생겨요</p>
              <p className="dim">자동으로 나누기는 준비 중이에요.{!t && ' 곡을 먼저 불러오세요.'}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 flex-none">
              <button type="button" className="ms-btn" disabled={!t} onClick={() => fileRef.current?.click()}><FolderOpen className="w-3.5 h-3.5" /> 스템 파일 추가</button>
              {t && stemLed}
            </div>
          </div>
          {dock}
        </div>
        <MasterStrip engine={engine} sel={sel} onSel={slot => setSel({ kind: 'master', slot })} wide />
      </div>
    )
  }

  return (
    <div className="ms-mixer" aria-label="믹서">
      {fileInput}
      <div className="ms-mixbar">
        {stemLed}
        <button type="button" className="ms-btn" onClick={() => fileRef.current?.click()}><FolderOpen className="w-3.5 h-3.5" /> 스템 파일 추가</button>
        {!t?.useStems && <span className="text-[11px] dim">「스템으로 마스터링」을 켜야 채널 조절이 소리에 반영돼요.</span>}
        <button type="button" className="ms-btn ml-auto" aria-pressed={folded} disabled={tooWide}
          title={tooWide ? '채널이 많아 자동으로 접었어요' : '채널을 이름·M/S·페이더만 남기고 접기'}
          onClick={() => setFoldWanted(v => !v)}>{folded ? '펼치기' : '접기'}</button>
      </div>
      <div className="ms-mixrow" ref={rowRef}>
        {stems.map((s, i) => (
          <StemStrip key={s.id} s={s} index={i} engine={engine} folded={folded} sel={sel}
            onSel={band => setSel({ kind: 'stem', id: s.id, band })} us={us(s.id)} />
        ))}
        <MasterStrip engine={engine} sel={sel} onSel={slot => setSel({ kind: 'master', slot })} />
      </div>
      {dock}
    </div>
  )
}

export default MixerView
