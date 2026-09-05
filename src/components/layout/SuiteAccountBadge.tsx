'use client'

import { useEffect, useRef, useState } from 'react'
import { Coins, FolderOpen, LifeBuoy, LogOut, Settings, UserRound } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { BASE_PATH, suiteHref, withBase } from '@/lib/basePath'

/**
 * 상단 바의 계정 배지 — 쿠키플레이 기준 바(COOKIELAB `SuiteShell` 의 AccountBadge)와
 * 같은 생김새다. 비로그인이면 「로그인」 글자 링크, 로그인이면 원형 아바타 + 메뉴.
 *
 * 이메일 글자·이니셜은 쓰지 않는다 — 다른 서비스의 배지와 어긋나기 때문이다.
 *
 * 세션은 이 앱의 supabase 클라이언트에서 직접 읽는다. 이 앱이 쿠키플레이 계정의
 * 로그인 관문 자신이라 여기서는 쿠키를 넘겨짚을 필요가 없다.
 */

const PROFILE_CACHE_KEY = 'cookieplay_profile'

interface AccountProfile {
  avatarUrl: string | null
  displayName: string | null
}

function readProfileCache(): AccountProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY)
    return raw ? (JSON.parse(raw) as AccountProfile) : null
  } catch {
    return null
  }
}

/**
 * 로그인이 끝나면 떠났던 자리로 돌아온다. 관문(`/login`)은 basePath 위에 살고
 * `next` 는 basePath 를 뺀 경로를 받으므로 지금 주소에서 `/music` 을 떼어 실어 보낸다.
 *
 * 돌아올 자리는 마운트 뒤에 붙인다 — 렌더 중에 `window` 를 읽으면 서버가 그린 href 와
 * 어긋나 하이드레이션 경고가 난다. 붙기 전에도 링크는 관문으로 멀쩡히 간다.
 */
const LOGIN_PATH = withBase('/login')

function loginHrefWithReturn(): string {
  const here = window.location.pathname + window.location.search
  const path = here.startsWith(BASE_PATH) ? here.slice(BASE_PATH.length) || '/' : here
  return `${LOGIN_PATH}?next=${encodeURIComponent(path)}`
}

const MENU_ITEM =
  'flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] text-[#dedede] transition-colors hover:bg-[#333333]'

/* 계정·고객지원 화면은 쿠키플레이가 그린다 — 이 앱의 basePath 를 붙이면 안 된다 */
const MENU_LINKS = [
  { href: suiteHref('/account'), icon: UserRound, label: '프로필' },
  { href: suiteHref('/account/credits'), icon: Coins, label: '크레딧' },
  { href: suiteHref('/account/library'), icon: FolderOpen, label: '보관함' },
  { href: suiteHref('/account/settings'), icon: Settings, label: '설정' },
  { href: suiteHref('/support'), icon: LifeBuoy, label: '고객지원' },
] as const

export function SuiteAccountBadge() {
  const [authed, setAuthed] = useState(false)
  const [profile, setProfile] = useState<AccountProfile | null>(null)
  const [open, setOpen] = useState(false)
  const [loginHref, setLoginHref] = useState(LOGIN_PATH)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setLoginHref(loginHrefWithReturn())
  }, [])

  useEffect(() => {
    const supabase = createClient()
    let alive = true
    void supabase.auth.getSession().then(({ data }) => {
      if (alive) setAuthed(!!data.session)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session)
    })
    return () => {
      alive = false
      sub.subscription.unsubscribe()
    }
  }, [])

  /* 캐시를 먼저 그리고 나중에 고친다 — 새로고침마다 아바타가 깜빡이면 바가 흔들린다.
     창이 포커스를 되찾을 때 다시 부른다: 계정 화면에서 사진을 바꾸고 돌아오면 그때 갱신된다. */
  useEffect(() => {
    if (!authed) {
      // 로그아웃했으면 남은 사진을 지운다 — 다음 사람에게 앞사람 얼굴이 보이면 안 된다
      setProfile(null)
      try {
        localStorage.removeItem(PROFILE_CACHE_KEY)
      } catch {
        /* 저장소가 막혀도 화면은 그대로 간다 */
      }
      return
    }
    setProfile(readProfileCache())
    let alive = true
    const load = async () => {
      try {
        const res = await fetch(withBase('/api/profile'), { credentials: 'include' })
        if (!res.ok) return
        const data = (await res.json()) as { avatar_url?: string; display_name?: string }
        if (!alive) return
        const next: AccountProfile = {
          avatarUrl: data.avatar_url || null,
          displayName: data.display_name || null,
        }
        setProfile(next)
        try {
          localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(next))
        } catch {
          /* 캐시 실패는 조용히 넘긴다 — 이번 화면은 이미 그렸다 */
        }
      } catch {
        /* 못 받아오면 기본 아이콘으로 간다 */
      }
    }
    void load()
    window.addEventListener('focus', load)
    return () => {
      alive = false
      window.removeEventListener('focus', load)
    }
  }, [authed])

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

  const handleSignOut = async () => {
    setOpen(false)
    try {
      await fetch(withBase('/api/auth/signout'), { method: 'POST' })
      await createClient().auth.signOut()
    } catch (err) {
      console.error('SignOut error:', err)
    }
    window.location.reload()
  }

  if (!authed) {
    return (
      <a
        href={loginHref}
        title="쿠키플레이 계정으로 로그인"
        className="flex h-11 items-center rounded-full px-2.5 text-[14px] text-[#a1a1a1] transition-colors hover:text-[#dedede] md:px-3"
      >
        로그인
      </a>
    )
  }

  const label = profile?.displayName ? `${profile.displayName} — 쿠키플레이 계정` : '쿠키플레이 계정'

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={label}
        className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-[#292929] text-[#dedede] transition-colors hover:border-[#8251f6]"
      >
        {profile?.avatarUrl ? (
          <img
            src={profile.avatarUrl}
            alt=""
            className="h-full w-full object-cover"
            /* 사진 주소가 깨졌으면 빈 원으로 — 오류 아이콘이 바에 뜨지 않게 한다 */
            onError={(e) => {
              ;(e.currentTarget as HTMLImageElement).style.display = 'none'
            }}
          />
        ) : (
          <UserRound size={18} strokeWidth={1.75} aria-hidden />
        )}
        <span className="sr-only">쿠키플레이 계정 메뉴</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-11 z-50 w-44 overflow-hidden rounded-[12px] border border-[#292929] bg-[#0d0d0d] py-1 shadow-lg"
        >
          {profile?.displayName && (
            <p className="truncate border-b border-[#292929] px-3.5 py-2 text-[12px] text-[#a1a1a1]">
              {profile.displayName}
            </p>
          )}
          {MENU_LINKS.map(({ href, icon: Icon, label: text }) => (
            <a key={text} role="menuitem" href={href} className={MENU_ITEM}>
              <Icon size={15} strokeWidth={1.75} aria-hidden />
              {text}
            </a>
          ))}
          <button
            role="menuitem"
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center gap-2.5 border-t border-[#292929] px-3.5 py-2.5 text-left text-[13px] text-[#a1a1a1] transition-colors hover:bg-[#333333] hover:text-[#dedede]"
          >
            <LogOut size={15} strokeWidth={1.75} aria-hidden />
            로그아웃
          </button>
        </div>
      )}
    </div>
  )
}
