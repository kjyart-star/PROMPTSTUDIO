/**
 * 간단 모드의 3단계 선택(용도 → 장르 → 느낌)을 하나의 체인으로 합친다.
 *  - 장르가 있으면 장르 템플릿의 체인이 바탕, 없으면 용도 템플릿, 둘 다 없으면 기본 체인
 *  - 용도는 목표 음량·천장과 용도 특유의 처리(폰 스피커 저역 배음, 대사 자리 비우기 등)를 얹는다
 *  - 느낌(질감)은 톤·새추레이션·폭을 조금 더한다
 * 화면에 보일 쉬운 설명과 전후 변화 막대 값도 여기서 만든다.
 */
import { MATCH_FREQS, type ChainParams } from './dsp'
import { defaultChain } from './presets'
import { TEMPLATES, type MasterTemplate, type ToneTarget } from './templates'
import { normalizeBands, type Analysis } from './analyze'
import { toneTargetDb } from './automaster'

export type UseId = 'use-stream' | 'use-video' | 'use-broadcast' | 'use-podcast' | 'use-club' | 'use-cd' | 'use-shorts' | 'use-bgm'
export type TextureId = 'none' | 'tex-warm' | 'tex-bright' | 'tex-punch' | 'tex-wide' | 'tex-vintage' | 'tex-clean'

export interface Choice { use: UseId | null; genre: string | null; texture: TextureId | null }

/** 용도 카드 — 쉬운 이름과 목표 음량을 말로 */
export const USE_CARDS: { id: UseId; title: string; loud: string; plain: string; image: string }[] = [
  { id: 'use-stream', title: '음원 스트리밍', loud: '일반 스트리밍 크기', plain: '음원 사이트에서 다른 곡과 비슷한 크기로 들려요', image: 'use-stream' },
  { id: 'use-video', title: '동영상 플랫폼', loud: '일반 스트리밍 크기', plain: '노트북·폰 스피커에서도 또렷하게 들리게 맞춰요', image: 'use-video' },
  { id: 'use-broadcast', title: 'TV · 라디오 방송', loud: '방송 기준의 조용한 크기', plain: '방송 규정 음량에 맞춰 여유 있게 담아요', image: 'use-broadcast' },
  { id: 'use-podcast', title: '팟캐스트 · 보이스', loud: '말소리가 편한 크기', plain: '목소리가 또렷하고 숨소리·웅웅거림은 줄여요', image: 'use-podcast' },
  { id: 'use-club', title: '클럽 · DJ', loud: '아주 크게', plain: '큰 스피커에서 저음이 단단하고 크게 울려요', image: 'use-club' },
  { id: 'use-cd', title: 'CD · 음반', loud: '크게', plain: '음반에 담을 때처럼 꽉 차게 키워요', image: 'use-cd' },
  { id: 'use-shorts', title: '쇼츠 · 릴스', loud: '폰에서 잘 들리는 크기', plain: '폰 스피커에서도 저음이 느껴지고 소리가 앞으로 나와요', image: 'use-shorts' },
  { id: 'use-bgm', title: '영상 배경음악', loud: '내레이션 밑에 깔리는 크기', plain: '말소리가 묻히지 않게 가운데 소리를 비워 둬요', image: 'use-bgm' },
]

export interface GenreGroup { id: string; title: string; image: string; genres: string[] }
export const GENRE_GROUPS: GenreGroup[] = [
  { id: 'pop', title: '팝 · K팝', image: 'genre-pop', genres: ['pop', 'kpop-dance', 'k-ballad', 'citypop', 'vocal'] },
  { id: 'hiphop', title: '힙합 · R&B', image: 'genre-hiphop', genres: ['hiphop', 'trap', 'rnb', 'reggaeton'] },
  { id: 'electronic', title: '전자 음악', image: 'genre-electronic', genres: ['edm-house', 'techno', 'lofi', 'ambient', 'chiptune'] },
  { id: 'rock', title: '록 · 밴드', image: 'genre-rock', genres: ['rock', 'metal'] },
  { id: 'acoustic', title: '어쿠스틱 · 재즈', image: 'genre-acoustic', genres: ['indie-acoustic', 'folk', 'jazz', 'piano-solo'] },
  { id: 'classical', title: '클래식 · OST', image: 'genre-classical', genres: ['classical', 'cinematic', 'drama-bgm'] },
  { id: 'other', title: '기타', image: 'genre-other', genres: ['trot', 'latin', 'ad-jingle'] },
]

