# 쿠키뮤직 가사 싱크 방식 조사 (2026-11-01)

범위: 코드 수정 없음. 모든 출처 확인일은 2026-11-01. 「미확인」은 1차 출처에서 근거를 못 찾았다는 뜻이다.
전제: 가사 원문 있음(강제 정렬), 한국어+영어 혼합 수노 곡, 비용 0 원, 사내 GPU PC 2대로 사전 계산 가능, 목표는 재생 시작 3초 내 현재 줄 일치.

## 0. 채택 결과(2026-11-02, 실측 반영)

문헌 조사의 1순위(CTC 정렬)는 한국어 전용 모델(kresnik)이 영어 줄에 약하고 다국어 MMS 는 모델 라이선스가 CC-BY-NC 라서 보류했다. 대신 문헌 3순위였던 **stable-ts `align()` + whisper large-v3(MIT)** 를 회사 PC 2번(RTX 3080 Ti, ComfyUI 가 쓰지 않는 GPU 0)에서 돌려 실측했고, 한국어·영어 혼합 줄을 그대로 처리하면서 곡당 약 20초(보컬 분리 3초 + 정렬 1~4초 + 받아쓰기 12~19초)로 충분히 빨랐다. 채택 조합: **htdemucs 보컬 분리 → large-v3 강제 정렬 → 보컬 받아쓰기에서 5글자 이상 연속 일치한 줄이 정렬과 2초 넘게 어긋나면 받아쓰기 시각으로 보정**(수노 곡에 가사에 없는 간주가 끼면 정렬기가 다음 줄을 앞당겨 붙이는 문제를 잡는다).

방식 비교(운영 음원 4곡 77줄, 정답 = 원본 음원 large-v3 받아쓰기 단어 시각과 원문 줄 첫 글자 일치, temperature 0):

| 변형 | 평균 오차 | 중앙값 | 1초 이내 | 최대 |
|---|---|---|---|---|
| A 보컬 분리 + 강제 정렬 | 0.61초 | 0.27초 | 68/77 | 13.21초 |
| B A + VAD | 0.66초 | 0.27초 | 64/77 | 13.21초 |
| **D A + 받아쓰기 보정(채택)** | **0.51초** | **0.27초** | 67/77 | **3.27초** |
| E 원본 음원 강제 정렬 | 0.58초 | 0.25초 | 69/77 | 13.31초 |

중앙값 0.25~0.27초는 줄을 0.25초 먼저 켜도록 둔 의도된 앞당김이다. 정답 자체가 받아쓰기라 수 초 단위의 흔들림이 있다(같은 곡 두 번 받아쓰기에서 최대 2초 차). 「Neon City Lights」는 temperature 0 받아쓰기가 무너져 이 표에서 빠졌다.

브라우저 폴백은 transformers.js WebGPU(가능할 때) whisper small 로 현재 재생 위치 근처 15초를 먼저 받아쓰기해 부르는 줄을 찾고 그 줄부터 정렬한다. 모델 내려받기(수백 MB)가 처음 한 번 걸려 첫 사용자는 3초 안에 들어오지 못한다 — 그래서 사전 계산이 1순위다.

