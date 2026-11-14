'use client'

import { useState } from 'react'
import { withBase } from '@/lib/basePath'
import { CONFIRM_PHRASE, GRACE_DAYS } from '@/lib/account/withdraw'

/**
 * 계정 삭제 창(감사 L-10): 안내 + 확인 문구 입력 → 최종 확인 → 삭제 요청 → 로그아웃.
 * 쿠키드림 계정 설정에도 같은 모양을 쓴다(서비스 간 import 금지라 COOKIELAB 쪽에 복사본이 있다).
 */
export function AccountDeleteDialog({ onClose, onDone }: { onClose: () => void; onDone: () => Promise<void> | void }) {
  const [step, setStep] = useState<'type' | 'final'>('type')
  const [phrase, setPhrase] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(withBase('/api/account/delete'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ confirm: CONFIRM_PHRASE }),
      })
      if (res.ok) {
        await onDone()
        return
      }
      const body = await res.json().catch(() => ({}))
      setError(typeof body?.error === 'string' ? body.error : '탈퇴하지 못했어요. 잠시 뒤 다시 시도해 주세요.')
    } catch {
      setError('네트워크가 불안정해요. 잠시 뒤 다시 시도해 주세요.')
    }
    setBusy(false)
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4" onClick={() => !busy && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="acct-del-title" className="w-full max-w-sm rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 text-left">
          <h3 id="acct-del-title" className="text-sm font-extrabold text-zinc-50 mb-3">{step === 'type' ? '계정 삭제' : '정말 삭제할까요?'}</h3>
          {step === 'type' ? (
            <>
              <ul className="text-xs leading-relaxed text-zinc-300 space-y-1.5 list-disc pl-4">
                <li>이름·이메일·프로필 사진·소개는 바로 지워져요.</li>
                <li>비공개 결과물은 {GRACE_DAYS}일 뒤 삭제돼요. 그 안에 문의하시면 보존할 수 있어요.</li>
                <li>공개한 작품은 남고, 만든 사람은 「탈퇴한 사용자」로 표시돼요.</li>
                <li>결제·크레딧 기록은 법에 따라 5년 동안 이름 없이 보관돼요.</li>
              </ul>
              <label className="block mt-4 text-xs text-zinc-400" htmlFor="acct-del-phrase">계속하려면 「{CONFIRM_PHRASE}」를 입력해 주세요.</label>
              <input id="acct-del-phrase" value={phrase} onChange={(e) => setPhrase(e.target.value)} autoComplete="off"
                className="mt-2 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-red-400" />
            </>
          ) : (
            <p className="text-xs leading-relaxed text-zinc-300">삭제하면 이 계정으로 다시 로그인할 수 없어요. 비공개 결과물은 {GRACE_DAYS}일 뒤 삭제돼요.</p>
          )}
          {error && <p role="alert" className="mt-3 text-xs text-red-400">{error}</p>}
        </div>
        <div className="flex items-center gap-3 p-4 bg-zinc-950 border-t border-white/10">
          <button type="button" disabled={busy} onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl font-bold text-xs text-zinc-100 bg-white/[0.06] hover:bg-white/[0.1] disabled:opacity-50">취소</button>
          {step === 'type' ? (
            <button type="button" disabled={phrase !== CONFIRM_PHRASE} onClick={() => setStep('final')} className="flex-1 px-4 py-2.5 rounded-xl font-bold text-xs text-white bg-red-500 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed">다음</button>
          ) : (
            <button type="button" disabled={busy} onClick={submit} className="flex-1 px-4 py-2.5 rounded-xl font-bold text-xs text-white bg-red-500 hover:brightness-110 disabled:opacity-60">{busy ? '삭제하는 중…' : '계정 삭제'}</button>
          )}
        </div>
      </div>
    </div>
  )
}
