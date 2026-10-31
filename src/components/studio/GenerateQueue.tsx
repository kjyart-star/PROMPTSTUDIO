'use client'

type Lang = 'KO' | 'JA' | 'EN'

const T = {
  title: { KO: '작업 대기열', JA: '作業キュー', EN: 'Queue' },
  queuing: { KO: '대기 중', JA: '待機中', EN: 'Waiting' },
  generating: { KO: '생성 중', JA: '生成中', EN: 'Generating' },
  done: { KO: '완료', JA: '完了', EN: 'Done' },
  failed: { KO: '실패', JA: '失敗', EN: 'Failed' },
  retry: { KO: '설정 다시 불러오기', JA: '設定を読み込む', EN: 'Reload settings' },
  dismiss: { KO: '지우기', JA: '消す', EN: 'Dismiss' },
  hint: {
    KO: '실패한 작업은 설정만 입력칸에 다시 채워 드립니다. 크레딧은 「음악 생성」 버튼을 눌러야 차감됩니다.',
    JA: '失敗した作業は設定のみ入力欄に戻します。クレジットは生成ボタンを押したときのみ消費されます。',
    EN: 'A failed job only refills the form. Credits are charged only when you press Generate.',
  },
}

export interface QueueTask { id: string; title: string; status: string; state?: string; progress?: number }

/** Suno 생성 진행 + 최근 실패 목록. 다시 실행은 설정을 채울 뿐 — 돈이 나가는 일은 사용자가 생성 버튼으로 한다. */
export default function GenerateQueue({
  uiLanguage, tasks, failedRows, onRetry, onDismiss,
}: {
  uiLanguage: Lang
  tasks: QueueTask[]
  failedRows: { id: string; title?: string }[]
  onRetry: (row: any) => void
  onDismiss: (row: any) => void
}) {
  const l = uiLanguage
  const rows = failedRows
  if (!tasks.length && !rows.length) return null
  const shown = tasks.filter((t) => t.status !== 'failed')
  return (
    <section aria-label={T.title[l]} className="space-y-2 rounded-xl border border-[#1e1e1e] bg-black/25 p-3">
      <p className="text-[10px] font-black text-zinc-400 tracking-wider">{T.title[l]}</p>
      <ul className="space-y-1.5">
        {shown.map((t) => (
          <li key={t.id} className="space-y-1">
            <div className="flex items-center gap-2 text-xs">
              <span className="flex-1 min-w-0 truncate text-zinc-200">{t.title || 'Untitled'}</span>
              <span className="text-[11px] text-primary">
                {t.status === 'completed' ? T.done[l] : (t.state === 'generating' ? T.generating[l] : T.queuing[l])}
              </span>
            </div>
            <div className="h-1 rounded-full bg-[#222] overflow-hidden" role="progressbar" aria-valuenow={Math.round(t.progress ?? 0)} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full bg-primary transition-[width] motion-reduce:transition-none" style={{ width: `${t.status === 'completed' ? 100 : Math.round(t.progress ?? 0)}%` }} />
            </div>
          </li>
        ))}
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-2 text-xs">
            <span className="flex-1 min-w-0 truncate text-zinc-300">{r.title || 'Untitled'}</span>
            <span className="text-[11px] font-bold text-red-400">{T.failed[l]}</span>
            <button type="button" onClick={() => onRetry(r)} className="px-2 py-1 rounded-lg border border-[#262626] bg-[#161616] text-[11px] font-bold text-zinc-300 hover:text-primary hover:border-primary/40 cursor-pointer">{T.retry[l]}</button>
            <button type="button" onClick={() => onDismiss(r)} className="px-2 py-1 text-[11px] font-bold text-zinc-500 hover:text-white cursor-pointer">{T.dismiss[l]}</button>
          </li>
        ))}
      </ul>
      {rows.length > 0 && <p className="text-[10px] text-zinc-500">{T.hint[l]}</p>}
    </section>
  )
}
