// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import FolderSidebar, { DRAG_TYPE } from './FolderSidebar'

afterEach(cleanup)

const setup = (over: any = {}) => {
  const p = {
    folders: [{ id: 'f1', title: '힙합' }, { id: 'f2', title: '미니앨범', is_published: true }],
    counts: { f1: 1, f2: 2 }, activeId: null as string | null, total: 16,
    onPick: vi.fn(), onCreate: vi.fn(async () => true), onRename: vi.fn(async () => true), onDelete: vi.fn(async () => true), onDropSong: vi.fn(),
    ...over,
  }
  render(<FolderSidebar {...p} />)
  return p
}

describe('FolderSidebar', () => {
  it('곡 수가 보이고 누르면 폴더가 선택된다', () => {
    const p = setup()
    expect(screen.getByText('2')).toBeTruthy()
    fireEvent.click(screen.getByText('힙합'))
    expect(p.onPick).toHaveBeenCalledWith('f1')
  })
  it('새 폴더 만들기 — 이름을 쓰고 Enter', async () => {
    const p = setup()
    fireEvent.click(screen.getByLabelText('새 폴더 만들기'))
    const input = screen.getByLabelText('새 폴더 이름')
    fireEvent.change(input, { target: { value: '운동할 때' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(p.onCreate).toHaveBeenCalledWith('운동할 때'))
  })
  it('이름 바꾸기', async () => {
    const p = setup()
    fireEvent.click(screen.getByLabelText('힙합 이름 바꾸기'))
    const input = screen.getByLabelText('폴더 이름 바꾸기')
    fireEvent.change(input, { target: { value: '힙합 모음' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(p.onRename).toHaveBeenCalledWith('f1', '힙합 모음'))
  })
  it('삭제는 한 번 더 확인하고 「곡은 남는다」고 알린다, 공개 폴더는 지울 수 없다', async () => {
    const p = setup()
    fireEvent.click(screen.getByLabelText('힙합 폴더 삭제'))
    expect(p.onDelete).not.toHaveBeenCalled()
    expect(screen.getByText(/곡은 「보관함」에 그대로 남아요/)).toBeTruthy()
    fireEvent.click(screen.getByText('폴더만 삭제'))
    await waitFor(() => expect(p.onDelete).toHaveBeenCalledWith('f1'))
    expect((screen.getByLabelText('미니앨범 폴더 삭제') as HTMLButtonElement).disabled).toBe(true)
  })
  it('곡을 폴더 위로 끌어 놓으면 넣고, 맨 위 칸에 놓으면 뺀다', () => {
    const p = setup()
    const dt = { types: [DRAG_TYPE], getData: () => 's1' }
    fireEvent.dragOver(screen.getByText('힙합').closest('div')!, { dataTransfer: dt })
    fireEvent.drop(screen.getByText('힙합').closest('div')!, { dataTransfer: dt })
    expect(p.onDropSong).toHaveBeenCalledWith('s1', 'f1')
    fireEvent.drop(screen.getByText(/폴더 밖/), { dataTransfer: dt })
    expect(p.onDropSong).toHaveBeenCalledWith('s1', null)
  })
})
