import type { Track } from '@/types/music';

/** 화면에 보이는 앨범 이름 — 스튜디오에서 만든 곡의 내부 이름(영어)을 한국어로 바꿔 보여 준다. */
export function albumLabel(t?: Track | null): string {
  const a = (t as any)?.album;
  if (!a) return '';
  if (a.id === 'studio-generated' || a.title === 'Studio Generation') return '스튜디오에서 만든 곡';
  return a.title || '';
}
