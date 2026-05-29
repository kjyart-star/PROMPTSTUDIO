# 🎵 AI Music Platform — 프로젝트 브리프

> **안티그라비티 / Cursor 등 AI IDE에 첫 컨텍스트로 던질 문서**
> 새 세션 시작할 때마다 이 파일을 먼저 읽히고 작업을 시작하세요.

---

## 1. 한 줄 설명

**AI로 만든 음악(Suno/Udio 등)을 퍼블리싱하고 차트로 보여주는 플랫폼.**
프롬프트 서비스 사이트의 후속 서비스로, "AI 음악 전용 Spotify + Billboard" 포지션.

## 2. 현재 단계

| Phase | 범위 | 상태 |
|---|---|---|
| **Phase 1** | 어드민 뮤직 메뉴 — 앨범/트랙 업로드, 메타데이터 관리, 기본 플레이어 | **🟢 지금 작업 중** |
| Phase 2 | 퍼블릭 페이지 — 앨범/아티스트 페이지, 좋아요, 재생 카운트 | 다음 |
| Phase 3 | 차트 — 일/주/월 단위 순위, 장르별 차트, 순위 변동 | 다음 |
| Phase 4 | Apple Music / Spotify 외부 링크 동기화 | 장기 |
| Phase 5 | 아티스트 셀프 퍼블리싱, 수익 분배 | 장기 |

## 3. 핵심 차별점

이 사이트가 Spotify·Apple Music과 다른 점은 **"어떻게 만들어졌는지"가 보인다**는 것:

- 트랙마다 **가사 (lyrics)**
- 트랙마다 **스타일 프롬프트 (style_prompt)** — "어떤 프롬프트로 생성됐는지"
- 트랙마다 **BPM, Key, 생성 도구, 무드 등 메타데이터**

→ 이 데이터를 Phase 1부터 쌓아야 Phase 2~3에서 검색·필터·추천의 무기가 됨.

---

## 4. 기술 스택

| 영역 | 선택 | 이유 |
|---|---|---|
| Frontend | **Next.js 15 (App Router)** | 서버 컴포넌트 + 라우트 캐싱 |
| Backend/DB | **Supabase** | Postgres + Storage + Auth + RLS + Realtime 통합 |
| State | **Zustand** | Persistent Player 전역 상태 |
| Styling | **Tailwind CSS** + shadcn/ui | 빠른 어드민 UI |
| Audio | HTML5 `<audio>` + Web Audio API | duration 추출, 파형 |
| Deploy | Vercel (추천) / Cloudflare Pages | |

---

## 5. 데이터 모델 (요약)

```
artists ───< albums ───< tracks ───< play_events
                              └─< likes

(공통) user_roles → admin / artist / user 권한 분리
(차트) chart_snapshots → 일/주/월 단위 캐시
```

핵심: **싱글도 "1트랙짜리 앨범"** 으로 통일 (`albums.release_type = 'single' | 'ep' | 'lp'`).

전체 SQL은 `01_SUPABASE_SETUP.sql` 참고.

---

## 6. 폴더 구조

```
src/
├── app/
│   ├── (admin)/admin/music/        # 어드민 (Phase 1)
│   │   ├── layout.tsx               # 사이드바
│   │   ├── page.tsx                 # 대시보드
│   │   ├── artists/
│   │   ├── albums/
│   │   └── tracks/
│   ├── (public)/                   # Phase 2~
│   │   ├── layout.tsx               # PersistentPlayer 포함
│   │   ├── albums/[slug]/
│   │   ├── artists/[slug]/
│   │   └── charts/                  # Phase 3
│   └── api/
│       ├── play/route.ts            # 재생 이벤트 기록
│       └── upload/route.ts          # 서명 URL 발급
│
├── components/
│   ├── admin/                       # 어드민 UI
│   ├── player/                      # PersistentPlayer 등
│   └── charts/                      # 차트 UI
│
├── stores/
│   └── playerStore.ts               # Zustand
│
├── lib/
│   ├── supabase/{client,server,admin}.ts
│   ├── audio/{duration,waveform}.ts
│   └── charts/aggregate.ts
│
└── types/music.ts
```

---

## 7. 작업 우선순위 (Phase 1 — 이번에 만들 것)

순서대로 한 Task씩 진행하세요. 각 Task는 한 세션에 끝낼 단위.

| # | Task | 산출물 | 비고 |
|---|------|--------|------|
| 1 | Supabase 스키마 + RLS + 어드민 권한 | SQL 전체 적용 완료 | `01_SUPABASE_SETUP.sql` |
| 2 | Next.js + Supabase 클라이언트 + 미들웨어 | `/admin/*` 보호 | |
| 3 | 어드민 레이아웃 + 대시보드 | 사이드바, 통계 카드 4개 | |
| 4 | 아티스트 CRUD | 리스트/생성/수정, 아바타 업로드 | |
| 5 | 앨범 CRUD | 그리드 뷰, 커버 업로드 | |
| 6 | **트랙 업로더** | 다중 드래그앤드롭 mp3 | ⚠️ 무거움, 한 세션 통째로 |
| 7 | **Persistent Player** | Zustand store + 루트 고정 플레이어 | ⚠️ 가장 중요, `02_PERSISTENT_PLAYER.md` 참고 |
| 8 | 트랙 메타 편집 | 가사/스타일/BPM/Key 드로어 | |

---

## 8. 안티그라비티 작업 규칙 (중요)

### 세션마다 지킬 것

1. **새 세션 시작 시**: 이 `00_PROJECT_BRIEF.md`를 먼저 읽힘.
2. **한 번에 한 Task만**: Task 6, 7은 각각 한 세션 전체.
3. **현재 작업 중 Task 명시**: "Task 5 진행 중. 다음 코드 수정해줘" 식.
4. **테스트 데이터 준비**: Task 5 끝나면 더미 앨범 2~3개 + mp3 3~5개로 Task 6, 7 검증.

### 코딩 규칙

- **서버 컴포넌트 우선**, 인터랙션 필요한 곳만 `'use client'`.
- **타입은 `types/music.ts`에 중앙화** — Supabase 타입 생성기(`supabase gen types`) 활용.
- **Supabase 호출은 항상 `lib/supabase/*`를 통해** — 컴포넌트에서 직접 createClient 금지.
- **Storage 업로드는 서명 URL 패턴** — 클라이언트가 직접 서버로 큰 파일 보내지 않기.

---

## 9. 환경변수 (.env.local)

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...   # ⚠️ 서버 전용, 절대 클라이언트 노출 금지
```

---

## 10. 다음 단계

1. `01_SUPABASE_SETUP.sql` → Supabase SQL Editor에 실행
2. 본인 계정을 admin role로 INSERT (SQL 마지막 부분 참고)
3. Next.js 프로젝트 생성 후 Task 2부터 안티그라비티에 던지기
4. Task 7에서 막히면 `02_PERSISTENT_PLAYER.md` 참고

---

**문서 버전**: v1.0
**최종 수정**: Phase 1 시작 시점
