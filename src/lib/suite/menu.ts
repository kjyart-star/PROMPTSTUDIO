'use client'

import { useEffect, useMemo, useState } from 'react'
import { BASE_PATH, suiteHref } from '@/lib/basePath'
import menuDefault from './suite-menu.default.json'
import type { SuiteNavFloor, SuiteService, SuiteStatus } from './services'

/**
 * 상단 층 메뉴의 정본은 **쿠키플레이의 `public/suite-menu.json`**(= https://cookieplay.app/suite-menu.json)
 * 한 곳이다. 층 · 순서 · 이름 · 설명 · 상태 · 주소를 거기서만 고친다.
 *
 * 이 앱은 `suite-menu.default.json`(빌드 때 정본에서 복사한 사본, `scripts/sync-suite-menu.mjs`)으로
 * 먼저 그리고, 정본을 받아오면 교체한다. 받지 못하면(차단 · 오프라인) 사본 그대로 남는다.
 * `services.ts` 의 옛 목록은 더 이상 메뉴를 그리지 않는다(타입 · 상태 라벨만 쓴다).
 */
interface MenuJson {
  floors: { short: string; name: string; services: string[] }[]
  services: { id: string; name: string; abbr: string; role: string; status: SuiteStatus; href: string }[]
}

const REMOTE = 'https://cookieplay.app/suite-menu.json'

const valid = (m: unknown): m is MenuJson =>
  !!m && Array.isArray((m as MenuJson).floors) && Array.isArray((m as MenuJson).services)

/** 이 앱 자신의 화면은 basePath 가 붙는다 — 나머지는 쿠키플레이 오리진 경로(`suiteHref`). */
const SELF_HREF: Record<string, string> = {
  cookiemusic: BASE_PATH,
  cookiemusicstudio: `${BASE_PATH}/studio`,
}

let cached: MenuJson | null = null

export function useSuiteMenu() {
  const [menu, setMenu] = useState<MenuJson>(cached ?? (menuDefault as MenuJson))

  useEffect(() => {
    if (cached) return
    let off = false
    fetch(REMOTE, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => {
        if (off || !valid(m)) return
        cached = m
        setMenu(m)
      })
      .catch(() => {})
    return () => {
      off = true
    }
  }, [])

  return useMemo(() => {
    /* SuiteFloorMenu 의 약자 칸은 `latin` 에서 파생된다 — 약자를 `latin` 자리에 넣으면 그대로 나온다. */
    const services: SuiteService[] = menu.services.map((s) => ({
      id: s.id,
      name: s.name,
      latin: s.abbr,
      role: s.role,
      status: s.status,
    }))
    const byId = new Map(services.map((s) => [s.id, s]))
    const floors: SuiteNavFloor[] = menu.floors
      .map((f) => ({
        short: f.short,
        name: f.name,
        items: f.services.map((id) => byId.get(id)).filter((s): s is SuiteService => Boolean(s)),
      }))
      .filter((f) => f.items.length > 0)
    const hrefById = new Map(menu.services.map((s) => [s.id, s.href]))
    const hrefOf = (id: string) => SELF_HREF[id] ?? suiteHref(hrefById.get(id) ?? '/')
    return { floors, services, hrefOf }
  }, [menu])
}
