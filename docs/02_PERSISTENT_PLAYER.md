# 🎧 Persistent Player — 완성 코드 패키지

> **이 파일을 안티그라비티에 통째로 던지세요.** Task 7 단독 세션용.
> 페이지를 이동해도 음악이 끊기지 않는 전역 플레이어 구현.

---

## 아키텍처 개요

```
┌─────────────────────────────────────────────┐
│  Root Layout (app/(public)/layout.tsx)      │
│  ┌─────────────────────────────────────┐    │
│  │  {children}                         │    │
│  │   ↓ (어디서든)                       │    │
│  │   playerStore.playTrack(track)      │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │  <PersistentPlayer />               │    │
│  │  - <audio ref> 1개만 존재           │    │
│  │  - playerStore 상태 구독            │    │
│  │  - 30초 이상 재생 → /api/play 호출  │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

**핵심 원칙**:
1. `<audio>` 태그는 앱 전체에 **단 하나만** 존재 (PersistentPlayer 내부).
2. 어떤 컴포넌트도 자기 `<audio>`를 만들지 않음 → 모두 `playerStore.playTrack()` 호출.
3. 라우터 이동은 React Server Component 내부에서 일어나므로 클라이언트 사이드 `<audio>`는 살아있음.

---

## 1. 의존성 설치

```bash
npm install zustand
npm install @supabase/supabase-js @supabase/ssr
npm install lucide-react   # 아이콘
```

---

## 2. 타입 정의 — `src/types/music.ts`

```typescript
export type ReleaseType = 'single' | 'ep' | 'lp' | 'compilation';
export type Status = 'draft' | 'published' | 'archived';

export interface Artist {
  id: string;
  slug: string;
  name: string;
  avatar_url: string | null;
}

export interface Album {
  id: string;
  slug: string;
  title: string;
  cover_url: string | null;
  release_type: ReleaseType;
  artist: Artist;
}

export interface Track {
  id: string;
  album_id: string;
  track_number: number;
  title: string;
  duration_sec: number | null;
  file_url: string;              // 서명 URL 또는 public URL
  lyrics: string | null;
  style_prompt: string | null;
  bpm: number | null;
  song_key: string | null;
  // 조인된 데이터
  album?: Album;
}
```

---

## 3. Zustand Store — `src/stores/playerStore.ts`

```typescript
'use client';

import { create } from 'zustand';
import type { Track } from '@/types/music';

interface PlayerState {
  // 현재 재생 정보
  currentTrack: Track | null;
  queue: Track[];           // 다음에 재생할 트랙 큐
  queueIndex: number;       // queue 안에서 currentTrack의 위치

  // 재생 상태
  isPlaying: boolean;
  progress: number;         // 0~1
  currentTime: number;      // 초
  duration: number;         // 초
  volume: number;           // 0~1
  isMuted: boolean;

  // 로깅용
  playStartTime: number | null;
  hasLoggedPlay: boolean;   // 30초 임계점 통과 여부

  // 액션
  playTrack: (track: Track, queue?: Track[]) => void;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  // 내부용 (PersistentPlayer가 호출)
  _setIsPlaying: (v: boolean) => void;
  _setProgress: (currentTime: number, duration: number) => void;
  _markPlayLogged: () => void;
  _resetPlayLog: () => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: null,
  queue: [],
  queueIndex: -1,
  isPlaying: false,
  progress: 0,
  currentTime: 0,
  duration: 0,
  volume: 0.8,
  isMuted: false,
  playStartTime: null,
  hasLoggedPlay: false,

  playTrack: (track, queue) => {
    const newQueue = queue ?? [track];
    const newIndex = newQueue.findIndex((t) => t.id === track.id);
    set({
      currentTrack: track,
      queue: newQueue,
      queueIndex: newIndex >= 0 ? newIndex : 0,
      isPlaying: true,
      progress: 0,
      currentTime: 0,
      playStartTime: Date.now(),
      hasLoggedPlay: false,
    });
  },

  togglePlay: () => {
    const { currentTrack, isPlaying } = get();
    if (!currentTrack) return;
    set({ isPlaying: !isPlaying });
  },

  next: () => {
    const { queue, queueIndex } = get();
    if (queueIndex < 0 || queueIndex >= queue.length - 1) return;
    const nextTrack = queue[queueIndex + 1];
    set({
      currentTrack: nextTrack,
      queueIndex: queueIndex + 1,
      isPlaying: true,
      progress: 0,
      currentTime: 0,
      playStartTime: Date.now(),
      hasLoggedPlay: false,
    });
  },

