/**
 * 모듈 패널의 짧은 도움말 · 위험값 규칙.
 * 「무엇을」「언제」「추천 시작값」은 사용 설명서(helpContent.ts)의 모듈 항목을 그대로 가져다 쓴다 — 설명서와 뜻이 어긋나지 않게.
 */
import type { ChainParams, SlotId } from '@/lib/mastering/dsp'
import { MODULE_HELP, moduleRecommend } from './helpContent'

/** 흔한 실수 한 가지 */
const MISTAKE: Record<SlotId, string> = {
  gate: '기준을 너무 높이면 노래 끝 울림까지 뚝 끊겨요.',
  eq: '한 대역을 6 dB 넘게 크게 올리면 소리가 부자연스러워져요. 보통 ±3 dB 안에서 조절해요.',
  mseq: '양옆 저음을 크게 올리면 모노로 들을 때 저음이 사라져요.',
  dyneq: '기준을 너무 낮추면 늘 깎여서 일반 EQ 처럼 돼 버려요.',
  deesser: '줄이는 양을 크게 하면 발음이 「흐」처럼 뭉개져요.',
  match: '강도를 100%로 두면 원곡 개성이 사라질 수 있어요.',
  comp: '비율을 8:1 이상으로 세게 걸면 강약이 사라지고 숨이 막힌 소리가 돼요.',
  multiband: '세 대역을 모두 세게 누르면 소리가 납작해져요.',
  transient: '어택을 너무 올리면 드럼이 찰싹거리고 피크가 커져요.',
  imager: '저역 폭을 넓히면 저음이 흔들리고 모노에서 약해져요.',
  stereo: '폭을 150% 넘게 넓히면 가운데 보컬이 얇아지고 모노에서 소리가 빠져요.',
  saturation: '드라이브를 12 dB 넘게 올리면 거칠게 찌그러져요.',
  clipper: '기준을 -3 dB 아래로 낮추면 소리가 뭉개져요.',
  limiter: '천장을 0 dB 가까이 두면 변환 뒤 찌그러질 수 있어요. -1 dB 이 안전해요.',
}

export interface ModuleHelpItems { what: string; when: string; start: string; mistake: string }

export function moduleHelp(slot: SlotId): ModuleHelpItems {
  const h = MODULE_HELP.find(x => x.slot === slot)
  return { what: h?.what ?? '', when: h?.when ?? '', start: moduleRecommend(slot), mistake: MISTAKE[slot] }
}

/** 위험값이면 안전한 추천값을 돌려준다(아니면 null) */
export function dangerFix(path: string, value: unknown, p: ChainParams): { why: string; fix: number } | null {
  const v = Number(value)
  if (path === 'limiter.ceiling' && v > -0.1) return { why: '천장이 0 dB 에 너무 가까워요', fix: -1 }
  if (path === 'comp.ratio' && v >= 8) return { why: '압축 비율이 아주 세요', fix: 4 }
  if (/^eq\.\w+\.gain$/.test(path) && Math.abs(v) > 6) return { why: '한 대역을 6 dB 넘게 바꿨어요', fix: Math.sign(v) * 3 }
  if (path === 'saturation.drive' && v > 12) return { why: '드라이브가 너무 세요', fix: 6 }
  if (path === 'clipper.threshold' && !p.bypass.clipper && v < -3) return { why: '깎기 시작점이 너무 낮아요', fix: -1 }
  if ((path === 'stereo.width' || /^imager\.widths\.\d$/.test(path)) && v > 150) return { why: '너무 넓어 모노에서 소리가 빠질 수 있어요', fix: 120 }
  return null
}
