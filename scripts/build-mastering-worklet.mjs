// src/lib/mastering/dsp.ts 를 AudioWorklet 모듈로 옮긴다.
// 실시간 재생(워크릿)과 내보내기(오프라인 렌더)가 같은 DSP 코드를 쓰게 하려는 것.
// 결과물 public/mastering/master-chain-worklet.js 는 커밋한다 — 테스트가 최신인지 확인한다.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const PROCESSOR = `
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
`

export async function buildWorkletSource() {
  const src = readFileSync(join(root, 'src/lib/mastering/dsp.ts'), 'utf8')
  const out = ts.transpileModule(src, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext, removeComments: false },
  }).outputText
  return `// 자동 생성 파일 — 직접 고치지 말 것. 원본: src/lib/mastering/dsp.ts (npm run build:worklet)\n${out}${PROCESSOR}`
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const code = await buildWorkletSource()
  writeFileSync(join(root, 'public/mastering/master-chain-worklet.js'), code)
  console.log('master-chain-worklet.js 생성')
}
