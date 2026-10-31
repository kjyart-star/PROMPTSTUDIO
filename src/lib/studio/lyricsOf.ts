/**
 * 곡 기록(song_history 행)에서 가사를 찾는다.
 * 저장 위치가 곡마다 달라서 순서대로 본다: lyrics → form.lyrics → form.prompt(가사 입력칸 값).
 * 마스터링본·버전 파생곡은 원곡 가사를 물려받는다 — form.source_id / parent_id 를 따라 올라간다(최대 4단계).
 */
export function ownLyrics(item: any): string {
  const v = item?.lyrics || item?.form?.lyrics || item?.form?.prompt || '';
  return typeof v === 'string' ? v.trim() : '';
}

export function lyricsOfItem(item: any, all?: any[]): string {
  const own = ownLyrics(item);
  if (own || !all?.length) return own;
  const byId = new Map<string, any>(all.filter(Boolean).map((x) => [x.id, x]));
  let cur = item;
  for (let i = 0; i < 4; i++) {
    const pid = cur?.form?.source_id || cur?.form?.parent_id || cur?.parent_id;
    const parent = pid ? byId.get(pid) : null;
    if (!parent) break;
    const l = ownLyrics(parent);
    if (l) return l;
    cur = parent;
  }
  return '';
}

/** 스타일 한 줄 — 입력한 스타일 → form.style → 장르 */
export function styleOfItem(item: any): string {
  const v = item?.prompt || item?.form?.style || item?.genre || '';
  return typeof v === 'string' ? v.trim() : '';
}

/** 곡 기록에 저장된 가사 시간표(form.lrc). 마스터링본만 원곡 시간표를 물려받는다(재생성한 v2 등은 소리가 달라 물려받지 않는다) */
export function lrcOfItem(item: any, all?: any[]): { t: number; text: string }[] | null {
  const own = (x: any) => (Array.isArray(x?.form?.lrc) && x.form.lrc.length >= 2 ? (x.form.lrc as { t: number; text: string }[]) : null);
  const mine = own(item);
  if (mine || !all?.length || item?.form?.kind !== 'mastering') return mine;
  const byId = new Map<string, any>(all.filter(Boolean).map((x) => [x.id, x]));
  let cur = item;
  for (let i = 0; i < 4; i++) {
    const pid = cur?.form?.source_id || cur?.form?.parent_id || cur?.parent_id;
    const parent = pid ? byId.get(pid) : null;
    if (!parent) break;
    const l = own(parent);
    if (l) return l;
    cur = parent;
  }
  return null;
}