수노 웹 관찰(2026-11-02, 비로그인, 무음): 공개 곡 페이지(suno.com/song/{id})의 Lyrics 탭은 정적 가사 텍스트였고, 재생 버튼은 가입 유도 화면으로 넘어가 재생되지 않아 재생 중 하이라이트 요청(aligned_lyrics)은 관찰하지 못했다. 페이지 로드 때 받은 /a/api/* 요청에도 가사 시간표 호출은 없었다(재생 때 따로 받는다는 8절 문헌과 모순되지 않음).

### 운영 측정(2026-11-02, cookieplay.app/music, 비로그인 무음 재생)

사전 계산 일괄 처리: 가사·음원이 있는 52곡 중 51곡 저장(회사 PC 2번, 곡당 18~74초). 1곡(「너는 상처뿐이야」)은 정렬을 믿을 수 없어 저장하지 않았고 그 곡은 하이라이트 없는 일반 가사로 보인다. 새 곡은 30초마다 목록에 잡힌다.

| 곡 | 싱크 표시까지 | 3초 시점 | 60→63초 지점 | 줄별 오차(정답 줄) 평균 / 1초 이내 / 최대 |
|---|---|---|---|---|
| 우리이야기 | 0.3초 | 맞음(첫 줄) | 맞음 | 0.35초 / 23/24 / 1.40초 |
| 우리이야기 (v2) | 0.3초 | 맞음(첫 줄) | 틀림 가능(간주 구간에 다음 줄을 약 10초 일찍 켬) | 0.32초 / 22/22 / 0.83초 |
| 지금이순간 | 0.3초 | 맞음(전주, 강조 없음) | 맞음 | 0.94초 / 10/14 / 2.23초 |
| 지금이순간 (v2) | 0.3초 | 맞음(전주, 강조 없음) | 맞음 | 0.49초 / 20/23 / 2.09초 |
| Neon City Lights(비공개) | 화면 측정 불가(로그인 필요) | 저장값 기준 맞음(첫 줄 18초) | — | 1.05초 / 6/11 / 2.33초 |
| 우리이야기 (마스터링, 비공개) | 화면 측정 불가 | 저장값 기준 맞음 | — | 원곡과 줄 시각 차 0.1초 안팎 |

정답 = 원본 음원 large-v3 받아쓰기 단어 시각(두 번 받아쓰기가 1초 안에 일치한 줄만). 오차에는 의도한 0.25초 앞당김이 들어 있다.

브라우저 폴백 실측: WebGPU(fp16) whisper small 정렬은 줄을 30초 간격으로 밀고 뒤 14줄을 한 시각에 몰았다(틀린 강조가 뜨고 일부 저장됨). 그래서 WebGPU 를 끄고 정확도가 확인된 WASM q8 만 쓰며, 한 시각에 몰리거나 간격이 비정상인 시간표는 서버·브라우저 모두에서 거른다. 잘못 저장된 브라우저 결과 5곡은 사전 계산 결과로 덮였다.

## 1. 결론(문헌 조사)

사전 계산이 답이다. 곡이 생성되거나 업로드될 때 사내 GPU PC에서 한 번 정렬하고, 줄 단위 타임스탬프(LRC/JSON)를 곡 메타데이터로 저장하면 재생 시 계산이 0초가 된다. 1순위는 **보컬 분리(htdemucs, MIT) 후 CTC 강제 정렬**이다. 정렬기는 두 후보를 같은 골든셋(손으로 줄 시작 시간을 찍은 한국어·혼합 곡 20곡 정도)으로 먼저 비교해서 고른다. (a) whisperX 방식의 `kresnik/wav2vec2-large-xlsr-korean`(Apache-2.0, 한글 전용이라 영어 구간 약함) (b) ctc-forced-aligner + MMS(다국어, uroman 로마자화, 모델 CC-BY-NC 4.0이라 상용 서비스 라이선스 위험). 혼합 곡이면 줄 단위로 언어를 나눠 (a)/(b)를 섞는 안도 후보다. stable-ts(MIT)의 `align()`은 whisper 기반이라 설치·운영이 가장 단순한 3순위 대안이다. 브라우저 폴백은 사전 계산본이 없는 곡에만 쓴다. transformers.js(WebGPU)에서 wav2vec2 CTC 정렬을 앞 30~60초 청크부터 돌려 현재 줄을 먼저 맞추고 나머지는 뒤에서 채운다. 이 폴백이 3초 안에 들어온다는 실측 근거는 이번 조사에서 확인하지 못했다(미확인, 시험 필요). 크롬 내장 음성인식·번역 API는 가사 싱크용으로 부적합하다.

## 2. 비교표

| 방법 | 정확도 | 지연 | 용량 | 라이선스 | 비용 | 한국어 지원 | 출처 |
|---|---|---|---|---|---|---|---|
| ctc-forced-aligner (MahmoudAshraf97) + MMS-300M | 노래 한국어 수치 미확인. 반주 많은 곡은 보컬 분리 권장(MMS-FA 변환본 카드) | GPU 지원. 속도 수치 미확인. torchaudio 대비 메모리 5배 이상 적음(저자 주장) | 모델 약 300M 파라미터. 파일 크기 미확인 | 코드 BSD-2, 기본 모델 CC-BY-NC 4.0 | 0원(사내 GPU) | 1130개 언어 표기, Korean 명시는 못 봄. `--romanize` 필수(uroman) | https://github.com/MahmoudAshraf97/ctc-forced-aligner |
| torchaudio MMS_FA | 한국어 노래 수치 미확인 | CPU/CUDA 구현 있음, 벤치 없음 | 미확인 | 튜토리얼에 라이선스 없음. 변환본 카드는 CC-BY-NC 4.0 | 0원 | 로마자화(uroman) 경유 다국어. 튜토리얼 API는 2.9에서 제거 예고 | https://docs.pytorch.org/audio/stable/tutorials/ctc_forced_alignment_api_tutorial.html , https://huggingface.co/chordai/mms-fa-aligner-coreml |
| whisperX 정렬 단계 (wav2vec2) | 한국어 모델 `kresnik/wav2vec2-large-xlsr-korean`: 음성 낭독 기준 WER 4.74%, CER 1.78%(자체 보고, 노래 아님) | 전사 70배 실시간(large-v2, 배치)이 헤드라인. 정렬 단독 수치 미확인 | 약 0.3B 파라미터 F32 | 코드 BSD-2, 한국어 모델 Apache-2.0 | 0원 | 있음(alignment.py 의 `ko` 항목). 숫자·기호 포함 단어는 정렬 안 됨 | https://github.com/m-bain/whisperX , https://raw.githubusercontent.com/m-bain/whisperX/main/whisperx/alignment.py , https://huggingface.co/kresnik/wav2vec2-large-xlsr-korean |
| stable-ts `align()` | 노래 수치 미확인 | 전사보다 현저히 빠르다고 문서에 있음. 수치 미확인 | whisper 모델 크기에 따름 | MIT. 저장소는 보관(archived)됨, 개발 중단 | 0원 | whisper 다국어 기반. 문서에 한국어 명시는 못 봄 | https://github.com/jianfch/stable-ts |
| NeMo NFA | 미확인 | 미확인 | 미확인 | README 에 명시 없음 | 0원 | README 에 한국어 언급 없음(14개 이상 언어 중 포함 여부 미확인) | https://github.com/NVIDIA/NeMo/blob/main/tools/nemo_forced_aligner/README.md |
| aeneas | 말소리 전용. 「노래 자막에 부적합」이라고 명시 | 빠름(MFCC+DTW). 수치 미확인 | 작음. 수치 미확인 | AGPL-3.0 | 0원 | 지원 38개 언어에 한국어 없음 | https://github.com/readbeyond/aeneas |
| 노래 특화: Tune Studio aligner (MMS-300m 파인튜닝) | 영어·독일어 74곡에서 음절 시작 94.0%가 ±80ms 이내 | 미확인 | 미확인 | CC BY-NC 4.0 | 0원 | 한국어 학습 여부 언급 없음 | https://huggingface.co/tuneperfect/tunestudio-aligner |
| 브라우저 전체 파이프라인 연구 (HTDemucs + wav2vec2, ONNX WebGPU/WASM, DTW) | 초록에 수치 없음. 전문은 2026-12-31까지 비공개 | 수치 없음 | 수치 없음 | 논문 | 0원 | 미확인 | https://amslaurea.unibo.it/id/eprint/34172/ |
| 브라우저: transformers.js v3 WebGPU | WASM 대비 최대 100배 빠르다는 주장만 있음(벤치 없음) | 위 주장 외 수치 없음. whisper 예시는 tiny 영어 | dtype(fp32/fp16/q8/q4)로 용량 조절. 개별 모델 크기 미확인 | Apache-2.0 계열(본 조사에서 별도 확인 안 함) | 0원 | wav2vec2 한국어 모델의 ONNX 변환 여부 미확인. 직접 변환 필요 | https://huggingface.co/blog/transformersjs-v3 |
| 수노 타임스탬프 가사 API (재판매 대행) | 수노 자체 값이라 정확도 기준이 됨. 비교 실험 미실시 | 요청 1회 | 해당 없음 | 서비스 약관 | 유료. PoYo 요청당 $0.005, API in One 2크레딧, UnificAlly 곡 생성 $0.06 (가사 줄 단가는 확인 못 함). 수노 공식 API는 없음 | 수노 가사 기준이라 한국어 표기 문제 없음(미검증) | https://poyo.ai/en/models/get-timestamped-lyrics , https://apiin-one.pages.dev/models/suno , https://unifically.com/ja/models/suno |

참고: 의뢰서의 「곡당 약 $0.06」은 UnificAlly 의 생성 단가와 겹치는 숫자이고, 타임스탬프 가사만의 단가는 대행사별로 달랐다. 대행사 가격은 마케팅 페이지 기준이라 계약 전 재확인이 필요하다.

### 정렬기 선택 메모
- 한국어 노래 정렬 정확도를 직접 비교한 공개 수치는 찾지 못했다. 이번 조사 기준 「MMS_FA 대 MFA 대 kresnik」 노래 벤치는 없다. 골든셋 자체 측정이 필요하다.
- 라이선스: 상용 서비스(유료 크레딧을 받는 쿠키뮤직)에서 쓰려면 MMS 계열(CC-BY-NC 4.0)은 위험하다. 서버에서 사전 계산만 하고 결과(타임스탬프)만 제공하는 경우의 해석은 법무 확인이 필요하다(미확인). kresnik(Apache-2.0)과 whisper(MIT, 별도 확인 안 함)는 이 문제가 없다.
- aeneas 는 노래에 부적합하다는 점이 공식 문서에 있고 한국어도 없어 탈락이다.
- Montreal Forced Aligner 한국어 모델이 있다(음성 중심 학습, 노래 수치 없음). 보조 후보일 뿐이다. https://huggingface.co/MontrealCorpusTools/korean_mfa

## 3. 크롬 내장 API 판정: 가사 싱크에 쓸 수 없다

| API | 확인 사항 | 판정 |
|---|---|---|
| Web Speech API `SpeechRecognition` | `start(audioTrack)`이 MediaStreamTrack 을 받는다. MDN 예시는 오디오 요소 `captureStream()`으로 mp3 를 넣는다. 단, 재생이 되어야 인식이 진행된다(실시간 1배속). https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/start | 사전 계산 불가, 곡 길이만큼 시간 필요. 재생 중 동시 인식은 가능하나 결과는 「인식한 문장」이지 원문 가사의 줄 번호가 아니다. 노래 인식 품질은 미확인. 정렬엔 부적합 |
| 서버 전송 여부 | `processLocally`는 기본 false 라 브라우저가 원격 처리를 선택할 수 있다. true 로 두면 기기 안에서만 처리. 실험 기능. 기본값에서 오디오가 서버로 가는지는 MDN 이 명시하지 않음. https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/processLocally | 개인정보·저작물 음원 유출 가능성이 있어 기본값은 부적합. 로컬 처리는 언어팩 설치가 필요하고 환경별로 `language-not-supported` 보고가 있음(2차 출처). 한국어 로컬 지원 여부는 미확인 |
| 온디바이스 인식 (Chrome 139, 2025) | 데스크톱 Chrome 139 에서 지원. Android/ChromeOS 는 미지원(2026-05 blink-dev). https://groups.google.com/a/chromium.org/g/chrome-ai-dev-preview-discuss/c/Rlyc2uAsFCY , https://groups.google.com/a/chromium.org/g/blink-dev/c/P8P-x7AnC6I | 모바일 사용자가 빠짐. 정렬 API 가 아니라 받아쓰기라 단어 시간 정보 없음(MDN 페이지에서 단어 타임스탬프 언급 못 봄, 미확인) |
| Translator / Language Detector API | 번역·언어 감지용 | 정렬과 무관. 「실시간 번역」 기능으로 가사 싱크는 만들 수 없다. 번역 자막 표시 용도로만 의미 있음 |

판정: 「실시간 번역 기능」 계열로 가사 싱크를 할 수 없다. 음성인식을 억지로 쓰면 재생 속도와 같은 시간이 걸려 3초 목표를 못 맞추고, 원문 줄과의 매핑을 따로 만들어야 한다.

## 4. 보컬 분리 판정: 정렬 정확도를 위해 쓴다. 단 사전 계산(서버)에서만 기본 적용

- 근거: 두 CoreML MMS-FA 포트 카드가 「반주가 센 곡은 분리된 보컬로 정렬」을 권장한다. https://huggingface.co/chordai/mms-fa-aligner-coreml , https://huggingface.co/chordai/wav2vec2-base960h-aligner-coreml . 한국어 노래에서 개선폭을 수치로 보여주는 1차 출처는 못 찾았다(미확인). 골든셋으로 분리 유무 비교가 필요하다.
- htdemucs: MIT, MUSDB HQ 에서 SDR 9.00 dB. 저장소는 보관됨(포크 adefossez/demucs). CPU 처리 시간은 곡 길이의 약 1.5배, GPU 수치는 문서에 없음, GPU 메모리 3GB 이상(기본 약 7GB). https://github.com/facebookresearch/demucs
- 웹 버전: timcsy/demucs-web(MIT, ONNX 약 172MB, WebGPU 후 WASM 폴백, 구간 단위 진행 콜백, SharedArrayBuffer 때문에 COOP/COEP 헤더 필요). https://github.com/timcsy/demucs-web . 21조각 분할 export(monteslu)는 같은 AMD GPU 한 대에서 자체 측정으로 실시간의 약 8~22배(자체 보고, 일반화 불가). https://huggingface.co/monteslu/htdemucs-web-onnx . ONNX 변환본은 약 180MB 클래스라 모바일 첫 로드 부담이 크다.
- 판정: 서버 사전 계산 파이프라인에는 필수 단계로 넣고, 브라우저 폴백에서는 172MB 모델 다운로드와 분리 시간 때문에 기본 끔(WebGPU 가능하고 캐시된 경우에만 선택). 분리된 보컬 스템을 저장하면 향후 노래방 모드 등에 재사용된다(저장 용량은 R2 무료 한도와 대조 필요).

## 5. 스트리밍·점진 처리 판정: 브라우저 폴백에서 가능성이 높다. 실측 필요

- CTC 강제 정렬은 구조상 구간 단위로 쪼갤 수 있다. MMS-FA 변환본 카드에서 20초 창이 반주 구간에서 정규화 왜곡을 일으켜 60초 창을 쓴 사례가 있다(wav2vec2-base960h 카드). 즉 청크가 너무 짧으면 정확도가 떨어질 수 있다. 앞뒤 겹침과 앞뒤 보호 토큰(시작·끝 별표 토큰으로 간주 구간 흡수, MMS-FA 카드) 같은 설계가 필요하다.
- 필요한 것: 재생 위치 t 근처의 가사 줄 범위를 먼저 가정해야 한다. 가사 줄 수와 곡 길이로 대략의 위치를 추정하고(균등 가정), 앞 청크 정렬 결과로 보정한다. 근거 논문은 못 찾았다. 구현 설계 사항(미검증).
- 3초 목표 달성 여부: transformers.js 의 「WASM 대비 최대 100배」는 벤치 없는 주장뿐이라 근거로 쓸 수 없다. 웹 환경 wav2vec2 0.3B(q8/fp16) 추론 시간을 직접 재야 한다(미확인).

## 6. 추천 실행 순서(시험 계획)

1. 골든셋 20곡(한국어 순수, 영어 순수, 혼합, 반주 강한 곡 포함)의 줄 시작 시간을 손으로 기록.
2. 사내 GPU에서 htdemucs 분리 유무 × (kresnik, MMS ctc-forced-aligner, stable-ts) 조합의 줄 시작 오차(중앙값, 90퍼센타일, ±0.3초 이내 비율)와 곡당 처리 시간 측정.
3. 라이선스 문제가 없는 조합으로 서버 사전 계산 확정. 결과 JSON 을 곡에 저장.
4. 폴백: wav2vec2 한국어를 ONNX 로 변환(미확인 작업)해 transformers.js WebGPU 에서 앞 청크 지연 측정.
5. 수노 대행 API는 골든셋 정답 대용이나 일부 곡 검증용으로만 소량 비교(유료).

## 7. 출처 목록 (확인일 2026-11-01)

- https://github.com/MahmoudAshraf97/ctc-forced-aligner
- https://docs.pytorch.org/audio/stable/tutorials/ctc_forced_alignment_api_tutorial.html
- https://github.com/m-bain/whisperX
- https://raw.githubusercontent.com/m-bain/whisperX/main/whisperx/alignment.py
- https://huggingface.co/kresnik/wav2vec2-large-xlsr-korean
- https://github.com/jianfch/stable-ts
- https://github.com/NVIDIA/NeMo/blob/main/tools/nemo_forced_aligner/README.md
- https://github.com/readbeyond/aeneas
- https://huggingface.co/tuneperfect/tunestudio-aligner
- https://huggingface.co/chordai/mms-fa-aligner-coreml
- https://huggingface.co/chordai/wav2vec2-base960h-aligner-coreml
- https://huggingface.co/MontrealCorpusTools/korean_mfa
- https://amslaurea.unibo.it/id/eprint/34172/
- https://huggingface.co/blog/transformersjs-v3
- https://github.com/facebookresearch/demucs
- https://github.com/timcsy/demucs-web
- https://huggingface.co/monteslu/htdemucs-web-onnx
- https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/start
- https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/processLocally
- https://groups.google.com/a/chromium.org/g/chrome-ai-dev-preview-discuss/c/Rlyc2uAsFCY
- https://groups.google.com/a/chromium.org/g/blink-dev/c/P8P-x7AnC6I
- https://poyo.ai/en/models/get-timestamped-lyrics
- https://apiin-one.pages.dev/models/suno
- https://unifically.com/ja/models/suno

한계: 웹 페이지 요약 도구로 확인했기 때문에 일부 항목(특히 stable-ts 한국어, NFA 언어 목록, transformers.js 모델 크기)은 원문 전체를 읽지 못했다. 해당 칸은 「미확인」으로 두었다.

## 8. 타 서비스 방식 (확인일 2026-11-01)

규칙: 공개 문서·공개 라이브러리 소스만 사용. 로그인·계정 생성·네트워크 관찰은 하지 않았다. 추측은 「추측」으로 표시했다.

| 서비스 | 확인된 사실 | 출처 |
|---|---|---|
| 수노 | 수노 내부 엔드포인트 `GET /api/gen/{id}/aligned_lyrics/v2/`가 곡 ID로 호출된다(비공식 Rust 크레이트 suno-core 소스). 응답에 단어 단위 `aligned_words`(word, success, start_s, end_s, p_align 신뢰도), 줄 단위 `aligned_lyrics`(줄 텍스트, 시작·끝, 섹션 라벨, 단어 목록), `waveform_data`, `hoot_cer`(오류 지표), `is_streamed`. 인스트루멘털이나 정렬 못 한 곡은 200 + 빈 배열. 비공식 gcui-art/suno-api 는 `GET /api/get_aligned_lyrics`로 같은 데이터를 감싸 제공하고 세션 쿠키가 필요하다. 수노가 재생 때마다 계산하는지 생성 때 저장하는지는 이 자료로 확정되지 않는다. 곡 ID 하나에 고정 응답이 나오는 조회형 API 모양이므로 「저장된 시간표를 받아 온다」가 유력하나, 이는 추측이다. 비공식 접근이라 약관·안정성 확인이 필요하다 | https://docs.rs/suno-core/0.36.9/src/suno_core/lyrics/aligned.rs.html , https://www.mintlify.com/gcui-art/suno-api/api-reference/get-aligned-lyrics , 공식 유료 대행 문서 https://docs.sunoapi.org/suno-api/get-timestamped-lyrics |
| 스포티파이 | 가사는 Musixmatch 가 제공하는 라이선스 동기 가사(일본은 PetitLyrics). 아티스트 도구에서는 줄 단위로 줄마다 타임스탬프를 사람이 맞추는 흐름이고, 변경 반영에 며칠 걸린다. 즉 서버에 저장된 줄 단위 시간표를 재생 시 받는 구조(반영 지연이 사전 배포형임을 시사, 추측). 스포티파이가 단어 단위를 표시하는지는 자료에 없음(미확인). 비동기 반영 구조 자체는 위 지연 서술로 뒷받침됨 | https://support.spotify.com/gw-en/artists/article/managing-your-lyrics-on-spotify/ , https://medium.com/musixmatch-blog/spotify-and-musixmatch-powering-lyrics-together-5b7e02531495 (본문은 403 으로 못 읽고 검색 요약만 확인) |
| Musixmatch | 줄 단위(웹·앱)와 단어 단위(앱 전용) 두 모드. 줄 단위는 듣고 각 줄 첫 음절 근처에 시간을 찍고 5초 넘는 간주는 instrumental 표시. 단어 단위는 앱에서 화면을 밀어 단어를 맞춘다. 「Sync Assistant」 계정이 자동 생성한 줄·단어 싱크를 출발점으로 제공하고 사람이 고친다. 비공식 확장 프로그램이 일괄 치환 도구를 덧붙일 정도로 커뮤니티 수정이 활발하다 | https://musixmatch.helpscoutdocs.com/article/190-how-can-artists-add-and-synchronize-lyrics-on-musixmatch-pro , https://musixmatch.helpscoutdocs.com/article/540-what-are-musixmatch-assistant-accounts |
| 애플 뮤직 | 시간 동기 가사는 TTML 로 제출(애플 지원 커뮤니티 답변). 줄 단위 TTML 이 기본, 단어 단위(span begin/end)가 있으면 노래방식 단어 강조, 복수 화자(ttm:agent)와 백그라운드 보컬(x-bg) 표기. 제출은 콘텐츠 수집 도구나 유통사 경유. 이 서술 대부분은 서드파티 Better Lyrics 가이드라 애플 공식 명세 대조가 필요하다 | https://discussions.apple.com/thread/251368064 , https://composer.betterlyrics.org/guides/ttml-file-format-spec |
| 유튜브 뮤직 | 공급사가 바뀌었다. 2024년 LyricFind 가 주 공급사가 되면서 동기 가사가 일부 사라졌다는 보도, LyricFind 는 원인이 아니라고 반박, 공식 문서는 못 찾음. 어쨌든 외부 공급사가 매일 제공하는 사전 배포 구조(제공 주기 서술 있음) | https://androidauthority.com/youtube-music-lost-time-synced-lyrics-3478527 , https://www.musicinafrica.net/node/112470 |
| 멜론·지니 | 싱크 가사 제작 방식을 다룬 공식 자료·기술 블로그·특허를 찾지 못했다. 미확인. 추측도 하지 않는다. 참고로 삼성뮤직은 mp3 옆 .lrc 파일로 싱크 가사를 구동한다(고객센터 답변) | https://r1.community.samsung.com/t5/%EA%B0%A4%EB%9F%AD%EC%8B%9C-S/%EC%82%BC%EC%84%B1%EB%AE%A4%EC%A7%81-%EA%B0%90%EB%8F%99%EC%9D%B4%EC%97%90%EC%9A%94/td-p/24450 |

### 판정
1. 「모두 사전 계산된 시간표를 재생 시 받아 온다」: 확인된 범위에서는 맞다. 스포티파이·Musixmatch·애플·유튜브 뮤직은 제작과 재생이 분리되어 있고(제출 후 반영 지연, 공급사 일일 전달) 재생 시에는 완성된 시간표만 받는다. 수노도 곡 ID 조회형 API 로 단어·줄 시간표를 내려준다(저장 시점은 추측). 재생 중 실시간 정렬을 하는 서비스는 이번 조사에서 하나도 확인되지 않았다.
2. 우리 설계(사전 계산 1순위·브라우저 폴백)는 업계 방식과 같다. 업계에 없는 것은 「폴백」뿐이고, 이는 사람이 만든 시간표가 없는 AI 생성곡이라는 우리 특수성 때문이다.
3. 더 배울 것:
   - 줄 단위만이 아니라 단어 단위 데이터를 저장한다(수노 응답 구조와 같다). 정렬기는 어차피 단어 시간을 내므로 추가 비용이 없고, 줄 단위는 단어에서 파생시킨다.
   - 신뢰도 필드를 저장한다. 수노는 단어별 `success`·`p_align`과 곡 전체 `hoot_cer`를 둔다. 우리도 줄별 신뢰도를 저장해 낮은 곡만 사람 확인·재계산 대상으로 걸러낸다.
   - 정렬 실패 곡 처리: 수노는 빈 배열로 「싱크 없음」을 명확히 표시한다. 우리도 실패 곡은 줄 하이라이트를 끄고 가사 전체 보기로 폴백한다.
   - 자동 생성본을 사람이 고치는 흐름(Musixmatch Sync Assistant → 큐레이터 수정): 자동 시간표 위에 사용자·운영자가 줄 시간을 드래그로 고치고 저장하는 편집기와 수정 이력을 둔다. 커뮤니티 수정은 자동화 방침(사람 손 없는 기능 우선)과 충돌할 수 있으므로 신뢰도 낮은 곡에만 열고, 반영은 운영자 승인 또는 투표 기준을 둘 것(설계 제안, 근거는 업계 사례).
   - 간주(5초 이상 무가사) 구간 표시, 섹션 라벨, 화자·백보컬 구분(애플 TTML)은 2차 과제.
