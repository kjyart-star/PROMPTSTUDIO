import { describe, it, expect, vi, beforeEach } from 'vitest'

const autoAlign = vi.fn()
let canPublish = true
vi.mock('@/lib/player/lyricSyncClient', () => ({
  autoAlign: (...a: unknown[]) => autoAlign(...a),
  canAlignForPublish: () => canPublish,
}))
const saveOwnLrc = vi.fn(async () => ({ ok: true }))
vi.mock('@/lib/player/lrcShareClient', () => ({ saveOwnLrc: (...a: unknown[]) => (saveOwnLrc as any)(...a) }))
vi.mock('@/lib/studio/audioUrl', () => ({ resolveStudioAudioUrl: async (p: string) => `https://cdn/${p}` }))
import { prepareSyncForPublish } from './publishFlow'
import { resetAlignJobs, runAlignJob } from '@/lib/player/alignJobs'

const lrc = [{ t: 2, text: '첫째 줄' }, { t: 20, text: '둘째 줄' }]
const song = (form: any = {}, lyrics = '첫째 줄\n둘째 줄') => ({ id: 's1', audio_url: 'audio/s1.mp3', lyrics, form })

beforeEach(() => { resetAlignJobs(); autoAlign.mockReset(); saveOwnLrc.mockClear(); canPublish = true })

describe('공개 단계 가사 싱크(공개자 기기가 계산)', () => {
  it('경음악이나 사람이 확인한 시간표가 있으면 바로 공개', async () => {
    expect((await prepareSyncForPublish(song({}, '[Instrumental]'), [])).status).toBe('none')
    expect((await prepareSyncForPublish(song({ lrc_by: 'user', lrc }), [])).status).toBe('none')
  })
  it('이미 계산된 자동 결과는 다시 계산하지 않고 확인 단계로', async () => {
    const r = await prepareSyncForPublish(song({ lrc_auto: lrc, lrc_auto_v: 5 }), [])
    expect(r.status).toBe('confirm')
    expect(autoAlign).not.toHaveBeenCalled()
  })
  it('계산해 저장한 뒤 확인 단계로', async () => {
    autoAlign.mockResolvedValue({ ok: true, lrc })
    const r = await prepareSyncForPublish(song(), [])
    expect(r).toMatchObject({ status: 'confirm', song: { form: { lrc_auto: lrc, lrc_auto_v: 5 } } })
    expect(saveOwnLrc).toHaveBeenCalledWith('s1', lrc, false)
    expect(autoAlign.mock.calls[0][6]).toEqual({ forceWasm: false })
  })
  it('처음 계산이 실패하면(메모리 부족 등) WASM q8 로 다시, 그래도 안 되면 수동 싱크', async () => {
    autoAlign.mockRejectedValueOnce(new Error('out of memory')).mockResolvedValueOnce({ ok: true, lrc })
    expect((await prepareSyncForPublish(song(), [])).status).toBe('confirm')
    expect(autoAlign.mock.calls[1][6]).toEqual({ forceWasm: true })
    autoAlign.mockReset()
    autoAlign.mockResolvedValue({ ok: false })
    expect((await prepareSyncForPublish(song(), [])).status).toBe('manual')
    expect(autoAlign).toHaveBeenCalledTimes(2)
  })
  it('태블릿도 계산하고(공개 단계), 워커가 없는 환경만 수동 싱크', async () => {
    autoAlign.mockResolvedValue({ ok: true, lrc })
    expect((await prepareSyncForPublish(song(), [])).status).toBe('confirm')
    canPublish = false
    expect((await prepareSyncForPublish(song(), [])).status).toBe('manual')
  })
  it('백그라운드 계산이 돌고 있으면 새로 계산하지 않고 그 작업의 남은 진행률을 보여 주며 기다린다', async () => {
    let done!: (v: any) => void
    let report!: (p: number) => void
    void runAlignJob('s1', (onPct) => { report = onPct; return new Promise((r) => { done = r }) })
    await Promise.resolve()
    report(60)
    const seen: number[] = []
    const p = prepareSyncForPublish(song(), [], (x) => seen.push(x))
    await Promise.resolve()
    report(90)
    done(lrc)
    const r = await p
    expect(r.status).toBe('confirm')
    expect(seen).toEqual([60, 90])
    expect(autoAlign).not.toHaveBeenCalled()
  })
})
