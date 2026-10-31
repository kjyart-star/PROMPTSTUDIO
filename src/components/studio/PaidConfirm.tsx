'use client'

import { formatPriceCredits } from '@/lib/credits/format'

/** 유료 표기 — 「✦N」(원화 금지). 단가를 모르면 숫자 없이 「유료」만 보인다. */
export function PriceBadge({ milli, className = '' }: { milli: number | null | undefined; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-extrabold leading-none bg-primary/15 text-primary ${className}`}>
      {typeof milli === 'number' ? `✦${formatPriceCredits(milli)}` : '유료'}
    </span>
  )
}

/** 실행 전 확인 — 얼마가 빠지는지, 실패하면 어떻게 되는지를 먼저 말한다. */
export function PaidConfirm({
  milli, what, onYes, onNo, busy,
}: { milli: number | null | undefined; what: string; onYes: () => void; onNo: () => void; busy?: boolean }) {
  return (
    <div role="alertdialog" aria-label="크레딧 사용 확인" className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2">
      <p className="text-xs text-zinc-200">
        {what}에 <b className="text-primary">{typeof milli === 'number' ? `✦${formatPriceCredits(milli)}` : '크레딧'}</b>이 사용됩니다.
        만들지 못하면 자동으로 돌려드려요.
      </p>
      <div className="flex gap-2">
        <button type="button" onClick={onYes} disabled={busy || typeof milli !== 'number'}
          className="px-4 py-1.5 rounded-lg bg-primary text-black text-xs font-extrabold cursor-pointer disabled:opacity-40">
          {typeof milli === 'number' ? `✦${formatPriceCredits(milli)} 사용하고 시작` : '요금 확인 중…'}
        </button>
        <button type="button" onClick={onNo} disabled={busy} className="px-4 py-1.5 rounded-lg border border-[#262626] text-xs font-bold text-zinc-300 cursor-pointer">취소</button>
      </div>
    </div>
  )
}
