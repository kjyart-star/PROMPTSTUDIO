// 자동 생성 파일 — 직접 고치지 말 것. 원본: src/lib/mastering/fft.ts + dsp.ts (npm run build:worklet)
/**
 * FFT 와 리니어 페이즈 FIR (분할 컨볼루션).
 * import 없이 쓴다 — 워크릿 빌드가 dsp.ts 앞에 그대로 붙인다.
 */
/** 제자리 복소 FFT (radix-2). n 은 2의 거듭제곱. inverse 면 1/n 까지 나눈다 */
export class FFT {
    constructor(n) {
        this.n = n;
        this.cos = new Float64Array(n / 2);
        this.sin = new Float64Array(n / 2);
        for (let i = 0; i < n / 2; i++) {
            this.cos[i] = Math.cos((2 * Math.PI * i) / n);
            this.sin[i] = Math.sin((2 * Math.PI * i) / n);
        }
        this.rev = new Uint32Array(n);
        const bits = Math.round(Math.log2(n));
        for (let i = 0; i < n; i++) {
            let r = 0;
            for (let b = 0; b < bits; b++)
                r |= ((i >> b) & 1) << (bits - 1 - b);
            this.rev[i] = r;
        }
    }
    transform(re, im, inverse = false) {
        const n = this.n;
        for (let i = 0; i < n; i++) {
            const j = this.rev[i];
            if (j > i) {
                let t = re[i];
                re[i] = re[j];
                re[j] = t;
                t = im[i];
                im[i] = im[j];
                im[j] = t;
            }
        }
        const sgn = inverse ? 1 : -1;
        for (let size = 2; size <= n; size <<= 1) {
            const half = size >> 1, step = n / size;
            for (let i = 0; i < n; i += size) {
                for (let j = 0, k = 0; j < half; j++, k += step) {
                    const wr = this.cos[k], wi = sgn * this.sin[k];
                    const a = i + j, b = a + half;
                    const tr = re[b] * wr - im[b] * wi;
                    const ti = re[b] * wi + im[b] * wr;
                    re[b] = re[a] - tr;
                    im[b] = im[a] - ti;
                    re[a] += tr;
                    im[a] += ti;
                }
            }
        }
        if (inverse)
            for (let i = 0; i < n; i++) {
                re[i] /= n;
                im[i] /= n;
            }
    }
}
/**
 * 크기 응답 함수(Hz → 선형 배율)로 리니어 페이즈 FIR 을 만든다.
 * 주파수 표본화 + 블랙맨 창. 길이는 홀수(taps), 지연은 (taps-1)/2.
 */
export function designLinearPhaseFir(mag, fs, taps = 4095) {
    const M = 16384;
    const fft = new FFT(M);
    const re = new Float64Array(M), im = new Float64Array(M);
    for (let k = 0; k <= M / 2; k++) {
        const v = mag((k * fs) / M);
        re[k] = v;
        if (k > 0 && k < M / 2)
            re[M - k] = v;
    }
    fft.transform(re, im, true);
    const h = new Float64Array(taps);
    const c = (taps - 1) / 2;
    for (let i = 0; i < taps; i++) {
        const n = i - c;
        const idx = ((n % M) + M) % M;
        const w = 0.42 + 0.5 * Math.cos((Math.PI * n) / (c + 1)) + 0.08 * Math.cos((2 * Math.PI * n) / (c + 1));
        h[i] = re[idx] * w;
    }
    return h;
}
/** 균일 분할 FFT 컨볼루션 (스테레오). 지연 = 블록 B. */
export class PartitionedConvolver {
    constructor(h, B = 128) {
        this.parts = [];
        this.hist = [[], []]; // 채널별 입력 스펙트럼 링
        this.hpos = 0;
        this.fill = 0;
        this.B = B;
        const N = 2 * B;
        this.fft = new FFT(N);
        const P = Math.ceil(h.length / B);
        for (let p = 0; p < P; p++) {
            const re = new Float64Array(N), im = new Float64Array(N);
            for (let i = 0; i < B; i++) {
                const k = p * B + i;
                if (k < h.length)
                    re[i] = h[k];
            }
            this.fft.transform(re, im);
            this.parts.push({ re, im });
            for (let c = 0; c < 2; c++)
                this.hist[c].push({ re: new Float64Array(N), im: new Float64Array(N) });
        }
        this.inBuf = [new Float64Array(B), new Float64Array(B)];
        this.prevIn = [new Float64Array(B), new Float64Array(B)];
        this.outBuf = [new Float64Array(B), new Float64Array(B)];
        this.wr = new Float64Array(N);
        this.wi = new Float64Array(N);
        this.ar = new Float64Array(N);
        this.ai = new Float64Array(N);
    }
    /** 샘플 단위로 밀어 넣고 B 샘플 늦은 결과를 받는다 */
    process(L, R, n) {
        const B = this.B;
        for (let i = 0; i < n; i++) {
            this.inBuf[0][this.fill] = L[i];
            this.inBuf[1][this.fill] = R[i];
            L[i] = this.outBuf[0][this.fill];
            R[i] = this.outBuf[1][this.fill];
            if (++this.fill === B) {
                this.fill = 0;
                this.block();
            }
        }
    }
    block() {
        const B = this.B, N = 2 * B, P = this.parts.length;
        this.hpos = (this.hpos - 1 + P) % P;
        for (let c = 0; c < 2; c++) {
            const slot = this.hist[c][this.hpos];
            // [이전 블록 | 현재 블록] 을 FFT (overlap-save)
            for (let i = 0; i < B; i++) {
                slot.re[i] = this.prevIn[c][i];
                slot.re[B + i] = this.inBuf[c][i];
            }
            slot.im.fill(0);
            this.fft.transform(slot.re, slot.im);
            this.prevIn[c].set(this.inBuf[c]);
            const ar = this.ar, ai = this.ai;
            ar.fill(0);
            ai.fill(0);
            for (let p = 0; p < P; p++) {
                const x = this.hist[c][(this.hpos + p) % P], hp = this.parts[p];
                for (let k = 0; k < N; k++) {
                    ar[k] += x.re[k] * hp.re[k] - x.im[k] * hp.im[k];
                    ai[k] += x.re[k] * hp.im[k] + x.im[k] * hp.re[k];
                }
            }
            this.fft.transform(ar, ai, true);
            for (let i = 0; i < B; i++)
                this.outBuf[c][i] = ar[B + i];
        }
    }
}
/**
 * 마스터링 체인 DSP 코어.
 *
 * import 는 ./fft 하나뿐 — scripts/build-mastering-worklet.mjs 가 fft.ts 와 이 파일을 이어 붙여
 * AudioWorklet(실시간 재생)으로 싣고, 내보내기(오프라인 청크 렌더)와 단위 테스트도 같은 코드를 쓴다.
 * 그래서 들리는 소리와 내보낸 파일이 같다.
 */
