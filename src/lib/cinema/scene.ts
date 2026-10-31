/**
 * 장면 템플릿 준비물(배경 사진·서체). draw 는 동기 함수라 그리기 전에 여기서 미리 불러 둔다.
 * 미리보기·썸네일·내보내기가 모두 같은 prepareScene(frame.ts) 을 기다린 뒤 그리므로 세 화면 결과가 같다.
 * 배경 사진: public/cinema/scenes (로컬 컴피 자체 생성, 글자·인물·상표 없음)
 * 서체: Google Fonts(OFL) — Noto Serif KR, IBM Plex Sans KR, Instrument Serif, Nanum Pen Script(손글씨)
 */
import { withBase } from '@/lib/basePath'

const plates = new Map<string, ImageBitmap | HTMLImageElement>()
const pending = new Map<string, Promise<void>>()

/** 불러온 배경 사진(없으면 null — 템플릿은 그림으로 대신 그린다) */
export function scenePlate(name: string): CanvasImageSource | null {
  return plates.get(name) ?? null
}

export function loadPlate(name: string): Promise<void> {
  if (plates.has(name)) return Promise.resolve()
  let p = pending.get(name)
  if (!p) {
    p = (async () => {
      try {
        const r = await fetch(withBase(`/cinema/scenes/${name}.webp`))
        if (!r.ok) return
        plates.set(name, await createImageBitmap(await r.blob()))
      } catch { /* 사진이 없으면 그림으로 대신한다 */ }
    })()
    pending.set(name, p)
  }
  return p
}

const FONT_CSS = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@300;400;600&family=Instrument+Serif:ital@0;1&family=Nanum+Pen+Script&family=Noto+Serif+KR:wght@300;500;700&display=block'
/** 이 서체들로 쓰는 글자 모양 목록(필요한 글자 조각만 받는다) */
const FONT_SPECS = ['300 40px "Noto Serif KR"', '500 40px "Noto Serif KR"', '700 40px "Noto Serif KR"', '300 40px "IBM Plex Sans KR"', '400 40px "IBM Plex Sans KR"', '600 40px "IBM Plex Sans KR"', '400 40px "Instrument Serif"', 'italic 400 40px "Instrument Serif"', '400 40px "Nanum Pen Script"']
const loadedText = new Set<string>()
let cssReady: Promise<void> | null = null

export async function loadFonts(text: string): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return
  cssReady ??= new Promise<void>(res => {
    const l = document.createElement('link')
    l.rel = 'stylesheet'; l.href = FONT_CSS; l.dataset.cinemaFonts = '1'
    l.onload = () => res(); l.onerror = () => res()
    document.head.appendChild(l)
    setTimeout(res, 8000)
  })
  await cssReady
  const chars = Array.from(new Set(Array.from(text + '0123456789:/.No 가나다라마바사'))).filter(c => !loadedText.has(c)).join('')
  if (!chars) return
  await Promise.race([
    Promise.all(FONT_SPECS.map(s => document.fonts.load(s, chars).catch(() => []))),
    new Promise(r => setTimeout(r, 12000)),
  ])
  for (const c of chars) loadedText.add(c)
}
