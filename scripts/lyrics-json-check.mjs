/**
 * 가사 JSON 건지기 검사 — `npm run check:lyrics-json`
 *
 * 2026-09-07 에 가사 생성이 쿠키플레이 게이트웨이로 옮겨 가면서
 * `response_format: { type: 'json_object' }` 를 잃었다(Replicate 의 gpt-5-nano
 * 입력 스키마에 그 칸이 없다). 형식 보증이 **규격에서 코드로** 내려앉았으므로,
 * 내려앉은 그 코드가 실제로 버티는지 여기서 못 박아 둔다.
 *
 * 외부로 나가지 않는다 — 유료 호출 없음. 모델이 뱉을 법한 글만 손으로 적어 넣는다.
 * Node 의 타입 스트리핑으로 .ts 를 그대로 불러온다(빌드 단계가 없다).
 */
import assert from 'node:assert/strict';
import { parseLyrics } from '../src/lib/ai/lyricsJson.ts';

let passed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed += 1;
  } catch (err) {
    console.error(`✗ ${name}\n  ${err.message}`);
    process.exitCode = 1;
  }
}

const pair = (extra = '') => `{
  "versionA": { "title": "네온 미드나잇", "stylePrompt": "korean city pop, 120 bpm", "lyrics": "[Verse 1]\\n비 내린 거리\\n\\n[Chorus]\\n달려봐" },
  "versionB": { "title": "자정의 몽상", "stylePrompt": "atmospheric city pop, 95 bpm", "lyrics": "[Intro]\\n\\n[Verse 1]\\n침묵의 도시" }${extra}
}`;

// ── 통과해야 하는 것 ────────────────────────────────────────────────────────

test('맨 JSON 한 덩이를 읽는다', () => {
  const out = parseLyrics(pair());
  assert.equal(out.versionA.title, '네온 미드나잇');
  assert.equal(out.versionB.stylePrompt, 'atmospheric city pop, 95 bpm');
  // 줄바꿈 이스케이프가 진짜 줄바꿈으로 풀려야 화면이 절을 나눠 그린다.
  assert.ok(out.versionA.lyrics.includes('\n'), '줄바꿈이 풀리지 않았다');
});

test('코드펜스로 감싸 와도 벗겨 낸다 (가장 흔한 어긋남)', () => {
  const out = parseLyrics('```json\n' + pair() + '\n```');
  assert.equal(out.versionA.title, '네온 미드나잇');
});

test('앞뒤 머리말이 붙어 와도 건져 낸다', () => {
  const out = parseLyrics(`좋아요! 요청하신 가사입니다.\n\n${pair()}\n\n마음에 드시길 바랍니다.`);
  assert.equal(out.versionB.title, '자정의 몽상');
});

test('모르는 칸이 더 붙어 와도 우리가 쓰는 칸만 읽는다', () => {
  const out = parseLyrics(pair(',\n  "notes": "덤으로 붙인 설명"'));
  assert.deepEqual(Object.keys(out.versionA).sort(), ['lyrics', 'stylePrompt', 'title']);
});

// ── 실패로 봐야 하는 것 (여기서 null 이 나와야 재시도·환불이 걸린다) ──────────

test('JSON 이 아니면 null — 산문을 가사로 넘기지 않는다', () => {
  assert.equal(parseLyrics('죄송합니다. 그 주제로는 가사를 쓸 수 없습니다.'), null);
});

test('중간에서 잘린 JSON 은 null — 반쯤 고쳐서 보여 주지 않는다', () => {
  assert.equal(parseLyrics(pair().slice(0, 120)), null);
});

test('한쪽 버전만 오면 null — 화면이 카드 두 장을 그린다', () => {
  assert.equal(
    parseLyrics('{"versionA": {"title":"A","stylePrompt":"pop","lyrics":"[Verse 1]\\n가사"}}'),
    null,
  );
});

test('칸이 비어 있으면 null', () => {
  assert.equal(
    parseLyrics(
      '{"versionA":{"title":"A","stylePrompt":"pop","lyrics":"가사"},' +
        '"versionB":{"title":"","stylePrompt":"pop","lyrics":"가사"}}',
    ),
    null,
  );
});

test('빈 글·비문자열은 null', () => {
  assert.equal(parseLyrics(''), null);
  assert.equal(parseLyrics('   '), null);
});

if (!process.exitCode) console.log(`\n${passed} passed`);