/** 장르 한 줄 결과 설명 */
export const GENRE_PLAIN: Record<string, string> = {
  'pop': '보컬과 비트가 고르게 앞으로 나오고 밝아져요',
  'kpop-dance': '소리가 크고 꽉 차며 킥과 보컬이 앞에 서요',
  'k-ballad': '목소리의 숨결을 살리고 부드럽게 커져요',
  'citypop': '아날로그 테이프 같은 따뜻함과 넓은 공간감이 생겨요',
  'vocal': '가사가 또렷하게 들리고 치찰음은 부드러워요',
  'hiphop': '저음이 단단해지고 랩이 앞으로 나와요',
  'trap': '서브 베이스가 묵직해지고 하이햇은 거칠지 않게 정리돼요',
  'rnb': '저음이 부드럽고 보컬이 매끈해져요',
  'reggaeton': '킥·스네어 리듬이 또렷하고 크게 들려요',
  'edm-house': '클럽처럼 크고 넓으며 저음이 한가운데에 모여요',
  'techno': '반복되는 킥이 단단하게 서요',
  'lofi': '고음을 살짝 깎아 흐릿하고 포근한 느낌이 나요',
  'ambient': '공간감을 넓게 살리고 조용하게 둬요',
  'chiptune': '귀를 찌르는 고음을 정리해 오래 들어도 편해요',
  'rock': '기타 벽과 드럼 타격감이 살아나요',
  'metal': '뭉치기 쉬운 저음을 정리해 무겁지만 또렷해요',
  'indie-acoustic': '악기 결과 공간을 그대로 두고 살짝만 다듬어요',
  'folk': '목소리와 통기타가 자연스럽고 따뜻해져요',
  'jazz': '연주의 강약을 살리고 거의 누르지 않아요',
  'piano-solo': '피아노의 울림과 강약을 그대로 둬요',
  'classical': '오케스트라의 큰 강약을 지키며 피크만 막아요',
  'cinematic': '큰 저음과 넓은 공간을 살려 영화처럼 들려요',
  'drama-bgm': '대사가 들어갈 자리를 비우고 조용히 깔아요',
  'trot': '보컬과 반주가 또렷하고 반짝여요',
  'latin': '퍼커션 리듬이 살아나요',
  'ad-jingle': '짧은 시간에 귀에 꽂히게 밝고 촘촘해져요',
}

export const TEXTURE_CARDS: { id: TextureId; title: string; plain: string; image: string }[] = [
  { id: 'none', title: '그대로', plain: '장르·용도에 맞춘 소리를 그대로 써요', image: 'tex-none' },
  { id: 'tex-warm', title: '따뜻하게', plain: '저음이 살짝 두꺼워지고 고음이 둥글어져요', image: 'tex-warm' },
  { id: 'tex-bright', title: '밝게', plain: '고음이 열리고 공기감이 생겨요', image: 'tex-bright' },
  { id: 'tex-punch', title: '펀치감', plain: '킥·스네어가 앞으로 튀어나와요', image: 'tex-punch' },
  { id: 'tex-wide', title: '넓게', plain: '저음은 가운데 두고 양옆이 넓어져요', image: 'tex-wide' },
  { id: 'tex-vintage', title: '빈티지', plain: '오래된 레코드처럼 따뜻하고 살짝 흐릿해져요', image: 'tex-vintage' },
  { id: 'tex-clean', title: '깨끗하게', plain: '색을 입히지 않고 정리만 해요', image: 'tex-clean' },
]

export const imageSrc = (name: string) => `/mastering/cards/${name}.webp`

const byId = (id: string | null) => (id ? TEMPLATES.find(t => t.id === id) ?? null : null)

