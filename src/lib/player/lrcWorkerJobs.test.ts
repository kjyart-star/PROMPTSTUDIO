import { describe, it, expect } from 'vitest'
import { lrcJobsOf, gpuDone } from './lrcWorkerJobs'
import { LRC_GPU_VERSION, LRC_BROWSER_MODEL, LRC_GPU_MODEL } from '@/lib/studio/lyricsOf'

const lyr = '[Verse]\n첫 줄\n둘째 줄\n셋째 줄'
const lines = [{ t: 1, text: '첫 줄' }, { t: 12, text: '둘째 줄' }, { t: 30, text: '셋째 줄' }]
const row = (id: string, extra: any = {}) => ({ id, title: id, created_at: `2026-11-0${id.length}`, lyrics: lyr, audio_url: `audio/${id}.mp3`, is_published: true, form: {}, ...extra })

describe('회사 PC 정렬 작업 목록', () => {
  it('가사·음원이 있고 GPU 결과가 없는 곡을 최신순으로 고르고 진행률을 센다', () => {
    const r = lrcJobsOf([
      row('a'),
      row('bb', { form: { lrc_auto: lines, lrc_auto_v: LRC_GPU_VERSION, lrc_auto_model: LRC_GPU_MODEL } }),
      row('ccc', { is_published: false }),
    ])
    expect(r.jobs.map((j) => j.id)).toEqual(['ccc', 'a'])
    expect(r.total).toBe(3)
    expect(r.done).toBe(1)
    expect(r.jobs[1].lines).toEqual(['첫 줄', '둘째 줄', '셋째 줄'])
  })
  it('브라우저 결과·옛 판은 다시 맞추고, 사용자 시간표·음원 없음·휴지통·가사 없음은 뺀다', () => {
    const r = lrcJobsOf([
      row('a', { form: { lrc_auto: lines, lrc_auto_v: LRC_GPU_VERSION, lrc_auto_model: LRC_BROWSER_MODEL } }),
      row('b', { form: { lrc_auto: lines, lrc_auto_v: 2 } }),
      row('c', { form: { lrc: lines, lrc_by: 'user' } }),
      row('d', { audio_url: '' }),
      row('e', { trashed_at: '2026-11-01' }),
      row('f', { lyrics: '', form: {} }),
    ])
    expect(r.jobs.map((j) => j.id).sort()).toEqual(['a', 'b'])
    expect(r.total).toBe(2)
  })
  it('마스터링본은 원곡 가사를 물려받아 자기 음원으로 맞춘다', () => {
    const r = lrcJobsOf([row('src'), row('m', { lyrics: '', form: { kind: 'mastering', source_id: 'src' } })])
    expect(r.jobs.find((j) => j.id === 'm')?.lines).toHaveLength(3)
  })
  it('gpuDone 은 현재 판·GPU 모델일 때만 참', () => {
    expect(gpuDone({ lrc_auto: lines, lrc_auto_v: LRC_GPU_VERSION, lrc_auto_model: LRC_GPU_MODEL })).toBe(true)
    expect(gpuDone({ lrc_auto: lines, lrc_auto_v: LRC_GPU_VERSION })).toBe(false)
  })
})
