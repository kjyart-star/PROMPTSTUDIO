'use client';

import { useEffect, useState } from 'react';
import type { AlignState } from './useLyricSync';

export interface SyncLabels {
  est: string; estAudio: string; faster: string; slower: string; offsetReset: string;
  align: string; aligning: string; listening: string; alignFail: string; alignDone: string; alignAgain: string; realigned: string; offsetCleared: string;
  working: string; doneToast: string;
}

export const SYNC_LABELS = {
  KO: { est: '가사 시간 추정', estAudio: '가사 시간 추정 · 음원 분석', faster: '가사 빠르게', slower: '가사 느리게', offsetReset: '맞춤 되돌리기', align: '가사 자동 맞추기', aligning: '음성 모델 내려받는 중', listening: '노래 듣고 맞추는 중', alignFail: '자동으로 맞추지 못했어요', alignDone: '맞춤 완료', alignAgain: '다시 맞추기', realigned: '가사 시간을 다시 맞췄어요', offsetCleared: '가사 시간을 새로 맞추면서 직접 넣은 빠르게·느리게 값은 초기화했어요', working: '가사 맞추는 중', doneToast: '가사 시간 맞춤 완료' },
  EN: { est: 'Lyric timing estimated', estAudio: 'Lyric timing estimated · audio analysis', faster: 'Lyrics earlier', slower: 'Lyrics later', offsetReset: 'Reset offset', align: 'Auto-align lyrics', aligning: 'Downloading speech model', listening: 'Listening and aligning', alignFail: 'Could not align automatically', alignDone: 'Aligned', alignAgain: 'Align again', realigned: 'Lyric timing re-aligned', offsetCleared: 'Lyric timing is being redone, so your manual offset was reset', working: 'Syncing lyrics', doneToast: 'Lyric timing synced' },
  JA: { est: '歌詞タイミングは推定', estAudio: '歌詞タイミングは推定 · 音源分析', faster: '歌詞を早く', slower: '歌詞を遅く', offsetReset: 'ずれを戻す', align: '歌詞を自動で合わせる', aligning: '音声モデルを取得中', listening: '曲を聴いて合わせ中', alignFail: '自動で合わせられませんでした', alignDone: '合わせました', alignAgain: 'もう一度合わせる', realigned: '歌詞タイミングを合わせ直しました', offsetCleared: '歌詞タイミングを合わせ直すため、手動のずれ設定をリセットしました', working: '歌詞を合わせ中', doneToast: '歌詞タイミングを合わせました' },
} as const;

const STEP = 0.25;

/**
 * 맞추는 동안의 전체 진행률(0~100) — 음원 준비 0~5, 음성 모델 5~20, 노래 듣기 20~100.
 * 모델이 이미 캐시에 있으면 앞 두 단계는 순식간이라 사실상 「듣는 중」 진행률이 보인다. 맞추는 중이 아니면 null.
 */
export function alignPercent(a: AlignState): number | null {
  if (a.phase === 'decode') return 2;
  if (a.phase === 'download') return Math.round(5 + a.pct * 0.15);
  if (a.phase === 'listen') return Math.min(99, Math.round(20 + a.pct * 0.8));
  return null;
}

/** 가사 위쪽 알림 — 맞추는 동안 「가사 맞추는 중 38%」, 끝나면 「가사 시간 맞춤 완료」를 잠깐 */
export function AlignBanner({ labels: L, align }: { labels: SyncLabels; align: AlignState }) {
  const pct = alignPercent(align);
  const [toast, setToast] = useState(false);
  useEffect(() => {
    if (align.phase !== 'done') { setToast(false); return; }
    setToast(true);
    const t = setTimeout(() => setToast(false), 3200);
    return () => clearTimeout(t);
  }, [align.phase]);
  if (pct === null && !toast) return null;
  return (
    <div className={`imm-alignbar${pct === null ? ' is-done' : ''}`} role="status" aria-live="polite" data-testid="align-banner">
      <span>{pct === null ? L.doneToast : `${L.working} ${pct}%`}</span>
      {pct !== null && <i style={{ width: `${pct}%` }} />}
    </div>
  );
}
const fmtOffset = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(2)}s`;

interface Props {
  labels: SyncLabels;
  mode: 'exact' | 'estimated';
  basis?: 'audio' | 'length';
  offset: number;
  onOffset: (v: number) => void;
  align: AlignState;
  onAlign: () => void;
  /** 자동 맞춤으로 만든 시간표가 있을 때만 — 되돌리기 */
  canAlignAgain: boolean;
  /** 옛 시간표에 맞춰 넣었던 오프셋을 초기화했으면 true — 한 번 알린다 */
  realigned?: boolean;
}

/** 가사 아래 줄: 추정 표시 + 가사 빠르게/느리게(±0.25초, 곡별 기억) + 가사 자동 맞추기 */
export function LyricSyncBar({ labels: L, mode, basis, offset, onOffset, align, onAlign, canAlignAgain, realigned }: Props) {
  const busy = align.phase === 'download' || align.phase === 'listen';
  return (
    <div className="imm-sync">
      {mode === 'estimated' && <p className="imm-est">{basis === 'audio' ? L.estAudio : L.est}</p>}
      <div className="imm-sync-row">
        <button type="button" onClick={() => onOffset(offset + STEP)} title={L.faster}>{L.faster}</button>
        <button type="button" className="imm-sync-val" onClick={() => onOffset(0)} disabled={offset === 0} title={L.offsetReset} aria-label={L.offsetReset}>{fmtOffset(offset)}</button>
        <button type="button" onClick={() => onOffset(offset - STEP)} title={L.slower}>{L.slower}</button>
        {(mode === 'estimated' || canAlignAgain) && (
          <button type="button" className="imm-sync-align" onClick={onAlign} disabled={busy}>
            {canAlignAgain && !busy ? L.alignAgain : L.align}
          </button>
        )}
      </div>
      <p className="imm-sync-state" role="status" aria-live="polite">
        {align.phase === 'fail' && L.alignFail}
        {align.phase === 'done' && (realigned ? L.realigned : L.alignDone)}
        {(align.phase === 'idle' || align.phase === 'fail') && realigned && ` ${L.offsetCleared}`}
      </p>
    </div>
  );
}

export const SYNC_CSS = `
.imm-sync{padding-left:clamp(16px,2.4vw,32px)}
.imm-sync-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;align-items:center}
.imm-sync-row button{font-size:12px;color:rgba(255,255,255,.8);background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);border-radius:8px;padding:5px 10px;cursor:pointer}
.imm-sync-row button:hover:not(:disabled){background:rgba(255,255,255,.16)}
.imm-sync-row button:disabled{opacity:.5;cursor:default}
.imm-sync-val{font-variant-numeric:tabular-nums;min-width:64px}
.imm-alignbar{position:relative;margin:0 0 10px;padding:7px 12px;border-radius:8px;font-size:13px;font-weight:700;color:#fff;background:rgba(255,255,255,.12);overflow:hidden;font-variant-numeric:tabular-nums}
.imm-alignbar span{position:relative;z-index:1}
.imm-alignbar i{position:absolute;left:0;bottom:0;height:3px;background:#fff;transition:width .6s linear}
.imm-alignbar.is-done{background:rgba(120,220,150,.2)}
.imm-lyrics.is-aligning{opacity:.38;transition:opacity .35s}
.imm-sync-state{margin-top:6px;font-size:12px;color:rgba(255,255,255,.6);min-height:16px}
`;
