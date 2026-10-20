/**
 * 마스터링 템플릿 — 장르·용도·질감.
 * 각 템플릿은 체인 전체 값과 목표 LUFS/TP, 자동 마스터링이 쓰는 「톤 목표」를 갖는다.
 * 값은 "그 장르 믹스가 보통 어떤 문제를 갖고 어떤 소리를 원하는가"에서 출발했고, why 에 한 줄로 적었다.
 */
import type { ChainParams, CompParams, SatMode } from './dsp'
import { defaultChain } from './presets'

export type TemplateCategory = 'genre' | 'use' | 'texture'

/** 자동 마스터링용 톤 목표: 1kHz 기준 기울기(dB/oct), 120Hz 아래 덧셈, 8kHz 위 덧셈 */
export interface ToneTarget { tilt: number; low: number; air: number }

export interface MasterTemplate {
  id: string
  label: string
  category: TemplateCategory
  /** 화면에 보이는 한 줄 근거 */
  why: string
  lufs: number
  tp: number
  tone: ToneTarget
  tags: string[]
  build: () => ChainParams
  /** 「이런 곡에 좋아요」 한 줄 — 화면 노출용 */
  fit?: string
  /** 허용하는 PLR(피크-음량비) 감소 dB — 없으면 plrLossOf 기본값 */
  plrLoss?: number
}

/**
 * 원본 대비 결과 PLR 감소 허용치(dB). 배경음악·클래식 계열 3, 큰 소리(-10 LUFS 이상·클럽 천장) 9, 나머지(스트리밍 등) 6.
 * 근거와 표는 docs/mastering-templates.md.
 */
export function plrLossOf(t: Pick<MasterTemplate, 'lufs' | 'tp' | 'plrLoss'>): number {
  if (t.plrLoss !== undefined) return t.plrLoss
  return t.lufs >= -10 || t.tp > -1 ? 9 : 6
}

interface Spec {
  fit?: string
  plrLoss?: number
  lufs: number
  tp?: number
  tone: ToneTarget
  /** lf, lmf, mf, hmf, hf 게인 */
  eq?: [number, number, number, number, number]
  hpf?: number
  lpf?: number
  lfFreq?: number
  lmfFreq?: number
  mfFreq?: number
  hmfFreq?: number
  comp?: Partial<CompParams>
  /** 멀티밴드 켜기 + 밴드별 [threshold, ratio] */
  mb?: [[number, number], [number, number], [number, number]]
  /** 대역별 폭 [저, 중, 고] % */
  widths?: [number, number, number]
  width?: number
  bassMono?: number
  sat?: { mode: SatMode; drive: number; mix: number }
  deess?: number
  trans?: { attack: number; sustain: number }
  clip?: { threshold: number; softness: number }
  release?: number
  /** 다이내믹 EQ: 저중역 뭉침·귀 아픈 대역 잡기 */
  dyn?: boolean
  gate?: boolean
  msSideAir?: number
}

function make(s: Spec): ChainParams {
  const c = defaultChain()
  const [lf, lmf, mf, hmf, hf] = s.eq ?? [0, 0, 0, 0, 0]
  c.eq.lf.gain = lf; c.eq.lmf.gain = lmf; c.eq.mf.gain = mf; c.eq.hmf.gain = hmf; c.eq.hf.gain = hf
  if (s.hpf !== undefined) c.eq.hpf.freq = s.hpf
  if (s.lpf) c.eq.lpf = { on: true, freq: s.lpf, slope: 12 }
  if (s.lfFreq) c.eq.lf.freq = s.lfFreq
  if (s.lmfFreq) c.eq.lmf.freq = s.lmfFreq
  if (s.mfFreq) c.eq.mf.freq = s.mfFreq
  if (s.hmfFreq) c.eq.hmf.freq = s.hmfFreq
  if (s.comp) c.comp = { ...c.comp, ...s.comp }
  if (s.mb) {
    c.bypass.multiband = false
    s.mb.forEach(([t, r], i) => { c.multiband.bands[i] = { ...c.multiband.bands[i], threshold: t, ratio: r } })
  }
  if (s.widths) { c.bypass.imager = false; c.imager.widths = [...s.widths] }
  if (s.width !== undefined) c.stereo.width = s.width
  if (s.bassMono) c.stereo.bassMono = s.bassMono
  if (s.sat) { c.bypass.saturation = false; c.saturation = { ...c.saturation, ...s.sat } }
  if (s.deess !== undefined) { c.bypass.deesser = false; c.deesser.threshold = s.deess }
  if (s.trans) { c.bypass.transient = false; c.transient = { ...c.transient, ...s.trans } }
  if (s.clip) { c.bypass.clipper = false; c.clipper = { ...c.clipper, ...s.clip } }
  if (s.release) c.limiter.release = s.release
  if (s.dyn) c.bypass.dyneq = false
  if (s.gate) c.bypass.gate = false
  if (s.msSideAir) { c.bypass.mseq = false; c.mseq.side.high.gain = s.msSideAir }
  c.limiter.ceiling = s.tp ?? -1
  // 리미터 게인은 목표 LUFS 에 대한 대략값 — 「자동 맞춤」이 곡에 맞게 다시 잰다
  c.limiter.gain = Math.max(0, Math.min(12, -14 - s.lufs + 4))
  return c
}

