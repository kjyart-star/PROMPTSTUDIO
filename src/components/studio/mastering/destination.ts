/**
 * 납품처(어디에 쓸 곡인가) — 화면이 참조하는 유일한 곳. 정본은 src/lib/mastering/destinations.ts.
 */
import { DESTINATIONS, DEFAULT_DESTINATION, DERIVATIVES as DERIV, exportOptsFor } from '@/lib/mastering/destinations'
import { TARGET_USE, composeChoice, blendChain, simpleChain, type UseId, type SimpleStyle } from '@/lib/mastering/compose'
import { autoMaster, masterToTarget } from '@/lib/mastering/automaster'
import { defaultChain } from '@/lib/mastering/presets'
import type { Analysis } from '@/lib/mastering/analyze'
import type { ChainParams } from '@/lib/mastering/dsp'
import type { MasterTemplate } from '@/lib/mastering/templates'
import type { ExportOpts } from './actions'
import { useMastering } from './store'

export interface Dest {
  id: string
  label: string
  plain: string
  lufs: number
  tp: number
  useId: UseId
  /** 대사와 섞일 배경 음악 */
  bgmMode: boolean
  opts: ExportOpts
}

export const DESTS: Dest[] = DESTINATIONS.map(d => ({
  id: d.id, label: d.label, plain: d.plain, lufs: d.lufs, tp: d.tp, useId: d.useId, bgmMode: d.bgmMode,
  opts: { ...exportOptsFor(d), range: 'all' },
}))

/** 기본 납품처 — 음반 */
export const DEFAULT_DEST: string = DEFAULT_DESTINATION
/** 목록에 없는 id(직접 지정 등)는 undefined */
export const destById = (id: string | null | undefined) => DESTS.find(d => d.id === id)
/** 함께 내보낼 파생본(기본 체크) */
export const DERIVATIVES: Record<string, string[]> = DERIV

// ── 렌더로 맞춘 풀 체인 캐시 ──
// chainFor 는 동기 함수라(StylePanel 이 그대로 부른다) 처음 한 번은 예측 체인을 돌려주고, 뒤에서 masterToTarget 으로
// 실제 렌더해 맞춘 풀 체인을 캐시에 넣은 뒤 화면 체인을 바꿔 끼운다. 강도만 움직일 때는 캐시된 풀 체인으로 blendChain 만 다시 한다.
type Full = { full: ChainParams; targetLufs: number }
const fullCache = new Map<string, Full>()
const pending = new Map<string, Promise<void>>()
const srcIds = new WeakMap<object, number>()
let srcSeq = 0
let decoder: ((trackId: string) => Promise<{ channels: Float32Array[]; sampleRate: number } | null>) | null = null
let latest: { key: string; style: SimpleStyle; d: Dest; strength: number; trackId: string } | null = null

let applied: ((id: string, dec: { channels: Float32Array[]; sampleRate: number }, p: ChainParams) => Promise<void>) | null = null
/** 렌더 결과를 화면 체인에 적용한 뒤 부를 함수(겹침 파형 갱신) */
export function registerApplied(fn: typeof applied) { applied = fn }
/** 활성 곡을 디코드하는 함수 등록 (actions.ts 가 올려 둔다) */
export function registerDecoder(fn: typeof decoder) { decoder = fn }
/** 진행 중인 렌더가 끝날 때까지 기다린다 — 자동 맞춤이 바뀐 체인을 보게 */
export async function settleRendered() { while (pending.size) await Promise.all([...pending.values()]) }

const renderTpl = (tpl: MasterTemplate, d: Dest): MasterTemplate => ({ ...tpl, lufs: d.lufs, tp: d.tp })

