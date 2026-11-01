import { lrcAutoReadable, lyricsOfItem } from '@/lib/studio/lyricsOf';
import { alignLineTexts } from './lrcValidate';

/**
 * 스튜디오 가사 시간 미리 계산 — 내 곡 중 가사가 있고 자동 맞춤(v2)이 없는 곡을 한 곡씩 순서대로 처리하는 큐.
 * 브라우저 작업(디코드·음성 인식·저장)은 processOne 으로 주입받는다(테스트에서 가짜로 갈아 끼운다).
 */

/** 맞춰야 할 곡 — 최신순 */
export function pendingLrcSongs(history: any[], skip?: (id: string) => boolean): any[] {
  return history.filter((it) => {
    if (!it?.id || it.trashed_at || it.status === 'processing') return false;
    if (!(it.audio_url || it.stream_url || it.url)) return false;
    const f = it.form;
    if (f?.lrc_by === 'user' && Array.isArray(f?.lrc) && f.lrc.length >= 2) return false; // 사용자 시간표가 우선
    if (lrcAutoReadable(f?.lrc_auto_v) && Array.isArray(f?.lrc_auto) && f.lrc_auto.length >= 2) return false;
    if (skip?.(it.id)) return false;
    return alignLineTexts(lyricsOfItem(it, history)).length >= 2;
  });
}

export type JobResult = 'saved' | 'failed';
export interface PrecomputeProgress { done: number; total: number; pct: number }

export interface PrecomputeDeps {
  getHistory: () => any[];
  /** 한 곡을 맞춰 서버에 저장한다. signal 이 중단되면 throw 해도 된다 */
  processOne: (item: any, signal: AbortSignal, onPct: (pct: number) => void) => Promise<JobResult>;
  onProgress: (p: PrecomputeProgress | null) => void;
  /** 이미 시도한 곡(이번 접속 동안 다시 시도하지 않는다) 외에 건너뛸 곡 — 최근 실패 등 */
  skip?: (id: string) => boolean;
  /** 다른 곳(재생 화면)이 음성 인식을 돌리고 있지 않은지 확인하고 잡는다 */
  acquire: () => boolean;
  release: () => void;
  sleep?: (ms: number) => Promise<void>;
  /** 곡과 곡 사이 쉬는 시간 */
  gapMs?: number;
  /** 연속 실패가 이만큼 나면 접는다(모델 내려받기 실패·오프라인 등) */
  maxFailStreak?: number;
}

export class LrcPrecomputeQueue {
  readonly attempted = new Set<string>();
  private stopped = false;
  private visible = true;
  private job: AbortController | null = null;
  private wake: (() => void)[] = [];

  constructor(private d: PrecomputeDeps) {}

  setVisible(v: boolean) {
    this.visible = v;
    if (!v) this.job?.abort(); // 탭이 숨겨지면 하던 곡을 멈춘다(다시 보이면 그 곡부터 다시)
    else this.flush();
  }

  /** 재생 화면이 잠금을 달라고 할 때 — 하던 곡을 멈춘다(그 곡은 나중에 다시) */
  preempt() { this.job?.abort(); }

  stop() {
    this.stopped = true;
    this.job?.abort();
    this.flush();
  }

  private flush() { const w = this.wake; this.wake = []; w.forEach((f) => f()); }
  private waitVisible() { return new Promise<void>((r) => this.wake.push(r)); }

  async run(): Promise<void> {
    const sleep = this.d.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
    const gap = this.d.gapMs ?? 3000;
    const maxFail = this.d.maxFailStreak ?? 3;
    let done = 0;
    let failStreak = 0;
    try {
      while (!this.stopped) {
        if (!this.visible) { await this.waitVisible(); continue; }
        const todo = pendingLrcSongs(this.d.getHistory(), (id) => this.attempted.has(id) || !!this.d.skip?.(id));
        if (!todo.length) break;
        if (!this.d.acquire()) { await sleep(3000); continue; } // 재생 화면이 맞추는 중 — 끝나길 기다린다
        const item = todo[0];
        const ctl = new AbortController();
        this.job = ctl;
        this.d.onProgress({ done, total: done + todo.length, pct: 0 });
        let result: JobResult | 'aborted';
        try {
          result = await this.d.processOne(item, ctl.signal, (pct) => this.d.onProgress({ done, total: done + todo.length, pct }));
        } catch {
          result = ctl.signal.aborted ? 'aborted' : 'failed';
        } finally {
          this.job = null;
          this.d.release();
        }
        if (result === 'aborted' || (ctl.signal.aborted && result !== 'saved')) { // 숨김·양보·중지 — 시도한 것으로 세지 않는다
          if (!this.stopped) await sleep(gap);
          continue;
        }
        this.attempted.add(item.id);
        done++;
        failStreak = result === 'saved' ? 0 : failStreak + 1;
        if (failStreak >= maxFail) break;
        await sleep(gap);
      }
    } finally {
      this.d.onProgress(null);
    }
  }
}
