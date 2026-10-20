# 마스터링 납품처별 목표값

확인일 2026-10-21. 코드 정본: `src/lib/mastering/destinations.ts`. 출처 등급: **확인** = 1차 공식 문서 본문을 직접 읽음 / **참고(2차)** = 미러·검색 요약·통설(추정 아님, 근거 표기) / **미확인** = 열람 못 함(앱의 보수적 값).
LRA 는 어느 납품처도 공식 한도 수치가 없어 전부 null · **미확인**(EBU R128 은 LRA 를 참고 측정치로만 언급, 수치 없음).

| 납품처 | LUFS | TP(dB) | LRA | 포맷 | 디더 | 검증 | 근거 |
|---|---|---|---|---|---|---|---|
| 음반 (CD · 디지털 앨범) | -9 | -1 | null | WAV 16bit 44.1k | 있음(16비트로 줄일 때) | 포맷만 참고(2차, Red Book=16비트 44.1k). LUFS -9 는 **업계 관행(공식 기준 없음)**, LUFS·TP **미확인**. TP 는 파생본 손실 변환 오버 방지를 위해 -1 로 통일(verified.tp 는 false 유지). AES TD1004 는 스트리밍용 -16~-20 LUFS 권고로 음반 기준이 아님 | https://www.loc.gov/preservation/digital/formats/fdd/fdd000011.shtml , https://aes.org/wp-content/uploads/2024/01/AESTD1004_1_15_10.pdf |
| 음원 스트리밍 | -14 | -1 | null | WAV 24bit 44.1k | 없음 | LUFS·TP 확인(Spotify: 기준 -14, 큰 소리 -11·작은 소리 -19, TP -1 미만·-14 보다 큰 마스터는 -2 미만). LRA·포맷 **미확인**(스포티파이는 고품질 스테레오 마스터 1개만 요구). AES TD1004: -16~-20 LUFS, -1 dB TP 확인. Amazon·Tidal 의 -14 는 참고(2차, 공식 문서 못 찾음). 멜론·지니 정규화 여부는 **미확인** | https://support.spotify.com/us/artists/article/loudness-normalization/ |
| 동영상 플랫폼 · 쇼츠 | -14 | -1 | null | WAV 24bit 48k | 없음 | 전부 **미확인** — 크리에이터용 공식 수치 문서 없음(시청자용 「안정적인 음량」 도움말뿐). -14 LUFS 는 외부 측정 기반 참고(2차) | https://support.google.com/youtube/answer/14106294 |
| 영화 | -23 | -2 | null | WAV 24bit 48k | 없음 | **미확인**. Netflix 공식 페이지 열람 불가(참고(2차) 검색 요약: 대사 게이트 -27 LKFS ±2, TP -2). 음악 단독 기준 없음. 극장 음악은 LUFS 기준 없음 — 극장 기준은 보정 레벨(채널당 -20 dBFS 핑크노이즈 = 85 dB SPL) 방식, 참고(2차) | https://partnerhelp.netflixstudios.com/hc/en-us/articles/360001794307-Netflix-Sound-Mix-Specifications-Best-Practices-v1-5 |
| 드라마 · 방송 | -24 | -2 | null | WAV 24bit 48k | 없음 | LUFS·TP 확인(ATSC A/85:2026-07: -24 LKFS ±2 dB, TP -2 dBTP). 한국 고시 -24 LKFS ±2 dB 는 참고(2차, 법령 미러), 정부 원문 열람 못 함 · TP 한도 규정 없음. EBU R128 은 -23 LUFS ±0.5, TP -1 확인(유럽용이라 미채택). LRA **미확인** | https://www.atsc.org/wp-content/uploads/2026/07/A85-2026-07.pdf , https://tech.ebu.ch/docs/r/r128.pdf |
| 광고 | -24 | -2 | null | WAV 24bit 48k | 없음 | LUFS·TP 확인(ATSC 단편은 전체 믹스 -24 LKFS, TP -2). 한국 방송광고는 방송프로그램에 포함(업무지침 제3조, 확인). LRA **미확인** | 위와 동일 , https://www.law.go.kr (중앙전파관리소예규 제119호) |
| 클럽 · DJ | -8 | -0.3 | null | WAV 24bit 44.1k | 없음 | **미확인** — 업계 관행, 공식 기준 없음. 앱 기존 설정이 `appDefault` | https://www.aes.org/standards/ (전용 기준 없음) |
| 팟캐스트 배경음악 | -16 | -1 | null | WAV 24bit 44.1k | 없음 | LUFS·TP·포맷 확인, LRA **미확인** (-16 LKFS ±1, TP -1 dBFS 이하, WAV 최소 44.1k 16/24) | https://podcasters.apple.com/support/893-audio-requirements |

