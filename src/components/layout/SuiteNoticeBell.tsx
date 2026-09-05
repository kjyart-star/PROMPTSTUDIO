'use client'

import { useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'

/**
 * 상단 바의 공지 종 — 쿠키플레이 기준 바(COOKIELAB `support/NoticeBell`)를 이 저장소로
 * 옮긴 것이다. 세 저장소가 같은 공개 API·같은 저장소 키를 보므로 한쪽에서 닫은 공지는
 * 다른 서비스로 옮겨 가도 그 탭에서는 다시 뜨지 않는다.
 *
 * 공개 API 라 로그인은 필요 없고, 못 받아오면 공지 0건과 똑같이 조용히 있는다.
 * 공지가 없어도 종은 남긴다 — 있을 때만 나타나면 바 폭이 들썩인다.
 */

const STATUS_URL = 'https://cookieplay-admin-api.kjyart.workers.dev/v1/public/status'

/** 목록이 바를 덮을 만큼 길어지면 읽지 않는다 — 최근 것만 편다. */
const MAX_LISTED = 5

/**
 * 닫은 공지는 **그 탭에서만** 잠잠하다. 영구 저장하면 나중에 같은 공지를 다시 띄울
 * 방법이 없어진다. 키 이름은 세 저장소가 글자까지 같아야 한다.
 */
const DISMISSED_KEY = 'cookieplay.dismissedNotices'

interface AnnouncementRow {
  id: string
  scope: string
  title: string
  body?: string | null
  link?: string | null
}

interface PublicStatusResponse {
  announcements: AnnouncementRow[]
}

/**
 * 상태·공지는 **페이지 열림당 한 번만** 받는다. 폴링도 재시도도 없다 — 무료 Workers 의
 * 하루 요청 예산을 종 하나가 태울 자리는 없다. 새로고침하면 새로 받는다.
 */
let inflight: Promise<PublicStatusResponse | null> | null = null

function loadPublicStatus(): Promise<PublicStatusResponse | null> {
  inflight ??= fetch(STATUS_URL)
    .then((res) => (res.ok ? (res.json() as Promise<PublicStatusResponse>) : null))
    .catch(() => null)
  return inflight
}

function readDismissed(): string[] {
  try {
    const raw = sessionStorage.getItem(DISMISSED_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

export function SuiteNoticeBell({ activeId }: { activeId?: string }) {
  const [data, setData] = useState<PublicStatusResponse | null>(null)
  const [dismissed, setDismissed] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let alive = true
    void loadPublicStatus().then((res) => {
      if (alive) setData(res)
    })
    /* sessionStorage 는 서버에 없다 — 마운트 뒤에 읽어 SSR 과 어긋나지 않게 한다 */
    setDismissed(readDismissed())
    return () => {
      alive = false
    }
  }, [])

  /* 바깥 클릭·ESC 로 닫는다 — 계정 배지 메뉴와 같은 방식 */
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const dismissNotice = (id: string) => {
    const next = Array.from(new Set([...readDismissed(), id]))
    try {
      sessionStorage.setItem(DISMISSED_KEY, JSON.stringify(next))
    } catch {
      /* 저장소가 막혀 있어도 이번 화면에서는 닫힌다 — 그것으로 충분하다 */
    }
    setDismissed(next)
  }

  /* 이 화면 범위(scope)에 맞고 닫지 않은 것만. 순서는 서버가 준 그대로다. */
  const notices = (data?.announcements ?? []).filter(
    (a) => (a.scope === 'all' || a.scope === activeId) && !dismissed.includes(a.id)
  )
  const count = notices.length
  const label = count > 0 ? `공지 ${count}건` : '공지'

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={label}
        aria-label={label}
        className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#231249] bg-[#1b0e39] text-[#a581f8] transition-colors hover:text-[#dedede]"
      >
        <Bell className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {count > 0 && (
          /* 숫자는 종 위에 겹친다 — 바가 좁아도 폭을 더 먹지 않는다 */
          <span className="absolute -right-1 -top-1 inline-flex min-w-[16px] items-center justify-center rounded-full bg-[#8251f6] px-1 text-[10px] font-semibold leading-[16px] tabular-nums text-white">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="공지"
          /* 폰에서는 화면 폭에서 좌우 여백만 뺀 만큼 — 오른쪽에 붙여 두면 넘치지 않는다 */
          className="absolute right-0 top-10 z-50 w-[min(20rem,calc(100vw-2.5rem))] overflow-hidden rounded-[12px] border border-[#292929] bg-[#0d0d0d] shadow-lg"
        >
          <p className="border-b border-[#292929] px-3.5 py-2 text-[12px] text-[#a1a1a1]">공지</p>
          {count === 0 ? (
            <p className="px-3.5 py-4 text-[13px] text-[#a1a1a1]">새 공지가 없습니다.</p>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto">
              {notices.slice(0, MAX_LISTED).map((a) => (
                <li key={a.id} className="border-b border-[#292929] px-3.5 py-3 last:border-b-0">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-[#dedede]">{a.title}</p>
                      {a.body && (
                        /* 본문은 두 줄까지만 — 긴 공지는 「자세히」로 넘긴다 */
                        <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-[#a1a1a1]">
                          {a.body}
                        </p>
                      )}
                      {a.link && (
                        <a
                          href={a.link}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="mt-1 inline-block text-[12px] text-[#dedede] underline underline-offset-2"
                        >
                          자세히
                        </a>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => dismissNotice(a.id)}
                      className="-my-3 inline-flex min-h-[44px] shrink-0 items-center text-[12px] text-[#a1a1a1] transition-colors hover:text-[#dedede]"
                    >
                      닫기
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {count > MAX_LISTED && (
            <p className="border-t border-[#292929] px-3.5 py-2 text-[12px] text-[#a1a1a1]">
              그 밖에 {count - MAX_LISTED}건이 더 있습니다.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
