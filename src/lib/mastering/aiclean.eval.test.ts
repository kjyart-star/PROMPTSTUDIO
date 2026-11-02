/**
 * AI 곡 고음 정리 — 실제 곡으로 처리 전후 수치·스펙트로그램 비교(수동 실행).
 *   AICLEAN_EVAL_DIR=<mp3 폴더> FFMPEG=<ffmpeg 경로> npx vitest run src/lib/mastering/aiclean.eval.test.ts
 * 폴더의 *.mp3 를 48kHz 로 풀어 고음 정리만 켠 체인(자연스럽게·강하게)을 돌리고,
 * <폴더>/out/report.json·report.md 와 곡별 전후 스펙트로그램 PNG 를 남긴다. 소리는 내지 않는다.
 * 환경 변수가 없으면 건너뛴다(일반 테스트에는 포함되지 않음).
 */
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readdirSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { defaultChain } from './presets'
import { ALL_SLOTS, type ChainParams } from './dsp'
import { renderChainLocal } from './render'
import { harshMetrics, withAiClean, type AiCleanMode } from './aiclean'

const DIR = process.env.AICLEAN_EVAL_DIR
const FF = process.env.FFMPEG || 'ffmpeg'
const FS = 48000

function decode(file: string): Float32Array[] {
  const buf = execFileSync(FF, ['-v', 'error', '-i', file, '-f', 'f32le', '-ac', '2', '-ar', String(FS), '-'], { maxBuffer: 1 << 30 })
  const all = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4)
  const n = all.length / 2
  const L = new Float32Array(n), R = new Float32Array(n)
  for (let i = 0; i < n; i++) { L[i] = all[2 * i]; R[i] = all[2 * i + 1] }
  return [L, R]
}

function spectrogram(ch: Float32Array[], out: string, start: number, dur: number) {
  const a = Math.floor(start * FS), b = Math.min(ch[0].length, a + Math.floor(dur * FS))
  const inter = new Float32Array((b - a) * 2)
  for (let i = a; i < b; i++) { inter[2 * (i - a)] = ch[0][i]; inter[2 * (i - a) + 1] = ch[1][i] }
  execFileSync(FF, ['-v', 'error', '-y', '-f', 'f32le', '-ar', String(FS), '-ac', '2', '-i', '-', '-lavfi',
    'showspectrumpic=s=900x360:legend=1:scale=log:fscale=lin:start=2000:stop=14000:color=intensity', out], { input: Buffer.from(inter.buffer) })
}

function onlyAiClean(mode: AiCleanMode): ChainParams {
  const c = defaultChain()
  for (const s of ALL_SLOTS) c.bypass[s] = true
  return withAiClean(c, mode)
}

const r2 = (v: number) => Math.round(v * 100) / 100

describe.skipIf(!DIR)('AI 곡 고음 정리 — 실제 곡 전후 비교', () => {
  it('곡마다 고역 피크·평탄도·쇳소리 지표·평균 손실', async () => {
    const files = readdirSync(DIR!).filter(f => f.endsWith('.mp3')).sort()
    const out = path.join(DIR!, 'out'); mkdirSync(out, { recursive: true })
    const rows: Record<string, unknown>[] = []
    for (const f of files) {
      const src = decode(path.join(DIR!, f))
      const before = harshMetrics(src, FS)
      const row: Record<string, unknown> = { file: f, sec: r2(src[0].length / FS), before }
      // 스펙트로그램은 고역이 가장 센 20초(곡 가운데쯤)
      const st = Math.max(0, src[0].length / FS / 2 - 10)
      if (!process.env.NO_PNG) spectrogram(src, path.join(out, `${f}.before.png`), st, 20)
      for (const mode of ['natural', 'strong'] as const) {
        const r = await renderChainLocal(src, FS, onlyAiClean(mode))
        const after = harshMetrics(r.channels!, FS)
        row[mode] = {
          after,
          hfMeanLossDb: r2(before.hfMeanDb - after.hfMeanDb),
          hfPeakDropDb: r2(before.hfPeakDb - after.hfPeakDb),
          spikeDropPct: r2(((before.spikeDb - after.spikeDb) / Math.max(1e-6, before.spikeDb)) * 100),
          bulgeDropPct: r2(((before.bulgeDb - after.bulgeDb) / Math.max(1e-6, before.bulgeDb)) * 100),
          flatnessGain: r2(after.flatness - before.flatness),
          maxCutDb: r2(r.aiCleanMaxCut ?? 0),
        }
        if (!process.env.NO_PNG) spectrogram(r.channels!, path.join(out, `${f}.${mode}.png`), st, 20)
      }
      rows.push(row)
      console.log(JSON.stringify(row))
    }
    writeFileSync(path.join(out, 'report.json'), JSON.stringify(rows, null, 2))
    const md = ['| 곡 | 길이(초) | 모드 | 고역 피크 감소(dB) | 고역 평균 손실(dB) | 쇳소리 지표(돌출) 전→후(dB) | 감소율 | 순간 튐 전→후(dB) | 평탄도 전→후 | 최대 감쇠(dB) |', '|---|---|---|---|---|---|---|---|---|---|']
    for (const r of rows) for (const m of ['natural', 'strong'] as const) {
      const b = r.before as ReturnType<typeof harshMetrics>, x = r[m] as { after: ReturnType<typeof harshMetrics>; hfMeanLossDb: number; hfPeakDropDb: number; bulgeDropPct: number; maxCutDb: number }
      md.push(`| ${r.file} | ${r.sec} | ${m === 'natural' ? '자연스럽게' : '강하게'} | ${x.hfPeakDropDb} | ${x.hfMeanLossDb} | ${r2(b.bulgeDb)}→${r2(x.after.bulgeDb)} | ${x.bulgeDropPct}% | ${r2(b.spikeDb)}→${r2(x.after.spikeDb)} | ${b.flatness.toFixed(3)}→${x.after.flatness.toFixed(3)} | ${x.maxCutDb} |`)
    }
    writeFileSync(path.join(out, 'report.md'), md.join('\n') + '\n')
    for (const r of rows) for (const m of ['natural', 'strong'] as const) expect((r[m] as { hfMeanLossDb: number }).hfMeanLossDb).toBeLessThanOrEqual(1.5)
  }, 1_800_000)
})
