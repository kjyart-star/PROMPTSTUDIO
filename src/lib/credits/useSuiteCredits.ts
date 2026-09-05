'use client'

/**
 * 스위트 공용 지갑 잔액을 화면에 물려 준다.
 *
 * 잔액은 서버(워커 D1 원장)에만 있다 — 브라우저는 읽기만 하고 절대 쓰지 않는다.
 * 차감이 일어난 화면이 응답의 balance 를 `setBalance` 로 넘기면
 * `suite-credits-changed` 이벤트가 퍼져 헤더·다른 탭의 숫자도 같이 바뀐다.
 */
import { useCallback, useEffect, useState } from 'react'
import { withBase } from '@/lib/basePath'
import type { CreditAction } from './suite'

export type CreditPrices = Partial<Record<CreditAction, number>>

const BALANCE_EVENT = 'suite-credits-changed'

export function useSuiteCredits(user: any) {
  const userId = user?.id ?? null
  const [balance, setBalanceState] = useState<number | null>(null)
  const [prices, setPrices] = useState<CreditPrices>({})

  const refresh = useCallback(async () => {
    if (!userId) {
      setBalanceState(null)
      return
    }
    try {
      const res = await fetch(withBase('/api/credits/me'), { cache: 'no-store' })
      if (!res.ok) {
        setBalanceState(null)
        return
      }
      const data = await res.json()
      setBalanceState(typeof data?.balance === 'number' ? data.balance : null)
      if (data?.prices) setPrices(data.prices)
    } catch {
      setBalanceState(null)
    }
  }, [userId])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onChanged = (e: Event) => {
      const detail = (e as CustomEvent<number>).detail
      if (typeof detail === 'number') setBalanceState(detail)
    }
    window.addEventListener(BALANCE_EVENT, onChanged)
    return () => window.removeEventListener(BALANCE_EVENT, onChanged)
  }, [])

  /** 차감 응답으로 받은 잔액을 반영하고 다른 화면에도 알린다. */
  const setBalance = useCallback((next: number) => {
    setBalanceState(next)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent<number>(BALANCE_EVENT, { detail: next }))
    }
  }, [])

  return { balance, prices, refresh, setBalance }
}