/** 용도별로 장르 체인 위에 얹는 처리 */
function applyUse(c: ChainParams, use: UseId) {
  switch (use) {
    case 'use-podcast':
      c.eq.hpf = { ...c.eq.hpf, on: true, freq: Math.max(c.eq.hpf.freq, 80) }
      c.bypass.deesser = false; c.bypass.gate = false
      break
    case 'use-shorts':
      c.eq.hpf = { ...c.eq.hpf, on: true, freq: Math.max(c.eq.hpf.freq, 60) }
      c.bypass.saturation = false
      c.saturation = { ...c.saturation, mode: 'transformer', drive: Math.max(c.saturation.drive, 6), mix: Math.max(c.saturation.mix, 40) }
      c.eq.hmf = { ...c.eq.hmf, on: true, gain: Math.min(4, c.eq.hmf.gain + 1) }
      break
    case 'use-bgm':
    case 'use-broadcast':
      if (use === 'use-bgm') c.eq.mf = { ...c.eq.mf, on: true, freq: 2000, gain: Math.min(c.eq.mf.gain, -2) }
      break
    case 'use-club':
      c.stereo.bassMono = Math.max(c.stereo.bassMono, 150)
      break
  }
}

/** 느낌(질감)을 더한다 — 장르 값에 상대적으로 */
function applyTexture(c: ChainParams, tex: TextureId) {
  const add = (k: 'lf' | 'lmf' | 'mf' | 'hmf' | 'hf', d: number) => { Object.assign(c.eq[k], { on: true, gain: Math.max(-8, Math.min(8, Math.round((c.eq[k].gain + d) * 10) / 10)) }) }
  switch (tex) {
    case 'tex-warm':
      add('lf', 1); add('lmf', 0.8); add('hf', -1.5)
      c.bypass.saturation = false; c.saturation = { ...c.saturation, mode: 'tapeWarm', drive: Math.max(c.saturation.drive, 4), mix: Math.max(c.saturation.mix, 40) }
      break
    case 'tex-bright':
      add('hmf', 1); add('hf', 2); c.bypass.deesser = false
      break
    case 'tex-punch':
      c.bypass.transient = false; c.transient = { ...c.transient, attack: Math.max(c.transient.attack, 30), sustain: Math.min(c.transient.sustain, -10) }
      c.comp = { ...c.comp, attack: Math.max(c.comp.attack, 35) }
      break
    case 'tex-wide':
      c.bypass.imager = false; c.imager.widths = [Math.min(c.imager.widths[0], 70), Math.max(c.imager.widths[1], 115), Math.max(c.imager.widths[2], 135)]
      c.stereo.bassMono = Math.max(c.stereo.bassMono, 120)
      break
    case 'tex-vintage':
      add('hf', -2); add('lmf', 0.8)
      c.eq.hpf = { ...c.eq.hpf, on: true, freq: Math.max(c.eq.hpf.freq, 40) }
      c.eq.lpf = { on: true, freq: 14000, slope: 12 }
      c.bypass.saturation = false; c.saturation = { ...c.saturation, mode: 'triode', drive: Math.max(c.saturation.drive, 6), mix: Math.max(c.saturation.mix, 50) }
      c.stereo.width = Math.min(c.stereo.width, 88)
      break
    case 'tex-clean':
      c.bypass.saturation = true; c.eq.mode = 'linear'
      c.comp = { ...c.comp, ratio: Math.min(c.comp.ratio, 1.6) }
      break
  }
}

function textureTone(t: ToneTarget, tex: TextureId | null): ToneTarget {
  switch (tex) {
    case 'tex-warm': return { ...t, low: t.low + 0.5, air: t.air - 1 }
    case 'tex-bright': return { ...t, air: t.air + 1.5, tilt: t.tilt + 0.3 }
    case 'tex-vintage': return { ...t, air: t.air - 2 }
    default: return t
  }
}

