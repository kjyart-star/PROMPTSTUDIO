/**
 * 발매 점검 — 곡 분석 결과로 6가지를 신호등(통과·주의·문제)으로 판정하고, 문제의 원인과 고치는 방법을 쉬운 말로 돌려준다.
 * 마스터링 내보내기 전 자동 검수(autoFix)와 단독 「발매 점검」 도구가 같이 쓴다. 처리는 브라우저 안에서만.
 *
 * 기준값 근거(과장하지 않는다):
 *  - 음량·트루피크: 납품처 목표(docs/mastering-destinations.md)가 있으면 그 값, 없으면 스트리밍 기준(-14 LUFS · -1 dBTP).
 *  - 클리핑: 0dBFS 에 닿은 샘플 수. 다이내믹(PLR)·모노 호환(상관도)은 마스터링에서 흔히 쓰는 경험적 범위.
 *  - 고음 거칠기: 고역 돌출 피크(aiclean.ts harshMetrics.bulgeDb). 공개 AI 곡 12곡 측정값으로 잡은 앱 기준이다.
 */
import type { Analysis } from './analyze'
import type { ChainParams } from './dsp'
import { withAiClean } from './aiclean'

export type CheckStatus = 'ok' | 'warn' | 'bad'
export type CheckId = 'loudness' | 'truePeak' | 'clipping' | 'dynamics' | 'mono' | 'harsh'

export interface CheckItem {
  id: CheckId
  label: string
  status: CheckStatus
  /** 측정값 한 줄 */
  value: string
  /** 통과가 아니면: 왜 문제인지 */
  cause?: string
  /** 통과가 아니면: 어떻게 고치는지 */
  fix?: string
}

export interface CheckTarget { lufs: number; tp: number }
export const STREAM_TARGET: CheckTarget = { lufs: -14, tp: -1 }

export const CHECK_LABEL: Record<CheckId, string> = {
  loudness: '음량', truePeak: '트루피크', clipping: '클리핑', dynamics: '강약(다이내믹)', mono: '모노 호환', harsh: '고음 거칠기',
}

const f1 = (v: number) => (Number.isFinite(v) ? v.toFixed(1) : '—')

/**
 * 6항목 판정. target 이 있으면 그 목표 기준(마스터링 결과 검수), 없으면 스트리밍 기준의 넓은 범위(발매 점검).
 */
export function releaseCheck(a: Analysis, target?: CheckTarget | null): CheckItem[] {
  const tg = target ?? STREAM_TARGET
  const out: CheckItem[] = []

  // 1) 음량
  {
    const v = a.integrated
    let status: CheckStatus, cause: string | undefined, fix: string | undefined
    if (!Number.isFinite(v)) { status = 'bad'; cause = '소리가 거의 없어 음량을 잴 수 없어요.'; fix = '곡 파일이 맞는지 확인해 주세요.' }
    else if (target) {
      const d = v - tg.lufs
      status = Math.abs(d) <= 1 ? 'ok' : Math.abs(d) <= 2 ? 'warn' : 'bad'
      if (status !== 'ok') {
        cause = `목표 ${tg.lufs} LUFS 보다 ${Math.abs(d).toFixed(1)}dB ${d > 0 ? '커요' : '작아요'}.`
        fix = d > 0 ? '목표 음량을 한 단계 낮추거나, 고급 마스터링에서 「자동 맞춤」을 다시 눌러 주세요.' : '곡의 강약이 커서 목표까지 못 올렸을 수 있어요. 한 단계 낮은 음량을 고르거나 고급 마스터링에서 압축을 조금 더 걸어 보세요.'
      }
    } else {
      status = v >= -16 && v <= -8 ? 'ok' : (v >= -20 && v < -16) || (v > -8 && v <= -6) ? 'warn' : 'bad'
      if (status !== 'ok') {
        cause = v > -8 ? '아주 크게 만들어져 있어요. 음원 사이트는 큰 곡을 자동으로 줄여서, 눌린 소리만 남을 수 있어요.' : '다른 곡보다 작게 들려요. 음원 사이트가 키워 주지 않는 곳도 있어요.'
        fix = v > -8 ? '간단 마스터링에서 「조용하게」나 「보통」으로 다시 만들어 보세요.' : '간단 마스터링으로 「보통」 음량에 맞춰 보세요.'
      }
    }
    out.push({ id: 'loudness', label: CHECK_LABEL.loudness, status, value: `${f1(v)} LUFS${target ? ` (목표 ${tg.lufs})` : ''}`, cause, fix })
  }

  // 2) 트루피크
  {
    const v = a.truePeak
    const status: CheckStatus = v <= tg.tp + 0.1 ? 'ok' : v <= 0 ? 'warn' : 'bad'
    out.push({
      id: 'truePeak', label: CHECK_LABEL.truePeak, status, value: `${f1(v)} dBTP (기준 ${tg.tp} 이하)`,
      ...(status !== 'ok' ? {
        cause: v > 0 ? '가장 큰 순간이 0dB 를 넘어요. MP3·AAC 로 바뀔 때 찌그러질 수 있어요.' : `가장 큰 순간이 기준(${tg.tp} dBTP)보다 높아요. 변환하면서 조금 넘칠 수 있어요.`,
        fix: '최대 피크를 -1 dBTP 로 고르거나 음량을 한 단계 낮춰 다시 마스터링해 주세요.',
      } : {}),
    })
  }

  // 3) 클리핑
  {
    const n = a.clipSamples
    const status: CheckStatus = n === 0 ? 'ok' : n <= 10 ? 'warn' : 'bad'
    out.push({
      id: 'clipping', label: CHECK_LABEL.clipping, status, value: n ? `${n}개 샘플이 끝까지 닿음` : '없음',
      ...(status !== 'ok' ? {
        cause: '소리가 끝(0dB)에 닿아 잘린 곳이 있어요. 「틱」 하는 찌그러짐으로 들릴 수 있어요.',
        fix: '마스터링을 거치면 천장 아래로 정리돼요. 이미 마스터링한 곡이면 음량을 한 단계 낮춰 다시 만들어 주세요.',
      } : {}),
    })
  }

  // 4) 강약(PLR)
  {
    const v = a.plr
    const status: CheckStatus = !Number.isFinite(v) ? 'warn' : v >= 7 ? 'ok' : v >= 5 ? 'warn' : 'bad'
    out.push({
      id: 'dynamics', label: CHECK_LABEL.dynamics, status, value: `PLR ${f1(v)} dB`,
      ...(status !== 'ok' ? {
        cause: '큰 소리와 평균 소리의 차이가 작아 납작하게 눌린 소리예요. 오래 들으면 피곤하고 타격감이 줄어요.',
        fix: '음량을 한 단계 낮춰(「보통」이나 「조용하게」) 다시 마스터링해 보세요.',
      } : {}),
    })
  }

  // 5) 모노 호환(상관도)
  {
    const v = a.correlation
    const status: CheckStatus = v >= 0.3 ? 'ok' : v >= 0 ? 'warn' : 'bad'
    out.push({
      id: 'mono', label: CHECK_LABEL.mono, status, value: `상관도 ${Number.isFinite(v) ? v.toFixed(2) : '—'}`,
      ...(status !== 'ok' ? {
        cause: v < 0 ? '왼쪽·오른쪽 소리가 서로 지워지는 쪽이에요. 폰 스피커처럼 한 개로 들으면 소리가 빠져요.' : '양옆으로 많이 퍼진 소리예요. 한 개 스피커로 들으면 일부가 약해질 수 있어요.',
        fix: '고급 마스터링에서 「소리 넓이」를 100% 이하로 줄이고 「저음 모으기」를 켜 주세요.',
      } : {}),
    })
  }

  // 6) 고음 거칠기
  {
    const h = a.harsh
    const v = h?.bulgeDb ?? NaN
    const status: CheckStatus = !h || !h.frames ? 'ok' : v <= 12.5 ? 'ok' : v <= 15 ? 'warn' : 'bad'
    out.push({
      id: 'harsh', label: CHECK_LABEL.harsh, status, value: h && h.frames ? `고역 돌출 ${f1(v)} dB` : '고역이 거의 없음',
      ...(status !== 'ok' ? {
        cause: '3~12kHz 에서 한 대역만 갑자기 솟는 쇳소리·지글거림이 들려요. AI로 만든 곡에서 자주 생겨요.',
        fix: '「AI 곡 고음 정리」를 켜고 다시 마스터링해 주세요. 그래도 거칠면 「강하게」를 골라 보세요.',
      } : {}),
    })
  }
  return out
}

