// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { usePlayerStore } from '@/stores/playerStore'
import { ImmersivePlayer } from './ImmersivePlayer'

vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 })))
const trk = (extra: any = {}) =>
  ({ id: 't1', title: '곡', file_url: 'a', duration_sec: 120, lyrics: '첫째 줄입니다\n둘째 줄입니다\n셋째 줄입니다', album: { title: '앨범', cover_url: '/c.png' }, ...extra }) as any
const open = (t: any) => usePlayerStore.setState({ isImmersiveOpen: true, currentTrack: t, queue: [t], queueIndex: 0, currentTime: 0, duration: 120, isPlaying: false })
afterEach(() => cleanup())

describe('전체화면 플레이어 「가사 동기화」 버튼', () => {
  it('내 스튜디오 곡이면 보이고, 시간표가 없으면 「가사 동기화」 + 무료 배지', () => {
    open(trk({ album_id: 'studio-generated' }))
    render(<ImmersivePlayer />)
    expect(screen.getByText('가사 동기화')).toBeTruthy()
    expect(screen.getByText('무료 · 내 컴퓨터에서 처리')).toBeTruthy()
  })
  it('시간표가 이미 있으면 「다시 맞추기」', () => {
    open(trk({ album_id: 'studio-generated', lrc: [{ t: 1, text: '첫째 줄입니다' }, { t: 5, text: '둘째 줄입니다' }, { t: 9, text: '셋째 줄입니다' }] }))
    render(<ImmersivePlayer />)
    expect(screen.getByText('다시 맞추기')).toBeTruthy()
  })
  it('남의 곡(공개 곡)에서는 숨긴다', () => {
    open(trk({ album_id: 'someone-elses-album' }))
    render(<ImmersivePlayer />)
    expect(screen.queryByTestId('lyric-sync')).toBeNull()
  })
})
