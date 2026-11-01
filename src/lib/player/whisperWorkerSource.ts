/**
 * 「가사 자동 맞추기」 강제 정렬 워커의 소스(일반 JS 문자열) — Blob 워커로 띄운다.
 * 원문 가사를 whisper 디코더에 그대로 넣고(교사 강제) 교차 어텐션을 DTW 로 훑어 줄 시작 시각을 얻는다.
 * 자유 인식(받아쓰기)은 노래에서 틀리고 환각이 많아 쓰지 않는다 — 4곡 측정에서 강제 정렬이 월등했다.
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
 * 줄 순서대로 따라가며 맞춘다: 창(30초)에 다음 줄들을 넣어 정렬하고, 창 앞쪽 20초 안에 시작하는 줄만 받아들인 뒤
 * 마지막으로 받아들인 줄 근처에서 다음 창을 연다. spans 가 있으면 쉬는 구간은 건너뛴다.
 * 반환: 줄마다 시작 초
 */
async function forcedAlign(asr, Tensor, samples, lines, spans, onProgress) {
  var tok = asr.tokenizer, total = samples.length / SR;
  var ids = lines.map(function (l) { return tok.encode(' ' + String(l)); });
  var filler = tok.encode(' \u266a \u266a');
  var res = new Array(lines.length).fill(null);
  var i = 0, winStart = spans && spans.length ? Math.max(0, spans[0].start - 0.5) : 0, interval = 4;
  var guard = 0;
  while (i < lines.length && guard++ < 200) {
    onProgress && onProgress(i / lines.length);
    var a = Math.floor(winStart * SR), b = Math.min(samples.length, a + 30 * SR);
    if (b - a < SR * 3) break;
    /* 창에 넣을 줄: 토큰 합이 150 이하, 최대 8줄 */
    var grp = [], n = 0;
    while (i + grp.length < lines.length && grp.length < 8 && n + ids[i + grp.length].length <= 150) { n += ids[i + grp.length].length; grp.push(ids[i + grp.length]); }
    if (!grp.length) grp.push(ids[i].slice(0, 150));
    /* 창 앞이 전주·간주일 수 있어, 음표 토큰을 맨 앞에 붙여 그 구간의 어텐션을 받아 내게 한다 */
    var st = (await alignWindow(asr, Tensor, samples, a, b, [filler].concat(grp))).slice(1);
    var lastWin = b >= samples.length - SR;
    var acceptedTo = -1;
    for (var g = 0; g < grp.length; g++) { if (lastWin || st[g] <= 20 || g === 0) acceptedTo = g; else break; }
    for (var g2 = 0; g2 <= acceptedTo; g2++) res[i + g2] = winStart + st[g2];
    if (acceptedTo >= 1) interval = Math.max(2, (res[i + acceptedTo] - res[i]) / acceptedTo);
    var lastT = res[i + acceptedTo];
    i += acceptedTo + 1;
    winStart = Math.min(Math.max(0, total - 3), lastT + interval * 0.7);
    if (spans) { /* 쉬는 구간 안이면 다음 노래 구간 앞으로 */
      for (var sp of spans) { if (winStart < sp.start - 0.5 && winStart > (sp.start - 40)) { var inSpan = spans.some(function (q) { return winStart >= q.start && winStart <= q.end; }); if (!inSpan) { winStart = sp.start - 0.5; break; } } }
    }
  }
  onProgress && onProgress(1);
  return res;
}

`;

export const WHISPER_GLUE_SRC = String.raw`
var asrP = null, TensorCls = null;
function load(tf) {
  if (!asrP) {
    tf.env.allowLocalModels = false;
    TensorCls = tf.Tensor;
    var files = {};
    asrP = tf.pipeline('automatic-speech-recognition', MODEL, {
      dtype: 'q8',
      progress_callback: function (p) {
        if (p && p.status === 'progress' && p.file) {
          files[p.file] = [p.loaded, p.total];
          var l = 0, t = 0;
          for (var f in files) { l += files[f][0]; t += files[f][1]; }
          if (t) self.postMessage({ type: 'download', pct: Math.round((l / t) * 100) });
        }
      }
    });
  }
  return asrP;
}
self.onmessage = async function (e) {
  var m = e.data;
  try {
    var tf = await import(TF_URL);
    var asr = await load(tf);
    self.postMessage({ type: 'listen', pct: 0 });
    var starts = await forcedAlign(asr, TensorCls, m.samples, m.lines, m.spans, function (p) {
      self.postMessage({ type: 'listen', pct: Math.round(p * 100) });
    });
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