export const worstStatus = (items: CheckItem[]): CheckStatus =>
  items.some(i => i.status === 'bad') ? 'bad' : items.some(i => i.status === 'warn') ? 'warn' : 'ok'

/**
 * 자동 재처리용 설정 고치기 — 통과 못 한 항목마다 한 가지씩 손본다. 바꿀 게 없으면 null.
 * 음량 목표(newTarget)가 바뀌면 호출한 쪽이 그 목표로 다시 맞춘다.
 */
export function autoFix(items: CheckItem[], p: ChainParams, target: CheckTarget, a: Analysis): { params: ChainParams; target: CheckTarget; changes: string[] } | null {
  const bad = new Set(items.filter(i => i.status !== 'ok').map(i => i.id))
  if (!bad.size) return null
  let q = structuredClone(p)
  let t = { ...target }
  const changes: string[] = []
  if (bad.has('truePeak') || bad.has('clipping')) {
    const over = Math.max(0.3, a.truePeak - target.tp)
    q.limiter = { ...q.limiter, ceiling: Math.round((q.limiter.ceiling - over - 0.2) * 10) / 10, truePeak: true }
    q.bypass = { ...q.bypass, limiter: false }
    changes.push(`천장을 ${q.limiter.ceiling} dB 로 낮춤`)
  }
  if (bad.has('dynamics')) {
    const need = Math.max(1, 7 - a.plr)
    t = { ...t, lufs: Math.round((t.lufs - need) * 10) / 10 }
    q.bypass = { ...q.bypass, clipper: true, multiband: true }
    q.comp = { ...q.comp, ratio: Math.min(q.comp.ratio, 1.6) }
    changes.push(`강약을 지키려고 목표를 ${t.lufs} LUFS 로 낮추고 압축을 풂`)
  }
  if (bad.has('mono')) {
    q.stereo = { ...q.stereo, width: Math.min(q.stereo.width, 90), bassMono: Math.max(q.stereo.bassMono, 120) }
    q.bypass = { ...q.bypass, stereo: false, imager: true }
    changes.push('양옆 넓이를 줄이고 저음을 가운데로 모음')
  }
  if (bad.has('harsh') && (q.bypass.aiclean || q.aiclean.mode !== 'strong')) {
    q = withAiClean(q, q.bypass.aiclean ? 'natural' : 'strong')
    changes.push(`AI 곡 고음 정리를 「${q.aiclean.mode === 'strong' ? '강하게' : '자연스럽게'}」로 켬`)
  }
  if (bad.has('loudness') && !changes.length) changes.push('목표 음량에 다시 맞춤')
  if (!changes.length) return null
  return { params: q, target: t, changes }
}
