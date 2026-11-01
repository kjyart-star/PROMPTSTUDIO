'use client';

import { withBase } from '@/lib/basePath';
import type { TimedLine } from './lyricTiming';

/** 공개 곡 자동 맞춤 결과 공유 — 서버(song_lrc_auto)에서 받기·보내기. 실패는 조용히(브라우저 계산으로 이어진다) */
export async function fetchSharedLrc(id: string, version: number): Promise<TimedLine[] | null> {
  try {
    const res = await fetch(withBase(`/api/song-lrc-auto?id=${encodeURIComponent(id)}&v=${version}`));
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data?.lrc) && data.lrc.length >= 2 ? (data.lrc as TimedLine[]) : null;
  } catch {
    return null;
  }
}

export async function submitSharedLrc(id: string, lrc: TimedLine[], version: number): Promise<boolean> {
  try {
    const res = await fetch(withBase('/api/song-lrc-auto'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ song_id: id, lrc, v: version }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
