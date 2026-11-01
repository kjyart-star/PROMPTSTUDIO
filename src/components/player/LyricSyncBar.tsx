'use client';

import type { AlignState } from './useLyricSync';

export interface SyncLabels {
  est: string; estAudio: string; faster: string; slower: string; offsetReset: string;
  align: string; aligning: string; listening: string; alignFail: string; alignDone: string; alignAgain: string; realigned: string; offsetCleared: string;
}

export const SYNC_LABELS = {
  KO: { est: '가사 시간 추정', estAudio: '가사 시간 추정 · 음원 분석', faster: '가사 빠르게', slower: '가사 느리게', offsetReset: '맞춤 되돌리기', align: '가사 자동 맞추기', aligning: '음성 모델 내려받는 중', listening: '노래 듣고 맞추는 중', alignFail: '자동으로 맞추지 못했어요', alignDone: '맞춤 완료', alignAgain: '다시 맞추기', realigned: '가사 시간을 다시 맞췄어요', offsetCleared: '가사 시간을 새로 맞추면서 직접 넣은 빠르게·느리게 값은 초기화했어요' },
  EN: { est: 'Lyric timing estimated', estAudio: 'Lyric timing estimated · audio analysis', faster: 'Lyrics earlier', slower: 'Lyrics later', offsetReset: 'Reset offset', align: 'Auto-align lyrics', aligning: 'Downloading speech model', listening: 'Listening and aligning', alignFail: 'Could not align automatically', alignDone: 'Aligned', alignAgain: 'Align again', realigned: 'Lyric timing re-aligned', offsetCleared: 'Lyric timing is being redone, so your manual offset was reset' },
  JA: { est: '歌詞タイミングは推定', estAudio: '歌詞タイミングは推定 · 音源分析', faster: '歌詞を早く', slower: '歌詞を遅く', offsetReset: 'ずれを戻す', align: '歌詞を自動で合わせる', aligning: '音声モデルを取得中', listening: '曲を聴いて合わせ中', alignFail: '自動で合わせられませんでした', alignDone: '合わせました', alignAgain: 'もう一度合わせる', realigned: '歌詞タイミングを合わせ直しました', offsetCleared: '歌詞タイミングを合わせ直すため、手動のずれ設定をリセットしました' },
} as const;

const STEP = 0.25;
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
        {align.phase === 'download' && `${L.aligning}${align.pct ? ` ${align.pct}%` : '…'}`}
        {align.phase === 'listen' && `${L.listening}…`}
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
.imm-sync-state{margin-top:6px;font-size:12px;color:rgba(255,255,255,.6);min-height:16px}
`;
