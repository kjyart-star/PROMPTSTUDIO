# 쿠키뮤직 가사 싱크 — 결정표(다른 서비스 비교, 대표 확인용, 2026-11-02)

범위: 웹(태블릿 768 ~ 데스크톱). 폰은 나중에 앱으로 만든다. 공개 문서만 읽었다(로그인·약관 동의 없음). 확인일은 모두 2026-11-02. 「미확인」은 1차 출처를 찾지 못했다는 뜻이다.
상태: 이 결정표는 대표 확인 전이다. 아래 「구현 대기」 항목은 브랜치에만 있고 배포하지 않았다. 이미 배포된 것(공개 보류 트리거, 브라우저 계산, 서버 무료 큐, 웹·앱 공용 읽기 API)은 그대로 운영 중이다.

## 1. 결정표

| 결정 항목 | 다른 서비스가 실제로 하는 방식(1차 출처) | 우리 선택 | 근거(따른 서비스 / 다르게 한 이유) |
|---|---|---|---|
| ① 작업 중 가사 표시 | 작업 화면은 줄 목록이나 편집 화면에서 보여 준다. Musixmatch Pro 는 줄 목록과 재생[5], YouTube 는 자막 편집 화면[2], CapCut 은 편집 타임라인[16]. 수노·유디오는 공식 하이라이트 근거가 없다 | 생성·스튜디오 작업 중에는 **일반 가사**만 보여 준다(사람이 올린 LRC 가 있으면 그것만 표시) | 수노·유디오와 같다. 비공개 곡 대부분은 공개되지 않으므로 자동 계산 비용·지연을 없앤다 |
| ② 싱크를 정하는 시점 | 가사 원문은 업로드·납품 때 받고, 싱크는 별도 단계에서 만든다. DistroKid 는 원문 승인 뒤 Synced Lyrics[18], Musixmatch Pro 는 배포 뒤 Sync 탭[5], Apple 은 발매 5일 전 TTML 납품(싱크 선택)[6], YouTube 는 업로드 뒤 자막 Auto-sync[2] | **공개하기를 누를 때** 계산하고 확인한 뒤 공개한다 | DistroKid·Apple 처럼 공개 전 단계에서 확정한다. 업계는 싱크가 선택이지만, 우리는 AI 곡이라 사람이 만든 시간표가 없다. 그래서 공개 직전에 자동으로 만들고 확인받는다 |
| ③ 계산 위치 | 사람 손(아티스트 탭: DistroKid·Musixmatch Pro), 서버 자동(YouTube Auto-sync, CapCut 인식) | **공개하는 사람 기기**가 계산한다(WebGPU fp32, 없으면 WASM q8). 태블릿 포함. 서버 무료 큐는 보조(표본 검수·예외) | YouTube·CapCut 의 「자동 후 사람 확인」 방식이다. 서버 GPU 는 비용 0 원칙 때문에 쓸 수 없고, 무료 서버 한도는 하루 약 80곡이다. 공개자 기기를 쓰면 처리 능력이 공개하는 사람 수에 비례한다 |
| ④ 실패·저사양 대응 | 자동이 안 되면 수동으로 한다. YouTube 는 직접 입력·파일(LRC 지원)[2][3], DistroKid 는 탭 찍기[18], CapCut 은 일괄 수정[17] | 1차 WebGPU → 2차 WASM q8(가장 적은 메모리, 30초 창씩) → 3차 **수동 싱크 편집기**(재생하며 「지금 찍기」, 기존 가사 시간 편집기 재사용) | YouTube 의 「자동 → 실패 시 수동·파일」과 DistroKid 의 탭 찍기를 그대로 따른다 |
| ⑤ 공개 보류와 시간 | 「싱크가 준비될 때까지 곡 공개를 보류」하는 서비스는 찾지 못했다. YouTube 의 처리 중은 영상 처리이고 자막과 무관하다[10]. Apple 은 5일 전 납품을 권고한다[6] | 공개 화면에서는 계산과 확인이 끝나야 공개된다(기다림 1~2분). 다른 경로로 공개를 요청하면 「가사 싱크 처리 중」으로 보류하고, 최대 24시간 뒤 일반 가사로 공개한다 | 업계보다 엄격하게 잡았다. 「공개된 곡은 처음부터 싱크가 맞다」는 대표 기준 때문이다. 대신 보류가 생기지 않도록 공개 화면 안에서 끝낸다 |
| ⑥ 사람 보정·커뮤니티 | Musixmatch 는 검증 아티스트가 수정한다[5]. Apple 은 검증된 가사를 고치려면 문의 양식을 써야 한다[6]. Spotify 의 사용자 신고 절차는 미확인이다. Genius·Musixmatch 커뮤니티 문서는 접근이 막혀 미확인 | 곡 주인의 확인·수정 값(lrc_by=user)을 최우선으로 쓴다. 신뢰도가 낮은 곡에는 「가사 시간 확인」을 권한다. 남의 곡은 두 사람 결과가 1초 안에서 일치해야 공개 결과로 쓴다(듣는 사람 계산은 꺼 둠) | Musixmatch 의 「검증된 주인 우선」을 따른다. 커뮤니티 수정은 사람 손이 드는 운영이라 지금은 넣지 않는다(자동화 기준) |
| ⑦ 앱·웹 공통 API | Spotify Web API 에는 가사 엔드포인트가 없다[7]. Apple MusicKit 도 가사를 주지 않는다(hasLyrics 만)[8]. LRCLIB 는 공개 읽기 API(syncedLyrics·plainLyrics)를 제공한다[9] | `GET /api/lyrics-sync/{id}`(ETag) 하나로 웹·앱이 같은 시간표를 표시한다. 제출에는 client·engine·model 을 함께 받는다 | 대형 서비스는 가사 API 를 닫아 둔다. 우리는 자체 앱이 같은 API 를 써야 하므로 LRCLIB 와 비슷한 단순 JSON 으로 둔다 |

