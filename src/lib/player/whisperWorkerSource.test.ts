import { describe, it, expect } from 'vitest'
import { WHISPER_CORE_SRC, whisperWorkerScript } from './whisperWorkerSource'

const core = new Function(WHISPER_CORE_SRC + '\nreturn { dtwStarts, medianFilter, matchLineIndex, diceSim };')() as {
  matchLineIndex: (text: string, lines: string[], expected: number) => { k: number; score: number }
  diceSim: (a: string, b: string) => number
  dtwStarts: (cost: Float32Array, T: number, F: number) => number[]
  medianFilter: (row: Float32Array, w: number) => Float32Array
}

describe('워커 코어', () => {
  it('DTW: 토큰이 프레임 순서대로 하나씩 이어지면 그 프레임에서 시작한다', () => {
    // 토큰 i 가 프레임 [i*10, i*10+10) 에 어텐션이 몰린 비용 행렬(낮을수록 좋음)
    const T = 4, F = 40, cost = new Float32Array(T * F).fill(1)
    for (let t = 0; t < T; t++) for (let f = t * 10; f < t * 10 + 10; f++) cost[t * F + f] = -1
    expect(core.dtwStarts(cost, T, F)).toEqual([0, 10, 20, 30])
  })
  it('DTW: 앞 프레임이 비어(전주) 있으면 첫 토큰이 그 뒤에서 시작한다', () => {
    const T = 2, F = 30, cost = new Float32Array(T * F).fill(1)
    for (let f = 12; f < 20; f++) cost[0 * F + f] = -1
    for (let f = 20; f < 30; f++) cost[1 * F + f] = -1
    const s = core.dtwStarts(cost, T, F)
    expect(s[1]).toBe(20)
    expect(s[0]).toBeGreaterThanOrEqual(0)
    expect(s[0]).toBeLessThan(s[1])
  })
  it('중앙값 필터가 튀는 값을 없앤다', () => {
    const r = core.medianFilter(new Float32Array([1, 1, 9, 1, 1, 1, 1]), 3)
    expect(Array.from(r)).toEqual([1, 1, 1, 1, 1, 1, 1])
  })
  it('줄 따라가기: 다음 창은 앞에서 맞춘 줄 1초 앞에서 열고, 그 줄을 기준으로 맨 앞에 다시 넣는다', async () => {
    // 가짜 정렬: 줄 k 의 실제 시작은 truth[k]. 창 밖이면 창 끝에 몰린 것으로 돌려준다
    const truth = [3, 9, 15, 21, 27, 40, 46, 52, 58, 64, 75, 81]
    const SRATE = 16000, total = 100
    const calls: { a: number; seq: number[] }[] = []
    const fake = async (_asr: unknown, _T: unknown, _s: unknown, a: number, b: number, seq: number[][]) => {
      calls.push({ a: a / SRATE, seq: seq.map((x) => x[0]) })
      const len = (b - a) / SRATE
      return seq.map((x) => (x[0] < 0 ? 0 : Math.min(len, Math.max(0, truth[x[0]] - a / SRATE))))
    }
    const run = new Function('fake', WHISPER_CORE_SRC + '\nalignWindow = fake; return forcedAlign;')(fake) as (...a: unknown[]) => Promise<number[]>
    const asr = { tokenizer: { encode: (s: string) => (s.includes('\u266a') ? [-1] : [Number(s.trim())]) } }
    const res = await run(asr, null, new Float32Array(total * SRATE), truth.map((_, k) => String(k)), null, null)
    expect(res).toEqual(truth)
    for (let c = 1; c < calls.length; c++) {
      const anchor = calls[c].seq[1]
      expect(calls[c].a).toBeCloseTo(truth[anchor] - 1, 5)
      expect(calls[c].seq[0]).toBe(-1) // 맨 앞 음표 토큰
      expect(calls[c].seq.filter((_, k) => k % 2 === 0).every((v) => v === -1)).toBe(true) // 줄 사이마다 음표 토큰
    }
  })
  it('줄 찾기: 받아쓴 글과 가장 비슷한 줄을 고르고, 후렴이 반복되면 재생 위치 비례 줄을 고른다', () => {
    const lines = ['아침 해가 떠오르면', '너를 만나러 갈게', '바람이 불어오는 길', '후렴은 사랑이야 영원히', '다른 노래가 흐르고', '후렴은 사랑이야 영원히', '마지막 인사를 건네']
    expect(core.matchLineIndex('바람이 불어 오는 길', lines, 0).k).toBe(2)
    expect(core.matchLineIndex('후렴은 사랑이야 영원히', lines, 5).k).toBe(5)
    expect(core.matchLineIndex('후렴은 사랑이야 영원히', lines, 1).k).toBe(3)
    expect(core.matchLineIndex('zzz qqq', lines, 2).score).toBeLessThan(0.3)
    expect(core.matchLineIndex('', lines, 2).score).toBe(0)
  })
  it('재생 위치부터: 받아쓰기로 찾은 줄 k 부터 맞추고 부분 결과를 내보낸 뒤 앞쪽 줄을 곡 처음부터 채운다', async () => {
    const truth = [3, 9, 15, 21, 27, 40, 46, 52, 58, 64, 75, 81]
    const SRATE = 16000, total = 100
    const fake = async (_a: unknown, _T: unknown, _s: unknown, a: number, b: number, seq: number[][]) => {
      const len = (b - a) / SRATE
      return seq.map((x) => (x[0] < 0 ? 0 : Math.min(len, Math.max(0, truth[x[0]] - a / SRATE))))
    }
    const lineTexts = ['아침 해가 떠오르면', '너를 만나러 갈게', '바람이 불어오는 길', '꽃잎이 흩날리는 밤', '별빛 아래 우리 둘이', '파도 소리 들려오고', '먼 바다로 떠나가는', '노을이 지는 언덕에', '손을 잡고 걸어가요', '끝나지 않는 이야기', '마지막 인사를 건네', '안녕 또 만나요']
    const run = new Function('fake', WHISPER_CORE_SRC + '\nalignWindow = fake; return alignFrom;')(fake) as (...a: unknown[]) => Promise<(number | null)[]>
    const idOf = new Map(lineTexts.map((t, i) => [t, i]))
    const asr = Object.assign(async () => ({ text: lineTexts[5] + ' ' + lineTexts[6] }), {
      tokenizer: { encode: (s: string) => (s.includes('\u266a') ? [-1] : [idOf.get(s.trim()) as number]) },
    })
    const partials: (number | null)[][] = []
    const res = await run(asr, null, new Float32Array(total * SRATE), lineTexts, null, 41, null, (p: (number | null)[]) => partials.push(p))
    expect(res).toEqual(truth)
    expect(partials.length).toBeGreaterThan(1)
    expect(partials[0].slice(0, 5).every((v) => v === null)).toBe(true) // 첫 부분 결과는 k 부터만 안다
    expect(partials[0][5]).toBe(40)
  })
  it('재생 위치가 3초 미만이면 받아쓰기 없이 처음부터 맞춘다', async () => {
    const calls: number[] = []
    const fake = async (_a: unknown, _T: unknown, _s: unknown, a: number, _b: number, seq: number[][]) => { calls.push(a); return seq.map(() => 0) }
    const run = new Function('fake', WHISPER_CORE_SRC + '\nalignWindow = fake; return alignFrom;')(fake) as (...a: unknown[]) => Promise<unknown>
    const asr = Object.assign(async () => { throw new Error('받아쓰기를 부르면 안 됨') }, { tokenizer: { encode: () => [1] } })
    await run(asr, null, new Float32Array(30 * 16000), ['가나다라', '마바사아'], null, 2, null, null)
    expect(calls[0]).toBe(0)
  })
  it('워커 완성 소스에 모델·CDN 주소가 박히고 백틱이 없다', () => {
    const src = whisperWorkerScript()
    expect(src).toContain('whisper-small_timestamped')
    expect(src).toContain('cdn.jsdelivr.net')
    expect(src).not.toContain('${')
  })
})