function kick(key: string, tpl: MasterTemplate, d: Dest, src: Analysis, trackId: string) {
  if (!decoder || pending.has(key) || fullCache.has(key)) return
  const job = (async () => {
    try {
      const dec = await decoder!(trackId)
      if (!dec) return
      const r = await masterToTarget(dec.channels, dec.sampleRate, src, renderTpl(tpl, d))
      fullCache.set(key, { full: r.params, targetLufs: r.targetLufs })
      const s = useMastering.getState()
      const req = latest
      // 그 사이 다른 스타일·곡으로 바뀌었으면 캐시만 채운다
      if (!req || req.key !== key || s.activeId !== trackId || !s.templateId?.startsWith('style:')) return
      const next = {
        ...blendChain(defaultChain(), r.params, req.strength / 100),
        listenOriginal: s.params.listenOriginal, originalTrim: s.params.originalTrim,
      }
      s.setParams(() => next, 'template')
      if (r.targetLufs < d.lufs - 0.05) s.setTarget({ id: d.id, label: d.label, lufs: r.targetLufs, tp: d.tp })
      await applied?.(trackId, dec, next as ChainParams)
    } catch (e) { console.error(e) } finally { pending.delete(key) }
  })()
  pending.set(key, job)
}

/**
 * 비동기판 — 렌더로 맞춘 풀 체인을 만들고(캐시) 강도만큼 섞어 돌려준다.
 * 같은 곡·스타일·납품처면 디코드·렌더 없이 캐시로 blendChain 만 한다.
 */
export async function simpleChainRendered(
  style: SimpleStyle, destOrTarget: Dest | string, strength: number,
  dec: { channels: Float32Array[]; sampleRate: number }, analysis: Analysis, onProgress?: (p: number) => void,
): Promise<{ tpl: MasterTemplate; params: ChainParams; targetLufs: number }> {
  const d = typeof destOrTarget === 'string' ? destById(destOrTarget) : destOrTarget
  const tpl = d ? composeChoice({ use: d.useId, genre: style.genre, texture: style.texture })
    : composeChoice({ use: TARGET_USE[destOrTarget as string] ?? 'use-stream', genre: style.genre, texture: style.texture })
  const key = cacheKey(analysis, tpl.id, d?.id)
  let hit = fullCache.get(key)
  if (!hit) {
    const t = d ? renderTpl(tpl, d) : tpl
    const r = await masterToTarget(dec.channels, dec.sampleRate, analysis, t, { onProgress })
    hit = { full: r.params, targetLufs: r.targetLufs }
    fullCache.set(key, hit)
  }
  return { tpl, params: blendChain(defaultChain(), hit.full, strength / 100), targetLufs: hit.targetLufs }
}

function cacheKey(src: Analysis, tplId: string, destId?: string) {
  let id = srcIds.get(src)
  if (id === undefined) { id = ++srcSeq; srcIds.set(src, id) }
  return `${id}|${tplId}|${destId ?? '-'}`
}

/**
 * 스타일 + 납품처 + 강도 → 체인. simpleChain 과 같은 계산이되 용도는 납품처의 useId 를 쓴다
 * (납품처가 없으면 — 직접 지정 음량 등 — simpleChain 의 TARGET_USE 폴백).
 * 렌더 캐시가 있으면 그 풀 체인으로, 없으면 예측 체인을 돌려주고 뒤에서 렌더해 채운다.
 */
export function chainFor(style: SimpleStyle, d: Dest | undefined, targetId: string, strength: number, src?: Analysis | null): { tpl: MasterTemplate; params: ChainParams } {
  if (!d) {
    const tid = TARGET_USE[targetId] ? targetId : 'stream'
    const tpl0 = composeChoice({ use: TARGET_USE[tid] ?? 'use-stream', genre: style.genre, texture: style.texture })
    const hit = src ? fullCache.get(cacheKey(src, tpl0.id)) : undefined
    return simpleChain(style, tid, strength, src, hit?.full)
  }
  const tpl = composeChoice({ use: d.useId, genre: style.genre, texture: style.texture })
  let full: ChainParams
  if (src) {
    const key = cacheKey(src, tpl.id, d.id)
    const hit = fullCache.get(key)
    const trackId = useMastering.getState().activeId
    if (trackId) latest = { key, style, d, strength, trackId }
    if (hit) full = hit.full
    else {
      full = autoMaster(src, renderTpl(tpl, d)).params
      if (trackId) kick(key, tpl, d, src, trackId)
    }
  } else full = tpl.build()
  return { tpl, params: blendChain(defaultChain(), full, strength / 100) }
}
