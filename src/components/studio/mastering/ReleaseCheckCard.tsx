'use client'

/**
 * 발매 점검 결과 카드 — 6항목 신호등(통과·주의·문제) + 통과 못 한 항목의 원인·해결 방법.
 * 간단 마스터링 결과, 고급 마스터링 내보내기, 「발매 점검」 도구가 같이 쓴다.
 */
import { worstStatus, type CheckItem, type CheckStatus } from '@/lib/mastering/releaseCheck'

const COLOR: Record<CheckStatus, string> = { ok: '#2ed48a', warn: '#f0a43a', bad: '#e5484d' }
const WORD: Record<CheckStatus, string> = { ok: '통과', warn: '주의', bad: '문제' }

export function ReleaseCheckCard({ items, title = '발매 점검', note, retried, compact = false }: {
  items: CheckItem[]
  title?: string
  /** 카드 아래 한 줄(예: 「줄인 고음: 최대 -3.2 dB」) */
  note?: string
  /** 자동으로 다시 처리했으면 바꾼 내용 */
  retried?: string[]
  compact?: boolean
}) {
  const w = worstStatus(items)
  const head = w === 'ok' ? '발매 점검 통과' : w === 'warn' ? '확인하면 좋은 항목이 있어요' : '고치면 좋은 문제가 있어요'
  const issues = items.filter(i => i.status !== 'ok')
  return (
    <section aria-label={title} data-testid="release-check" className="rounded-xl border border-[#262626] bg-[#111] p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span aria-hidden className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: COLOR[w] }} />
        <h4 className="text-xs font-bold text-white">{title}</h4>
        <span className="text-[11px] font-bold" style={{ color: COLOR[w] }}>{head}</span>
      </div>
      <ul className={`grid gap-1.5 ${compact ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-3'}`}>
        {items.map(i => (
          <li key={i.id} data-check={i.id} data-status={i.status} className="min-w-0 rounded-lg border border-[#222] bg-[#161616] px-2 py-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <span aria-hidden className="shrink-0 inline-block w-2 h-2 rounded-full" style={{ background: COLOR[i.status] }} />
              <span className="text-[11px] font-bold text-zinc-200 truncate">{i.label}</span>
              <span className="ml-auto shrink-0 text-[10px] font-bold" style={{ color: COLOR[i.status] }}>{WORD[i.status]}</span>
            </div>
            {!compact && <div className="text-[10px] text-zinc-500 mt-0.5 break-words">{i.value}</div>}
          </li>
        ))}
      </ul>
      {retried && retried.length > 0 && (
        <p className="text-[11px] text-zinc-400">처음 결과에서 문제가 보여 자동으로 한 번 다시 처리했어요: {retried.join(', ')}.</p>
      )}
      {!compact && issues.length > 0 && (
        <ul className="space-y-1" aria-label="원인과 해결 방법">
          {issues.map(i => (
            <li key={i.id} className="text-[11px] leading-relaxed">
              <span className="font-bold" style={{ color: COLOR[i.status] }}>{i.label}</span>
              <span className="text-zinc-300"> · {i.cause}</span>
              {i.fix && <span className="block text-zinc-500">해결: {i.fix}</span>}
            </li>
          ))}
        </ul>
      )}
      {note && <p className="text-[11px] text-zinc-400">{note}</p>}
    </section>
  )
}
