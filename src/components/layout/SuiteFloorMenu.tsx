'use client'

import {
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown } from 'lucide-react'
import { SUITE_STATUS_LABEL, type SuiteService } from '@/lib/suite/services'

// 상단 바의 접힌 층 메뉴 — 「4F AI작업실 ▾」을 누르거나 마우스를 올리면 그 층의
// 서비스가 아래로 펼쳐진다(대표 지시 2026-09-06: "4층은 AI작업실로 하고, 마우스
// 올리면 아래로 쿠키뮤직 스튜디오·쿠키드림 이런 식으로 나오게 해줘").
//
// 층에 서비스가 하나뿐이면 SuiteBar 가 이 컴포넌트를 쓰지 않고 바로 링크를 그린다.
//
// 판은 `document.body` 로 포털한다 — 바의 `<nav>` 는 `overflow-x-auto` 라 그 안에
// 그리면 아래로 펼친 판이 잘린다. 자리는 트리거의 화면 좌표로 잡고, 스크롤·리사이즈가
// 나면 어긋나기 전에 닫는다.
//
// 판의 결은 쿠키포토 「서비스」 메가메뉴를 따른다(대표 지시 2026-09-06: "포토 참고.") —
// 넓은 둥근 판에, 행마다 약자 칸 + 이름 + 한 줄 설명. 정본 COOKIELAB
// `src/components/home/FloorMenu.tsx` 와 같은 모양이다.
//
// 색은 리터럴 hex 다 — 기준 저장소(COOKIELAB)의 CSS 토큰이 여기엔 없어서 계정 팝오버와
// 같은 다크 값을 그대로 적었다. 새 색은 만들지 않는다. 토큰이 아니라 리터럴이라
// `document.body` 로 포털해도 판이 투명해지지 않는다 — 정본은 토큰을 써서 앱 뿌리 안에
// 붙여야 했다.

// 판 너비 = `w-[280px]`. 위치 계산에 숫자가 필요해 클래스와 같이 적어 둔다. 224 짜리 얇은
// 목록이던 것을 넓혔다 — 행이 이름 + 한 줄 설명의 두 줄이라 이만큼은 있어야 설명이 안 꺾인다.
const PANEL_W = 280
// 화면 가장자리에서 띄울 최소 여백 — 판이 창 밖으로 나가지 않게 가둘 때 쓴다.
const EDGE = 8

