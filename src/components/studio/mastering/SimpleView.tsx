'use client'

/**
 * 간단 모드 — 곡 고르기 → 템플릿 고르기(용도·장르·느낌, 사진 카드) → 적용하고 듣기 → 내보내기.
 * 화면에는 지금 할 일 하나와 큰 음량 미터, A/B 만 둔다. 전문 값은 카드의 「자세히」 안에만.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Play, Pause, X, Library, FolderOpen, ChevronDown, ChevronRight, Download, Save, Loader2, ArrowLeft } from 'lucide-react'
import { withBase } from '@/lib/basePath'
import {
  USE_CARDS, GENRE_GROUPS, TEXTURE_CARDS, GENRE_PLAIN, composeChoice, changeBars, recommendGenres, loudnessWords, imageSrc,
  type Choice, type UseId, type TextureId,
} from '@/lib/mastering/compose'
import { TEMPLATES } from '@/lib/mastering/templates'
import { useMastering } from './store'
import { useUi, previewTemplate, endPreview, runAutoMaster, playFromLoudest, exportActive, saveToLibrary, activate } from './actions'
import type { MasteringEngine } from './engine'

export interface ViewCtx {
  engine: MasteringEngine
  playing: boolean
  compare: 'a' | 'b' | 'r'
  setListenMode: (m: 'a' | 'b' | 'r') => void
  togglePlay: () => void
  openLibrary: () => void
  openFile: () => void
  counterRef: React.RefObject<HTMLSpanElement | null>
}

type Step = 1 | 2 | 3 | 4
const STEP_TITLES = ['곡 고르기', '템플릿 고르기', '적용하고 듣기', '내보내기']
type Sub = 'use' | 'genre' | 'texture'

const genreLabel = (id: string) => TEMPLATES.find(t => t.id === id)?.label ?? id

export function SimpleView({ ctx }: { ctx: ViewCtx }) {
  const tracks = useMastering(s => s.tracks)
  const active = useMastering(s => s.tracks.find(t => t.id === s.activeId) ?? null)
  const src = useMastering(s => (s.activeId ? s.srcAnalysis[s.activeId] : undefined))
  const target = useMastering(s => s.target)
  const templateId = useMastering(s => s.templateId)
  const busy = useUi(s => s.busy)
  const preview = useUi(s => s.preview)
  const [step, setStep] = useState<Step>(1)
  const [sub, setSub] = useState<Sub>('use')
  const [choice, setChoice] = useState<Choice>({ use: null, genre: null, texture: null })
  const [refine, setRefine] = useState(true)
  const [applied, setApplied] = useState<string | null>(null)
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const [fmt, setFmt] = useState<'wav' | 'mp3'>('wav')

  // 곡이 생기면 다음 단계로 자연스럽게
  useEffect(() => { if (active && step === 1 && tracks.length === 1 && !applied) setStep(2) }, [active?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  // 단계를 떠나면 미리듣기를 끝낸다
  useEffect(() => { if (step !== 2 && useUi.getState().preview) endPreview(false) }, [step])

  const recs = useMemo(() => (src ? recommendGenres(src, 3) : []), [src])
  const combo = composeChoice(choice)
  const summary: { key: keyof Choice; label: string }[] = [
    choice.use && { key: 'use' as const, label: USE_CARDS.find(u => u.id === choice.use)!.title },
    choice.genre && { key: 'genre' as const, label: genreLabel(choice.genre) },
    choice.texture && { key: 'texture' as const, label: TEXTURE_CARDS.find(t => t.id === choice.texture)!.title },
  ].filter(Boolean) as { key: keyof Choice; label: string }[]

  const applyAndListen = async () => {
    if (preview) endPreview(false)
    const ok = refine ? await runAutoMaster(combo) : (useMastering.getState().setParams(() => combo.build(), 'template'), useMastering.getState().setTarget({ id: combo.id, label: combo.label, lufs: combo.lufs, tp: combo.tp }), true)
    if (!ok) return
    setApplied(combo.label)
    setStep(3)
    ctx.setListenMode('b')
    ctx.engine.resetMeters()
    await playFromLoudest()
  }

  const next = (() => {
    switch (step) {
      case 1: return { label: '다음: 템플릿 고르기', disabled: !active, run: () => setStep(2) }
      case 2: return sub === 'use' ? { label: '다음: 장르 고르기', disabled: false, run: () => setSub('genre') }
        : sub === 'genre' ? { label: '다음: 느낌 고르기', disabled: false, run: () => setSub('texture') }
          : { label: '적용하고 듣기', disabled: !active || !!busy, run: applyAndListen }
      case 3: return { label: '다음: 내보내기', disabled: !applied, run: () => setStep(4) }
      case 4: return null
    }
  })()

  return (
    <div className="flex flex-col">
      <nav className="ms-steps" aria-label="진행 단계">
        {STEP_TITLES.map((t, i) => {
          const n = (i + 1) as Step
          const done = n < step || (n === 1 && !!active) || (n === 2 && !!applied) || (n === 3 && !!applied && step === 4)
          return (
            <button key={t} type="button" className={`ms-step ${done && n !== step ? 'done' : ''}`} aria-current={n === step ? 'step' : undefined}
              onClick={() => (n === 1 || active) && setStep(n)} disabled={n > 1 && !active}>
              <span className="n">{done && n !== step ? <Check className="w-3 h-3" /> : n}</span>
              <span className="min-w-0">
                <span className="block text-[10px] dim mono">{n} / 4</span>
                <span className="t block">{t}</span>
              </span>
            </button>
          )
        })}
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="p-4 min-w-0 lg:border-r border-[var(--m-line-soft)]">
          {step === 1 && <StepSong ctx={ctx} />}
          {step === 2 && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2 min-h-[28px]">
                <span className="dim text-[12px]">고른 조합</span>
                {summary.length ? summary.map(s => (
                  <span key={s.key} className="ms-chip">{s.label}
                    <button type="button" aria-label={`${s.label} 빼기`} className="dim hover:text-white" onClick={() => setChoice(c => ({ ...c, [s.key]: null }))}><X className="w-3.5 h-3.5" /></button>
                  </span>
                )) : <span className="faint text-[12px]">아직 없어요 — 고르지 않으면 기본으로 맞춰요</span>}
              </div>
              <div className="ms-seg self-start" role="tablist" aria-label="템플릿 단계">
                {([['use', '① 어디에 올릴 곡인가요?'], ['genre', '② 어떤 장르인가요?'], ['texture', '③ 어떤 느낌으로?']] as [Sub, string][]).map(([k, l]) => (
                  <button key={k} type="button" role="tab" aria-pressed={sub === k} aria-selected={sub === k} onClick={() => setSub(k)}>{l}</button>
                ))}
              </div>

              {sub === 'use' && (
                <CardGrid>
                  {USE_CARDS.map(u => (
                    <ChoiceCard key={u.id} img={u.image} title={u.title} sub={u.loud} text={u.plain}
                      selected={choice.use === u.id} onSelect={() => setChoice(c => ({ ...c, use: c.use === u.id ? null : u.id as UseId }))}
                      tryChoice={{ ...choice, use: u.id }} ctx={ctx} />
                  ))}
                </CardGrid>
              )}

              {sub === 'genre' && (
                <div className="flex flex-col gap-3">
                  {recs.length > 0 && (
                    <>
                      <h3 className="text-[13px] font-semibold">곡을 들어 보고 고른 추천</h3>
                      <CardGrid>
                        {recs.map(r => {
                          const g = GENRE_GROUPS.find(x => x.genres.includes(r.id))!
                          return <ChoiceCard key={r.id} img={g.image} title={genreLabel(r.id)} sub={g.title} text={GENRE_PLAIN[r.id]} badge="추천"
                            selected={choice.genre === r.id} onSelect={() => setChoice(c => ({ ...c, genre: c.genre === r.id ? null : r.id }))}
                            tryChoice={{ ...choice, genre: r.id }} ctx={ctx} />
                        })}
                      </CardGrid>
                    </>
                  )}
                  <h3 className="text-[13px] font-semibold">장르 묶음에서 고르기</h3>
                  <CardGrid>
                    {GENRE_GROUPS.map(g => {
                      const inGroup = choice.genre && g.genres.includes(choice.genre)
                      return (
                        <div key={g.id} className="ms-card" aria-pressed={!!inGroup}>
                          <button type="button" onClick={() => setOpenGroup(o => (o === g.id ? null : g.id))} className="text-left" aria-expanded={openGroup === g.id}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img className="img" src={withBase(imageSrc(g.image))} alt="" loading="lazy" />
                            <div className="body">
                              <span className="ttl">{g.title}</span>
                              <span className="txt">{inGroup ? `${genreLabel(choice.genre!)} 선택됨` : `${g.genres.length}가지 — 눌러서 고르기`}</span>
                            </div>
                          </button>
                          {inGroup && <span className="check"><Check className="w-3.5 h-3.5" /></span>}
                          {openGroup === g.id && (
                            <div className="px-2 pb-2 flex flex-col gap-1">
                              {g.genres.map(id => (
                                <button key={id} type="button" aria-pressed={choice.genre === id}
                                  onClick={() => setChoice(c => ({ ...c, genre: c.genre === id ? null : id }))}
                                  className={`text-left rounded px-2 py-1.5 border ${choice.genre === id ? 'border-[var(--m-green)] bg-[var(--m-raise)]' : 'border-[var(--m-line-soft)] hover:bg-[var(--m-panel-2)]'}`}>
                                  <span className="block text-[13px] font-semibold">{genreLabel(id)}</span>
                                  <span className="block text-[11px] dim">{GENRE_PLAIN[id]}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </CardGrid>
                  {choice.genre && <PreviewRow ctx={ctx} tryChoice={choice} label={`${genreLabel(choice.genre)} 8초 듣기`} />}
                </div>
              )}

              {sub === 'texture' && (
                <CardGrid>
                  {TEXTURE_CARDS.map(t => (
                    <ChoiceCard key={t.id} img={t.image} title={t.title} text={t.plain}
                      selected={(choice.texture ?? 'none') === t.id} onSelect={() => setChoice(c => ({ ...c, texture: t.id as TextureId }))}
                      tryChoice={{ ...choice, texture: t.id as TextureId }} ctx={ctx} />
                  ))}
                </CardGrid>
              )}

              <label className="flex items-center gap-2 text-[12px] dim mt-1">
                <input type="checkbox" checked={refine} onChange={e => setRefine(e.target.checked)} />
                곡을 분석해 템플릿 값을 이 곡에 맞게 다듬기 (권장)
              </label>
            </div>
          )}
          {step === 3 && <StepListen ctx={ctx} applied={applied ?? templateId ?? ''} onRedo={() => { setStep(2); setSub('use') }} />}
          {step === 4 && <StepExport fmt={fmt} setFmt={setFmt} />}
        </div>
        <aside className="p-4 flex flex-col gap-3">
          <BigLoudness engine={ctx.engine} target={target.lufs} ceiling={target.tp} />
          <div className="flex items-center gap-2">
            <button type="button" className="ms-tbtn play" style={{ width: 44, height: 40 }} onClick={ctx.togglePlay} disabled={!active} aria-label={ctx.playing ? '일시정지' : '재생'}>
              {ctx.playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>
            <span ref={ctx.counterRef} className="ms-counter" style={{ fontSize: 22 }}>00:00.000</span>
          </div>
          <div className="ms-seg w-full" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            <button type="button" aria-pressed={ctx.compare === 'a'} onClick={() => ctx.setListenMode('a')} style={{ height: 32 }}>원본</button>
            <button type="button" aria-pressed={ctx.compare === 'b'} onClick={() => ctx.setListenMode('b')} style={{ height: 32 }}>마스터링</button>
          </div>
          <p className="text-[11px] faint leading-relaxed">원본과 마스터링을 같은 크기로 맞춰 번갈아 들려줘요. 커진 소리에 속지 않고 차이만 들을 수 있어요.</p>
        </aside>
      </div>

      <footer className="flex items-center justify-between gap-3 px-4 py-3 border-t border-[var(--m-line-soft)] bg-[var(--m-panel)]">
        <button type="button" className="ms-ghost" disabled={step === 1} onClick={() => (step === 2 && sub !== 'use' ? setSub(sub === 'texture' ? 'genre' : 'use') : setStep((step - 1) as Step))} style={step === 1 ? { visibility: 'hidden' } : undefined}>
          <ArrowLeft className="w-4 h-4" /> 이전
        </button>
        <div className="flex items-center gap-2">
          {step === 2 && sub !== 'texture' && <button type="button" className="ms-ghost" onClick={() => setSub(sub === 'use' ? 'genre' : 'texture')}>건너뛰기</button>}
          {step === 2 && sub !== 'texture' && <button type="button" className="ms-ghost" disabled={!active || !!busy} onClick={applyAndListen}>바로 적용하고 듣기</button>}
          {next && (
            <button type="button" className="ms-bigbtn" disabled={next.disabled} onClick={next.run}>
              {busy && step === 2 && sub === 'texture' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}{next.label}
            </button>
          )}
        </div>
      </footer>
    </div>
  )
}

function CardGrid({ children }: { children: React.ReactNode }) {
  return <div className="ms-cardgrid">{children}</div>
}

/** 사진 카드 — 고르기 · 8초 듣기(원본↔적용) · 전후 막대 · 자세히 */
function ChoiceCard({ img, title, sub, text, badge, selected, onSelect, tryChoice, ctx }: {
  img: string; title: string; sub?: string; text: string; badge?: string; selected: boolean; onSelect: () => void; tryChoice: Choice; ctx: ViewCtx
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="ms-card" aria-pressed={selected}>
      <button type="button" onClick={onSelect} className="text-left" aria-label={`${title} ${selected ? '선택 해제' : '고르기'}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="img" src={withBase(imageSrc(img))} alt="" loading="lazy" />
        <div className="body">
          <span className="ttl">{title}</span>
          {sub && <span className="sub">{sub}</span>}
          <span className="txt">{text}</span>
        </div>
      </button>
      {badge && <span className="rec">{badge}</span>}
      {selected && <span className="check" aria-hidden><Check className="w-3.5 h-3.5" /></span>}
      <div className="px-2.5 pb-2.5 flex flex-col gap-2">
        <ChangeBars choice={tryChoice} />
        <PreviewRow ctx={ctx} tryChoice={tryChoice} label={`${title} 8초 듣기`} compact />
        <button type="button" className="self-start text-[11px] dim hover:text-white inline-flex items-center gap-1" onClick={() => setOpen(o => !o)} aria-expanded={open}>
          {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />} 자세히
        </button>
        {open && <Details choice={tryChoice} />}
      </div>
    </div>
  )
}

function PreviewRow({ ctx, tryChoice, label, compact }: { ctx: ViewCtx; tryChoice: Choice; label: string; compact?: boolean }) {
  const preview = useUi(s => s.preview)
  const hasTrack = useMastering(s => !!s.activeId)
  const tpl = composeChoice(tryChoice)
  const on = preview?.templateId === tpl.id
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" className="ms-btn" style={{ height: 32, paddingInline: 12 }} disabled={!hasTrack} aria-label={on ? `${label} 멈추기` : label}
        onClick={() => { if (on) { endPreview(false); ctx.engine.pause() } else { ctx.setListenMode('b'); previewTemplate(tpl) } }}>
        {on ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />} {compact ? (on ? '멈추기' : '8초 듣기') : label}
      </button>
      {on && (
        <div className="ms-seg">
          <button type="button" aria-pressed={ctx.compare === 'a'} onClick={() => ctx.setListenMode('a')} style={{ height: 30 }}>원본</button>
          <button type="button" aria-pressed={ctx.compare === 'b'} onClick={() => ctx.setListenMode('b')} style={{ height: 30 }}>적용</button>
        </div>
      )}
    </div>
  )
}

function ChangeBars({ choice }: { choice: Choice }) {
  const src = useMastering(s => (s.activeId ? s.srcAnalysis[s.activeId] : undefined))
  const b = changeBars(composeChoice(choice), src)
  const rows: [string, number, number, string][] = [
    ['음량', b.loud, 12, b.loud > 0.5 ? '커져요' : b.loud < -0.5 ? '작아져요' : '그대로'],
    ['밝기', b.bright, 4, b.bright > 0.3 ? '밝아져요' : b.bright < -0.3 ? '부드러워져요' : '그대로'],
    ['폭', b.width, 40, b.width > 3 ? '넓어져요' : b.width < -3 ? '좁아져요' : '그대로'],
  ]
  return (
    <div className="grid gap-1" style={{ gridTemplateColumns: '28px 1fr 56px' }} aria-label="전후 변화">
      {rows.map(([k, v, max, word]) => {
        const t = Math.max(-1, Math.min(1, v / max))
        return (
          <React.Fragment key={k}>
            <span className="text-[11px] dim">{k}</span>
            <div className="ms-bar self-center"><span className="mid" /><span className="v" style={{ left: t >= 0 ? '50%' : `${50 + t * 50}%`, width: `${Math.abs(t) * 50}%`, background: t >= 0 ? 'var(--m-green)' : 'var(--m-blue)' }} /></div>
            <span className="text-[11px] text-right">{word}</span>
          </React.Fragment>
        )
      })}
    </div>
  )
}

function Details({ choice }: { choice: Choice }) {
  const t = composeChoice(choice)
  const c = t.build()
  const on = (Object.keys(c.bypass) as (keyof typeof c.bypass)[]).filter(k => !c.bypass[k]).length
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[11px] mono">
      <dt className="dim">목표</dt><dd>{t.lufs} LUFS · {t.tp} dBTP</dd>
      <dt className="dim">EQ</dt><dd>{[c.eq.lf.gain, c.eq.lmf.gain, c.eq.mf.gain, c.eq.hmf.gain, c.eq.hf.gain].map(g => (g > 0 ? `+${g}` : `${g}`)).join(' / ')} dB</dd>
      <dt className="dim">컴프</dt><dd>{c.comp.threshold} dB · {c.comp.ratio}:1</dd>
      <dt className="dim">폭</dt><dd>{c.stereo.width}%{c.stereo.bassMono ? ` · 저역 모노 ${c.stereo.bassMono} Hz` : ''}</dd>
      <dt className="dim">켜진 처리</dt><dd>{on}개</dd>
    </dl>
  )
}

function StepSong({ ctx }: { ctx: ViewCtx }) {
  const tracks = useMastering(s => s.tracks)
  const activeId = useMastering(s => s.activeId)
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-[18px] font-bold">마스터링할 곡을 골라 주세요</h2>
        <p className="dim mt-1">보관함의 곡이나 이 컴퓨터의 파일(WAV·MP3)을 불러와요. 원곡은 바뀌지 않아요.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="ms-bigbtn" onClick={ctx.openLibrary}><Library className="w-4 h-4" /> 보관함에서 고르기</button>
        <button type="button" className="ms-ghost" onClick={ctx.openFile}><FolderOpen className="w-4 h-4" /> 파일 열기</button>
      </div>
      {tracks.length > 0 && (
        <ul className="flex flex-col border border-[var(--m-line-soft)] rounded-md overflow-hidden">
          {tracks.map(t => (
            <li key={t.id}>
              <button type="button" onClick={() => activate(t.id)} className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-[var(--m-panel-2)]" aria-current={t.id === activeId}>
                {t.meta.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.meta.coverUrl} alt="" className="w-9 h-9 rounded object-cover" />
                ) : <span className="w-9 h-9 rounded bg-[var(--m-raise)]" />}
                <span className="flex-1 min-w-0 truncate text-[13px]">{t.meta.title || t.title}</span>
                {t.id === activeId && <span className="text-[11px] text-[var(--m-green)] inline-flex items-center gap-1"><Check className="w-3.5 h-3.5" /> 선택됨</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function StepListen({ ctx, applied, onRedo }: { ctx: ViewCtx; applied: string; onRedo: () => void }) {
  const src = useMastering(s => (s.activeId ? s.srcAnalysis[s.activeId] : undefined))
  const target = useMastering(s => s.target)
  const params = useMastering(s => s.params)
  const loud = src && Number.isFinite(src.integrated) ? target.lufs - src.integrated : 0
  const lines = [
    `원곡보다 소리가 ${Math.abs(loud).toFixed(1)}dB ${loud >= 0 ? '커졌어요' : '작아졌어요'} (목표: ${target.label})`,
    params.eq.hf.gain > 0.5 ? '고음이 조금 밝아졌어요' : params.eq.hf.gain < -0.5 ? '거친 고음을 부드럽게 했어요' : null,
    params.eq.lf.gain > 0.5 ? '저음을 단단하게 했어요' : params.eq.lf.gain < -0.5 ? '뭉친 저음을 정리했어요' : null,
    !params.bypass.stereo && params.stereo.bassMono ? '저음은 가운데로 모아 스피커에서 안정적이에요' : null,
    '소리가 찌그러지지 않게 맨 끝을 안전하게 막았어요',
  ].filter(Boolean) as string[]
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-[18px] font-bold">「{applied}」로 마스터링했어요</h2>
        <p className="dim mt-1">오른쪽 「원본 / 마스터링」을 번갈아 눌러 들어 보세요. 마음에 들면 내보내기로 넘어가요.</p>
      </div>
      <ul className="flex flex-col gap-1.5">
        {lines.map(l => <li key={l} className="flex items-start gap-2 text-[13px]"><Check className="w-4 h-4 mt-0.5 text-[var(--m-green)] flex-none" />{l}</li>)}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="ms-ghost" onClick={() => { ctx.setListenMode('b'); playFromLoudest() }}><Play className="w-4 h-4" /> 가장 큰 부분부터 듣기</button>
        <button type="button" className="ms-ghost" onClick={onRedo}>템플릿 다시 고르기</button>
      </div>
    </div>
  )
}

function StepExport({ fmt, setFmt }: { fmt: 'wav' | 'mp3'; setFmt: (f: 'wav' | 'mp3') => void }) {
  const reports = useUi(s => s.reports)
  const busy = useUi(s => s.busy)
  const set = (f: 'wav' | 'mp3') => {
    setFmt(f)
    const o = useUi.getState().exportOpts
    useUi.getState().set({ exportOpts: { ...o, format: f, bits: 24, rate: 44100, dither: 'tpdf', range: 'all' } })
  }
  const r = reports[0]
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-[18px] font-bold">어떤 파일로 받을까요?</h2>
        <p className="dim mt-1">내려받거나, 보관함에 새 곡으로 저장해요. 원곡은 그대로 남아요.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-[560px]">
        {([['wav', '고음질 (WAV)', '음원 사이트 등록·보관용. 파일이 커요'], ['mp3', '작은 파일 (MP3)', '메신저·공유용. 파일이 작아요']] as const).map(([k, t, d]) => (
          <button key={k} type="button" aria-pressed={fmt === k} onClick={() => set(k)} className="ms-card text-left p-3" style={{ display: 'block' }}>
            <span className="ttl block">{t}</span>
            <span className="txt block mt-1">{d}</span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="ms-bigbtn" disabled={!!busy} onClick={exportActive}><Download className="w-4 h-4" /> 내려받기</button>
        <button type="button" className="ms-ghost" disabled={!!busy} onClick={saveToLibrary}><Save className="w-4 h-4" /> 보관함에 새 곡으로 저장</button>
      </div>
      {r && (
        <div className="border border-[var(--m-line-soft)] rounded-md p-3 max-w-[560px]">
          <div className="text-[13px] font-semibold mb-1.5">방금 만든 파일을 다시 들어 봤어요</div>
          <ul className="flex flex-col gap-1 text-[13px]">
            <li className="flex items-center gap-2">{r.pass.loudness ? <Check className="w-4 h-4 text-[var(--m-green)]" /> : <X className="w-4 h-4 text-[var(--m-amber)]" />}
              {r.pass.loudness ? `목표 음량(${r.target.label})에 맞아요` : `목표 음량과 ${Math.abs(r.integrated - r.target.lufs).toFixed(1)}dB 차이가 나요`}</li>
            <li className="flex items-center gap-2">{r.pass.peak ? <Check className="w-4 h-4 text-[var(--m-green)]" /> : <X className="w-4 h-4 text-[var(--m-red)]" />}
              {r.pass.peak ? '어떤 기기에서도 찌그러지지 않게 안전해요' : '피크가 조금 넘쳐요 — 고급 모드에서 리미터 천장을 낮춰 주세요'}</li>
          </ul>
        </div>
      )}
    </div>
  )
}

/** 큰 음량 미터 — 목표 대비 지금 위치를 막대와 쉬운 말로 */
function BigLoudness({ engine, target, ceiling }: { engine: MasteringEngine; target: number; ceiling: number }) {
  const fill = useRef<HTMLDivElement>(null)
  const word = useRef<HTMLSpanElement>(null)
  const peak = useRef<HTMLSpanElement>(null)
  const lo = -36, hi = -4
  const pos = (v: number) => `${((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * 100}%`
  useEffect(() => {
    let raf = 0, last = 0
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const m = engine.meters
      const on = !engine.paused
      const v = on && m ? m.shortTerm : -Infinity
      if (fill.current) fill.current.style.width = Number.isFinite(v) ? pos(v) : '0%'
      if (now - last > 250) {
        last = now
        const w = loudnessWords(m && on ? m.integrated : -Infinity, target)
        if (word.current) { word.current.textContent = w.text; word.current.style.color = w.tone === 'ok' ? 'var(--m-green)' : w.tone === 'high' ? 'var(--m-amber)' : 'var(--m-dim)' }
        if (peak.current) {
          const over = m && on && m.truePeakMax > ceiling + 0.1
          peak.current.textContent = over ? '피크가 넘쳐요' : '피크 안전'
          peak.current.style.color = over ? 'var(--m-red)' : 'var(--m-dim)'
        }
      }
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [engine, target, ceiling]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="border border-[var(--m-line)] rounded-md p-3 bg-[var(--m-panel)]">
      <div className="flex items-baseline justify-between">
        <span className="text-[12px] dim">지금 음량</span>
        <span ref={word} className="text-[18px] font-bold">재생하면 재요</span>
      </div>
      <div className="relative h-4 mt-2 rounded-sm bg-[var(--m-well)] overflow-hidden" aria-hidden>
        <div className="absolute top-0 bottom-0 bg-[var(--m-green-dim)]/40" style={{ left: pos(target - 1), width: `calc(${pos(target + 1)} - ${pos(target - 1)})` }} />
        <div ref={fill} className="absolute left-0 top-0 bottom-0 bg-[var(--m-green)]" style={{ width: 0, opacity: 0.85 }} />
        <div className="absolute top-0 bottom-0 w-0.5 bg-white" style={{ left: pos(target) }} />
      </div>
      <div className="flex justify-between text-[10px] faint mt-1"><span>작게</span><span>목표</span><span>크게</span></div>
      <span ref={peak} className="block text-[11px] mt-1 dim">피크 안전</span>
    </div>
  )
}
