/**
 * 음성 인식(가사 맞추기)은 브라우저 부담이 커서 한 번에 한 곡만 — 재생 화면과 스튜디오 백그라운드 큐가 같이 쓴다.
 * 지금 듣고 있는 곡이 우선이다: 재생 화면이 잠금을 못 잡으면 백그라운드 큐에 양보를 요청한다.
 */
let busy = false;
let preempt: (() => void) | null = null;

export function acquireAlignLock(): boolean {
  if (busy) return false;
  busy = true;
  return true;
}
export function releaseAlignLock() { busy = false; }
export const alignLockBusy = () => busy;

/** 백그라운드 큐가 「하던 곡을 멈추고 양보」하는 방법을 등록한다(해제는 null) */
export function setPreemptHandler(fn: (() => void) | null) { preempt = fn; }

/** 잠금을 잡는다. 이미 누가 쓰는 중이면 양보를 요청하고 잠깐(기본 6초) 기다린다 */
export async function acquireAlignLockSoon(timeoutMs = 6000): Promise<boolean> {
  if (acquireAlignLock()) return true;
  preempt?.();
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    await new Promise((r) => setTimeout(r, 150));
    if (acquireAlignLock()) return true;
  }
  return false;
}
