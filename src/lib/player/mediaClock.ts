/** 지금 재생 중인 오디오 요소의 실제 재생 시각(media clock, 초). 재생 중인 요소가 없으면 0 */
export function playingAudioTime(): number {
  if (typeof document === 'undefined') return 0;
  for (const el of Array.from(document.querySelectorAll('audio'))) if (el.currentSrc) return el.currentTime || 0;
  return 0;
}