/** 고른 조합을 템플릿 한 개처럼 만든다 (자동 마스터링이 그대로 받는다) */
export function composeChoice(ch: Choice): MasterTemplate {
  const use = byId(ch.use), genre = byId(ch.genre)
  const tex = ch.texture && ch.texture !== 'none' ? ch.texture : null
  const lufs = use?.lufs ?? genre?.lufs ?? -14
  const tp = use?.tp ?? genre?.tp ?? -1
  const tone = textureTone(genre?.tone ?? use?.tone ?? { tilt: -4, low: 1, air: 1 }, tex)
  const label = [use && USE_CARDS.find(u => u.id === ch.use)?.title, genre?.label, tex && TEXTURE_CARDS.find(t => t.id === tex)?.title].filter(Boolean).join(' · ') || '기본'
  return {
    id: `combo:${ch.use ?? '-'}:${ch.genre ?? '-'}:${ch.texture ?? '-'}`,
    label, category: 'genre', why: label, lufs, tp, tone, tags: [],
    build: () => {
      const c = genre ? genre.build() : use ? use.build() : defaultChain()
      if (use && genre) applyUse(c, ch.use!)
      if (tex) applyTexture(c, tex)
      c.limiter.ceiling = tp
      return c
    },
  }
}

/** 전후 변화 막대 값: 음량(dB)·밝기(dB)·폭(%) — 원곡 분석이 있으면 음량은 실제 차이 */
export function changeBars(tpl: MasterTemplate, src?: Analysis | null) {
  const c = tpl.build()
  const loud = src && Number.isFinite(src.integrated) ? tpl.lufs - src.integrated : tpl.lufs + 14
  const eqOn = !c.bypass.eq
  const bright = eqOn ? (c.eq.hmf.gain + c.eq.hf.gain) / 2 + (c.bypass.mseq ? 0 : c.mseq.side.high.gain / 2) : 0
  const w = (c.bypass.stereo ? 100 : c.stereo.width) * (c.bypass.imager ? 1 : (c.imager.widths[1] + c.imager.widths[2]) / 200)
  return { loud: Math.round(loud * 10) / 10, bright: Math.round(bright * 10) / 10, width: Math.round(w - 100) }
}

/** 곡 분석으로 장르 1~3개 추천 — 스펙트럼 모양이 장르 톤 목표에 가깝고, 눌린 정도(크레스트)가 장르 음량대와 맞는 순 */
export function recommendGenres(a: Analysis, n = 3): { id: string; score: number }[] {
  const src = normalizeBands(a.bands)
  const idx = MATCH_FREQS.map((f, i) => i).filter(i => MATCH_FREQS[i] >= 40 && MATCH_FREQS[i] <= 14000)
  const out = TEMPLATES.filter(t => t.category === 'genre').map(t => {
    const tgt = normalizeBands(MATCH_FREQS.map(f => toneTargetDb(t.tone, f)))
    let e = 0
    for (const i of idx) e += (src[i] - tgt[i]) ** 2
    const shape = Math.sqrt(e / idx.length)
    // 크게 만드는 장르일수록 원곡도 덜 출렁이는(크레스트 작은) 경향
    const crestExp = 8 + Math.max(0, -t.lufs - 8) * 0.7
    const dyn = Math.abs(a.crest - crestExp) * 0.35
    return { id: t.id, score: shape + dyn }
  })
  return out.sort((x, y) => x.score - y.score).slice(0, n)
}

/** 지금 라우드니스를 쉬운 말로 */
export function loudnessWords(now: number, target: number): { text: string; tone: 'ok' | 'low' | 'high' } {
  if (!Number.isFinite(now)) return { text: '재생하면 재요', tone: 'low' }
  const d = now - target
  if (Math.abs(d) <= 1) return { text: '적당해요', tone: 'ok' }
  if (d < -3) return { text: '많이 작아요', tone: 'low' }
  if (d < 0) return { text: '조금 작아요', tone: 'low' }
  if (d > 3) return { text: '많이 커요', tone: 'high' }
  return { text: '조금 커요', tone: 'high' }
}

export const templatePlain = (id: string) =>
  GENRE_PLAIN[id] ?? USE_CARDS.find(u => u.id === id)?.plain ?? TEXTURE_CARDS.find(t => t.id === id)?.plain ?? ''
