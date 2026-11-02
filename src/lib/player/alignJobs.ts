/**
 * 곡별 가사 정렬 작업 등록부 — 같은 곡을 두 번 계산하지 않는다.
 * 생성·업로드 직후 백그라운드 계산(LrcPrecompute)이 돌고 있을 때 「공개하기」를 누르면, 공개 창은 새로 계산하지 않고
 * 그 작업을 기다리며 남은 진행률만 보여 준다.
 */
export type AlignLrc = { t: number; text: string }[];
interface Job { promise: Promise<AlignLrc | null>; pct: number; subs: Set<(p: number) => void> }
const jobs = new Map<string, Job>();

/** 이 곡의 작업을 시작한다(이미 돌고 있으면 그 작업을 돌려준다). 결과 null = 맞추지 못함 */
export function runAlignJob(id: string, fn: (onPct: (pct: number) => void) => Promise<AlignLrc | null>): Promise<AlignLrc | null> {
  const ex = jobs.get(id);
  if (ex) return ex.promise;
  const job = { pct: 0, subs: new Set() } as unknown as Job;
  const onPct = (p: number) => { job.pct = p; job.subs.forEach((f) => f(p)); };
  jobs.set(id, job);
  job.promise = Promise.resolve().then(() => fn(onPct)).finally(() => { jobs.delete(id); });
  return job.promise;
}

/** 돌고 있는 작업을 지켜본다(진행률을 바로 한 번, 이후 바뀔 때마다). 없으면 null */
export function watchAlignJob(id: string, onPct: (pct: number) => void): Promise<AlignLrc | null> | null {
  const j = jobs.get(id);
  if (!j) return null;
  onPct(j.pct);
  j.subs.add(onPct);
  return j.promise.finally(() => j.subs.delete(onPct));
}

/** 테스트용 — 등록부 비우기 */
export function resetAlignJobs() { jobs.clear(); }
