import { describe, it, expect } from 'vitest'
import { alignLyricsToSegments } from './lyricAlign'
import base from './__fixtures__/woori-whisper-base.json'
import small from './__fixtures__/woori-whisper-small.json'

// 「우리이야기」 실제 음성 인식 결과(whisper base·small, 한국어, 단락 단위)와 원문 가사
const LYRICS = `젖은 유리창 위로 네 이름이 번져
신호등 불빛마다 마음이 멈춰 서
돌아갈 길은 없다는 걸 알면서도
나는 같은 거리를 다시 지나가
라디오 끝에 남은 작은 숨처럼
아직도 넌 내 밤을 흔들어
Rain on the midnight road
너를 잊는 법을 몰라
흐려진 불빛 사이로
우리의 계절이 또 지나가
Rain on the midnight road
끝내 말하지 못한 말
빗소리 안에 묻어둘게
오늘도 널 지나쳐 가
텅 빈 조수석 위로 새벽이 내려
익숙한 골목마다 추억이 켜져
괜찮아질 거라는 흔한 말 대신
가만히 속도를 낮춰 숨을 쉬어
언젠가 이 노래가 끝나면
나도 웃으며 널 놓을 수 있을까`.split('\n')

describe('alignLyricsToSegments', () => {
  it.each([['base', base], ['small', small]])('%s: 틀린 글자가 섞여도 첫 줄이 보컬 시작(약 1.4초)에 맞는다', (_n, segs) => {
    const r = alignLyricsToSegments(LYRICS, segs as any, 119.8)
    expect(r.ok).toBe(true)
    expect(r.lines[0].anchored).toBe(true)
    expect(Math.abs(r.lines[0].t - 1.4)).toBeLessThan(0.5)
    expect(Math.abs(r.lines[1].t - 5.5)).toBeLessThan(0.5)
    expect(Math.abs(r.lines[2].t - 9.7)).toBeLessThan(0.5)
  })
  it('시작 시간이 단조 증가한다', () => {
    const r = alignLyricsToSegments(LYRICS, small as any, 119.8)
    for (let i = 1; i < r.lines.length; i++) expect(r.lines[i].t).toBeGreaterThanOrEqual(r.lines[i - 1].t)
  })
  it('인식 결과가 가사와 무관하면 실패로 돌려보낸다(가짜 싱크 금지)', () => {
    const junk = [{ text: 'thanks for watching please subscribe to the channel', start: 0, end: 20 }, { text: 'see you next time bye', start: 20, end: 30 }]
    expect(alignLyricsToSegments(LYRICS, junk, 120).ok).toBe(false)
  })
  it('인식된 글이 없으면 실패', () => {
    expect(alignLyricsToSegments(LYRICS, [], 120).ok).toBe(false)
  })
})