멜론·지니(파트너센터)·틱톡·유튜브 뮤직 가사 제출·수노·유디오는 공식 문서를 찾지 못했다(미확인). 유통사나 담당자에게 문의해야 한다.

## 2. 서비스별 올리기·싱크 절차(요약)

- **Spotify / Musixmatch Pro[5][13]**: Pro 계정을 만들고, 로스터에서 Spotify 아티스트를 연결해 인증받는다(영업일 며칠). 그다음 곡을 고르고 Lyrics 를 편집한 뒤 Sync 탭에서 줄마다 첫 단어에 시간을 맞추고 Send 한다(반영까지 며칠). 오디오는 직접 올리거나 Premium 연결로 가져온다. 단어 단위 싱크는 모바일 앱에서만 된다.
- **Apple Music[6][14][15]**: 배급사가 iTunes Producer(평문, 2,000자)나 Transporter·iTunes Connect(TTML)로 낸다. TTML 규칙은 UTF-8, BOM 없음, `<p>` 한 개가 한 줄이고 `<span>` 은 단어, `begin`·`end` 필수, 시간은 `분:초.밀리초`, 배경 보컬은 `ttm:role="x-bg"` 다. 스타일 가이드는 줄 끝 문장부호 금지, 반복은 풀어 쓰기, 이모지 금지. 버전별 싱크가 필요하고, 검증 뒤 수정은 문의 양식으로 한다.
- **YouTube[1][2][3][10]**: 업로드한 뒤 Studio 자막 메뉴에서 직접 입력하거나, 대본을 붙여넣고 Auto-sync(몇 분)하거나, 파일(LRC·SRT·VTT·TTML, 시간 있음·없음)을 올린다. 자동 자막은 복잡한 오디오에서 생성되지 않을 수 있다. SD 처리가 끝나면 게시할 수 있고 게시 뒤에도 수정된다.
- **DistroKid[18][19]**: 업로드할 때 평문 가사와 Lyric Blaster 에 동의한다. 승인 뒤 Synced Lyrics 에서 재생하며 스페이스바(모바일은 탭)로 줄을 찍는다(초기화 버튼, 크롬 권장). 반영은 1~2주(도움말 요약). Apple·YouTube 싱크는 상위 요금제만 된다.
- **TuneCore**: 가사 텍스트만 Apple 에 보내고 싱크는 하지 않는다(외부 Musixmatch 를 권함).
- **CapCut[16][17]**: 모바일 앱에서 영상 추가 → Text → Auto Lyrics(보컬이 뚜렷할 때만) → 자막 클립 → Edit captions 에서 일괄 수정한다. 웹은 편집만 된다.
- **SoundCloud**: 설명란(4,000자)에 가사를 쓴다. 싱크 기능은 없다.
- **WebGPU 지원**: 아이패드는 Safari 26.0(2025-09-15, iPadOS 26 이상)부터[11]. 안드로이드 크롬은 121 부터 Android 12 이상에서 Qualcomm·ARM GPU 일 때[12]. 그보다 오래된 기기는 WASM q8 로 계산한다.

## 3. 태블릿 조건 측정(무음)

크롬 헤드리스로 768×1024 터치 뷰포트에 안드로이드 태블릿 사용자 에이전트를 쓰고, CPU 4배 감속, WASM q8(WebGPU 미사용 경로)로 base 모델을 돌렸다. 곡은 3곡 104줄이다.

| 조건 | 3분 곡 처리 | 평균 오차 | 1초 이내 | 최대 오차 |
|---|---|---|---|---|
| 데스크톱 WASM q8(M4 Pro, 한 스레드) | 32초 | 0.49초 | 92/104 | 12.6초 |
| 태블릿 흉내(CPU 4배 감속) | **약 140초(2분 20초)** | 0.49초 | 92/104 | 12.6초 |
| 데스크톱 WebGPU fp32(앞선 실측) | 6.5초 | 0.44초 | — | — |

