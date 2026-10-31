/** 개발 전용: 템플릿 여러 장을 한 장의 시트로 그려 화면에 덮어 보여 준다(콘솔에서 __cinema.sheet(...)). */
import { TEMPLATES } from '@/lib/cinema/templates'
import { PALETTES } from '@/lib/cinema/palettes'
import { makeFrame, drawFrame, prepareScene } from '@/lib/cinema/frame'
import { sampleBars, SAMPLE_LINES } from './thumbs'
import type { VizShapeId } from '@/lib/cinema/types'

export async function sheet(o: { W?: number; H?: number; cols?: number; ids?: string[]; shapes?: (VizShapeId | null)[]; pal?: string; kind?: 'lyrics' | 'instrumental'; coverUrl?: string; t?: number }) {
  const { W = 640, H = 360, cols = 3, kind = 'lyrics', t = 14.2 } = o
  const ids = o.ids ?? TEMPLATES.map(x => x.id)
  let cover: ImageBitmap
  if (o.coverUrl) cover = await createImageBitmap(await (await fetch(o.coverUrl)).blob())
  else {
    const cv = document.createElement('canvas'); cv.width = cv.height = 600; const x = cv.getContext('2d')!
    const g = x.createLinearGradient(0, 0, 600, 600); g.addColorStop(0, '#e0457b'); g.addColorStop(.5, '#7a3cff'); g.addColorStop(1, '#12c2e9'); x.fillStyle = g; x.fillRect(0, 0, 600, 600)
    cover = await createImageBitmap(cv)
  }
  for (const id of ids) await prepareScene(id, '여름밤의 노래쿠키뮤직 플레이리스트' + SAMPLE_LINES.map(l => l.text).join(''))
  const rows = Math.ceil(ids.length / cols)
  const sh = document.createElement('canvas'); sh.width = W * cols; sh.height = H * rows
  const sx = sh.getContext('2d')!
  ids.forEach((id, i) => {
    const c = document.createElement('canvas'); c.width = W; c.height = H
    const tpl = TEMPLATES.find(x => x.id === id)!
    const f = makeFrame({
      w: W, h: H, t, trackIndex: 0, trackCount: 3, title: '여름밤의 노래', headline: '쿠키뮤직 플레이리스트', coverSeed: 'a', cover, kind,
      lyrics: { lines: SAMPLE_LINES, mode: 'estimated' }, duration: 210, bars: sampleBars(1.3), level: 0.6,
      shape: o.shapes?.[i] ?? tpl.defaultShape, palette: PALETTES.find(p => p.id === o.pal) ?? PALETTES[0],
    })
    drawFrame(c.getContext('2d')!, id, f)
    sx.drawImage(c, (i % cols) * W, Math.floor(i / cols) * H)
  })
  document.getElementById('__ov')?.remove()
  const ov = document.createElement('div'); ov.id = '__ov'
  ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#000;display:flex;align-items:center;justify-content:center'
  sh.style.cssText = 'max-width:100vw;max-height:100vh'
  ov.appendChild(sh); ov.onclick = () => ov.remove(); document.body.appendChild(ov)
}

/** 개발 전용: 합성 음악 WAV 파일(검증용). __cinema.testWav(10) */
export function testWav(sec = 10, name = '테스트 곡'): File {
  const fs = 44100, n = fs * sec, L = new Float32Array(n)
  const notes = [261.6, 329.6, 392, 523.3, 392, 329.6]
  for (let i = 0; i < n; i++) { const t = i / fs; const nt = notes[Math.floor(t * 2) % 6]; const env = Math.exp(-((t * 2) % 1) * 3); L[i] = 0.35 * env * (Math.sin(2 * Math.PI * nt * t) + 0.4 * Math.sin(2 * Math.PI * nt * 2 * t)) + 0.1 * Math.sin(2 * Math.PI * 55 * t) * (Math.floor(t * 4) % 2) }
  const buf = new ArrayBuffer(44 + n * 2), dv = new DataView(buf)
  const w = (o: number, s: string) => [...s].forEach((c, i) => dv.setUint8(o + i, c.charCodeAt(0)))
  w(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true); dv.setUint32(24, fs, true); dv.setUint32(28, fs * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, n * 2, true)
  for (let i = 0; i < n; i++) dv.setInt16(44 + i * 2, Math.max(-1, Math.min(1, L[i])) * 32767, true)
  return new File([buf], `${name}.wav`, { type: 'audio/wav' })
}
