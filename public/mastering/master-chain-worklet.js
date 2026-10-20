// 자동 생성 파일 — 직접 고치지 말 것. 원본: src/lib/mastering/dsp.ts (npm run build:worklet)
/**
 * 마스터링 체인 DSP 코어.
 *
 * 이 파일은 다른 모듈을 import 하지 않는다 — scripts/build-mastering-worklet.mjs 가 그대로
 * 트랜스파일해 AudioWorklet(실시간 재생)으로 싣고, 내보내기(오프라인 청크 렌더)와 단위 테스트도
 * 같은 코드를 쓴다. 그래서 들리는 소리와 내보낸 파일이 같다.
 */
export const dbToLin = (db) => Math.pow(10, db / 20);
export const linToDb = (x) => (x > 1e-12 ? 20 * Math.log10(x) : -240);
export const ALL_SLOTS = ['eq', 'comp', 'multiband', 'stereo', 'saturation', 'limiter'];
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
    }
    set(p) {
        const key = JSON.stringify(p);
        if (key === this.key)
            return;
        this.key = key;
        const coefs = eqSections(p, this.fs);
        // 단 개수가 같으면 상태를 유지해 클릭을 줄인다
        if (coefs.length !== this.secs.length)
            this.secs = coefs.map(() => new Biquad());
        coefs.forEach((c, i) => this.secs[i].set(c));
        this.gIn = dbToLin(p.input);
        this.gOut = dbToLin(p.output);
    }
    process(L, R, n) {
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
/** 스테레오 링크 피드포워드 컴프 — 반환값 없이 env(dB, ≤0)를 갱신한다 */
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
    /** 샘플 하나의 링크된 레벨로 게인(선형)을 돌려준다 */
    gain(level) {
        const x = linToDb(level);
        const gr = compCurve(x, this.T, this.R, this.K) - x;
        this.env = gr < this.env ? this.aA * this.env + (1 - this.aA) * gr : this.aR * this.env + (1 - this.aR) * gr;
        if (this.env < this.maxGr)
            this.maxGr = this.env;
        return dbToLin(this.env);
    }
}
class CompStage {
    constructor(fs) {
        this.makeup = 1;
        this.mix = 1;
        this.core = new CompCore(fs);
    }
    set(p) {
        this.core.set(p.threshold, p.ratio, p.attack, p.release, p.knee);
        this.makeup = dbToLin(p.makeup);
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
// ───────────────────────── 멀티밴드 (3밴드, LR4 크로스오버) ─────────────────────────
class MultibandStage {
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
        this.gains = [1, 1, 1];
        this.active = [1, 1, 1];
        this.key = '';
        this.cores = [new CompCore(fs), new CompCore(fs), new CompCore(fs)];
    }
    set(p) {
        const fs = this.fs;
        const key = `${p.lowX}|${p.highX}`;
        if (key !== this.key) {
            this.key = key;
            const lo = Math.min(p.lowX, p.highX * 0.8), hi = p.highX;
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
        const anySolo = p.bands.some(b => b.solo);
        p.bands.forEach((b, i) => {
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
            const l = L[i], r = R[i];
            // 저역: LR4 LP(f1) → 위상 맞춤용 올패스(f2)
            let lL = this.ap2.l(this.lp1b.l(this.lp1a.l(l)));
            let lR = this.ap2.r(this.lp1b.r(this.lp1a.r(r)));
            const restL = this.hp1b.l(this.hp1a.l(l));
            const restR = this.hp1b.r(this.hp1a.r(r));
            let mL = this.lp2b.l(this.lp2a.l(restL)), mR = this.lp2b.r(this.lp2a.r(restR));
            let hL = this.hp2b.l(this.hp2a.l(restL)), hR = this.hp2b.r(this.hp2a.r(restR));
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
            // LR4 는 저·고가 같은 위상이라 그대로 더하면 전대역이 평탄(올패스)하다
            L[i] = lL * g0 + mL * g1 + hL * g2;
            R[i] = lR * g0 + mR * g1 + hR * g2;
        }
    }
}
// ───────────────────────── 스테레오 폭 / M-S ─────────────────────────
class StereoStage {
    constructor(fs) {
        this.fs = fs;
        this.hp = new Biquad();
        this.bassMono = 0;
        this.mid = 1;
        this.side = 1;
    }
    set(p) {
        this.mid = dbToLin(p.mid);
        this.side = dbToLin(p.side) * Math.max(0, p.width) / 100;
        if (p.bassMono !== this.bassMono) {
            this.bassMono = p.bassMono;
            if (p.bassMono > 0)
                this.hp.set(designPass('hp', p.bassMono, Math.SQRT1_2, this.fs));
        }
    }
    process(L, R, n) {
        const bm = this.bassMono > 0;
        for (let i = 0; i < n; i++) {
            const m = (L[i] + R[i]) * 0.5 * this.mid;
            let s = (L[i] - R[i]) * 0.5 * this.side;
            if (bm)
                s = this.hp.l(s);
            L[i] = m + s;
            R[i] = m - s;
        }
    }
}
// ───────────────────────── 새추레이션 ─────────────────────────
export function saturate(x, mode) {
    if (mode === 'tube') {
        const y = x + 0.15 * x * x;
        return Math.tanh(y);
    }
    if (mode === 'clip') {
        if (x > 1)
            return 2 / 3;
        if (x < -1)
            return -2 / 3;
        return x - (x * x * x) / 3;
    }
    return Math.tanh(x);
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
        this.dcA = Math.exp((-2 * Math.PI * 10) / fs);
    }
    set(p) {
        this.drive = dbToLin(p.drive);
        this.mode = p.mode;
        this.mix = Math.min(Math.max(p.mix, 0), 100) / 100;
        this.out = dbToLin(p.output);
    }
    process(L, R, n) {
        const g = this.drive, m = this.mix, o = this.out, a = this.dcA;
        // 낮은 레벨에서 1배가 되도록 드라이브로 다시 나눈다 (clip 은 기울기 1)
        const norm = 1 / g;
        for (let i = 0; i < n; i++) {
            const l = L[i], r = R[i];
            let sl = saturate(l * g, this.mode) * norm;
            let sr = saturate(r * g, this.mode) * norm;
            if (this.mode === 'tube') {
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
            const t = k - (TP_HALF - 1) - frac; // 샘플 위치 - 보간 위치
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
    /** 가운데 샘플(TP_HALF-1 지연)과 그 다음 샘플 사이의 최대 |값| */
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
            // 감지 위치: TP_HALF-1 샘플 전
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
            // 지연선
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
/** 고정 지연선 (A/B 원본을 체인 지연에 맞춘다) */
class DelayLine {
    constructor(len) {
        this.p = 0;
        this.bl = new Float32Array(len + 1);
        this.br = new Float32Array(len + 1);
    }
    process(L, R, n) {
        const N = this.bl.length;
        for (let i = 0; i < n; i++) {
            this.bl[this.p] = L[i];
            this.br[this.p] = R[i];
            const rd = (this.p + 1) % N;
            L[i] = this.bl[rd];
            R[i] = this.br[rd];
            this.p = rd;
        }
    }
}
// ───────────────────────── 라우드니스 (ITU-R BS.1770-4) ─────────────────────────
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
        this.momentary = -Infinity;
        this.shortTerm = -Infinity;
        this.maxMomentary = -Infinity;
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
        this.momentary = this.shortTerm = this.maxMomentary = -Infinity;
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
            if (this.momentary > this.maxMomentary)
                this.maxMomentary = this.momentary;
        }
        if (this.ringN >= 30) {
            let s = 0;
            for (let k = 0; k < 30; k++)
                s += this.ring[k];
            this.shortTerm = energyToLufs(s / 30);
        }
        else if (this.ringN >= 4) {
            let s = 0;
            for (let k = 1; k <= this.ringN; k++)
                s += this.ring[(this.ringPos - k + 30) % 30];
            this.shortTerm = energyToLufs(s / this.ringN);
        }
    }
    integrated() { return gatedIntegrated(this.blocks); }
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
export class MasterChain {
    constructor(fs, maxBlock = 4096) {
        this.p = null;
        this.inTrim = 1;
        this.origTrim = 1;
        // 미터
        this.meterOn = true;
        this.tp = new TruePeakMeter();
        this.cLR = 0;
        this.cLL = 0;
        this.cRR = 0;
        this.t0 = new Float32Array(0);
        this.t1 = new Float32Array(0);
        this.fs = fs;
        this.eq = new EqStage(fs);
        this.comp = new CompStage(fs);
        this.mb = new MultibandStage(fs);
        this.st = new StereoStage(fs);
        this.sat = new SaturationStage(fs);
        this.lim = new LimiterStage(fs);
        this.latency = this.lim.latency;
        this.dryDelay = new DelayLine(this.latency);
        this.limBypassDelay = new DelayLine(this.latency);
        this.wL = new Float32Array(maxBlock);
        this.wR = new Float32Array(maxBlock);
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
        this.eq.set(p.eq);
        this.comp.set(p.comp);
        this.mb.set(p.multiband);
        this.st.set(p.stereo);
        this.sat.set(p.saturation);
        this.lim.set(p.limiter);
    }
    resetMeters() {
        this.loud.reset();
        this.inLoud.reset();
        this.tp.reset();
        this.lim.maxGr = 0;
        this.comp.core.maxGr = 0;
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
        const wL = this.wL, wR = this.wR;
        const t = this.inTrim;
        for (let i = 0; i < n; i++) {
            wL[i] = inL[i] * t;
            wR[i] = inR[i] * t;
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
                case 'eq':
                    this.eq.process(wL, wR, n);
                    break;
                case 'comp':
                    this.comp.process(wL, wR, n);
                    break;
                case 'multiband':
                    this.mb.process(wL, wR, n);
                    break;
                case 'stereo':
                    this.st.process(wL, wR, n);
                    break;
                case 'saturation':
                    this.sat.process(wL, wR, n);
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
            // 원본 듣기: 입력을 체인 지연만큼 늦춰 그대로 (음량 맞춤 적용)
            const g = this.origTrim;
            for (let i = 0; i < n; i++) {
                outL[i] = inL[i];
                outR[i] = inR[i];
            }
            this.dryDelay.process(outL, outR, n);
            for (let i = 0; i < n; i++) {
                outL[i] *= g;
                outR[i] *= g;
            }
        }
        else {
            // 원본 지연선도 계속 흘려 A/B 전환 순간이 매끄럽게
            const tmpL = this.tmp(n, 0), tmpR = this.tmp(n, 1);
            tmpL.set(inL.subarray(0, n));
            tmpR.set(inR.subarray(0, n));
            this.dryDelay.process(tmpL, tmpR, n);
            for (let i = 0; i < n; i++) {
                outL[i] = wL[i];
                outR[i] = wR[i];
            }
        }
        if (this.meterOn)
            this.outLv.process(outL, outR, n);
    }
    tmp(n, which) {
        if (which === 0) {
            if (this.t0.length < n)
                this.t0 = new Float32Array(n);
            return this.t0;
        }
        if (this.t1.length < n)
            this.t1 = new Float32Array(n);
        return this.t1;
    }
    snapshot() {
        const denom = Math.sqrt(this.cLL * this.cRR);
        const tpRecent = this.tp.recent;
        this.tp.recent = 0;
        return {
            inLevel: this.inLv.take(),
            outLevel: this.outLv.take(),
            momentary: this.loud.momentary,
            shortTerm: this.loud.shortTerm,
            integrated: this.loud.integrated(),
            inIntegrated: this.inLoud.integrated(),
            truePeak: linToDb(tpRecent),
            truePeakMax: linToDb(this.tp.max),
            correlation: denom > 1e-10 ? this.cLR / denom : 1,
            compGr: this.p?.bypass.comp ? 0 : this.comp.core.env,
            mbGr: this.p?.bypass.multiband ? [0, 0, 0] : [this.mb.cores[0].env, this.mb.cores[1].env, this.mb.cores[2].env],
            limGr: this.lim.gr,
            limGrMax: this.lim.maxGr,
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