// 서비스 워드마크 약자 — 'CookieCut' → 'CC', 'CookieMusic Studio' → 'CMS'. 서비스에 아이콘이
// 따로 없어 행 머리 칸에는 이 약자를 놓는다. 새 아이콘 세트를 만들지 않는다 — `latin` 에서
// 파생되므로 서비스가 늘어도 여기 고칠 것이 없다.
const monogram = (latin: string) =>
  latin
    .split(/(?=[A-Z])|\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')

export function SuiteFloorMenu({
  short,
  name,
  items,
  activeId,
  hrefOf,
}: {
  short: string
  name: string
  items: SuiteService[]
  activeId?: string
  hrefOf: (id: string) => string
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  // 마운트 직후 한 프레임은 흐린 상태로 두었다가 다음 프레임에 제자리로 — 그래야
  // transition 이 걸린다. 키프레임을 새로 만들지 않으려고 이렇게 한다.
  const [shown, setShown] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const closeTimer = useRef<number | null>(null)
  // 키보드로 열었을 때만 첫 항목으로 포커스를 옮긴다(마우스로 열 때는 옮기지 않는다).
  const focusFirst = useRef(false)
  const panelId = useId()
  const isActive = items.some((i) => i.id === activeId)

  const cancelClose = () => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }

  // 트리거와 판 사이에 마우스가 지나가는 4px 틈에서 메뉴가 깜빡이지 않게 유예를 둔다.
  const scheduleClose = () => {
    cancelClose()
    closeTimer.current = window.setTimeout(() => setOpen(false), 150)
  }

  const openMenu = () => {
    const r = triggerRef.current?.getBoundingClientRect()
    if (!r) return
    // 판 폭은 PANEL_W 고정 — 트리거 가운데에 맞추되 화면 밖으로 나가지 않게 가둔다.
    const left = Math.min(
      Math.max(r.left + r.width / 2 - PANEL_W / 2, EDGE),
      window.innerWidth - PANEL_W - EDGE,
    )
    setPos({ top: r.bottom + 4, left })
    setOpen(true)
  }

  // 터치 기기에서는 탭이 mouseenter 로도 들어와 클릭 토글과 싸운다 — 진짜 마우스일 때만 연다.
  const canHover = () => window.matchMedia('(hover: hover)').matches

  const menuItems = () =>
    Array.from(panelRef.current?.querySelectorAll<HTMLAnchorElement>('[role="menuitem"]') ?? [])

  useEffect(() => {
    if (!open) {
      setShown(false)
      return
    }
    const raf = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(raf)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return
      setOpen(false)
    }
    const close = () => setOpen(false)
    window.addEventListener('mousedown', onDown)
    window.addEventListener('scroll', close)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('scroll', close)
      window.removeEventListener('resize', close)
    }
  }, [open])

  useEffect(() => {
    if (!open || !focusFirst.current) return
    focusFirst.current = false
    menuItems()[0]?.focus()
  }, [open])

  useEffect(() => {
    return () => {
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current)
    }
  }, [])

  const closeToTrigger = () => {
    setOpen(false)
    triggerRef.current?.focus()
  }

  // 포커스가 트리거·판 둘 다에서 벗어나면 닫는다. 판이 포털이라 한 래퍼의 focusout 으로는
  // 잡히지 않으므로 양쪽에 같은 핸들러를 건다.
  const onFocusOut = (e: ReactFocusEvent) => {
    const next = e.relatedTarget as Node | null
    if (next && (triggerRef.current?.contains(next) || panelRef.current?.contains(next))) return
    setOpen(false)
  }

  const onTriggerKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      focusFirst.current = true
      if (open) menuItems()[0]?.focus()
      else openMenu()
    } else if (e.key === 'Escape' && open) {
      e.preventDefault()
      setOpen(false)
    }
  }

  const onPanelKeyDown = (e: ReactKeyboardEvent) => {
    const els = menuItems()
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (els.length === 0) return
      const i = els.indexOf(document.activeElement as HTMLAnchorElement)
      const step = e.key === 'ArrowDown' ? 1 : -1
      els[(i + step + els.length) % els.length].focus()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      closeToTrigger()
    } else if (e.key === 'Tab') {
      // preventDefault 하지 않는다 — 포커스를 트리거로 되돌려 두면 기본 Tab 이 그
      // 다음 요소로 이어 간다. 판 안에 갇히지 않는다.
      closeToTrigger()
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onMouseEnter={() => {
          if (!canHover()) return
          cancelClose()
          openMenu()
        }}
        onMouseLeave={() => {
          if (canHover()) scheduleClose()
        }}
        onKeyDown={onTriggerKeyDown}
        onBlur={onFocusOut}
        className={`flex h-11 shrink-0 items-center whitespace-nowrap rounded-[8px] px-3 text-[14px] transition-colors ${
          isActive ? 'font-semibold text-[#dedede]' : 'text-[#a1a1a1] hover:text-[#dedede]'
        }`}
      >
        {short && <span className="mr-1.5 text-[11px] text-[#a1a1a1]">{short}</span>}
        {name}
        <ChevronDown
          size={14}
          aria-hidden
          className={`ml-1 shrink-0 transition-transform duration-150 motion-reduce:transition-none ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role="menu"
            aria-label={`${short} ${name}`}
            style={{ top: pos.top, left: pos.left }}
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
            onKeyDown={onPanelKeyDown}
            onBlur={onFocusOut}
            // 쿠키포토 메가메뉴와 같은 결 — 넓은 둥근 판, 불투명 어두운 배경, 옅은 테두리, 안쪽 여백.
            className={`fixed z-[80] w-[280px] rounded-[16px] border border-[#292929] bg-[#0d0d0d] p-2 shadow-2xl transition duration-150 motion-reduce:transition-none ${
              shown ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0'
            }`}
          >
            {items.map((it) => {
              const itemActive = it.id === activeId
              return (
                // 행 = 약자 칸 + (이름 · 배지 / 한 줄 설명). 제목은 굵게, 설명은 흐리게.
                <a
                  key={it.id}
                  role="menuitem"
                  href={hrefOf(it.id)}
                  aria-current={itemActive ? 'page' : undefined}
                  onClick={() => setOpen(false)}
                  className="flex w-full items-start gap-3 rounded-[12px] px-3 py-2.5 text-left transition-colors hover:bg-[#212121]"
                >
                  {/* 지금 있는 서비스는 약자 칸이 반전돼 어디 있는지 읽힌다 */}
                  <span
                    aria-hidden
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border text-[11px] font-semibold tracking-[-0.02em] ${
                      itemActive
                        ? 'border-[#dedede] bg-[#dedede] text-[#0d0d0d]'
                        : 'border-[#292929] text-[#a1a1a1]'
                    }`}
                  >
                    {monogram(it.latin)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-[14px] font-semibold leading-[1.3] text-[#dedede]">
                      {it.name}
                      {it.status !== 'stable' && (
                        <span className="shrink-0 rounded-[6px] border border-[#231249] px-1.5 py-0.5 text-[10px] leading-none text-[#a581f8]">
                          {SUITE_STATUS_LABEL[it.status]}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-[12px] leading-[1.5] text-[#a1a1a1]">
                      {it.role}
                    </span>
                  </span>
                </a>
              )
            })}
          </div>,
          document.body,
        )}
    </>
  )
}