- 감속해도 정확도는 같았다. 시간만 늘어난다.
- 메모리 제한은 브라우저에서 그대로 흉내 낼 수 없어 측정하지 않았다. 대신 메모리가 가장 적은 WASM q8 경로를 재시도용으로 둔다.
- 실기 추정(측정 아님): iPadOS 26 이상 아이패드는 WebGPU 로 수십 초 이내, WebGPU 가 없는 중급 안드로이드 태블릿은 1.5~3분.

## 4. 우리 공개 흐름 화면 순서 초안(태블릿 768 ~ 데스크톱)

| 순서 | 화면 | 사용자가 하는 일 | 시스템 |
|---|---|---|---|
| 0 | 스튜디오 보관함(생성·업로드 결과) | 듣기, 가사 보기(일반 텍스트) | 계산 없음 |
| 1 | 「공개하기」 창 | 장르·채널 고르고 「퍼블리싱하기」 | 가사 2줄 이상이고 사람이 확인한 시간표가 없으면 2로 |
| 2 | 같은 창의 「가사 싱크 맞추는 중 n%」 | 기다림(WebGPU 수 초, WASM 30초~2분 남짓) | 공개자 기기에서 계산. WebGPU 가 실패하면 WASM q8 로 다시 한다. 결과는 곡에 저장해 다시 계산하지 않는다 |
| 3 | 「가사 싱크 확인」(기존 시간 편집기) | 재생하며 줄 강조를 확인한다. 어긋난 줄은 번호를 누르고 「지금 찍기」, 필요하면 「이 줄 듣기」 | 자동 계산이 끝내 실패하면 같은 편집기가 빈 시간으로 열린다(수동 싱크) |
| 4 | 「확인하고 공개」 | 누름 | 사람이 확인한 시간표로 저장하고 공개한다(DB 트리거가 시간표를 확인) |
| 5 | 완료 알림 | 「쿠키뮤직에서 보기」 | 듣는 사람은 `GET /api/lyrics-sync/{id}` 를 표시만 한다 |
| 예외 | 3에서 닫음 | 공개 취소(비공개 유지) | 계산 결과가 남아 다음 공개 때 3부터 시작한다 |
| 예외 | 다른 경로로 공개(프로필 업로드의 공개 체크 등) | — | 「가사 싱크 처리 중」으로 보류하고 공개자 기기가 계산해 공개한다(보조: 서버 무료 큐, 24시간 뒤 일반 가사로 공개) |

## 5. 구현 상태
- 배포됨(운영 중): 공개 보류 트리거, 공개 요청 곡의 브라우저 계산, 서버 무료 큐(하루 9,000 뉴런 상한), 웹·앱 공용 읽기 API, 두 사람 일치 규칙, 회사 PC 제외.
- 구현 대기(브랜치 `feat/lrc-publish-step`, 테스트 679개 통과, 배포 안 함): 생성 직후 자동 계산 → 공개 요청 시 계산, 공개 창 진행률과 「가사 싱크 확인」 단계, WASM 재시도와 수동 싱크, 비공개 곡 일반 가사 표시, 듣는 사람 계산 끄기, 공개 단계에서 태블릿 계산 허용.

## 6. 출처(확인일 2026-11-02)
1. https://support.google.com/youtube/answer/6373554?hl=en
2. https://support.google.com/youtube/answer/2734796?hl=en
3. https://support.google.com/youtube/answer/2734698?hl=en
4. https://blog.youtube/news-and-events/youtube-music-app-2023-guide/
5. https://support.spotify.com/artists/article/lyrics/
6. https://itunespartner.apple.com/music/support/5218-submit-lyrics
7. https://developer.spotify.com/documentation/web-api/reference/get-track
8. https://developer.apple.com/forums/thread/698127
9. https://lrclib.net/docs.md
10. https://support.google.com/youtube/answer/57407?hl=en
11. https://webkit.org/blog/17333/webkit-features-in-safari-26-0/
12. https://developer.chrome.com/blog/new-in-webgpu-121
13. https://musixmatch.helpscoutdocs.com/article/190-how-can-artists-add-and-synchronize-lyrics-on-musixmatch-pro (직접 열면 404, 검색 요약)
14. https://help.apple.com/itc/videoaudioassetguide/en.lproj/static.html
15. https://help.apple.com/itc/musicstyleguide/en.lproj/static.html
16. https://www.capcut.com/help/entrance-to-auto-lyrics
17. https://www.capcut.com/help/batch-edit-to-recognize-subtitle
18. https://distrokid.com/resources/blog/you-can-now-upload-synced-lyrics-with-distrokid
19. https://support.distrokid.com/hc/en-us/articles/360013534574-Adding-Lyrics-to-Your-Music (직접 열면 403, 검색 요약)
20. https://support.tunecore.com/hc/en-us/articles/8443043757204-Uploading-Lyrics (직접 열면 403, 검색 요약)