function T(id: string, label: string, category: TemplateCategory, why: string, tags: string[], s: Spec): MasterTemplate {
  return { id, label, category, why, lufs: s.lufs, tp: s.tp ?? -1, tone: s.tone, tags, build: () => make(s), fit: s.fit, plrLoss: s.plrLoss }
}

export const TEMPLATES: MasterTemplate[] = [
  // ───────── 장르 ─────────
  T('kpop-dance', 'K-팝 댄스', 'genre', '킥·보컬이 앞에 서고 고역이 반짝이는 큰 소리 — 멀티밴드로 저역을 묶고 클리퍼로 밀도를 올린다', ['케이팝', '아이돌', '댄스'],
    { fit: '킥과 보컬이 꽉 찬 아이돌 댄스곡, 후렴이 크게 터지는 곡에 좋아요', lufs: -9, tone: { tilt: -3.6, low: 2, air: 2 }, eq: [2, -1.5, 0, 1.5, 2.5], hpf: 28, comp: { threshold: -16, ratio: 2.5, attack: 15, release: 120 }, mb: [[-20, 2.5], [-18, 1.8], [-22, 2]], widths: [70, 105, 120], bassMono: 140, clip: { threshold: -1, softness: 30 }, deess: -26, release: 50 }),
  T('k-ballad', 'K-발라드', 'genre', '보컬 다이내믹을 살려야 하는 장르 — 느린 컴프와 부드러운 고역, 라우드니스는 여유 있게', ['발라드', '보컬'],
    { fit: '목소리 숨결이 중요한 느린 발라드에 좋아요', lufs: -12, tone: { tilt: -4.2, low: 0.5, air: 1.5 }, eq: [0.5, -1, 0, 0.8, 1.5], comp: { threshold: -22, ratio: 1.6, attack: 40, release: 300 }, deess: -28, sat: { mode: 'tapeWarm', drive: 2, mix: 30 }, release: 150 }),
  T('hiphop', '힙합', 'genre', '808·킥이 핵심 — 저역 모노와 저역 컴프로 베이스를 단단히, 중역은 보컬 자리를 비운다', ['랩', '붐뱁'],
    { fit: '808과 랩이 중심인 힙합·붐뱁에 좋아요', lufs: -9, tone: { tilt: -4.5, low: 3.5, air: 0.5 }, eq: [3, -1.5, 0, 1, 1], lfFreq: 70, comp: { threshold: -16, ratio: 3, attack: 30, release: 120 }, mb: [[-18, 3], [-18, 1.6], [-22, 1.8]], bassMono: 120, sat: { mode: 'tube', drive: 4, mix: 35 }, release: 60 }),
  T('trap', '트랩', 'genre', '서브 베이스와 하이햇이 양 끝을 차지 — 서브를 모노로 묶고 하이햇이 거칠지 않게 다이내믹 EQ', ['808', '트랩'],
    { fit: '서브 베이스가 깊고 하이햇이 빠른 트랩에 좋아요', lufs: -8.5, tone: { tilt: -4.8, low: 4, air: 1 }, eq: [3.5, -2, -0.5, 0.5, 1.5], lfFreq: 55, hpf: 22, comp: { threshold: -14, ratio: 3, attack: 25, release: 90 }, mb: [[-16, 3], [-18, 1.8], [-24, 2.5]], bassMono: 150, clip: { threshold: -1, softness: 25 }, dyn: true, release: 40 }),
  T('rnb', 'R&B', 'genre', '부드러운 저역과 매끈한 보컬 — 따뜻한 새추레이션, 고역은 날카롭지 않게 디에서', ['알앤비', '소울'],
    { fit: '부드러운 저음과 매끈한 보컬의 알앤비·소울에 좋아요', lufs: -11, tone: { tilt: -4.4, low: 2, air: 1 }, eq: [1.5, -0.5, 0, 0.5, 1.2], comp: { threshold: -20, ratio: 2, attack: 30, release: 200 }, sat: { mode: 'tapeWarm', drive: 3, mix: 35 }, deess: -27, bassMono: 110, release: 100 }),
  T('citypop', '시티팝', 'genre', '80년대 아날로그 질감 — 테이프 새추레이션과 넓은 중고역, 저역은 둥글게', ['레트로', '시티팝'],
    { fit: '아날로그 신스와 그루브 있는 베이스의 레트로 팝에 좋아요', lufs: -11, tone: { tilt: -3.8, low: 1, air: 1.5 }, eq: [1, 0.5, 0, 1, 1.5], comp: { threshold: -20, ratio: 2, attack: 25, release: 180 }, sat: { mode: 'tape', drive: 4, mix: 45 }, widths: [90, 110, 115], release: 100 }),
  T('edm-house', 'EDM · 하우스', 'genre', '킥과 신스가 꽉 찬 클럽 사운드 — 강한 저역 모노, 넓은 고역, 클리퍼+리미터로 큰 소리', ['클럽', '하우스', '일렉트로닉'],
    { fit: '킥과 신스가 꽉 찬 클럽용 댄스 음악에 좋아요', lufs: -8, tone: { tilt: -3.5, low: 2.5, air: 2.5 }, eq: [2.5, -2, 0, 1.5, 2.5], comp: { threshold: -14, ratio: 4, attack: 5, release: 80 }, mb: [[-18, 3], [-18, 2], [-22, 2]], widths: [60, 110, 130], bassMono: 150, clip: { threshold: -1.2, softness: 30 }, sat: { mode: 'clip', drive: 4, mix: 25 }, release: 40 }),
  T('techno', '테크노', 'genre', '반복되는 킥의 단단함이 생명 — 트랜지언트를 세우고 저역을 묶는다, 고역은 담백하게', ['테크노', '클럽'],
    { fit: '반복되는 킥이 단단해야 하는 테크노에 좋아요', lufs: -9, tone: { tilt: -4, low: 2.5, air: 0.5 }, eq: [2, -1.5, 0, 0.5, 0.5], comp: { threshold: -14, ratio: 3, attack: 20, release: 100 }, trans: { attack: 25, sustain: -10 }, bassMono: 160, clip: { threshold: -1, softness: 35 }, release: 50 }),
  T('rock', '록', 'genre', '기타 벽과 드럼 펀치 — 중역 밀도를 살리고 테이프로 엮어 준다', ['밴드', '록'],
    { fit: '기타와 드럼이 밀어붙이는 밴드 곡에 좋아요', lufs: -10, tone: { tilt: -3.8, low: 1, air: 1 }, eq: [1.5, -1, 0.5, 1.5, 1], comp: { threshold: -18, ratio: 3, attack: 10, release: 100 }, sat: { mode: 'tape', drive: 5, mix: 40 }, trans: { attack: 15, sustain: 0 }, release: 60 }),
  T('metal', '메탈', 'genre', '저역이 쉽게 뭉치는 고밀도 기타 — 다이내믹 EQ 로 200Hz 를, 멀티밴드로 저역을 묶는다', ['메탈', '헤비'],
    { fit: '기타가 두껍고 저음이 뭉치기 쉬운 헤비한 곡에 좋아요', lufs: -9, tone: { tilt: -3.6, low: 1.5, air: 0.5 }, eq: [1, -2, 0, 1, 0.5], hpf: 35, comp: { threshold: -16, ratio: 3, attack: 8, release: 80 }, mb: [[-20, 3], [-18, 2], [-22, 2.2]], dyn: true, release: 50 }),
  T('indie-acoustic', '인디 · 어쿠스틱', 'genre', '공간과 악기 결이 중요 — 가볍게만 누르고 여유 있는 라우드니스', ['인디', '어쿠스틱', '기타'],
    { fit: '통기타·건반 위주로 공간이 살아 있는 곡에 좋아요', lufs: -13, tone: { tilt: -4.2, low: 0, air: 1.5 }, eq: [0.5, -0.8, 0, 0.5, 1.5], comp: { threshold: -22, ratio: 1.5, attack: 40, release: 250 }, sat: { mode: 'tapeWarm', drive: 2, mix: 25 }, release: 150 }),
  T('jazz', '재즈', 'genre', '다이내믹이 표현의 일부 — 거의 누르지 않고 투명하게, 크게 만들지 않는다', ['재즈', '라이브'],
    { fit: '연주의 강약이 그대로 들려야 하는 재즈·라이브에 좋아요', plrLoss: 3, lufs: -16, tone: { tilt: -4.5, low: 0.5, air: 1 }, eq: [0.5, 0, 0, 0.3, 1], comp: { threshold: -26, ratio: 1.3, attack: 50, release: 300 }, release: 200 }),
  T('classical', '클래식 · 오케스트라', 'genre', '넓은 다이내믹 레인지 보존이 최우선 — 리니어 페이즈 EQ 로 살짝, 리미터는 피크만', ['클래식', '오케스트라'],
    { fit: '오케스트라·실내악처럼 강약 폭이 아주 큰 곡에 좋아요', plrLoss: 3, lufs: -20, tone: { tilt: -4.8, low: 0, air: 0.5 }, eq: [0, 0, 0, 0, 0.8], hpf: 20, comp: { threshold: -30, ratio: 1.2, attack: 60, release: 400 }, release: 300 }),
  T('cinematic', '영화 OST · 시네마틱', 'genre', '큰 저역과 넓은 공간 — 넓은 이미지와 부드러운 리미팅, 다이내믹 유지', ['OST', '트레일러', '시네마틱'],
    { fit: '저음이 크고 공간이 넓은 영화음악·트레일러에 좋아요', lufs: -16, tone: { tilt: -4.4, low: 2, air: 1 }, eq: [1.5, -0.5, 0, 0.5, 1], comp: { threshold: -22, ratio: 1.8, attack: 30, release: 250 }, widths: [90, 115, 125], bassMono: 90, release: 200 }),
  T('lofi', '로파이', 'genre', '일부러 흐릿한 질감 — 고역을 깎고 테이프 포화, 큰 소리는 필요 없다', ['로파이', '스터디'],
    { fit: '일부러 흐릿하고 포근하게 들려야 하는 공부용 음악에 좋아요', lufs: -13, tone: { tilt: -5.2, low: 1.5, air: -3 }, eq: [1.5, 1, 0, -2, -4], lpf: 12000, comp: { threshold: -20, ratio: 2, attack: 30, release: 200 }, sat: { mode: 'tape', drive: 8, mix: 60 }, width: 85, release: 120 }),
  T('ambient', '앰비언트', 'genre', '공간감과 잔향이 주인공 — 압축은 최소, 넓게, 조용한 목표', ['앰비언트', '명상'],
    { fit: '잔향과 공간이 주인공인 조용한 음악에 좋아요', plrLoss: 3, lufs: -18, tone: { tilt: -4.5, low: 1, air: 1.5 }, eq: [0.5, -0.5, 0, 0.5, 1.5], comp: { threshold: -28, ratio: 1.3, attack: 60, release: 400 }, widths: [90, 120, 130], release: 300 }),
  T('trot', '트로트', 'genre', '보컬과 반주가 또렷해야 하는 장르 — 중고역 존재감, 디에서로 치찰음 정리', ['트로트', '성인가요'],
    { fit: '보컬과 반주가 또렷해야 하는 트로트·성인가요에 좋아요', lufs: -10, tone: { tilt: -3.8, low: 1, air: 1 }, eq: [1, -1, 0.5, 1.5, 1], comp: { threshold: -18, ratio: 2.5, attack: 15, release: 150 }, deess: -26, sat: { mode: 'tube', drive: 3, mix: 30 }, release: 80 }),
  T('folk', '포크', 'genre', '목소리와 통기타의 자연스러움 — 따뜻하게, 압축은 가볍게', ['포크', '싱어송라이터'],
    { fit: '목소리와 통기타가 자연스러워야 하는 포크에 좋아요', lufs: -14, tone: { tilt: -4.4, low: 0.5, air: 1 }, eq: [0.5, -0.5, 0, 0.5, 1], comp: { threshold: -22, ratio: 1.6, attack: 35, release: 250 }, sat: { mode: 'tapeWarm', drive: 2, mix: 25 }, deess: -28, release: 150 }),
  T('latin', '라틴', 'genre', '퍼커션의 어택과 리듬감 — 트랜지언트를 살리고 저역은 둥글게', ['라틴', '살사'],
    { fit: '퍼커션 리듬이 살아야 하는 라틴 음악에 좋아요', lufs: -10, tone: { tilt: -3.8, low: 1.5, air: 1.5 }, eq: [1.5, -1, 0, 1, 1.5], comp: { threshold: -18, ratio: 2.5, attack: 20, release: 120 }, trans: { attack: 20, sustain: 0 }, release: 70 }),
  T('reggaeton', '레게톤', 'genre', '뎀보 리듬의 킥·스네어가 핵심 — 저역 모노와 펀치, 큰 소리', ['레게톤'],
    { fit: '킥·스네어 리듬이 반복되는 레게톤에 좋아요', lufs: -9, tone: { tilt: -4.2, low: 3, air: 1 }, eq: [2.5, -1.5, 0, 1, 1], comp: { threshold: -15, ratio: 3, attack: 20, release: 100 }, mb: [[-18, 3], [-18, 1.8], [-22, 2]], bassMono: 130, trans: { attack: 15, sustain: -5 }, release: 50 }),
  T('chiptune', '칩튠 · 게임', 'genre', '사각파 위주라 고역이 쉽게 귀를 찌른다 — 다이내믹 EQ 와 디하시로 정리', ['게임', '8비트'],
    { fit: '사각파 소리가 많은 게임·8비트 음악에 좋아요', lufs: -11, tone: { tilt: -3.6, low: 1, air: -0.5 }, eq: [1, 0, 0, -0.5, -1], comp: { threshold: -18, ratio: 2, attack: 10, release: 120 }, dyn: true, release: 80 }),
  T('vocal', '보컬 중심', 'genre', '가사 전달이 우선 — 2~4kHz 존재감, 디에서, 저역 정리', ['보컬', '가사'],
    { fit: '가사 전달이 가장 중요한 노래에 좋아요', lufs: -12, tone: { tilt: -3.8, low: 0, air: 1.5 }, eq: [0, -1.5, 0.5, 1.5, 1.5], hpf: 35, comp: { threshold: -20, ratio: 2, attack: 20, release: 180 }, deess: -27, dyn: true, release: 100 }),
  T('piano-solo', '피아노 솔로', 'genre', '한 악기의 다이내믹과 울림 — 거의 누르지 않고 저역 공명만 정리', ['피아노', '솔로'],
    { fit: '피아노 한 대의 울림과 강약을 지켜야 하는 곡에 좋아요', plrLoss: 3, lufs: -18, tone: { tilt: -4.8, low: 0, air: 0.5 }, eq: [0, -0.5, 0, 0, 0.5], hpf: 25, comp: { threshold: -28, ratio: 1.3, attack: 50, release: 350 }, release: 250 }),
  T('drama-bgm', '드라마 BGM', 'genre', '대사 아래 깔리는 음악 — 대사 대역(1~4kHz)을 비우고 조용하게', ['드라마', '배경'],
    { fit: '대사 아래에 깔리는 드라마 배경음악에 좋아요', plrLoss: 3, lufs: -18, tone: { tilt: -4.6, low: 1, air: 0 }, eq: [0.5, 0, -2, -1.5, 0], mfFreq: 1800, comp: { threshold: -22, ratio: 2, attack: 30, release: 250 }, release: 200 }),
  T('ad-jingle', '광고 징글', 'genre', '짧은 시간에 귀에 꽂혀야 함 — 밝고 촘촘하게, 작은 스피커에서도 들리게', ['광고', 'CM'],
    { fit: '짧은 시간에 귀에 꽂혀야 하는 광고 음악에 좋아요', lufs: -12, tone: { tilt: -3.4, low: 1, air: 2 }, eq: [1, -1, 0.5, 2, 2], hpf: 40, comp: { threshold: -16, ratio: 3, attack: 10, release: 80 }, sat: { mode: 'tube', drive: 3, mix: 30 }, release: 50 }),
  T('pop', '팝', 'genre', '보컬과 비트의 균형 — 무난하게 밝고 단단하게', ['팝'],
    { fit: '보컬과 비트가 고르게 나와야 하는 팝 전반에 좋아요', lufs: -10, tone: { tilt: -3.8, low: 1.5, air: 1.5 }, eq: [1, -1, 0, 1, 2], comp: { threshold: -20, ratio: 2.5, attack: 15, release: 150 }, mb: [[-20, 2], [-18, 1.6], [-22, 1.8]], width: 110, release: 70 }),

  // ───────── 용도 ─────────
  T('use-stream', '스트리밍', 'use', '플랫폼이 -14 LUFS 로 낮춰 재생 — 더 크게 만들 이유가 없어 다이내믹을 남긴다', ['음원', '스트리밍'],
    { fit: '음원 사이트에 올릴 곡에 좋아요', lufs: -14, tone: { tilt: -4, low: 1, air: 1 }, comp: { threshold: -20, ratio: 2, attack: 20, release: 200 } }),
  T('use-video', '동영상 플랫폼', 'use', '-14 LUFS 정규화 + 노트북·폰 스피커 재생이 많다 — 중역 존재감 조금', ['유튜브', '영상'],
    { fit: '영상 플랫폼에 올리는 뮤직비디오·영상에 좋아요', lufs: -14, tone: { tilt: -3.8, low: 0.5, air: 1 }, eq: [0.5, -0.5, 0.5, 1, 1], comp: { threshold: -20, ratio: 2, attack: 20, release: 180 } }),
  T('use-broadcast', '방송', 'use', '방송 기준 -23 LUFS — 대사와 섞일 전제라 압축은 가볍게, 피크 -2dBTP 여유', ['TV', '라디오'],
    { fit: 'TV·라디오 방송 납품용에 좋아요', plrLoss: 3, lufs: -23, tp: -2, tone: { tilt: -4.2, low: 0, air: 0.5 }, eq: [0, 0, -1.5, -0.5, 0], mfFreq: 2000, comp: { threshold: -26, ratio: 1.8, attack: 30, release: 250 } }),
  T('use-podcast', '팟캐스트 · 보이스', 'use', '말소리 명료도 우선 — 저역 정리, 디에서, 게이트로 숨소리 줄이기, -16 LUFS', ['팟캐스트', '내레이션', '보이스'],
    { fit: '말소리가 중심인 팟캐스트·내레이션에 좋아요', lufs: -16, tone: { tilt: -3.6, low: -2, air: 1 }, eq: [-1, -1.5, 0.5, 2, 1], hpf: 80, comp: { threshold: -22, ratio: 3, attack: 10, release: 150 }, deess: -26, gate: true, width: 60 }),
  T('use-club', '클럽 · DJ', 'use', '큰 시스템에서 연속 재생 — 저역 모노 필수, 큰 소리, 피크는 -0.3', ['클럽', 'DJ'],
    { fit: '클럽·DJ 세트에서 틀 곡에 좋아요', lufs: -8, tp: -0.3, tone: { tilt: -3.6, low: 3, air: 1.5 }, eq: [2, -1.5, 0, 1, 1.5], comp: { threshold: -14, ratio: 3, attack: 10, release: 80 }, mb: [[-18, 3], [-18, 2], [-22, 2]], bassMono: 160, clip: { threshold: -1, softness: 30 }, release: 40 }),
  T('use-cd', 'CD · 음반', 'use', 'CD 는 정규화가 없다 — 앨범 안에서 크게, 피크는 디지털 앨범과 같이 -1dBTP', ['CD', '음반'],
    { fit: 'CD·디지털 앨범에 담을 곡에 좋아요', lufs: -9, tone: { tilt: -3.8, low: 1.5, air: 1.5 }, eq: [1, -1, 0, 1, 1.5], comp: { threshold: -16, ratio: 2.5, attack: 15, release: 120 }, mb: [[-20, 2], [-18, 1.6], [-22, 1.8]], release: 60 }),
  T('use-shorts', '쇼츠 · 릴스 (폰 스피커)', 'use', '폰 스피커는 150Hz 아래가 안 나온다 — 저역을 배음으로 옮기고 중역을 올린다', ['쇼츠', '릴스', '모바일'],
    { fit: '폰 스피커로 듣는 짧은 영상에 좋아요', lufs: -12, tone: { tilt: -3.2, low: -2, air: 1 }, eq: [-1, 1, 1, 2, 1], hpf: 60, lmfFreq: 300, comp: { threshold: -16, ratio: 3, attack: 10, release: 100 }, sat: { mode: 'transformer', drive: 8, mix: 50 }, width: 80, release: 50 }),
  T('use-bgm', '영상 배경음악', 'use', '내레이션 밑에 깔린다 — 말소리 대역을 비우고 -20 LUFS 로 조용히', ['BGM', '배경음악'],
    { fit: '내레이션이나 대사 밑에 깔리는 배경음악에 좋아요', plrLoss: 3, lufs: -20, tp: -2, tone: { tilt: -4.6, low: 1, air: 0 }, eq: [0.5, 0, -2, -1.5, 0], mfFreq: 2000, comp: { threshold: -24, ratio: 2, attack: 30, release: 250 }, release: 200 }),

  // ───────── 질감 ─────────
  T('tex-warm', '따뜻하게', 'texture', '저중역을 살짝 두껍게, 고역은 둥글게 — 테이프 엠퍼시스로 고역 왜곡을 줄인다', ['따뜻함'],
    { fit: '차갑거나 날카롭게 들리는 곡에 좋아요', lufs: -12, tone: { tilt: -4.6, low: 1.5, air: -0.5 }, eq: [1.5, 1, 0, -0.5, -1.5], sat: { mode: 'tapeWarm', drive: 5, mix: 50 }, comp: { threshold: -20, ratio: 2, attack: 30, release: 200 } }),
  T('tex-bright', '밝게', 'texture', '고역 공기감과 존재감 — 셸프로 위를 열고 디에서로 치찰음은 막는다', ['밝음', '선명'],
    { fit: '답답하고 어둡게 들리는 곡에 좋아요', lufs: -12, tone: { tilt: -3.4, low: 0, air: 2.5 }, eq: [0, -1, 0, 1.5, 3], deess: -27, msSideAir: 1.5 }),
  T('tex-punch', '펀치감', 'texture', '킥·스네어 어택을 세운다 — 트랜지언트 셰이퍼 + 느린 어택 컴프', ['펀치', '타격감'],
    { fit: '드럼이 묻혀 힘이 없는 곡에 좋아요', lufs: -11, tone: { tilt: -4, low: 1.5, air: 1 }, eq: [2, 1, 0, 1, 0.5], trans: { attack: 35, sustain: -10 }, comp: { threshold: -18, ratio: 3, attack: 40, release: 120 } }),
  T('tex-wide', '넓게', 'texture', '저역은 모노로 지키고 중고역만 넓힌다 — 위상 문제 없이 넓은 이미지', ['넓음', '공간'],
    { fit: '소리가 가운데로 몰려 좁게 들리는 곡에 좋아요', lufs: -12, tone: { tilt: -4, low: 1, air: 1.5 }, widths: [60, 120, 140], bassMono: 120, msSideAir: 2 }),
  T('tex-vintage', '빈티지', 'texture', '테이프·진공관의 배음과 깎인 양 끝 — 오래된 레코드의 질감', ['빈티지', '레트로'],
    { fit: '오래된 레코드 같은 질감을 원하는 곡에 좋아요', lufs: -13, tone: { tilt: -5, low: 0.5, air: -2 }, eq: [1, 1, 0.5, 0, -2], hpf: 40, lpf: 14000, sat: { mode: 'triode', drive: 7, mix: 55 }, width: 85 }),
  T('tex-clean', '깨끗하게', 'texture', '색을 입히지 않고 정리만 — 리니어 페이즈 EQ, 가벼운 압축, 새추레이션 없음', ['투명', '깨끗함'],
    { fit: '색을 입히지 않고 정리만 하고 싶은 곡에 좋아요', lufs: -14, tone: { tilt: -4, low: 0.5, air: 1 }, eq: [0, -1, 0, 0, 0.5], comp: { threshold: -24, ratio: 1.5, attack: 30, release: 200 } }),
]

// 깨끗하게·클래식은 리니어 페이즈로
for (const id of ['tex-clean', 'classical']) {
  const t = TEMPLATES.find(x => x.id === id)!
  const base = t.build
  t.build = () => { const c = base(); c.eq.mode = 'linear'; return c }
}

export function buildTemplate(id: string): ChainParams | null {
  return TEMPLATES.find(t => t.id === id)?.build() ?? null
}

export const TEMPLATE_CATEGORY_LABEL: Record<TemplateCategory, string> = { genre: '장르', use: '용도', texture: '질감' }
