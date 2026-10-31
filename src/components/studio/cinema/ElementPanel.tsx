'use client'
/**
 * 미리보기에서 고른 요소의 속성 패널. 바꾸는 즉시 미리보기에 보이고, 영상에도 그대로 들어간다(같은 그리기 코드).
 * 글자: 글꼴·크기·색·그림자 / 스펙트럼: 형태·색·크기 / 커버: 크기·모서리·그림자 / 진행바: 크기
 */
import type { Dispatch, SetStateAction } from 'react'
import { Undo2, Redo2, RotateCcw, X } from 'lucide-react'
import type { ElAdjust, ElKey, FontStyle } from '@/lib/cinema/types'
import { EL_LABEL, TEXT_ELS } from '@/lib/cinema/layout'
import { VIZ_SHAPES } from '@/lib/cinema/viz'
import type { FullSettings } from './model'

const FONTS: [FontStyle, string][] = [['auto', '템플릿 기본'], ['serif', '명조'], ['sans', '고딕'], ['hand', '손글씨']]
const chip = (on: boolean) => `px-2.5 py-1 rounded-lg text-xs font-semibold border ${on ? 'bg-white text-black border-white' : 'border-white/15 text-zinc-300 hover:border-white/40'}`

function Slider({ label, value, min, max, step = 1, unit = '%', onChange }: { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void }) {
  return (
    <label className="fld-cin"><span>{label}</span>
      <div className="flex items-center gap-2">
        <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} className="flex-1 accent-emerald-400" aria-label={label} />
        <span className="text-[11px] tabular-nums w-10 text-right text-zinc-300">{value}{unit}</span>
      </div>
    </label>
  )
}

export function ElementPanel({ el, adj, onPatch, onClose, onUndo, onRedo, onResetTemplate, settings, setSettings }: {
  el: ElKey; adj: ElAdjust
  onPatch: (p: Partial<ElAdjust>) => void
  onClose: () => void; onUndo: () => void; onRedo: () => void; onResetTemplate: () => void
  settings: FullSettings; setSettings: Dispatch<SetStateAction<FullSettings>>
}) {
  const isText = TEXT_ELS.includes(el)
  const scale = Math.round((adj.scale ?? 1) * 100)
  return (
    <div className="space-y-4" data-testid="cinema-element-panel">
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold text-white">선택: {EL_LABEL[el]}</span>
        <span className="flex-1" />
        <button type="button" className="btn-cin" onClick={onClose}><X className="w-3.5 h-3.5" />선택 풀기 (Esc)</button>
      </div>

      <Slider label="크기" value={scale} min={30} max={300} onChange={v => onPatch({ scale: v / 100 })} />

      {isText && (
        <>
          <div className="fld-cin"><span>글꼴</span>
            <div className="flex flex-wrap gap-1.5">{FONTS.map(([id, label]) => <button key={id} type="button" className={chip((adj.font ?? 'auto') === id)} onClick={() => onPatch({ font: id === 'auto' ? undefined : id })}>{label}</button>)}</div>
          </div>
          <div className="fld-cin"><span>색</span>
            <div className="flex items-center gap-2">
              <input type="color" value={adj.color ?? '#ffffff'} onChange={e => onPatch({ color: e.target.value })} className="h-7 w-10 rounded border border-white/15 bg-transparent" aria-label="글자 색" />
              <button type="button" className={chip(!adj.color)} onClick={() => onPatch({ color: undefined })}>템플릿 기본</button>
            </div>
          </div>
          <Slider label="그림자" value={Math.round((adj.shadow ?? 0) * 100)} min={0} max={100} onChange={v => onPatch({ shadow: v ? v / 100 : undefined })} />
        </>
      )}

      {el === 'cover' && (
        <>
          <Slider label="모서리" value={Math.round((adj.radius ?? 0) * 100)} min={0} max={50} onChange={v => onPatch({ radius: v / 100 })} />
          <Slider label="그림자" value={Math.round((adj.shadow ?? 1) * 100)} min={0} max={150} onChange={v => onPatch({ shadow: v / 100 })} />
        </>
      )}

      {el === 'viz' && (
        <>
          <label className="fld-cin"><span>형태</span>
            <select value={settings.shape} onChange={e => setSettings(s => ({ ...s, shape: e.target.value as FullSettings['shape'] }))} className="sel-cin" aria-label="스펙트럼 형태 고르기">
              {VIZ_SHAPES.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </label>
          <div className="fld-cin"><span>색</span>
            <div className="flex flex-wrap items-center gap-2">
              <select value={settings.colorMode === 'solid' || settings.colorMode === 'gradient' ? settings.colorMode : 'palette'} onChange={e => setSettings(s => ({ ...s, colorMode: e.target.value as 'palette' | 'solid' | 'gradient' }))} className="sel-cin !w-auto" aria-label="스펙트럼 색 방식">
                <option value="palette">팔레트(스펙트럼 탭)</option><option value="solid">단색</option><option value="gradient">그라데이션</option>
              </select>
              {(settings.colorMode === 'solid' || settings.colorMode === 'gradient') && <input type="color" value={settings.customColors?.[0] ?? '#f2d6a8'} onChange={e => setSettings(s => ({ ...s, customColors: [e.target.value, s.customColors?.[1] ?? '#7aa7ff'] }))} className="h-7 w-10 rounded border border-white/15 bg-transparent" aria-label="스펙트럼 색" />}
              {settings.colorMode === 'gradient' && <input type="color" value={settings.customColors?.[1] ?? '#7aa7ff'} onChange={e => setSettings(s => ({ ...s, customColors: [s.customColors?.[0] ?? '#f2d6a8', e.target.value] }))} className="h-7 w-10 rounded border border-white/15 bg-transparent" aria-label="스펙트럼 끝 색" />}
            </div>
          </div>
        </>
      )}

      <div className="flex flex-wrap gap-1.5 pt-1">
        <button type="button" className="btn-cin" onClick={() => onPatch({ dx: undefined, dy: undefined })}>위치 되돌리기</button>
        <button type="button" className="btn-cin" onClick={onUndo}><Undo2 className="w-3.5 h-3.5" />실행 취소</button>
        <button type="button" className="btn-cin" onClick={onRedo}><Redo2 className="w-3.5 h-3.5" />다시 실행</button>
        <button type="button" className="btn-cin" onClick={onResetTemplate}><RotateCcw className="w-3.5 h-3.5" />템플릿 기본값으로</button>
      </div>
      <p className="text-[11px] text-zinc-500">미리보기에서 끌어서 옮기고 모서리로 크기를 바꿔요. 화살표 1px, Shift+화살표 10px. 조정값은 템플릿마다 따로 저장되고 영상에도 그대로 들어가요.</p>
    </div>
  )
}
