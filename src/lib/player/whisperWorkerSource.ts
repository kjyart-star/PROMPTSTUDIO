/**
 * 「가사 자동 맞추기」 강제 정렬 워커의 소스(일반 JS 문자열) — Blob 워커로 띄운다.
 * 원문 가사를 whisper 디코더에 그대로 넣고(교사 강제) 교차 어텐션을 DTW 로 훑어 줄 시작 시각을 얻는다.
 * 자유 인식(받아쓰기)은 노래에서 틀리고 환각이 많아 시작 줄 찾기(15초 청크)에만 쓴다 — 4곡 측정에서 강제 정렬이 월등했다.
 * 번들러를 거치지 않고 transformers.js 를 CDN 에서 불러오므로 앱 번들과 빌드에 영향이 없다.
 * 같은 코드를 Node 하네스에서도 돌려 정확도를 잰다(CORE 부분만 떼어 실행).
 * 주의: 이 문자열 안에는 백틱·달러 중괄호를 쓰지 않는다.
 */

export const WHISPER_MODEL = 'onnx-community/whisper-small_timestamped';
export const TRANSFORMERS_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.6';

export const WHISPER_CORE_SRC = String.raw`
var SR = 16000;

/* ---- 강제 정렬: 원문 가사를 그대로 디코더에 넣고(교사 강제) 교차 어텐션을 DTW 로 훑어 토큰별 시각을 얻는다 ---- */

function medianFilter(row, w) {
  var h = w >> 1, n = row.length, out = new Float32Array(n), buf = new Array(w);
  for (var i = 0; i < n; i++) {
    var c = 0;
    for (var k = -h; k <= h; k++) { var j = i + k; j = j < 0 ? -j : j >= n ? 2 * n - 2 - j : j; buf[c++] = row[j]; }
    buf.sort(function (a, b) { return a - b; });
    out[i] = buf[h];
  }
  return out;
}

/* 토큰 × 프레임 비용 행렬의 DTW. 반환: 토큰별 시작 프레임 */
function dtwStarts(cost, T, F) {
  var W = F + 1, D = new Float32Array((T + 1) * W).fill(Infinity), B = new Uint8Array((T + 1) * W);
  D[0] = 0;
  for (var i = 1; i <= T; i++) {
    for (var j = 1; j <= F; j++) {
      var c = cost[(i - 1) * F + (j - 1)];
      var a = D[(i - 1) * W + (j - 1)], b = D[(i - 1) * W + j], d = D[i * W + (j - 1)];
      var m = a, t = 0;
      if (b < m) { m = b; t = 1; }
      if (d < m) { m = d; t = 2; }
      D[i * W + j] = c + m; B[i * W + j] = t;
    }
  }
  var i2 = T, j2 = F, starts = new Array(T).fill(-1);
  while (i2 > 0 && j2 > 0) {
    var tr = B[i2 * W + j2];
    starts[i2 - 1] = j2 - 1;           /* 이 토큰이 처음 차지한 프레임으로 계속 덮어쓴다 */
    if (tr === 0) { i2--; j2--; } else if (tr === 1) i2--; else j2--;
  }
  return starts;
}

/* 한 창(samples[a..b])에 줄들의 토큰을 맞춘다. 반환: 줄마다 창 안 시작 초 */
async function alignWindow(asr, Tensor, samples, a, b, lineIds) {
  var tok = asr.tokenizer, gc = asr.model.generation_config;
  var pre = tok.model.convert_tokens_to_ids(['<|startoftranscript|>', '<|ko|>', '<|transcribe|>', '<|notimestamps|>']);
  var eot = tok.model.convert_tokens_to_ids(['<|endoftext|>'])[0];
  var text = [], first = [];
  for (var li = 0; li < lineIds.length; li++) { first.push(pre.length + text.length); for (var x of lineIds[li]) text.push(x); }
  var dec = pre.concat(text, [eot]);
  var feats = await asr.processor(samples.subarray(a, b));
  var out = await asr.model({ input_features: feats.input_features, decoder_input_ids: new Tensor('int64', BigInt64Array.from(dec.map(BigInt)), [1, dec.length]), output_attentions: true });
  var T = dec.length, F = Math.min(1500, Math.max(10, Math.round((b - a) / SR / 0.02)));
  var heads = gc.alignment_heads, H = null, acc = new Float32Array(T * F), cnt = 0;
  for (var hh of heads) {
    var ten = out['cross_attentions.' + hh[0]];
    if (!ten) continue;
    var dims = ten.dims, nh = dims[1], fr = dims[3], data = ten.data;
    var m = new Float32Array(T * F);
    for (var t = 0; t < T; t++) for (var f = 0; f < F; f++) m[t * F + f] = data[((hh[1] * T) + t) * fr + f];
    /* 프레임마다 토큰 축 평균·표준편차로 정규화 */
    for (var f2 = 0; f2 < F; f2++) {
      var mu = 0, sd = 0;
      for (var t2 = 0; t2 < T; t2++) mu += m[t2 * F + f2];
      mu /= T;
      for (var t3 = 0; t3 < T; t3++) { var dv = m[t3 * F + f2] - mu; sd += dv * dv; }
      sd = Math.sqrt(sd / T) + 1e-6;
      for (var t4 = 0; t4 < T; t4++) m[t4 * F + f2] = (m[t4 * F + f2] - mu) / sd;
    }
    for (var t5 = 0; t5 < T; t5++) { var mf = medianFilter(m.subarray(t5 * F, (t5 + 1) * F), 7); for (var f3 = 0; f3 < F; f3++) acc[t5 * F + f3] += mf[f3]; }
    cnt++;
  }
  if (!cnt) throw new Error('no cross attention');
  for (var i = 0; i < acc.length; i++) acc[i] = -acc[i] / cnt;
  var starts = dtwStarts(acc, T, F);
  return first.map(function (ix) { return starts[ix] * 0.02; });
}

/*
 * 줄 순서대로 따라가며 맞춘다: 창(30초)에 「바로 앞에 맞춘 줄(기준) + 다음 줄들」을 넣어 정렬하고,
 * 창 앞쪽 20초 안에 시작하는 줄만 받아들인 뒤, 마지막으로 받아들인 줄 1초 앞에서 다음 창을 연다.
 * 줄 사이·앞뒤에 음표 토큰을 넣어 전주·간주·애드리브·후렴 반복처럼 가사가 아닌 소리가 줄에 붙지 않게 한다
 * (2026-11-01 측정: 애드리브가 있는 곡에서 12초, 후렴 반복으로 끝나는 곡에서 21초 어긋나던 것을 잡았다).
 * opts: { from: 시작 줄, to: 끝 줄(미포함), winStart: 첫 창 시작 초, res: 결과를 채울 배열, onPartial: 창 하나가 끝날 때마다 호출 }
 * 반환: 줄마다 시작 초
 */
async function forcedAlign(asr, Tensor, samples, lines, spans, onProgress, opts) {
  opts = opts || {};
  var tok = asr.tokenizer, total = samples.length / SR;
  var ids = lines.map(function (l) { return tok.encode(' ' + String(l)); });
  var filler = tok.encode(' \u266a \u266a');
  var res = opts.res || new Array(lines.length).fill(null);
  var to = opts.to == null ? lines.length : opts.to;
  var i = opts.from || 0, anchor = -1;
  var winStart = opts.winStart != null ? opts.winStart : (spans && spans.length ? Math.max(0, spans[0].start - 0.5) : 0);
  var guard = 0;
  while (i < to && guard++ < 200) {
    onProgress && onProgress(i / lines.length);
    var a = Math.floor(winStart * SR), b = Math.min(samples.length, a + 30 * SR);
    if (b - a < SR * 3) break;
    /* 창에 넣을 줄: 바로 앞에 맞춘 줄(기준) + 다음 줄들, 토큰 합 150 이하, 최대 8줄 */
    var grp = [], n = anchor >= 0 ? ids[anchor].length : 0;
    while (i + grp.length < to && grp.length < 8 && n + ids[i + grp.length].length <= 150) { n += ids[i + grp.length].length; grp.push(ids[i + grp.length]); }
    if (!grp.length) grp.push(ids[i].slice(0, 150));
    /* 음표 토큰을 맨 앞·줄 사이·맨 뒤에 넣어 전주·간주·애드리브·후주처럼 가사가 아닌 소리를 받아 내게 한다 */
    var seq = [filler], off = 1;
    if (anchor >= 0) { seq.push(ids[anchor]); seq.push(filler); off = 3; }
    for (var q = 0; q < grp.length; q++) { seq.push(grp[q]); seq.push(filler); }
    var st0 = await alignWindow(asr, Tensor, samples, a, b, seq);
    var st = []; for (var q2 = 0; q2 < grp.length; q2++) st.push(st0[off + q2 * 2]);
    var lastWin = b >= samples.length - SR;
    var winLen = (b - a) / SR;
    var acceptedTo = -1;
    for (var g = 0; g < grp.length; g++) {
      /* 다음 줄이 창 끝에 몰려 있으면(창 밖에 있다는 뜻) 이 줄도 뒤쪽 소리를 떠안았을 수 있어 다음 창에서 다시 본다 */
      var squeezed = !lastWin && g + 1 < grp.length && st[g + 1] >= winLen - 1;
      if (g === 0 || (lastWin || st[g] <= 20) && !squeezed) acceptedTo = g; else break;
    }
    for (var g2 = 0; g2 <= acceptedTo; g2++) res[i + g2] = winStart + st[g2];
    var lastT = res[i + acceptedTo];
    anchor = i + acceptedTo;
    i += acceptedTo + 1;
    opts.onPartial && opts.onPartial(res.slice());
    /* 다음 창은 마지막으로 맞춘 줄 바로 앞에서 연다 — 그 줄을 기준으로 다시 넣어 창 앞 소리가 다음 줄로 끌려가지 않게 한다 */
    winStart = Math.min(Math.max(0, total - 3), Math.max(0, lastT - 1));
  }
  onProgress && onProgress(1);
  return res;
}

/* ---- 재생 위치에서 시작하기: 받아쓰기로 지금 부르는 줄을 찾는다 ---- */

function normText(s) { return String(s).toLowerCase().replace(/[^0-9a-zㄱ-ㆎ가-힣]/g, ''); }

function bigramCounts(s) {
  var m = {}, n = 0;
  for (var i = 0; i + 1 < s.length; i++) { var g = s.substr(i, 2); m[g] = (m[g] || 0) + 1; n++; }
  return { m: m, n: n };
}

/* 글자 2-gram Dice 유사도(0~1) */
function diceSim(a, b) {
  var A = bigramCounts(a), B = bigramCounts(b);
  if (!A.n || !B.n) return 0;
  var inter = 0;
  for (var g in A.m) if (B.m[g]) inter += Math.min(A.m[g], B.m[g]);
  return (2 * inter) / (A.n + B.n);
}

/*
 * 받아쓴 글과 가장 비슷한 가사 줄 k 를 찾는다(줄 k 한 줄·k..k+1·k..k+2 를 이어 붙인 것 중 가장 비슷한 점수).
 * 반복 후렴처럼 비슷한 점수가 여러 곳이면 expected(재생 위치 비례 줄 번호)에 가까운 쪽을 고른다.
 * 반환: { k, score } — 글이 너무 짧거나 비슷한 곳이 없으면 score 가 낮다
 */
function matchLineIndex(text, lines, expected) {
  var t = normText(text);
  if (t.length < 4) return { k: 0, score: 0 };
  var norm = lines.map(normText), sc = [], best = 0;
  for (var k = 0; k < norm.length; k++) {
    var w1 = norm[k], w2 = w1 + (norm[k + 1] || ''), w3 = w2 + (norm[k + 2] || '');
    var s = Math.max(diceSim(t, w1), diceSim(t, w2), diceSim(t, w3));
    sc.push(s);
    if (s > best) best = s;
  }
  var pick = 0, gap = Infinity;
  for (var j = 0; j < sc.length; j++) {
    if (sc[j] >= best - 0.05) { var d = Math.abs(j - expected); if (d < gap) { gap = d; pick = j; } }
  }
  return { k: pick, score: best };
}

/* startSec 근처 15초([startSec-1, startSec+14])를 받아쓰고 가장 비슷한 줄 번호를 돌려준다. 약하면 0 */
async function findStartLine(asr, samples, lines, startSec) {
  var a = Math.max(0, Math.floor((startSec - 1) * SR)), b = Math.min(samples.length, a + 15 * SR);
  if (b - a < SR * 3) return 0;
  var lang = /[가-힣]/.test(lines.join('')) ? 'korean' : 'english';
  var out = await asr(samples.slice(a, b), { language: lang, task: 'transcribe' });
  var text = Array.isArray(out) ? out.map(function (x) { return x.text; }).join(' ') : String(out && out.text || '');
  var r = matchLineIndex(text, lines, Math.round((startSec / (samples.length / SR)) * lines.length));
  return r.score >= 0.3 ? r.k : 0;
}

/*
 * 재생 위치(startSec)부터 맞춘다: (a) 받아쓰기로 줄 k 를 찾고 (b) k 부터 끝까지 따라간 뒤
 * (c) 0..k-1 줄을 곡 처음부터 res[k] 전까지 맞춘다. startSec 가 3초 미만이거나 매칭이 약하면 k=0 부터 기존 방식.
 * onPartial(starts) 는 창 하나가 끝날 때마다 불린다(아직 모르는 줄은 null).
 */
async function alignFrom(asr, Tensor, samples, lines, spans, startSec, onProgress, onPartial) {
  var k = 0;
  if (startSec >= 3) { try { k = await findStartLine(asr, samples, lines, startSec); } catch (e) { k = 0; } }
  var res = new Array(lines.length).fill(null);
  if (k === 0) { await forcedAlign(asr, Tensor, samples, lines, spans, onProgress, { res: res, onPartial: onPartial }); return res; }
  await forcedAlign(asr, Tensor, samples, lines, spans, onProgress, { res: res, from: k, winStart: Math.max(0, startSec - 4), onPartial: onPartial });
  var cut = res[k] != null ? Math.min(samples.length, Math.floor((res[k] + 1) * SR)) : samples.length;
  await forcedAlign(asr, Tensor, samples.subarray(0, cut), lines, spans, onProgress, { res: res, from: 0, to: k, onPartial: onPartial });
  return res;
}

`;