## 2026-10-21 재조사에서 바뀐 것
- 드라마·방송, 광고: TP -1 → **-2** (ATSC A/85 가 -2 dBTP, EBU 는 -1 이므로 둘 다 만족). LUFS -24 는 ATSC 로 확인, 검증 표시 lufs·tp 를 확인으로 올림.
- 출처 등급(`grade`) 필드 추가(확인/참고(2차)/미확인). Netflix 주소를 이전된 곳으로 교체, 한국 고시는 법령 미러(2차)와 업무지침(1차, 방송광고 포함 정의) 분리.

## 항목별 조사 결과 (2026-10-21)
- YouTube: 공식 문서에 -14 LUFS 수치 없음 → 미확인. 외부 측정 통설만 있음(참고 2차).
- 한국 방송: 고시 제2014-87호 -24 LKFS ±2 dB, 방송광고 포함, 클래식·국악 전문 음악 생방송 예외, 측정 BS.1770-3(참고 2차 미러). TTA 표준은 TTAK.KO-07.0114 「디지털 방송 음량레벨 운용기준」이며 요청하신 TTAK.KO-07.0098 은 찾지 못함. 트루피크 한도는 국내 규정 못 찾음.
- EBU R128 v4(확인): -23.0 LUFS ±0.5 LU(생방송 ±1.0), TP 최대 -1 dBTP, LRA 는 한도 없이 참고 측정치. Tech 3341(측정 방식)·3343(제작 가이드)은 수치 한도 없음.
- ATSC A/85:2026-07(확인): -24 LKFS 약 ±2 dB, TP -2 dBTP(±0.5), 스트리밍 전용은 -23~-27 LKFS 단일 목표 권장.
- Apple Music: Sound Check -16 LUFS 는 공식 문서 못 찾음(참고 2차). Apple Digital Masters 공식 PDF 는 24비트·최고 원본 해상도 납품, 디더 불필요를 요구하나 LUFS 수치는 없음(확인).
- Amazon Music·Tidal -14: 공식 문서 못 찾음(참고 2차, Amazon -13 설도 있음). 멜론·지니: 정규화 여부 공식 확인 못 함 → 미확인.
- 극장: 음악 LUFS 기준 없음. 보정 레벨 방식(채널당 -20 dBFS = 85 dB SPL)은 참고(2차, 공식 Dolby/SMPTE 문서 미열람).
- CD: 공식 LUFS 기준 없음. -9 안팎은 업계 관행(공식 기준 없음). 트루피크는 파생본 손실 변환 오버 방지를 위해 -1 로 통일.

## BGM 모드 (`bgmMode`)
영화·드라마/방송·팟캐스트 배경음악은 대사·효과음과 섞이는 것이 전제. 과한 압축과 리미팅을 하지 않고(음량 경쟁 금지), 대사가 있는 중역을 비우는 옵션을 쓴다. 목표 음량은 음악 단독이 아니라 섞인 뒤의 방송·납품 기준에 맞추므로, 음악 단독 음량은 위 표보다 낮아질 수 있다.

## 파생본 기본 제안
음반 마스터를 만들면 `stream`, `video` 파생본을 함께 내보내도록 제안한다(`DERIVATIVES`).
