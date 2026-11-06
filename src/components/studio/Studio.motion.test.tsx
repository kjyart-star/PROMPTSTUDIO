// @vitest-environment jsdom
/** 쿠키뮤직 스튜디오 등장·전환 애니메이션 — 히어로·탭 래퍼 등장 클래스, 커버 스켈레톤→페이드인, 모션 줄이기. */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'

vi.mock('@/lib/basePath', () => ({ withBase: (p: string) => p }))
import { StudioHero } from './StudioHero'
import { WideFit } from './WideFit'
import { FadeImg } from './FadeImg'

afterEach(cleanup)

describe('스튜디오 등장·전환', () => {
  it('히어로 글줄은 차례로, 배경은 페이드인한다', () => {
    render(<StudioHero badge="배지" title="제목" desc="설명" bg="/studio/x.webp" />)
    expect(screen.getByTestId('studio-hero-copy').classList.contains('rv-enter')).toBe(true)
    expect(screen.getByTestId('studio-hero-bg').classList.contains('cm-img-in')).toBe(true)
  })
  it('탭 화면 래퍼가 등장 클래스를 가진다(탭을 바꾸면 새로 마운트되어 다시 등장)', () => {
    const { rerender } = render(<WideFit key="a">a</WideFit>)
    const first = screen.getByTestId('wide-fit')
    expect(first.classList.contains('rv-in')).toBe(true)
    rerender(<WideFit key="b">b</WideFit>)
    expect(screen.getByTestId('wide-fit')).not.toBe(first)
  })
  it('커버 이미지는 스켈레톤 뒤에서 불러온 뒤 페이드인한다', () => {
    render(<div><FadeImg src="/c.png" alt="커버" /></div>)
    const img = screen.getByAltText('커버') as HTMLImageElement
    expect(screen.getByTestId('img-skeleton')).toBeTruthy()
    expect(img.style.opacity).toBe('0')
    fireEvent.load(img)
    expect(screen.queryByTestId('img-skeleton')).toBeNull()
    expect(img.classList.contains('cm-img-in')).toBe(true)
    expect(img.style.opacity).toBe('')
  })
  it('모션 줄이기면 CSS 가 애니메이션을 끈다', () => {
    const css = readFileSync('src/app/globals.css', 'utf8')
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.rv-enter > \*, \.rv-in, \.cm-img-in \{ animation: none !important; \}/)
  })
})
