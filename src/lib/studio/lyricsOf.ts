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

/**
 * 자동 맞추기 결과(form.lrc_auto)의 판 번호. 정렬 방식을 바꾸면 올린다 — 판이 다른 저장값은 무시하고 브라우저가 다시 계산한다(값은 지우지 않는다).
 * 2: whisper small 강제 정렬(어텐션 DTW) + 앞 줄 기준 창·줄 사이 음표 토큰(2026-11-01).
 */
export const LRC_AUTO_VERSION = 2

/**
 * 곡 기록에 저장된 가사 시간표. 사용자가 올리거나 편집한 form.lrc(lrc_by='user') → 현재 판의 자동 맞추기 결과(lrc_auto) 순.
 * lrc_by 표시가 없는 옛 form.lrc 는 1차 자동 맞추기(자유 인식, 2026-11-01 오전)가 그 자리에 저장한 값이라 쓰지 않는다 — 운영 확인 결과 2곡뿐이고 둘 다 2~7초 어긋났다.
 * 마스터링본만 원곡의 사용자 시간표를 물려받는다(재생성한 v2 등은 소리가 달라 물려받지 않는다).
 * 자동 맞추기 결과는 물려받지 않는다 — 마스터링에서 앞을 잘라 냈을 수 있고(잘라 낸 길이는 기록되지 않음), 마스터링본 음원으로 다시 맞추는 데 비용이 들지 않는다.
 */
export function lrcOfItem(item: any, all?: any[]): { t: number; text: string }[] | null {
  const own = (x: any) => {
    const f = x?.form
    if (f?.lrc_by === 'user' && Array.isArray(f?.lrc) && f.lrc.length >= 2) return f.lrc as { t: number; text: string }[]
    return f?.lrc_auto_v === LRC_AUTO_VERSION && Array.isArray(f?.lrc_auto) && f.lrc_auto.length >= 2 ? (f.lrc_auto as { t: number; text: string }[]) : null
  };
  const mine = own(item);
  if (mine || !all?.length || item?.form?.kind !== 'mastering') return mine;
  const byId = new Map<string, any>(all.filter(Boolean).map((x) => [x.id, x]));
  let cur = item;
  for (let i = 0; i < 4; i++) {
    const pid = cur?.form?.source_id || cur?.form?.parent_id || cur?.parent_id;
    const parent = pid ? byId.get(pid) : null;
    if (!parent) break;
    const f = parent.form
    if (f?.lrc_by === 'user' && Array.isArray(f?.lrc) && f.lrc.length >= 2) return f.lrc as { t: number; text: string }[]
    cur = parent;
  }
  return null;
}