  prev: () => {
    const { queue, queueIndex, currentTime } = get();
    // 3초 이상 재생됐으면 처음으로, 아니면 이전 트랙
    if (currentTime > 3) {
      set({ progress: 0, currentTime: 0 });
      return;
    }
    if (queueIndex <= 0) return;
    const prevTrack = queue[queueIndex - 1];
    set({
      currentTrack: prevTrack,
      queueIndex: queueIndex - 1,
      isPlaying: true,
      progress: 0,
      currentTime: 0,
      playStartTime: Date.now(),
      hasLoggedPlay: false,
    });
  },

  seek: (time) => {
    // 실제 audio 요소 시킹은 PersistentPlayer가 처리
    set({ currentTime: time });
  },

  setVolume: (volume) => set({ volume, isMuted: volume === 0 }),
  toggleMute: () => set((s) => ({ isMuted: !s.isMuted })),

  _setIsPlaying: (v) => set({ isPlaying: v }),
  _setProgress: (currentTime, duration) =>
    set({
      currentTime,
      duration,
      progress: duration > 0 ? currentTime / duration : 0,
    }),
  _markPlayLogged: () => set({ hasLoggedPlay: true }),
  _resetPlayLog: () =>
    set({ playStartTime: Date.now(), hasLoggedPlay: false }),
}));
```

---

## 4. Persistent Player 컴포넌트 — `src/components/player/PersistentPlayer.tsx`

```tsx
'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Play, Pause, SkipBack, SkipForward,
  Volume2, VolumeX,
} from 'lucide-react';
import { usePlayerStore } from '@/stores/playerStore';

