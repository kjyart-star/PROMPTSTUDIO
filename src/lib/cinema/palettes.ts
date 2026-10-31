import type { Palette } from './types'

/** 어두운 배경 위에서 잘 보이는 밝고 채도 있는 색 팔레트 */
export const PALETTES: Palette[] = [
  { id: 'rainbow', name: '레인보우', colors: ['#ff5f6d', '#ffc371', '#7bed9f', '#70a1ff', '#c56cf0'], accent: '#ffd166' },
  { id: 'neon', name: '네온', colors: ['#00f5ff', '#7a5cff', '#ff2bd6'], accent: '#00f5ff' },
  { id: 'sunset', name: '선셋', colors: ['#ffd36b', '#ff8a4c', '#ff4d6d', '#c13584'], accent: '#ff8a4c' },
  { id: 'ocean', name: '오션', colors: ['#7df9ff', '#3fa7ff', '#3d5afe'], accent: '#5cc8ff' },
  { id: 'forest', name: '포레스트', colors: ['#d4ff7a', '#5eea8a', '#18c3a0'], accent: '#7bed9f' },
  { id: 'lavender', name: '라벤더', colors: ['#e0c3ff', '#b28dff', '#7f7bff'], accent: '#c7a6ff' },
  { id: 'rose-gold', name: '로즈골드', colors: ['#ffe0d0', '#f7b2a0', '#e58f9e'], accent: '#f7b2a0' },
  { id: 'ice', name: '아이스', colors: ['#ffffff', '#cdeeff', '#8fd3ff'], accent: '#cdeeff' },
  { id: 'mono', name: '화이트', colors: ['#ffffff', '#d0d4dc'], accent: '#ffffff' },
]
export const getPalette = (id: string): Palette => PALETTES.find(p => p.id === id) ?? PALETTES[0]

export function paletteGradient(ctx: CanvasRenderingContext2D, palette: Palette, x0: number, y0: number, x1: number, y1: number): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1)
  const n = palette.colors.length
  palette.colors.forEach((c, i) => g.addColorStop(n === 1 ? 0 : i / (n - 1), c))
  return g
}