export const dbToLin = (db) => Math.pow(10, db / 20);
export const linToDb = (x) => (x > 1e-12 ? 20 * Math.log10(x) : -240);
export const ALL_SLOTS = [
    'gate', 'eq', 'mseq', 'dyneq', 'deesser', 'match', 'comp', 'multiband',
    'transient', 'imager', 'stereo', 'saturation', 'clipper', 'limiter',
];
export const AUTO_TARGETS = ['volume', 'eq.lf', 'eq.lmf', 'eq.mf', 'eq.hmf', 'eq.hf', 'limiter.gain'];
export function defaultEdit() {
    return {
        start: 0, end: 0,
        fadeIn: { dur: 0, curve: 'scurve' }, fadeOut: { dur: 0, curve: 'scurve' },
        region: null, automation: {}, gainOffset: 0,
    };
}
export function fadeShape(x, c) {
    if (x <= 0)
        return 0;
    if (x >= 1)
        return 1;
    switch (c) {
        case 'lin': return x;
        case 'exp': return x * x;
        case 'log': return Math.sqrt(x);
        case 'scurve': return 0.5 - 0.5 * Math.cos(Math.PI * x);
        case 'equal': return Math.sin((Math.PI / 2) * x);
    }
}
/** 브레이크포인트 직선 보간 (점이 없으면 fallback) */
export function evalAuto(pts, t, fallback) {
    if (!pts || !pts.length)
        return fallback;
    if (t <= pts[0].t)
        return pts[0].v;
    const last = pts[pts.length - 1];
    if (t >= last.t)
        return last.v;
    let lo = 0, hi = pts.length - 1;
    while (hi - lo > 1) {
        const m = (lo + hi) >> 1;
        if (pts[m].t <= t)
            lo = m;
        else
            hi = m;
    }
    const a = pts[lo], b = pts[hi];
    return a.v + ((b.v - a.v) * (t - a.t)) / Math.max(1e-9, b.t - a.t);
}
export const IDENTITY = [1, 0, 0, 0, 0];
export function designPeaking(f, gain, q, fs) {
    const A = Math.pow(10, gain / 40);
    const w = (2 * Math.PI * clampF(f, fs)) / fs;
    const alpha = Math.sin(w) / (2 * Math.max(q, 0.05));
    const cs = Math.cos(w);
    const a0 = 1 + alpha / A;
    return [(1 + alpha * A) / a0, (-2 * cs) / a0, (1 - alpha * A) / a0, (-2 * cs) / a0, (1 - alpha / A) / a0];
}
export function designShelf(kind, f, gain, q, fs) {
    const A = Math.pow(10, gain / 40);
    const w = (2 * Math.PI * clampF(f, fs)) / fs;
    const cs = Math.cos(w);
    const alpha = Math.sin(w) / (2 * Math.max(q, 0.05));
    const s = 2 * Math.sqrt(A) * alpha;
    if (kind === 'low') {
        const a0 = A + 1 + (A - 1) * cs + s;
        return [
            (A * (A + 1 - (A - 1) * cs + s)) / a0,
            (2 * A * (A - 1 - (A + 1) * cs)) / a0,
            (A * (A + 1 - (A - 1) * cs - s)) / a0,
            (-2 * (A - 1 + (A + 1) * cs)) / a0,
            (A + 1 + (A - 1) * cs - s) / a0,
        ];
    }
    const a0 = A + 1 - (A - 1) * cs + s;
    return [
        (A * (A + 1 + (A - 1) * cs + s)) / a0,
        (-2 * A * (A - 1 + (A + 1) * cs)) / a0,
        (A * (A + 1 + (A - 1) * cs - s)) / a0,
        (2 * (A - 1 - (A + 1) * cs)) / a0,
        (A + 1 - (A - 1) * cs - s) / a0,
    ];
}
export function designPass(kind, f, q, fs) {
    const w = (2 * Math.PI * clampF(f, fs)) / fs;
    const cs = Math.cos(w);
    const alpha = Math.sin(w) / (2 * q);
    const a0 = 1 + alpha;
    if (kind === 'lp')
        return [(1 - cs) / 2 / a0, (1 - cs) / a0, (1 - cs) / 2 / a0, (-2 * cs) / a0, (1 - alpha) / a0];
    if (kind === 'hp')
        return [(1 + cs) / 2 / a0, -(1 + cs) / a0, (1 + cs) / 2 / a0, (-2 * cs) / a0, (1 - alpha) / a0];
    if (kind === 'bp')
        return [alpha / a0, 0, -alpha / a0, (-2 * cs) / a0, (1 - alpha) / a0];
    return [(1 - alpha) / a0, (-2 * cs) / a0, (1 + alpha) / a0, (-2 * cs) / a0, (1 - alpha) / a0];
}
/** 버터워스 기울기별 2차 단의 Q 값 */
export const BUTTER_Q = {
    12: [0.70710678],
    24: [0.54119610, 1.30656296],
    36: [0.51763809, 0.70710678, 1.93185165],
    48: [0.50979558, 0.60134489, 0.89997622, 2.56291545],
};
function clampF(f, fs) {
    return Math.min(Math.max(f, 5), fs * 0.49);
}
/** 바이쿼드 한 단의 dB 응답 (그래프용) */
export function coefsMagDb(c, f, fs) {
    const w = (2 * Math.PI * f) / fs;
    const cos1 = Math.cos(w), sin1 = Math.sin(w), cos2 = Math.cos(2 * w), sin2 = Math.sin(2 * w);
    const nr = c[0] + c[1] * cos1 + c[2] * cos2;
    const ni = -(c[1] * sin1 + c[2] * sin2);
    const dr = 1 + c[3] * cos1 + c[4] * cos2;
    const di = -(c[3] * sin1 + c[4] * sin2);
    return 10 * Math.log10((nr * nr + ni * ni) / (dr * dr + di * di) + 1e-30);
}
/** 스테레오 바이쿼드 (TDF-II) */
export class Biquad {
    constructor() {
        this.c = IDENTITY;
        this.l1 = 0;
        this.l2 = 0;
        this.r1 = 0;
        this.r2 = 0;
    }
    set(c) { this.c = c; }
    reset() { this.l1 = this.l2 = this.r1 = this.r2 = 0; }
    l(x) {
        const c = this.c;
        const y = c[0] * x + this.l1;
        this.l1 = c[1] * x - c[3] * y + this.l2;
        this.l2 = c[2] * x - c[4] * y;
        return y;
    }
    r(x) {
        const c = this.c;
        const y = c[0] * x + this.r1;
        this.r1 = c[1] * x - c[3] * y + this.r2;
        this.r2 = c[2] * x - c[4] * y;
        return y;
    }
}
// ───────────────────────── 리니어 페이즈 FIR 공통 ─────────────────────────
export const FIR_TAPS = 4095;
export const FIR_BLOCK = 128;
export const FIR_LATENCY = FIR_BLOCK + (FIR_TAPS - 1) / 2;
class FirStage {
    constructor(fs) {
        this.fs = fs;
        this.conv = null;
        this.key = '';
    }
    design(key, mag) {
        if (key === this.key && this.conv)
            return;
        this.key = key;
        this.conv = new PartitionedConvolver(designLinearPhaseFir(mag, this.fs, FIR_TAPS), FIR_BLOCK);
    }
    process(L, R, n) { this.conv?.process(L, R, n); }
}
// ───────────────────────── 7밴드 EQ ─────────────────────────
/** EQ 파라미터를 바이쿼드 계수 목록으로 (게인 0 인 벨·셸프는 빼서 정확히 투명하게) */
export function eqSections(p, fs) {
    const out = [];
    if (p.hpf.on)
        for (const q of BUTTER_Q[p.hpf.slope] ?? BUTTER_Q[12])
            out.push(designPass('hp', p.hpf.freq, q, fs));
    const shelfOrBell = (b, kind) => {
        if (!b.on || Math.abs(b.gain) < 1e-6)
            return;
        out.push(b.shape === 'shelf' ? designShelf(kind, b.freq, b.gain, b.q, fs) : designPeaking(b.freq, b.gain, b.q, fs));
    };
    shelfOrBell(p.lf, 'low');
    for (const b of [p.lmf, p.mf, p.hmf])
        if (b.on && Math.abs(b.gain) >= 1e-6)
            out.push(designPeaking(b.freq, b.gain, b.q, fs));
    shelfOrBell(p.hf, 'high');
    if (p.lpf.on)
        for (const q of BUTTER_Q[p.lpf.slope] ?? BUTTER_Q[12])
            out.push(designPass('lp', p.lpf.freq, q, fs));
    if (p.deharsh > 0) {
        const t = Math.min(p.deharsh, 100) / 100;
        out.push(designPeaking(3500, -6 * t, 1 + 1.5 * t, fs));
        out.push(designShelf('high', 10000, -4 * t, 0.7071, fs));
    }
    return out;
}
export function eqResponseDb(p, f, fs) {
    let db = p.input + p.output;
    for (const c of eqSections(p, fs))
        db += coefsMagDb(c, f, fs);
    return db;
}
class EqStage {
    constructor(fs) {
        this.fs = fs;
        this.secs = [];
        this.gIn = 1;
        this.gOut = 1;
        this.key = '';
        this.linear = false;
        this.fir = new FirStage(fs);
    }
    set(p) {
        const key = JSON.stringify(p);
        if (key === this.key)
            return;
        this.key = key;
        this.linear = p.mode === 'linear';
        if (this.linear) {
            const secs = eqSections(p, this.fs);
            const g = p.input + p.output;
            this.fir.design(key, f => {
                let db = g;
                for (const c of secs)
                    db += coefsMagDb(c, Math.max(f, 1), this.fs);
                return dbToLin(db);
            });
            return;
        }
        const coefs = eqSections(p, this.fs);
        // 단 개수가 같으면 상태를 유지해 클릭을 줄인다
        if (coefs.length !== this.secs.length)
            this.secs = coefs.map(() => new Biquad());
        coefs.forEach((c, i) => this.secs[i].set(c));
        this.gIn = dbToLin(p.input);
        this.gOut = dbToLin(p.output);
    }
    process(L, R, n) {
        if (this.linear) {
            this.fir.process(L, R, n);
            return;
        }
        const g = this.gIn * this.gOut;
        const s = this.secs;
        for (let i = 0; i < n; i++) {
            let l = L[i], r = R[i];
            for (let k = 0; k < s.length; k++) {
                l = s[k].l(l);
                r = s[k].r(r);
            }
            L[i] = l * g;
            R[i] = r * g;
        }
    }
}
// ───────────────────────── M/S EQ ─────────────────────────
export function msSections(b, fs) {
    const out = [];
    if (Math.abs(b.low.gain) >= 1e-6)
        out.push(designShelf('low', b.low.freq, b.low.gain, 0.7071, fs));
    if (Math.abs(b.b1.gain) >= 1e-6)
        out.push(designPeaking(b.b1.freq, b.b1.gain, b.b1.q, fs));
    if (Math.abs(b.b2.gain) >= 1e-6)
        out.push(designPeaking(b.b2.freq, b.b2.gain, b.b2.q, fs));
    if (Math.abs(b.high.gain) >= 1e-6)
        out.push(designShelf('high', b.high.freq, b.high.gain, 0.7071, fs));
    return out;
}
class MsEqStage {
    constructor(fs) {
        this.fs = fs;
        this.mid = [];
        this.side = [];
        this.key = '';
    }
    set(p) {
        const key = JSON.stringify(p);
        if (key === this.key)
            return;
        this.key = key;
        const m = msSections(p.mid, this.fs), s = msSections(p.side, this.fs);
        if (m.length !== this.mid.length)
            this.mid = m.map(() => new Biquad());
        if (s.length !== this.side.length)
            this.side = s.map(() => new Biquad());
        m.forEach((c, i) => this.mid[i].set(c));
        s.forEach((c, i) => this.side[i].set(c));
    }
    process(L, R, n) {
        const M = this.mid, S = this.side;
        if (!M.length && !S.length)
            return;
        for (let i = 0; i < n; i++) {
            let m = (L[i] + R[i]) * 0.5, s = (L[i] - R[i]) * 0.5;
            for (let k = 0; k < M.length; k++)
                m = M[k].l(m);
            for (let k = 0; k < S.length; k++)
                s = S[k].r(s);
            L[i] = m + s;
            R[i] = m - s;
        }
    }
}
// ───────────────────────── 컴프레서 ─────────────────────────
/** 정적 게인 커브: 입력 레벨 dB → 출력 레벨 dB (소프트 니) */
export function compCurve(x, threshold, ratio, knee) {
    const over = x - threshold;
    if (knee > 0 && 2 * Math.abs(over) <= knee) {
        return x + ((1 / ratio - 1) * (over + knee / 2) ** 2) / (2 * knee);
    }
    if (2 * over > knee)
        return threshold + over / ratio;
    return x;
}
/** 자동 메이크업: 0dBFS 입력에서 줄어드는 양의 절반을 되돌린다 */
export function autoMakeupDb(threshold, ratio, knee) {
    return -0.5 * (compCurve(0, threshold, ratio, knee) - 0);
}
/** 스테레오 링크 피드포워드 컴프 — env(dB, ≤0)를 갱신한다 */
class CompCore {
    constructor(fs) {
        this.fs = fs;
        this.env = 0; // 현재 게인 리덕션 dB (음수)
        this.maxGr = 0;
        this.aA = 0;
        this.aR = 0;
        this.T = -18;
        this.R = 2;
        this.K = 6;
    }
    set(threshold, ratio, attackMs, releaseMs, knee) {
        this.T = threshold;
        this.R = Math.max(1, ratio);
        this.K = Math.max(0, knee);
        this.aA = Math.exp(-1 / (Math.max(attackMs, 0.01) * 0.001 * this.fs));
        this.aR = Math.exp(-1 / (Math.max(releaseMs, 1) * 0.001 * this.fs));
    }
    /** 샘플 하나의 링크된 레벨로 게인 리덕션 dB 를 갱신해 돌려준다 */
    grDb(level) {
        const x = linToDb(level);
        const gr = compCurve(x, this.T, this.R, this.K) - x;
        this.env = gr < this.env ? this.aA * this.env + (1 - this.aA) * gr : this.aR * this.env + (1 - this.aR) * gr;
        if (this.env < this.maxGr)
            this.maxGr = this.env;
        return this.env;
    }
    gain(level) { return dbToLin(this.grDb(level)); }
}
class CompStage {
    constructor(fs) {
        this.makeup = 1;
        this.mix = 1;
        this.core = new CompCore(fs);
    }
    set(p) {
        this.core.set(p.threshold, p.ratio, p.attack, p.release, p.knee);
        this.makeup = dbToLin(p.makeup + (p.autoMakeup ? autoMakeupDb(p.threshold, p.ratio, p.knee) : 0));
        this.mix = Math.min(Math.max(p.mix, 0), 100) / 100;
    }
    process(L, R, n) {
        const m = this.mix, d = 1 - m;
        for (let i = 0; i < n; i++) {
            const l = L[i], r = R[i];
            const g = this.core.gain(Math.max(Math.abs(l), Math.abs(r))) * this.makeup;
            L[i] = l * (d + m * g);
            R[i] = r * (d + m * g);
        }
    }
}
// ───────────────────────── 다이내믹 EQ / 디에서 ─────────────────────────
/** 감지(대역) → 게인 리덕션 → 그 대역을 움직이는 벨/셸프 한 밴드 */
class DynBand {
    constructor(fs) {
        this.fs = fs;
        this.det = new Biquad();
        this.flt = new Biquad();
        this.p = null;
        this.shape = 'bell';
        this.cnt = 0;
        this.lastGain = NaN;
        this.dyn = 0;
        /** 감지 신호(리슨용) — step 뒤에 읽는다 */
        this.dl = 0;
        this.dr = 0;
        this.core = new CompCore(fs);
    }
    set(p, shape = 'bell') {
        this.p = p;
        this.shape = shape;
        this.det.set(shape === 'hshelf' ? designPass('hp', p.freq, 0.7071, this.fs) : designPass('bp', p.freq, Math.max(0.3, p.q), this.fs));
        this.core.set(p.threshold, Math.max(1, p.ratio), p.attack, p.release, 2);
        this.lastGain = NaN;
    }
    step(l, r, out, i, outR) {
        const p = this.p;
        const dl = this.det.l(l), dr = this.det.r(r);
        this.dl = dl;
        this.dr = dr;
        const gr = this.core.grDb(Math.max(Math.abs(dl), Math.abs(dr)));
        const dynDb = p.mode === 'cut' ? Math.max(-p.range, gr) : Math.min(p.range, -gr);
        this.dyn = dynDb;
        if ((this.cnt++ & 15) === 0) {
            const g = p.gain + dynDb;
            if (!(Math.abs(g - this.lastGain) <= 0.02)) {
                this.lastGain = g;
                this.flt.set(this.shape === 'hshelf' ? designShelf('high', p.freq, g, 0.7071, this.fs) : designPeaking(p.freq, g, p.q, this.fs));
            }
        }
        out[i] = this.flt.l(l);
        outR[i] = this.flt.r(r);
    }
}
class DynEqStage {
    constructor(fs) {
        this.fs = fs;
        this.bands = [];
        this.on = [];
    }
    set(p) {
        while (this.bands.length < p.bands.length)
            this.bands.push(new DynBand(this.fs));
        p.bands.forEach((b, i) => { this.bands[i].set(b); this.on[i] = b.on; });
        this.on.length = p.bands.length;
    }
    process(L, R, n) {
        for (let k = 0; k < this.on.length; k++) {
            if (!this.on[k])
                continue;
            const b = this.bands[k];
            for (let i = 0; i < n; i++)
                b.step(L[i], R[i], L, i, R);
        }
    }
}
class DeesserStage {
    constructor(fs) {
        this.listen = false;
        this.band = new DynBand(fs);
    }
    set(p) {
        this.listen = p.listen;
        this.band.set({ on: true, freq: p.freq, q: 1, gain: 0, threshold: p.threshold, ratio: 6, range: p.range, attack: 0.5, release: 60, mode: 'cut' }, 'hshelf');
    }
    process(L, R, n) {
        for (let i = 0; i < n; i++) {
            this.band.step(L[i], R[i], L, i, R);
            if (this.listen) {
                L[i] = this.band.dl;
                R[i] = this.band.dr;
            }
        }
    }
}
// ───────────────────────── 매칭 EQ (리니어 페이즈) ─────────────────────────
/** 1/3 옥타브 중심 주파수 31개 (20Hz~20kHz) */
export const MATCH_FREQS = Array.from({ length: 31 }, (_, i) => 20 * Math.pow(2, i / 3));
export function matchCurveDb(curve, strength, f) {
    if (!curve.length)
        return 0;
    const x = Math.log2(Math.max(f, 1) / 20) * 3;
    let v;
    if (x <= 0)
        v = curve[0];
    else if (x >= curve.length - 1)
        v = curve[curve.length - 1];
    else {
        const i = Math.floor(x), t = x - i;
        v = curve[i] * (1 - t) + curve[i + 1] * t;
    }
    return (v * strength) / 100;
}
export const matchActive = (p) => !p.bypass.match && p.match.strength > 0 && p.match.curve.some(v => Math.abs(v) > 0.01);
class MatchStage {
    constructor(fs) { this.fir = new FirStage(fs); }
    set(p) {
        const key = JSON.stringify(p);
        this.fir.design(key, f => dbToLin(matchCurveDb(p.curve, p.strength, f)));
    }
    process(L, R, n) { this.fir.process(L, R, n); }
}
// ───────────────────────── 3밴드 크로스오버 (LR4) ─────────────────────────
class Crossover3 {
    constructor(fs) {
        this.fs = fs;
        this.lp1a = new Biquad();
        this.lp1b = new Biquad();
        this.hp1a = new Biquad();
        this.hp1b = new Biquad();
        this.lp2a = new Biquad();
        this.lp2b = new Biquad();
        this.hp2a = new Biquad();
        this.hp2b = new Biquad();
        this.ap2 = new Biquad();
        this.key = '';
        // 결과 [저L, 저R, 중L, 중R, 고L, 고R]
        this.o = new Float64Array(6);
    }
    set(lowX, highX) {
        const key = `${lowX}|${highX}`;
        if (key === this.key)
            return;
        this.key = key;
        const fs = this.fs;
        const lo = Math.min(lowX, highX * 0.8), hi = highX;
        const q = Math.SQRT1_2;
        const lp1 = designPass('lp', lo, q, fs), hp1 = designPass('hp', lo, q, fs);
        const lp2 = designPass('lp', hi, q, fs), hp2 = designPass('hp', hi, q, fs);
        this.lp1a.set(lp1);
        this.lp1b.set(lp1);
        this.hp1a.set(hp1);
        this.hp1b.set(hp1);
        this.lp2a.set(lp2);
        this.lp2b.set(lp2);
        this.hp2a.set(hp2);
        this.hp2b.set(hp2);
        this.ap2.set(designPass('ap', hi, q, fs));
    }
    split(l, r) {
        const o = this.o;
        // 저역: LR4 LP(f1) → 위상 맞춤용 올패스(f2) / LR4 는 저·고가 같은 위상이라 합이 평탄
        o[0] = this.ap2.l(this.lp1b.l(this.lp1a.l(l)));
        o[1] = this.ap2.r(this.lp1b.r(this.lp1a.r(r)));
        const restL = this.hp1b.l(this.hp1a.l(l));
        const restR = this.hp1b.r(this.hp1a.r(r));
        o[2] = this.lp2b.l(this.lp2a.l(restL));
        o[3] = this.lp2b.r(this.lp2a.r(restR));
        o[4] = this.hp2b.l(this.hp2a.l(restL));
        o[5] = this.hp2b.r(this.hp2a.r(restR));
        return o;
    }
}
class MultibandStage {
    constructor(fs) {
        this.gains = [1, 1, 1];
        this.active = [1, 1, 1];
        this.x = new Crossover3(fs);
        this.cores = [new CompCore(fs), new CompCore(fs), new CompCore(fs)];
    }
    set(p) {
        this.x.set(p.lowX, p.highX);
        const anySolo = p.bands.some(b => b.solo);
        p.bands.slice(0, 3).forEach((b, i) => {
            this.cores[i].set(b.threshold, b.ratio, b.attack, b.release, 3);
            this.gains[i] = b.on ? dbToLin(b.gain) : 1;
            this.active[i] = b.on ? 1 : 0;
            if (anySolo && !b.solo)
                this.gains[i] = 0;
        });
    }
    process(L, R, n) {
        const [c0, c1, c2] = this.cores;
        const [g0, g1, g2] = this.gains;
        const [a0, a1, a2] = this.active;
        for (let i = 0; i < n; i++) {
            const o = this.x.split(L[i], R[i]);
            let lL = o[0], lR = o[1], mL = o[2], mR = o[3], hL = o[4], hR = o[5];
            if (a0) {
                const g = c0.gain(Math.max(Math.abs(lL), Math.abs(lR)));
                lL *= g;
                lR *= g;
            }
            if (a1) {
                const g = c1.gain(Math.max(Math.abs(mL), Math.abs(mR)));
                mL *= g;
                mR *= g;
            }
            if (a2) {
                const g = c2.gain(Math.max(Math.abs(hL), Math.abs(hR)));
                hL *= g;
                hR *= g;
            }
            L[i] = lL * g0 + mL * g1 + hL * g2;
            R[i] = lR * g0 + mR * g1 + hR * g2;
        }
    }
}
/** 멀티밴드 이미저 — 대역마다 스테레오 폭 */
class ImagerStage {
    constructor(fs) {
        this.w = [1, 1, 1];
        this.x = new Crossover3(fs);
    }
    set(p) {
        this.x.set(p.lowX, p.highX);
        this.w = [0, 1, 2].map(i => Math.max(0, p.widths[i] ?? 100) / 100);
    }
    process(L, R, n) {
        const w = this.w;
        for (let i = 0; i < n; i++) {
            const o = this.x.split(L[i], R[i]);
            let l = 0, r = 0;
            for (let b = 0; b < 3; b++) {
                const m = (o[b * 2] + o[b * 2 + 1]) * 0.5, s = (o[b * 2] - o[b * 2 + 1]) * 0.5 * w[b];
                l += m + s;
                r += m - s;
            }
            L[i] = l;
            R[i] = r;
        }
    }
}
// ───────────────────────── 스테레오 폭 / M-S / 저역 모노 크로스오버 ─────────────────────────
class StereoStage {
    constructor(fs) {
        this.fs = fs;
        this.hpA = new Biquad();
        this.hpB = new Biquad();
        this.bassMono = 0;
        this.mid = 1;
        this.side = 1;
    }
    set(p) {
        this.mid = dbToLin(p.mid);
        this.side = dbToLin(p.side) * Math.max(0, p.width) / 100;
        if (p.bassMono !== this.bassMono) {
            this.bassMono = p.bassMono;
            if (p.bassMono > 0) {
                // 사이드에 LR4 하이패스 — 크로스오버 아래는 완전 모노, 미드는 손대지 않는다
                const c = designPass('hp', p.bassMono, Math.SQRT1_2, this.fs);
                this.hpA.set(c);
                this.hpB.set(c);
            }
        }
    }
    process(L, R, n) {
        const bm = this.bassMono > 0;
        for (let i = 0; i < n; i++) {
            const m = (L[i] + R[i]) * 0.5 * this.mid;
            let s = (L[i] - R[i]) * 0.5 * this.side;
            if (bm)
                s = this.hpB.l(this.hpA.l(s));
            L[i] = m + s;
            R[i] = m - s;
        }
    }
}
// ───────────────────────── 트랜지언트 셰이퍼 ─────────────────────────
class TransientStage {
    constructor(fs) {
        this.fA = 0;
        this.sA = 0;
        this.fR = 0;
        this.sR = 0;
        this.atk = 0;
        this.sus = 0;
        this.out = 1;
        this.gainDb = 0;
        const k = (ms) => Math.exp(-1 / (ms * 0.001 * fs));
        this.c = { fa: k(0.5), sa: k(25), r1: k(40), r2: k(250), rel: k(80) };
    }
    set(p) { this.atk = p.attack / 100; this.sus = p.sustain / 100; this.out = dbToLin(p.output); }
    process(L, R, n) {
        const c = this.c;
        for (let i = 0; i < n; i++) {
            const x = Math.max(Math.abs(L[i]), Math.abs(R[i])) + 1e-9;
            // 어택: 빠른 엔벨로프가 느린 엔벨로프보다 앞설 때
            this.fA = x > this.fA ? c.fa * this.fA + (1 - c.fa) * x : c.rel * this.fA + (1 - c.rel) * x;
            this.sA = x > this.sA ? c.sa * this.sA + (1 - c.sa) * x : c.rel * this.sA + (1 - c.rel) * x;
            // 서스테인: 느리게 떨어지는 엔벨로프가 빨리 떨어지는 것보다 클 때(꼬리)
            this.fR = x > this.fR ? c.fa * this.fR + (1 - c.fa) * x : c.r1 * this.fR + (1 - c.r1) * x;
            this.sR = x > this.sR ? c.fa * this.sR + (1 - c.fa) * x : c.r2 * this.sR + (1 - c.r2) * x;
            const aDiff = Math.max(0, linToDb(this.fA) - linToDb(this.sA));
            const sDiff = Math.max(0, linToDb(this.sR) - linToDb(this.fR));
            let g = this.atk * aDiff * 1.5 + this.sus * sDiff * 0.8;
            g = Math.max(-15, Math.min(12, g));
            this.gainDb = g;
            const lin = dbToLin(g) * this.out;
            L[i] *= lin;
            R[i] *= lin;
        }
    }
}
// ───────────────────────── 게이트 / 익스팬더 ─────────────────────────
class GateStage {
    constructor(fs) {
        this.fs = fs;
        this.env = 0;
        this.holdCnt = 0;
        this.gDb = 0;
        this.aA = 0;
        this.aR = 0;
        this.hold = 0;
        this.eA = 0;
        this.T = -60;
        this.ratio = 2;
        this.range = 40;
        this.gr = 0;
        this.eA = Math.exp(-1 / (0.005 * fs));
    }
    set(p) {
        this.T = p.threshold;
        this.ratio = Math.max(1, p.ratio);
        this.range = Math.max(0, p.range);
        this.aA = Math.exp(-1 / (Math.max(0.05, p.attack) * 0.001 * this.fs));
        this.aR = Math.exp(-1 / (Math.max(1, p.release) * 0.001 * this.fs));
        this.hold = Math.round(p.hold * 0.001 * this.fs);
    }
    process(L, R, n) {
        for (let i = 0; i < n; i++) {
            const x = Math.max(Math.abs(L[i]), Math.abs(R[i]));
            this.env = x > this.env ? x : this.eA * this.env + (1 - this.eA) * x;
            const lv = linToDb(this.env);
            let target = 0;
            if (lv < this.T)
                target = Math.max(-this.range, (lv - this.T) * (this.ratio - 1));
            if (target >= this.gDb) {
                this.gDb = this.aA * this.gDb + (1 - this.aA) * target;
                this.holdCnt = this.hold;
            }
            else if (this.holdCnt > 0)
                this.holdCnt--;
            else
                this.gDb = this.aR * this.gDb + (1 - this.aR) * target;
            this.gr = this.gDb;
            const g = dbToLin(this.gDb);
            L[i] *= g;
            R[i] *= g;
        }
    }
}
// ───────────────────────── 새추레이션 ─────────────────────────
export function saturate(x, mode) {
    switch (mode) {
        case 'tube': return Math.tanh(x + 0.15 * x * x);
        // 3극관: 양의 반파는 일찍, 음의 반파는 늦게 눌린다 → 짝수 배음
        case 'triode': return Math.tanh(x >= 0 ? x * 1.15 : x * 0.85);
        case 'clip':
            if (x > 1)
                return 2 / 3;
            if (x < -1)
                return -2 / 3;
            return x - (x * x * x) / 3;
        default: return Math.tanh(x);
    }
}
class SaturationStage {
    constructor(fs) {
        this.drive = 1;
        this.mix = 1;
        this.out = 1;
        this.mode = 'tape';
        this.dcL = 0;
        this.dcR = 0;
        this.dcxL = 0;
        this.dcxR = 0;
        this.pre = new Biquad();
        this.post = new Biquad();
        this.lowLP = new Biquad();
        this.lowLP2 = new Biquad();
        this.dcA = Math.exp((-2 * Math.PI * 10) / fs);
        // 테이프 엠퍼시스: 녹음 때 고역을 올렸다가 재생 때 내린다 → 고역은 덜 찌그러지고 따뜻해진다
        this.pre.set(designShelf('high', 3000, 6, 0.7071, fs));
        this.post.set(designShelf('high', 3000, -6, 0.7071, fs));
        const lp = designPass('lp', 180, Math.SQRT1_2, fs);
        this.lowLP.set(lp);
        this.lowLP2.set(lp);
    }
    set(p) {
        this.drive = dbToLin(p.drive);
        this.mode = p.mode;
        this.mix = Math.min(Math.max(p.mix, 0), 100) / 100;
        this.out = dbToLin(p.output);
    }
    process(L, R, n) {
        const g = this.drive, m = this.mix, o = this.out, a = this.dcA;
        const norm = 1 / g;
        const mode = this.mode;
        for (let i = 0; i < n; i++) {
            const l = L[i], r = R[i];
            let sl, sr;
            if (mode === 'tapeWarm') {
                sl = this.post.l(Math.tanh(this.pre.l(l) * g) * norm);
                sr = this.post.r(Math.tanh(this.pre.r(r) * g) * norm);
            }
            else if (mode === 'transformer') {
                // 저역만 포화 — 트랜스포머 코어처럼 베이스가 두꺼워진다
                const lowL = this.lowLP2.l(this.lowLP.l(l)), lowR = this.lowLP2.r(this.lowLP.r(r));
                sl = l - lowL + Math.tanh(lowL * g) * norm;
                sr = r - lowR + Math.tanh(lowR * g) * norm;
            }
            else {
                sl = saturate(l * g, mode) * norm;
                sr = saturate(r * g, mode) * norm;
            }
            if (mode === 'tube' || mode === 'triode') {
                // 비대칭 왜곡이 만드는 DC 제거 (1차 하이패스 10Hz)
                const yl = sl - this.dcxL + a * this.dcL;
                this.dcxL = sl;
                this.dcL = yl;
                sl = yl;
                const yr = sr - this.dcxR + a * this.dcR;
                this.dcxR = sr;
                this.dcR = yr;
                sr = yr;
            }
            L[i] = (l * (1 - m) + sl * m) * o;
            R[i] = (r * (1 - m) + sr * m) * o;
        }
    }
}
// ───────────────────────── 소프트 클리퍼 ─────────────────────────
export function softClip(x, t, k) {
    const a = Math.abs(x);
    const knee = t * Math.max(0.001, k);
    const lin = t - knee;
    if (a <= lin)
        return x;
    const y = lin + knee * Math.tanh((a - lin) / knee);
    return Math.sign(x) * Math.min(t, y);
}
class ClipperStage {
    constructor() {
        this.t = 1;
        this.k = 0.3;
        this.out = 1;
        this.clipped = 0;
    }
    set(p) { this.t = dbToLin(Math.min(0, p.threshold)); this.k = Math.min(1, Math.max(0, p.softness / 100)); this.out = dbToLin(p.output); }
    process(L, R, n) {
        const t = this.t, k = this.k, o = this.out;
        let c = 0;
        for (let i = 0; i < n; i++) {
            const l = softClip(L[i], t, k), r = softClip(R[i], t, k);
            if (l !== L[i] || r !== R[i])
                c++;
            L[i] = l * o;
            R[i] = r * o;
        }
        this.clipped = c;
    }
}
// ───────────────────────── 트루 피크 보간 (4배) ─────────────────────────
const TP_HALF = 6; // 위상당 12탭
/** 4배 오버샘플 보간 필터 (윈도 sinc), 위상 1·2·3 */
export const TP_PHASES = (() => {
    const phases = [];
    for (let p = 1; p < 4; p++) {
        const frac = p / 4;
        const taps = new Float64Array(TP_HALF * 2);
        let sum = 0;
        for (let k = 0; k < TP_HALF * 2; k++) {
            const t = k - (TP_HALF - 1) - frac;
            const x = Math.PI * t;
            const sinc = Math.abs(t) < 1e-9 ? 1 : Math.sin(x) / x;
            const win = 0.5 + 0.5 * Math.cos((Math.PI * t) / (TP_HALF + 0.5));
            taps[k] = sinc * win;
            sum += taps[k];
        }
        for (let k = 0; k < taps.length; k++)
            taps[k] /= sum;
        phases.push(taps);
    }
    return phases;
})();
/** 한 채널의 최근 2*TP_HALF 샘플 링버퍼로 샘플 사이 피크를 추정 */
class TpHistory {
    constructor() {
        this.buf = new Float64Array(TP_HALF * 2);
        this.pos = 0;
    }
    push(x) { this.buf[this.pos] = x; this.pos = (this.pos + 1) % this.buf.length; }
    peak() {
        const N = this.buf.length;
        let m = Math.abs(this.buf[(this.pos + TP_HALF - 1) % N]);
        for (const taps of TP_PHASES) {
            let acc = 0;
            for (let k = 0; k < N; k++)
                acc += taps[k] * this.buf[(this.pos + k) % N];
            const a = Math.abs(acc);
            if (a > m)
                m = a;
        }
        return m;
    }
}
// ───────────────────────── 브릭월 리미터 ─────────────────────────
class LimiterStage {
    constructor(fs) {
        this.dPos = 0;
        this.tpL = new TpHistory();
        this.tpR = new TpHistory();
        this.qh = 0;
        this.qt = 0;
        this.boxPos = 0;
        this.t = 0;
        this.g = 1;
        this.relA = 0;
        this.inGain = 1;
        this.ceil = 0.89;
        this.tp = true;
        this.gr = 0;
        this.maxGr = 0;
        this.look = Math.max(8, Math.round(fs * 0.0015));
        this.latency = this.look - 1 + TP_HALF;
        this.dL = new Float32Array(this.latency + 1);
        this.dR = new Float32Array(this.latency + 1);
        this.qv = new Float64Array(this.look + 1);
        this.qi = new Int32Array(this.look + 1);
        this.box = new Float64Array(this.look).fill(1);
        this.boxSum = this.look;
        this.fs = fs;
    }
    set(p) {
        this.inGain = dbToLin(p.gain);
        this.ceil = dbToLin(Math.min(p.ceiling, 0));
        this.tp = p.truePeak;
        this.relA = Math.exp(-1 / (Math.max(p.release, 1) * 0.001 * this.fs));
    }
    setGain(db) { this.inGain = dbToLin(db); }
    pushMin(v) {
        const cap = this.qv.length;
        while (this.qt !== this.qh) {
            const last = (this.qt - 1 + cap) % cap;
            if (this.qv[last] >= v)
                this.qt = last;
            else
                break;
        }
        this.qv[this.qt] = v;
        this.qi[this.qt] = this.t;
        this.qt = (this.qt + 1) % cap;
        while (this.qi[this.qh] <= this.t - this.look)
            this.qh = (this.qh + 1) % cap;
        return this.qv[this.qh];
    }
    process(L, R, n) {
        const ceil = this.ceil, N = this.dL.length;
        let minG = 1;
        for (let i = 0; i < n; i++) {
            const l = L[i] * this.inGain, r = R[i] * this.inGain;
            this.tpL.push(l);
            this.tpR.push(r);
            let pk;
            if (this.tp)
                pk = Math.max(this.tpL.peak(), this.tpR.peak());
            else {
                const b = this.tpL.buf, c = this.tpR.buf, k = (this.tpL.pos + TP_HALF - 1) % b.length;
                pk = Math.max(Math.abs(b[k]), Math.abs(c[k]));
            }
            const req = pk > ceil ? ceil / pk : 1;
            const held = this.pushMin(req);
            this.t++;
            this.boxSum += held - this.box[this.boxPos];
            this.box[this.boxPos] = held;
            this.boxPos = (this.boxPos + 1) % this.look;
            const smooth = this.boxSum / this.look;
            const rel = this.g + (1 - this.g) * (1 - this.relA);
            this.g = Math.min(smooth, rel);
            if (this.g < minG)
                minG = this.g;
            this.dL[this.dPos] = l;
            this.dR[this.dPos] = r;
            const rd = (this.dPos + 1) % N;
            this.dPos = rd;
            let ol = this.dL[rd] * this.g, or = this.dR[rd] * this.g;
            // 안전 클립 — 샘플 피크는 절대 ceiling 을 넘지 않는다
            if (ol > ceil)
                ol = ceil;
            else if (ol < -ceil)
                ol = -ceil;
            if (or > ceil)
                or = ceil;
            else if (or < -ceil)
                or = -ceil;
            L[i] = ol;
            R[i] = or;
        }
        this.gr = linToDb(minG);
        if (this.gr < this.maxGr)
            this.maxGr = this.gr;
    }
}
/** 지연선 — 읽는 지연을 바꿀 수 있다(원본 A/B, 꺼진 리미터 지연 맞춤) */
class DelayLine {
    constructor(maxLen, delay = maxLen) {
        this.p = 0;
        this.bl = new Float32Array(maxLen + 1);
        this.br = new Float32Array(maxLen + 1);
        this.delay = delay;
    }
    process(L, R, n) {
        const N = this.bl.length;
        const d = Math.min(this.delay, N - 1);
        for (let i = 0; i < n; i++) {
            this.bl[this.p] = L[i];
            this.br[this.p] = R[i];
            const rd = (this.p - d + N) % N;
            L[i] = this.bl[rd];
            R[i] = this.br[rd];
            this.p = (this.p + 1) % N;
        }
    }
}
// ───────────────────────── 라우드니스 (ITU-R BS.1770-4 / EBU R128) ─────────────────────────
export function kWeightingCoefs(fs) {
    let f0 = 1681.974450955533;
    const G = 3.999843853973347;
    let Q = 0.7071752369554196;
    let K = Math.tan((Math.PI * f0) / fs);
    const Vh = Math.pow(10, G / 20);
    const Vb = Math.pow(Vh, 0.4996667741545416);
    let a0 = 1 + K / Q + K * K;
    const pre = [
        (Vh + (Vb * K) / Q + K * K) / a0,
        (2 * (K * K - Vh)) / a0,
        (Vh - (Vb * K) / Q + K * K) / a0,
        (2 * (K * K - 1)) / a0,
        (1 - K / Q + K * K) / a0,
    ];
    f0 = 38.13547087602444;
    Q = 0.5003270373238773;
    K = Math.tan((Math.PI * f0) / fs);
    a0 = 1 + K / Q + K * K;
    const rlb = [1, -2, 1, (2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0];
    return [pre, rlb];
}
export class LoudnessMeter {
    constructor(fs) {
        this.pre = new Biquad();
        this.rlb = new Biquad();
        this.subCount = 0;
        this.subSum = 0;
        this.ring = new Float64Array(30);
        this.ringN = 0;
        this.ringPos = 0;
        /** 400ms 블록 에너지 (적분 라우드니스 게이팅용) */
        this.blocks = [];
        /** 100ms 마다의 단기(3s) 라우드니스 — LRA·그래프용 (3s 가 차기 전은 넣지 않는다) */
        this.shortSeries = [];
        /** 100ms 마다의 모멘터리 */
        this.momentarySeries = [];
        this.momentary = -Infinity;
        this.shortTerm = -Infinity;
        this.maxMomentary = -Infinity;
        this.maxShortTerm = -Infinity;
        const [a, b] = kWeightingCoefs(fs);
        this.pre.set(a);
        this.rlb.set(b);
        this.sub = Math.round(fs / 10);
    }
    reset() {
        this.pre.reset();
        this.rlb.reset();
        this.subCount = 0;
        this.subSum = 0;
        this.ring.fill(0);
        this.ringN = 0;
        this.ringPos = 0;
        this.blocks = [];
        this.shortSeries = [];
        this.momentarySeries = [];
        this.momentary = this.shortTerm = this.maxMomentary = this.maxShortTerm = -Infinity;
    }
    process(L, R, n) {
        for (let i = 0; i < n; i++) {
            const l = this.rlb.l(this.pre.l(L[i]));
            let e = l * l;
            if (R) {
                const r = this.rlb.r(this.pre.r(R[i]));
                e += r * r;
            }
            this.subSum += e;
            if (++this.subCount === this.sub)
                this.closeSub();
        }
    }
    closeSub() {
        this.ring[this.ringPos] = this.subSum / this.sub;
        this.ringPos = (this.ringPos + 1) % 30;
        if (this.ringN < 30)
            this.ringN++;
        this.subSum = 0;
        this.subCount = 0;
        if (this.ringN >= 4) {
            let s = 0;
            for (let k = 1; k <= 4; k++)
                s += this.ring[(this.ringPos - k + 30) % 30];
            const e = s / 4;
            this.blocks.push(e);
            this.momentary = energyToLufs(e);
            this.momentarySeries.push(this.momentary);
            if (this.momentary > this.maxMomentary)
                this.maxMomentary = this.momentary;
        }
        if (this.ringN >= 30) {
            let s = 0;
            for (let k = 0; k < 30; k++)
                s += this.ring[k];
            this.shortTerm = energyToLufs(s / 30);
            this.shortSeries.push(this.shortTerm);
            if (this.shortTerm > this.maxShortTerm)
                this.maxShortTerm = this.shortTerm;
        }
        else if (this.ringN >= 4) {
            let s = 0;
            for (let k = 1; k <= this.ringN; k++)
                s += this.ring[(this.ringPos - k + 30) % 30];
            this.shortTerm = energyToLufs(s / this.ringN);
        }
    }
    integrated() { return gatedIntegrated(this.blocks); }
    lra() { return loudnessRange(this.shortSeries); }
}
export const energyToLufs = (e) => (e > 0 ? -0.691 + 10 * Math.log10(e) : -Infinity);
export function gatedIntegrated(blocks) {
    const absGate = Math.pow(10, (-70 + 0.691) / 10);
    let sum = 0, cnt = 0;
    for (let i = 0; i < blocks.length; i++)
        if (blocks[i] > absGate) {
            sum += blocks[i];
            cnt++;
        }
    if (!cnt)
        return -Infinity;
    const relGate = (sum / cnt) * Math.pow(10, -10 / 10);
    sum = 0;
    cnt = 0;
    for (let i = 0; i < blocks.length; i++)
        if (blocks[i] > absGate && blocks[i] > relGate) {
            sum += blocks[i];
            cnt++;
        }
    return cnt ? energyToLufs(sum / cnt) : -Infinity;
}
/** EBU Tech 3342 라우드니스 레인지: 단기 값 → -70 절대·-20 상대 게이트 → 10~95 백분위 차 */
export function loudnessRange(shortTerm) {
    const v = [];
    for (let i = 0; i < shortTerm.length; i++)
        if (shortTerm[i] > -70)
            v.push(shortTerm[i]);
    if (v.length < 2)
        return 0;
    let e = 0;
    for (const x of v)
        e += Math.pow(10, (x + 0.691) / 10);
    const rel = energyToLufs(e / v.length) - 20;
    const g = v.filter(x => x > rel).sort((a, b) => a - b);
    if (g.length < 2)
        return 0;
    const pct = (p) => g[Math.min(g.length - 1, Math.max(0, Math.round((p / 100) * (g.length - 1))))];
    return pct(95) - pct(10);
}
/** 버퍼 전체의 통합 라우드니스 (테스트·분석용) */
export function measureIntegratedLufs(channels, fs) {
    const m = new LoudnessMeter(fs);
    m.process(channels[0], channels[1] ?? null, channels[0].length);
    return m.integrated();
}
export class TruePeakMeter {
    constructor() {
        this.h = [new TpHistory(), new TpHistory()];
        this.max = 0;
        this.recent = 0;
    }
    process(L, R, n) {
        let m = 0;
        for (let i = 0; i < n; i++) {
            this.h[0].push(L[i]);
            this.h[1].push(R[i]);
            const p = Math.max(this.h[0].peak(), this.h[1].peak());
            if (p > m)
                m = p;
        }
        this.recent = Math.max(this.recent, m);
        if (m > this.max)
            this.max = m;
    }
    reset() { this.max = 0; this.recent = 0; }
}
class LevelMeter {
    constructor(fs) {
        this.peakL = 0;
        this.peakR = 0;
        this.msL = 0;
        this.msR = 0;
        this.a = Math.exp(-1 / (0.3 * fs));
    }
    process(L, R, n) {
        const a = this.a;
        for (let i = 0; i < n; i++) {
            const l = L[i], r = R[i];
            const al = Math.abs(l), ar = Math.abs(r);
            if (al > this.peakL)
                this.peakL = al;
            if (ar > this.peakR)
                this.peakR = ar;
            this.msL = a * this.msL + (1 - a) * l * l;
            this.msR = a * this.msR + (1 - a) * r * r;
        }
    }
    take() {
        const s = { peakL: this.peakL, peakR: this.peakR, rmsL: Math.sqrt(this.msL), rmsR: Math.sqrt(this.msR) };
        this.peakL = this.peakR = 0;
        return s;
    }
}
const SUB = 128; // 오토메이션 제어 주기(샘플)
const MAX_LAT_EXTRA = 2 * FIR_LATENCY;
export class MasterChain {
    constructor(fs, maxBlock = 4096) {
        this.p = null;
        this.edit = defaultEdit();
        this.inTrim = 1;
        this.origTrim = 1;
        /** 입력 기준 샘플 위치 */
        this.pos = 0;
        this.eqAutoKey = '';
        // 미터
        this.meterOn = true;
        this.tp = new TruePeakMeter();
        this.tp3 = { v: 0, t: 0 };
        this.cLR = 0;
        this.cLL = 0;
        this.cRR = 0;
        this.fs = fs;
        this.gate = new GateStage(fs);
        this.eq = new EqStage(fs);
        this.mseq = new MsEqStage(fs);
        this.dyneq = new DynEqStage(fs);
        this.deess = new DeesserStage(fs);
        this.match = new MatchStage(fs);
        this.comp = new CompStage(fs);
        this.mb = new MultibandStage(fs);
        this.trans = new TransientStage(fs);
        this.imager = new ImagerStage(fs);
        this.st = new StereoStage(fs);
        this.sat = new SaturationStage(fs);
        this.clip = new ClipperStage();
        this.lim = new LimiterStage(fs);
        this.latency = this.lim.latency;
        this.dryDelay = new DelayLine(this.lim.latency + MAX_LAT_EXTRA, this.lim.latency);
        this.limBypassDelay = new DelayLine(this.lim.latency);
        this.wL = new Float32Array(maxBlock);
        this.wR = new Float32Array(maxBlock);
        this.dL = new Float32Array(maxBlock);
        this.dR = new Float32Array(maxBlock);
        this.inLv = new LevelMeter(fs);
        this.outLv = new LevelMeter(fs);
        this.loud = new LoudnessMeter(fs);
        this.inLoud = new LoudnessMeter(fs);
        this.cA = Math.exp(-1 / (0.3 * fs));
    }
    setParams(p) {
        this.p = p;
        this.inTrim = dbToLin(p.inputTrim);
        this.origTrim = dbToLin(p.originalTrim);
        this.gate.set(p.gate);
        this.eq.set(p.eq);
        this.eqAutoKey = '';
        this.mseq.set(p.mseq);
        this.dyneq.set(p.dyneq);
        this.deess.set(p.deesser);
        if (matchActive(p))
            this.match.set(p.match);
        this.comp.set(p.comp);
        this.mb.set(p.multiband);
        this.trans.set(p.transient);
        this.imager.set(p.imager);
        this.st.set(p.stereo);
        this.sat.set(p.saturation);
        this.clip.set(p.clipper);
        this.lim.set({ ...p.limiter, gain: p.limiter.gain });
        this.latency = this.lim.latency + (p.eq.mode === 'linear' && !p.bypass.eq ? FIR_LATENCY : 0) + (matchActive(p) ? FIR_LATENCY : 0);
        this.dryDelay.delay = this.latency;
    }
    setEdit(e) { this.edit = e; this.eqAutoKey = ''; }
    setPosition(sec) { this.pos = Math.max(0, Math.round(sec * this.fs)); }
    resetMeters() {
        this.loud.reset();
        this.inLoud.reset();
        this.tp.reset();
        this.lim.maxGr = 0;
        this.comp.core.maxGr = 0;
    }
    /** 지금 위치의 오토메이션을 EQ·리미터에 반영 */
    applyAutomation(tSec) {
        const p = this.p, a = this.edit.automation;
        const bands = ['lf', 'lmf', 'mf', 'hmf', 'hf'];
        let hasEq = false;
        for (const b of bands)
            if (a[`eq.${b}`]?.length) {
                hasEq = true;
                break;
            }
        if (hasEq && p.eq.mode !== 'linear') {
            const eq = { ...p.eq };
            for (const b of bands) {
                const pts = a[`eq.${b}`];
                if (pts?.length)
                    eq[b] = { ...eq[b], on: true, gain: Math.round(evalAuto(pts, tSec, eq[b].gain) * 20) / 20 };
            }
            const key = bands.map(b => eq[b].gain).join('|');
            if (key !== this.eqAutoKey) {
                this.eqAutoKey = key;
                this.eq.set(eq);
            }
        }
        const lg = a['limiter.gain'];
        if (lg?.length)
            this.lim.setGain(evalAuto(lg, tSec, p.limiter.gain));
    }
    /**
     * 입력(L,R)을 처리해 out 에 쓴다. 입력과 출력 배열은 같아도 된다.
     * 블록 길이는 생성자의 maxBlock 이하.
     */
    process(inL, inR, outL, outR, n) {
        const p = this.p;
        if (!p) {
            outL.set(inL.subarray(0, n));
            outR.set(inR.subarray(0, n));
            return;
        }
        const e = this.edit;
        const auto = e.automation;
        const hasParamAuto = !!(auto['limiter.gain']?.length || auto['eq.lf']?.length || auto['eq.lmf']?.length || auto['eq.mf']?.length || auto['eq.hmf']?.length || auto['eq.hf']?.length);
        if (hasParamAuto && n > SUB) {
            for (let off = 0; off < n; off += SUB) {
                const m = Math.min(SUB, n - off);
                this.process(inL.subarray(off, off + m), inR.subarray(off, off + m), outL.subarray(off, off + m), outR.subarray(off, off + m), m);
            }
            return;
        }
        const fs = this.fs;
        const t0 = this.pos / fs;
        if (hasParamAuto)
            this.applyAutomation(t0);
        const wL = this.wL, wR = this.wR, dL = this.dL, dR = this.dR;
        const baseGain = this.inTrim * dbToLin(e.gainOffset);
        const vol = auto.volume;
        for (let i = 0; i < n; i++) {
            const g = vol?.length ? baseGain * dbToLin(evalAuto(vol, t0 + i / fs, 0)) : baseGain;
            wL[i] = inL[i] * g;
            wR[i] = inR[i] * g;
            dL[i] = inL[i];
            dR[i] = inR[i];
        }
        if (this.meterOn) {
            this.inLv.process(inL, inR, n);
            this.inLoud.process(inL, inR, n);
        }
        let limiterRan = false;
        for (const id of p.order) {
            if (p.bypass[id])
                continue;
            switch (id) {
                case 'gate':
                    this.gate.process(wL, wR, n);
                    break;
                case 'eq':
                    this.eq.process(wL, wR, n);
                    break;
                case 'mseq':
                    this.mseq.process(wL, wR, n);
                    break;
                case 'dyneq':
                    this.dyneq.process(wL, wR, n);
                    break;
                case 'deesser':
                    this.deess.process(wL, wR, n);
                    break;
                case 'match':
                    if (matchActive(p))
                        this.match.process(wL, wR, n);
                    break;
                case 'comp':
                    this.comp.process(wL, wR, n);
                    break;
                case 'multiband':
                    this.mb.process(wL, wR, n);
                    break;
                case 'transient':
                    this.trans.process(wL, wR, n);
                    break;
                case 'imager':
                    this.imager.process(wL, wR, n);
                    break;
                case 'stereo':
                    this.st.process(wL, wR, n);
                    break;
                case 'saturation':
                    this.sat.process(wL, wR, n);
                    break;
                case 'clipper':
                    this.clip.process(wL, wR, n);
                    break;
                case 'limiter':
                    this.lim.process(wL, wR, n);
                    limiterRan = true;
                    break;
            }
        }
        // 리미터를 끈 경우에도 지연을 같게 유지해 켜고 끌 때 박자가 밀리지 않게 한다
        if (!limiterRan) {
            this.limBypassDelay.process(wL, wR, n);
            this.lim.gr = 0;
        }
        // 원본(지연 맞춤)
        this.dryDelay.process(dL, dR, n);
        // 시간축 편집: 출력 위치 = 입력 위치 - 지연
        const lat = this.latency;
        const startS = e.start, endS = e.end > 0 ? e.end : Infinity;
        const fi = e.fadeIn.dur, fo = e.fadeOut.dur;
        const region = e.region;
        const hasTimeEdit = startS > 0 || endS < Infinity || fi > 0 || fo > 0 || !!region;
        if (hasTimeEdit) {
            const ramp = 0.02;
            for (let i = 0; i < n; i++) {
                const t = (this.pos + i - lat) / fs;
                let g = 1;
                if (t < startS || t > endS)
                    g = 0;
                else {
                    if (fi > 0 && t < startS + fi)
                        g *= fadeShape((t - startS) / fi, e.fadeIn.curve);
                    if (fo > 0 && endS < Infinity && t > endS - fo)
                        g *= fadeShape((endS - t) / fo, e.fadeOut.curve);
                }
                let l = wL[i], r = wR[i];
                if (region) {
                    // 구간 안은 처리본, 밖은 원본 — 20ms 로 이어 붙인다
                    const inside = Math.min(1, Math.max(0, Math.min(t - region.start, region.end - t) / ramp + 0.5));
                    l = l * inside + dL[i] * (1 - inside);
                    r = r * inside + dR[i] * (1 - inside);
                }
                wL[i] = l * g;
                wR[i] = r * g;
                dL[i] *= g;
                dR[i] *= g;
            }
        }
        if (this.meterOn) {
            this.loud.process(wL, wR, n);
            this.tp.process(wL, wR, n);
            const a = this.cA;
            for (let i = 0; i < n; i++) {
                const l = wL[i], r = wR[i];
                this.cLR = a * this.cLR + (1 - a) * l * r;
                this.cLL = a * this.cLL + (1 - a) * l * l;
                this.cRR = a * this.cRR + (1 - a) * r * r;
            }
        }
        if (p.listenOriginal) {
            const g = this.origTrim;
            for (let i = 0; i < n; i++) {
                outL[i] = dL[i] * g;
                outR[i] = dR[i] * g;
            }
        }
        else {
            for (let i = 0; i < n; i++) {
                outL[i] = wL[i];
                outR[i] = wR[i];
            }
        }
        if (this.meterOn)
            this.outLv.process(outL, outR, n);
        this.pos += n;
    }
    snapshot() {
        const denom = Math.sqrt(this.cLL * this.cRR);
        const tpRecent = this.tp.recent;
        this.tp.recent = 0;
        // 최근 3초 트루 피크 (PSR 용)
        const now = this.pos / this.fs;
        if (tpRecent >= this.tp3.v || now - this.tp3.t > 3)
            this.tp3 = { v: tpRecent, t: now };
        const integ = this.loud.integrated();
        const p = this.p;
        return {
            inLevel: this.inLv.take(),
            outLevel: this.outLv.take(),
            momentary: this.loud.momentary,
            shortTerm: this.loud.shortTerm,
            integrated: integ,
            inIntegrated: this.inLoud.integrated(),
            lra: this.loud.lra(),
            psr: linToDb(this.tp3.v) - this.loud.shortTerm,
            plr: linToDb(this.tp.max) - integ,
            truePeak: linToDb(tpRecent),
            truePeakMax: linToDb(this.tp.max),
            correlation: denom > 1e-10 ? this.cLR / denom : 1,
            compGr: p?.bypass.comp ? 0 : this.comp.core.env,
            mbGr: p?.bypass.multiband ? [0, 0, 0] : [this.mb.cores[0].env, this.mb.cores[1].env, this.mb.cores[2].env],
            limGr: this.lim.gr,
            limGrMax: this.lim.maxGr,
            dyneqGr: p?.bypass.dyneq ? [] : this.dyneq.bands.map(b => b.dyn),
            deessGr: p?.bypass.deesser ? 0 : this.deess.band.dyn,
            gateGr: p?.bypass.gate ? 0 : this.gate.gr,
            transientDb: p?.bypass.transient ? 0 : this.trans.gainDb,
            latency: this.latency,
            position: this.pos / this.fs,
        };
    }
}

class MasterChainProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.chain = new MasterChain(sampleRate, 128)
    this.blocks = 0
    this.every = Math.max(1, Math.round(sampleRate / 30 / 128))
    this.zero = new Float32Array(128)
    this.spare = new Float32Array(128)
    this.port.onmessage = (e) => {
      const m = e.data
      if (m.type === 'params') this.chain.setParams(m.params)
      else if (m.type === 'edit') this.chain.setEdit(m.edit)
      else if (m.type === 'time') this.chain.setPosition(m.t)
      else if (m.type === 'reset') this.chain.resetMeters()
    }
  }
  process(inputs, outputs) {
    const inp = inputs[0] || []
    const out = outputs[0]
    const n = out[0].length
    if (this.zero.length < n) { this.zero = new Float32Array(n); this.spare = new Float32Array(n) }
    const L = inp[0] || this.zero
    const R = inp[1] || L
    this.chain.process(L, R, out[0], out[1] || this.spare, n)
    if (++this.blocks % this.every === 0) this.port.postMessage({ type: 'meters', m: this.chain.snapshot() })
    return true
  }
}
registerProcessor('master-chain', MasterChainProcessor)
