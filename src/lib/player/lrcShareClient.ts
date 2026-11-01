'use client';

import { withBase } from '@/lib/basePath';
import { LRC_AUTO_VERSION, LRC_BROWSER_MODEL } from '@/lib/studio/lyricsOf';
import type { TimedLine } from './lyricTiming';

/** 웹 브라우저 정렬기 정보 — 앱은 같은 자리에 ios/android·whisper.cpp 등을 넣는다(src/lib/lyricsSync/submission.ts) */
const WEB_CLIENT = { client: 'web', engine: 'transformers.js', model: LRC_BROWSER_MODEL } as const;

/**
 * 곡 시간표 받기 — 웹과 앱이 같은 읽기 API(GET /api/lyrics-sync/{id}, ETag)를 쓴다. 실패는 조용히(null).
 * 'failed' = 믿을 수 없다고 접은 곡(브라우저도 계산하지 않고 일반 가사로 둔다)
 */
export async function fetchSharedLrc(id: string, _version: number = LRC_AUTO_VERSION): Promise<TimedLine[] | null | 'failed'> {
  try {
    const res = await fetch(withBase(`/api/lyrics-sync/${encodeURIComponent(id)}`));
    if (!res.ok) {
      const body = typeof (res as any).json === 'function' ? await res.json().catch(() => null) : null;
      return body?.failed ? 'failed' : null;
    }
    const data = await res.json();
    if (data?.failed) return 'failed';
    return Array.isArray(data?.lines) && data.lines.length >= 2 ? (data.lines as TimedLine[]) : null;
  } catch {
    return null;
  }
}

/** 남의 공개 곡 결과 제출 — 다른 사람 결과와 1초 안에서 일치해야 공개 결과가 된다(서버 검증) */
export async function submitSharedLrc(id: string, lrc: TimedLine[], version: number): Promise<boolean> {
  try {
    const res = await fetch(withBase('/api/song-lrc-auto'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ song_id: id, lrc, v: version, ...WEB_CLIENT }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** 내 곡 결과 저장 — 곡 기록 form.lrc_auto 에 둔다. 공개 대기 중이던 곡이면 서버가 이때 공개한다 */
export function saveOwnLrc(id: string, lrc: TimedLine[], lowConfidence = false): Promise<Response> {
  return fetch(`/api/song-history/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lrc_auto: lrc, lrc_auto_v: LRC_AUTO_VERSION, ...WEB_CLIENT, ...(lowConfidence ? { lrc_review: true } : {}) }),
  });
}
