import React from 'react';

/**
 * CookieMusic Studio와 같은 LP 규칙.
 * 위치를 잡는 레이어와 회전 레이어를 분리해 translate와 rotate가 충돌하지 않는다.
 */
export const DISC_CSS = `
@keyframes cms-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.cms-disc {
  border-radius: 9999px;
  background:
    radial-gradient(circle at 50% 50%, var(--background) 0 3%, transparent 3.2%),
    radial-gradient(circle at 50% 38%, color-mix(in srgb, var(--background) 70%, transparent) 0 2%, transparent 2.2%),
    radial-gradient(circle at 50% 50%, var(--primary, var(--cm-brand)) 0 18%, transparent 18.4%),
    conic-gradient(from 0deg,
      transparent 0deg 12deg,
      color-mix(in srgb, var(--foreground) 12%, transparent) 26deg,
      transparent 40deg 192deg,
      color-mix(in srgb, var(--foreground) 12%, transparent) 206deg,
      transparent 220deg 360deg),
    repeating-radial-gradient(circle at 50% 50%,
      color-mix(in srgb, var(--foreground) 10%, transparent) 0 0.5%,
      transparent 0.5% 2.6%),
    color-mix(in srgb, var(--foreground) 7%, var(--background));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--foreground) 26%, transparent);
  animation: cms-spin 3.6s linear infinite;
}
.cms-disc[data-spin='false'] { animation-play-state: paused; }
@media (prefers-reduced-motion: reduce) { .cms-disc { animation: none; } }
`;

export const DiscStyles: React.FC = () => <style>{DISC_CSS}</style>;

export const Disc: React.FC<{ spinning: boolean }> = ({ spinning }) => (
  <span
    aria-hidden
    style={{ height: '96%', transform: 'translate(33%,-50%)' }}
    className="pointer-events-none absolute top-1/2 right-0 z-0 block aspect-square"
  >
    <span data-spin={spinning ? 'true' : 'false'} className="cms-disc block h-full w-full" />
  </span>
);
