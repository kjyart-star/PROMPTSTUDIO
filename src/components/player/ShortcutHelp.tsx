'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { usePlayerStore } from '@/stores/playerStore';
import { SHORTCUT_GROUPS } from './playerShortcuts';

/** 플레이어 단축키 안내 창. Esc·? 로 닫고, 열려 있는 동안 Esc 가 아래 전체 화면까지 닫지 않게 먼저 가로챈다. */
export function ShortcutHelp() {
  const open = usePlayerStore((s) => s.isShortcutHelpOpen);
  const setOpen = usePlayerStore((s) => s.setShortcutHelpOpen);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === '?') { e.preventDefault(); e.stopPropagation(); setOpen(false); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, setOpen]);
  if (!open) return null;
  const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform || '');
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4" onClick={() => setOpen(false)} data-testid="shortcut-help">
      <div role="dialog" aria-modal="true" aria-label="단축키 안내" onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[86vh] overflow-y-auto rounded-xl border border-white/10 bg-[#141416] p-5 text-zinc-100 shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold">단축키 안내</h2>
          <button type="button" onClick={() => setOpen(false)} aria-label="닫기" className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/10"><X size={16} /></button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {SHORTCUT_GROUPS.map((g) => (
            <section key={g.title}>
              <h3 className="mb-1.5 text-[11px] font-bold tracking-widest text-zinc-400">{g.title}</h3>
              <ul className="space-y-1.5">
                {g.items.map((it) => (
                  <li key={it.keys} className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="text-zinc-300">{it.label}</span>
                    <kbd className="shrink-0 rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono text-[11px]">{it.keys}</kbd>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <p className="mt-4 text-[11px] text-zinc-500">입력칸에 글을 쓰는 중이거나 마스터링·가사 시간 편집 화면에서는 그 화면의 단축키가 먼저 동작해요.{isMac ? ' Cmd' : ' Ctrl'} 조합은 브라우저에 넘깁니다.</p>
      </div>
    </div>
  );
}