export const WHISPER_GLUE_SRC = String.raw`
var USE_WEBGPU = false;
var asrP = null, asrDev = '', TensorCls = null;

/* WebGPU 를 쓸 수 있으면 { f16 } 를, 아니면 null */
async function pickGpu() {
  /* 2026-11-02 운영 실측: WebGPU fp16 의 교차 어텐션으로 정렬하면 줄이 창 길이(30초) 간격으로 밀리고 뒤쪽 줄이 한 시각에 몰렸다.
     정확도가 확인된 WASM q8 만 쓴다(USE_WEBGPU 를 켜기 전에 반드시 정답 시각과 대조할 것). */
  if (!USE_WEBGPU) return null;
  try {
    if (self.navigator && self.navigator.gpu) {
      var ad = await self.navigator.gpu.requestAdapter();
      if (ad) return { f16: !!(ad.features && ad.features.has('shader-f16')) };
    }
  } catch (e) { /* WASM 으로 */ }
  return null;
}

function load(tf, gpu) {
  var dev = gpu ? 'webgpu' : 'wasm';
  if (asrP && asrDev === dev) return asrP;
  tf.env.allowLocalModels = false;
  TensorCls = tf.Tensor;
  var files = {};
  var opts = gpu
    ? { device: 'webgpu', dtype: gpu.f16 ? 'fp16' : { encoder_model: 'fp32', decoder_model_merged: 'q4' } }
    : { dtype: 'q8' };
  opts.progress_callback = function (p) {
    if (p && p.status === 'progress' && p.file) {
      files[p.file] = [p.loaded, p.total];
      var l = 0, t = 0;
      for (var f in files) { l += files[f][0]; t += files[f][1]; }
      if (t) self.postMessage({ type: 'download', pct: Math.round((l / t) * 100) });
    }
  };
  asrDev = dev;
  asrP = tf.pipeline('automatic-speech-recognition', MODEL, opts);
  return asrP;
}

async function runOnce(tf, gpu, m) {
  var asr = await load(tf, gpu);
  self.postMessage({ type: 'device', device: gpu ? 'webgpu' : 'wasm' });
  self.postMessage({ type: 'listen', pct: 0 });
  return alignFrom(asr, TensorCls, m.samples, m.lines, m.spans, m.startSec || 0, function (p) {
    self.postMessage({ type: 'listen', pct: Math.round(p * 100) });
  }, function (starts) {
    self.postMessage({ type: 'partial', starts: starts });
  });
}

self.onmessage = async function (e) {
  var m = e.data;
  try {
    var tf = await import(TF_URL);
    var gpu = await pickGpu(), starts = null;
    if (gpu) {
      try { starts = await runOnce(tf, gpu, m); }
      catch (err) { asrP = null; gpu = null; }   /* WebGPU 에서 막히면 WASM q8 로 다시 */
    }
    if (!starts) starts = await runOnce(tf, null, m);
    self.postMessage({ type: 'result', starts: starts });
  } catch (err) {
    asrP = null;
    self.postMessage({ type: 'error', message: String(err && err.message || err) });
  }
};
`;

/** Blob 워커용 완성 소스 */
export function whisperWorkerScript(): string {
  return 'var MODEL=' + JSON.stringify(WHISPER_MODEL) + ',TF_URL=' + JSON.stringify(TRANSFORMERS_URL) + ';\n' + WHISPER_CORE_SRC + WHISPER_GLUE_SRC;
}