export function PersistentPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const seekRef = useRef<HTMLInputElement>(null);

  const {
    currentTrack, isPlaying, progress, currentTime, duration,
    volume, isMuted, hasLoggedPlay,
    togglePlay, next, prev, seek, setVolume, toggleMute,
    _setIsPlaying, _setProgress, _markPlayLogged,
  } = usePlayerStore();

  // 트랙 변경 시 src 변경 + 자동 재생
  useEffect(() => {
    if (!audioRef.current || !currentTrack) return;
    audioRef.current.src = currentTrack.file_url;
    audioRef.current.load();
    if (isPlaying) {
      audioRef.current.play().catch(() => {
        // 자동재생 차단 시
        _setIsPlaying(false);
      });
    }
  }, [currentTrack?.id]);

  // 재생/일시정지 상태 동기화
  useEffect(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.play().catch(() => _setIsPlaying(false));
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying]);

  // 볼륨 동기화
  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  // 30초 이상 재생 시 /api/play 호출
  useEffect(() => {
    if (!currentTrack || hasLoggedPlay) return;
    if (currentTime >= 30) {
      fetch('/api/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          track_id: currentTrack.id,
          duration_played: Math.floor(currentTime),
        }),
      }).catch(() => {});
      _markPlayLogged();
    }
  }, [currentTime, currentTrack?.id, hasLoggedPlay]);

  // 시킹 핸들러
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
    seek(newTime);
  };

  // 트랙 없으면 숨김
  if (!currentTrack) return null;

  return (
    <>
      {/* 실제 audio element — 화면에 보이지 않음 */}
      <audio
        ref={audioRef}
        onPlay={() => _setIsPlaying(true)}
        onPause={() => _setIsPlaying(false)}
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          _setProgress(el.currentTime, el.duration || 0);
        }}
        onEnded={() => next()}
        preload="metadata"
      />

      {/* 하단 고정 플레이어 UI */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 py-3">
          <div className="grid grid-cols-3 items-center gap-4">
            {/* 좌: 트랙 정보 */}
            <div className="flex items-center gap-3 min-w-0">
              {currentTrack.album?.cover_url && (
                <Image
                  src={currentTrack.album.cover_url}
                  alt=""
                  width={48}
                  height={48}
                  className="rounded shrink-0"
                />
              )}
              <div className="min-w-0">
                <Link
                  href={`/albums/${currentTrack.album?.slug ?? ''}`}
                  className="block truncate text-sm font-medium text-white hover:underline"
                >
                  {currentTrack.title}
                </Link>
                <Link
                  href={`/artists/${currentTrack.album?.artist.slug ?? ''}`}
                  className="block truncate text-xs text-zinc-400 hover:underline"
                >
                  {currentTrack.album?.artist.name}
                </Link>
              </div>
            </div>

            {/* 중: 컨트롤 + 진행바 */}
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-4">
                <button
                  onClick={prev}
                  className="text-zinc-400 hover:text-white"
                  aria-label="이전 트랙"
                >
                  <SkipBack size={18} />
                </button>
                <button
                  onClick={togglePlay}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black hover:scale-105 transition"
                  aria-label={isPlaying ? '일시정지' : '재생'}
                >
                  {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
                </button>
                <button
                  onClick={next}
                  className="text-zinc-400 hover:text-white"
                  aria-label="다음 트랙"
                >
                  <SkipForward size={18} />
                </button>
              </div>
              <div className="flex items-center gap-2 w-full">
                <span className="text-xs text-zinc-400 tabular-nums w-10 text-right">
                  {formatTime(currentTime)}
                </span>
                <input
                  ref={seekRef}
                  type="range"
                  min={0}
                  max={duration || 0}
                  value={currentTime}
                  onChange={handleSeek}
                  className="flex-1 h-1 accent-white"
                />
                <span className="text-xs text-zinc-400 tabular-nums w-10">
                  {formatTime(duration)}
                </span>
              </div>
            </div>

            {/* 우: 볼륨 */}
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={toggleMute}
                className="text-zinc-400 hover:text-white"
                aria-label={isMuted ? '음소거 해제' : '음소거'}
              >
                {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={isMuted ? 0 : volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-24 h-1 accent-white"
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
```

---

## 5. 루트 레이아웃에 마운트 — `src/app/(public)/layout.tsx`

```tsx
import { PersistentPlayer } from '@/components/player/PersistentPlayer';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen pb-24"> {/* pb-24: 하단 플레이어 공간 확보 */}
      {children}
      <PersistentPlayer />
    </div>
  );
}
```

> 어드민에서도 플레이어 쓰려면 `app/(admin)/admin/music/layout.tsx`에도 동일하게 마운트.

---

## 6. 재생 이벤트 API — `src/app/api/play/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

export async function POST(req: Request) {
  const body = await req.json();
  const { track_id, duration_played } = body;

  if (!track_id || typeof duration_played !== 'number') {
    return NextResponse.json({ error: 'invalid' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // IP 해시 (개인정보 X)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown';
  const ip_hash = crypto
    .createHash('sha256')
    .update(ip + (process.env.IP_SALT ?? 'salt'))
    .digest('hex')
    .substring(0, 16);

  const { error } = await supabase.from('play_events').insert({
    track_id,
    user_id: user?.id ?? null,
    duration_played,
    ip_hash,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
```

---

## 7. 사용 예시 — 어디서든 재생 시작

```tsx
'use client';
import { usePlayerStore } from '@/stores/playerStore';

export function PlayButton({ track, queue }: { track: Track; queue?: Track[] }) {
  const playTrack = usePlayerStore((s) => s.playTrack);

  return (
    <button onClick={() => playTrack(track, queue)}>
      재생
    </button>
  );
}
```

앨범 페이지에서 전체 재생:
```tsx
<button onClick={() => playTrack(tracks[0], tracks)}>
  앨범 전체 재생
</button>
```

---

## 8. 체크리스트

작업 끝나고 이거 다 통과하면 OK:

- [ ] 트랙 재생 후 다른 페이지로 이동해도 음악이 끊기지 않음
- [ ] 페이지 이동해도 하단 플레이어 UI가 그대로 유지됨
- [ ] 일시정지/재생, 이전/다음 트랙, 시킹, 볼륨 전부 동작
- [ ] 30초 이상 재생 시 `play_events` 테이블에 row 추가됨
- [ ] 1번 재생당 1번만 로깅됨 (30초 넘게 재생해도 중복 INSERT 없음)
- [ ] 모바일에서도 플레이어가 화면 하단에 정상 표시됨

---

## 9. 자주 막히는 부분

**❌ "재생 버튼 눌렀는데 소리가 안 나요"**
→ 브라우저 자동재생 정책. 사용자 인터랙션(클릭) 후 첫 재생은 OK, 그 이전 자동재생은 차단됨. `playTrack`은 항상 클릭 핸들러 안에서만 호출.

**❌ "페이지 이동하면 다시 처음부터 재생됨"**
→ PersistentPlayer가 자식 레이아웃이 아니라 루트 레이아웃에 있어야 함. (public) 그룹 안의 모든 페이지가 같은 layout.tsx를 공유하는지 확인.

**❌ "duration이 NaN으로 나옴"**
→ mp3 파일에 메타데이터 없을 때. `preload="metadata"` 속성 확인하고, 그래도 안 되면 업로드 시 서버에서 ffprobe로 추출해서 DB에 저장.

**❌ "play_events에 중복 INSERT됨"**
→ `hasLoggedPlay` 플래그가 트랙 변경 시 리셋되는지 확인 (`playTrack`, `next`, `prev`에서 `hasLoggedPlay: false`).

---

이 패키지대로 만들면 Phase 2의 모든 페이지(앨범/아티스트/차트)에서 재생 기능을 그냥 `playTrack()` 한 줄로 쓸 수 있습니다.
