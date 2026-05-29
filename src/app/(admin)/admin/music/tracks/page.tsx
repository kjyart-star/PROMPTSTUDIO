'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Track, Album, Status } from '@/types/music'
import { Plus, Edit2, Trash2, Upload, Loader2, X, Music, Play, FileText, CheckCircle, AlertCircle } from 'lucide-react'
import { usePlayerStore } from '@/stores/playerStore'

interface UploadQueueItem {
  id: string
  file: File
  title: string
  albumId: string
  trackNumber: number
  durationSec: number | null
  status: 'ready' | 'uploading' | 'success' | 'failed'
  progress: number
  error?: string
}

export default function TracksPage() {
  const [tracks, setTracks] = useState<Track[]>([])
  const [albums, setAlbums] = useState<Album[]>([])
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [metaDrawerOpen, setMetaDrawerOpen] = useState(false)

  // 1. 일반 트랙 추가/수정 폼 상태
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [albumId, setAlbumId] = useState('')
  const [trackNumber, setTrackNumber] = useState(1)
  const [status, setStatus] = useState<Status>('draft')
  const [fileUrl, setFileUrl] = useState('')
  const [durationSec, setDurationSec] = useState<number | null>(null)
  const [fileSize, setFileSize] = useState<number | null>(null)
  const [audioFile, setAudioFile] = useState<File | null>(null)

  // 2. 다중 업로드 드래그앤드롭 상태
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 3. 메타데이터 드로어 상태 (Task 8 대응)
  const [selectedMetaTrack, setSelectedMetaTrack] = useState<Track | null>(null)
  const [lyrics, setLyrics] = useState('')
  const [stylePrompt, setStylePrompt] = useState('')
  const [bpm, setBpm] = useState<number | ''>('')
  const [songKey, setSongKey] = useState('')

  const supabase = createClient()
  const playTrack = usePlayerStore((s) => s.playTrack)

  // 데이터 fetch
  const fetchData = async () => {
    setLoading(true)
    try {
      const { data: albumsData, error: albumsError } = await supabase
        .from('albums')
        .select('*, artists(name)')
        .order('title')
      if (albumsError) throw albumsError

      const formattedAlbums = (albumsData || []).map((album: any) => ({
        ...album,
        artist: album.artists
      }))
      setAlbums(formattedAlbums)

      const { data: tracksData, error: tracksError } = await supabase
        .from('tracks')
        .select('*, albums(*, artists(*))')
        .order('created_at', { ascending: false })
      if (tracksError) throw tracksError

      const formattedTracks: Track[] = (tracksData || []).map((track: any) => ({
        ...track,
        album: track.albums ? {
          ...track.albums,
          artist: track.albums.artists
        } : undefined
      }))
      setTracks(formattedTracks)
    } catch (err) {
      console.error('Error fetching tracks:', err)
      alert('데이터를 로드하지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // 앨범이 변경될 때 기본값 세팅 보정
  useEffect(() => {
    if (albums.length > 0 && !albumId && !currentTrackId) {
      setAlbumId(albums[0].id)
    }
  }, [albums, albumId, currentTrackId])

  // 모달 닫기
  const closeModal = () => {
    setModalOpen(false)
    setCurrentTrackId(null)
    setTitle('')
    setAlbumId(albums[0]?.id || '')
    setTrackNumber(1)
    setStatus('draft')
    setFileUrl('')
    setDurationSec(null)
    setFileSize(null)
    setAudioFile(null)
  }

  // 수정 모달 열기
  const openEditModal = (track: Track) => {
    setCurrentTrackId(track.id)
    setTitle(track.title)
    setAlbumId(track.album_id)
    setTrackNumber(track.track_number)
    setStatus(track.status)
    setFileUrl(track.file_url)
    setDurationSec(track.duration_sec)
    setFileSize(track.file_size)
    setModalOpen(true)
  }

  // 메타데이터 드로어 열기 (Task 8)
  const openMetaDrawer = (track: Track) => {
    setSelectedMetaTrack(track)
    setLyrics(track.lyrics || '')
    setStylePrompt(track.style_prompt || '')
    setBpm(track.bpm !== null ? track.bpm : '')
    setSongKey(track.song_key || '')
    setMetaDrawerOpen(true)
  }

  // 메타데이터 저장 (Task 8)
  const handleSaveMeta = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedMetaTrack) return

    setIsSubmitting(true)
    try {
      const { error } = await supabase
        .from('tracks')
        .update({
          lyrics: lyrics || null,
          style_prompt: stylePrompt || null,
          bpm: bpm === '' ? null : Number(bpm),
          song_key: songKey || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedMetaTrack.id)

      if (error) throw error

      setMetaDrawerOpen(false)
      setSelectedMetaTrack(null)
      fetchData()
    } catch (err: any) {
      console.error('Error saving metadata:', err)
      alert(err.message || '메타데이터 저장에 실패했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 개별 트랙 수동 제출 (업로드 & DB)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !albumId) {
      alert('제목과 앨범은 필수 항목입니다.')
      return
    }

    setIsSubmitting(true)
    try {
      let finalFileUrl = fileUrl
      let finalDuration = durationSec
      let finalSize = fileSize

      // 파일 업로드
      if (audioFile) {
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: audioFile.name, contentType: audioFile.type })
        })
        const signData = await res.json()
        if (!res.ok) throw new Error(signData.error || '서명 발급 실패')

        const uploadRes = await fetch(signData.signedUrl, {
          method: 'PUT',
          headers: { 'Content-Type': audioFile.type },
          body: audioFile
        })
        if (!uploadRes.ok) throw new Error('스토리지 파일 업로드 실패')

        finalFileUrl = signData.path
        finalSize = audioFile.size
      }

      const payload = {
        title,
        album_id: albumId,
        track_number: Number(trackNumber),
        status,
        file_url: finalFileUrl,
        file_size: finalSize,
        duration_sec: finalDuration,
        updated_at: new Date().toISOString()
      }

      if (currentTrackId) {
        const { error } = await supabase
          .from('tracks')
          .update(payload)
          .eq('id', currentTrackId)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('tracks')
          .insert([payload])
        if (error) throw error
      }

      closeModal()
      fetchData()
    } catch (err: any) {
      console.error('Error saving track:', err)
      alert(err.message || '저장에 실패했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 트랙 삭제
  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return

    try {
      const { error } = await supabase
        .from('tracks')
        .delete()
        .eq('id', id)
      if (error) throw error
      fetchData()
    } catch (err: any) {
      console.error('Error deleting track:', err)
      alert(err.message || '삭제에 실패했습니다.')
    }
  }

  // 드래그앤드롭 파일 오디오 메타 추출 및 큐 등록
  const processFiles = (files: FileList) => {
    const items: UploadQueueItem[] = []

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('audio/')) {
        alert(`${file.name}은(는) 오디오 파일이 아닙니다.`)
        return
      }

      const id = crypto.randomUUID()
      const titleWithoutExt = file.name.replace(/\.[^/.]+$/, '')

      const item: UploadQueueItem = {
        id,
        file,
        title: titleWithoutExt,
        albumId: albums[0]?.id || '',
        trackNumber: 1,
        durationSec: null,
        status: 'ready',
        progress: 0
      }

      const audioUrl = URL.createObjectURL(file)
      const tempAudio = new Audio(audioUrl)
      tempAudio.onloadedmetadata = () => {
        setUploadQueue((prev) =>
          prev.map((q) => (q.id === id ? { ...q, durationSec: Math.floor(tempAudio.duration) } : q))
        )
      }

      items.push(item)
    })

    setUploadQueue((prev) => [...prev, ...items])
  }

  // 다중 일괄 업로드 처리
  const handleBatchUpload = async () => {
    const readyItems = uploadQueue.filter((item) => item.status === 'ready')
    if (readyItems.length === 0) return

    for (const item of readyItems) {
      setUploadQueue((prev) =>
        prev.map((q) => (q.id === item.id ? { ...q, status: 'uploading', progress: 20 } : q))
      )

      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: item.file.name, contentType: item.file.type })
        })
        const signData = await res.json()
        if (!res.ok) throw new Error(signData.error || '서명 오류')

        setUploadQueue((prev) =>
          prev.map((q) => (q.id === item.id ? { ...q, progress: 50 } : q))
        )

        const uploadRes = await fetch(signData.signedUrl, {
          method: 'PUT',
          headers: { 'Content-Type': item.file.type },
          body: item.file
        })
        if (!uploadRes.ok) throw new Error('업로드 오류')

        setUploadQueue((prev) =>
          prev.map((q) => (q.id === item.id ? { ...q, progress: 80 } : q))
        )

        const { error: insertError } = await supabase.from('tracks').insert([
          {
            title: item.title,
            album_id: item.albumId,
            track_number: Number(item.trackNumber),
            file_url: signData.path,
            file_size: item.file.size,
            duration_sec: item.durationSec,
            status: 'draft'
          }
        ])

        if (insertError) throw insertError

        setUploadQueue((prev) =>
          prev.map((q) => (q.id === item.id ? { ...q, status: 'success', progress: 100 } : q))
        )
      } catch (err: any) {
        console.error(err)
        setUploadQueue((prev) =>
          prev.map((q) => (q.id === item.id ? { ...q, status: 'failed', error: err.message } : q))
        )
      }
    }

    fetchData()
  }

  // 재생 테스트
  const handlePlayTest = async (track: Track) => {
    if (track.file_url.startsWith('http')) {
      playTrack(track)
      return
    }
    try {
      const { data, error } = await supabase.storage
        .from('tracks')
        .createSignedUrl(track.file_url, 3600)
      
      if (error) throw error

      const signedTrack: Track = {
        ...track,
        file_url: data.signedUrl
      }
      playTrack(signedTrack)
    } catch (err) {
      console.error(err)
      alert('음원 재생 URL을 가져올 수 없습니다.')
    }
  }

  return (
    <div className="space-y-8 font-sans pb-10">
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">트랙 & 음원 업로드</h1>
          <p className="text-xs text-slate-400 mt-1">개별 음원 정보 추가 및 드래그앤드롭 다중 업로드를 지원합니다.</p>
        </div>
        
        <div className="flex gap-2">
          <button
            id="btn-add-track"
            onClick={() => {
              if (albums.length === 0) {
                alert('트랙을 등록하려면 최소 1개 이상의 앨범이 먼저 등록되어 있어야 합니다.')
                return
              }
              setModalOpen(true)
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            단일 트랙 추가
          </button>
        </div>
      </div>

      {albums.length > 0 && (
        <div 
          className="border-2 border-dashed border-slate-800 rounded-2xl bg-slate-900/10 p-8 text-center space-y-4 hover:border-violet-500/50 hover:bg-violet-500/5 transition-all"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            if (e.dataTransfer.files) {
              processFiles(e.dataTransfer.files)
            }
          }}
        >
          <div className="mx-auto w-12 h-12 rounded-full bg-slate-900 border border-slate-850 flex items-center justify-center text-slate-400">
            <Upload className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-semibold">여러 개의 MP3 파일을 여기에 드래그하여 놓으세요</p>
            <p className="text-xs text-slate-500 mt-1">또는 아래 버튼을 눌러 컴퓨터에서 파일을 선택할 수 있습니다.</p>
          </div>
          <div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-850 hover:bg-slate-850 hover:border-slate-700 text-xs font-semibold"
            >
              컴퓨터에서 선택
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="audio/mp3, audio/mpeg"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) processFiles(e.target.files)
              }}
            />
          </div>
        </div>
      )}

      {/* 다중 업로드 대기 큐 */}
      {uploadQueue.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold flex items-center gap-2">
              업로드 큐 ({uploadQueue.length}개 대기중)
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => setUploadQueue([])}
                className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-850 hover:bg-slate-900 text-xs font-semibold text-slate-400"
              >
                비우기
              </button>
              <button
                onClick={handleBatchUpload}
                className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white shadow-md shadow-violet-500/20"
              >
                일괄 업로드 시작
              </button>
            </div>
          </div>

          <div className="divide-y divide-slate-800 border-t border-slate-800 max-h-72 overflow-y-auto">
            {uploadQueue.map((item) => (
              <div key={item.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="min-w-0">
                    <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">곡 이름</label>
                    <input
                      type="text"
                      value={item.title}
                      onChange={(e) => {
                        const val = e.target.value
                        setUploadQueue((prev) => prev.map((q) => (q.id === item.id ? { ...q, title: val } : q)))
                      }}
                      className="w-full mt-1 bg-slate-950 border border-slate-855 rounded-lg px-3 py-1.5 text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">앨범 설정</label>
                    <select
                      value={item.albumId}
                      onChange={(e) => {
                        const val = e.target.value
                        setUploadQueue((prev) => prev.map((q) => (q.id === item.id ? { ...q, albumId: val } : q)))
                      }}
                      className="w-full mt-1 bg-slate-950 border border-slate-855 rounded-lg px-3 py-1.5 text-xs focus:outline-none"
                    >
                      {albums.map((alb) => (
                        <option key={alb.id} value={alb.id}>
                          {alb.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">트랙 번호</label>
                      <input
                        type="number"
                        min={1}
                        value={item.trackNumber}
                        onChange={(e) => {
                          const val = Number(e.target.value)
                          setUploadQueue((prev) => prev.map((q) => (q.id === item.id ? { ...q, trackNumber: val } : q)))
                        }}
                        className="w-full mt-1 bg-slate-950 border border-slate-855 rounded-lg px-3 py-1.5 text-xs focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">길이(초)</label>
                      <div className="w-full mt-1 bg-slate-950 border border-slate-855 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-400">
                        {item.durationSec ? `${item.durationSec}초` : '디코딩 중...'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="w-24 text-right">
                    {item.status === 'ready' && <span className="text-xs text-slate-500">대기 중</span>}
                    {item.status === 'uploading' && (
                      <div className="space-y-1">
                        <span className="text-[10px] text-violet-400 font-semibold">전송 {item.progress}%</span>
                        <div className="w-full h-1 bg-slate-950 rounded overflow-hidden">
                          <div className="h-full bg-violet-500 transition-all" style={{ width: `${item.progress}%` }}></div>
                        </div>
                      </div>
                    )}
                    {item.status === 'success' && (
                      <span className="text-xs text-emerald-400 flex items-center gap-1 justify-end font-semibold">
                        <CheckCircle className="w-3.5 h-3.5" />
                        완료
                      </span>
                    )}
                    {item.status === 'failed' && (
                      <span className="text-xs text-red-400 flex items-center gap-1 justify-end font-semibold" title={item.error}>
                        <AlertCircle className="w-3.5 h-3.5" />
                        실패
                      </span>
                    )}
                  </div>
                  
                  <button
                    onClick={() => setUploadQueue((prev) => prev.filter((q) => q.id !== item.id))}
                    className="p-1.5 text-slate-500 hover:text-slate-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 트랙 목록 테이블 */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-4 px-6 w-16">재생</th>
                  <th className="py-4 px-6 w-16">번호</th>
                  <th className="py-4 px-6">제목</th>
                  <th className="py-4 px-6">앨범 / 아티스트</th>
                  <th className="py-4 px-6 w-20 text-right">길이</th>
                  <th className="py-4 px-6 w-24 text-right">누적재생</th>
                  <th className="py-4 px-6 w-24 text-right">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-sm">
                {tracks.length > 0 ? (
                  tracks.map((track) => (
                    <tr key={track.id} className="hover:bg-slate-950/35 transition-all">
                      <td className="py-4 px-6">
                        <button
                          id={`btn-play-track-${track.id}`}
                          onClick={() => handlePlayTest(track)}
                          className="w-8 h-8 rounded-full bg-slate-950 border border-slate-850 flex items-center justify-center text-slate-400 hover:text-violet-400 hover:border-violet-500/30 transition-all"
                        >
                          <Play className="w-3.5 h-3.5 ml-0.5" />
                        </button>
                      </td>
                      <td className="py-4 px-6 font-mono text-slate-400">{track.track_number}</td>
                      <td className="py-4 px-6 font-semibold text-slate-100">{track.title}</td>
                      <td className="py-4 px-6">
                        <p className="text-slate-200 font-medium truncate max-w-xs">{track.album?.title}</p>
                        <p className="text-slate-400 text-xs truncate max-w-xs">{track.album?.artist?.name}</p>
                      </td>
                      <td className="py-4 px-6 font-mono text-xs text-slate-400 text-right">
                        {track.duration_sec ? `${Math.floor(track.duration_sec / 60)}:${(track.duration_sec % 60).toString().padStart(2, '0')}` : '-'}
                      </td>
                      <td className="py-4 px-6 font-mono text-xs text-slate-400 text-right">
                        {(track.play_count || 0).toLocaleString()}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            id={`btn-edit-meta-${track.id}`}
                            onClick={() => openMetaDrawer(track)}
                            title="메타데이터 편집 (가사/BPM)"
                            className="p-2 text-slate-400 hover:text-violet-400 hover:bg-slate-850 rounded-lg transition-all"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          <button
                            id={`btn-edit-track-${track.id}`}
                            onClick={() => openEditModal(track)}
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-850 rounded-lg transition-all"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            id={`btn-delete-track-${track.id}`}
                            onClick={() => handleDelete(track.id)}
                            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-950/20 rounded-lg transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      등록된 트랙이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 단일 트랙 추가/수정 모달 */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
            
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/20">
              <h3 className="font-bold text-lg">
                {currentTrackId ? '단일 트랙 수정' : '단일 트랙 등록'}
              </h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-white p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  곡 제목 *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 transition-all text-sm"
                  placeholder="예: Midnight Rain"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    소속 앨범 *
                  </label>
                  <select
                    required
                    value={albumId}
                    onChange={(e) => setAlbumId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 transition-all text-sm"
                  >
                    {albums.map((alb) => (
                      <option key={alb.id} value={alb.id}>
                        {alb.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    트랙 번호
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={trackNumber}
                    onChange={(e) => setTrackNumber(Number(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 transition-all text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    공개 상태 *
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as Status)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 transition-all text-sm"
                  >
                    <option value="draft">Draft (초안)</option>
                    <option value="published">Published (발매)</option>
                    <option value="archived">Archived (보관)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    감지 시간(초)
                  </label>
                  <div className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-850 text-slate-400 text-sm font-mono">
                    {durationSec ? `${durationSec}초` : '-'}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  MP3 오디오 파일
                </label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 cursor-pointer transition-all text-xs font-medium text-slate-300">
                    <Music className="w-4 h-4 text-slate-400" />
                    오디오 선택
                    <input
                      type="file"
                      accept="audio/mp3, audio/mpeg"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          setAudioFile(file)
                          setTitle(file.name.replace(/\.[^/.]+$/, ''))
                          
                          const audioUrl = URL.createObjectURL(file)
                          const tempAudio = new Audio(audioUrl)
                          tempAudio.onloadedmetadata = () => {
                            setDurationSec(Math.floor(tempAudio.duration))
                          }
                        }
                      }}
                    />
                  </label>
                  <span className="text-xs text-slate-400 truncate max-w-xs">
                    {audioFile ? audioFile.name : fileUrl ? '기존 음원 등록됨' : '선택된 파일 없음'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-850 text-slate-300 text-xs font-semibold"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {currentTrackId ? '수정 완료' : '추가 완료'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* 상세 메타데이터 편집 드로어 */}
      {metaDrawerOpen && selectedMetaTrack && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl p-6 flex flex-col justify-between font-sans">
          
          <div className="space-y-6 overflow-y-auto pr-1">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="font-bold text-lg text-slate-100">상세 메타 편집</h3>
                <p className="text-[10px] text-violet-400 mt-1 font-mono">{selectedMetaTrack.title}</p>
              </div>
              <button 
                onClick={() => { setMetaDrawerOpen(false); setSelectedMetaTrack(null); }} 
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMeta} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  가사 (Lyrics)
                </label>
                <textarea
                  value={lyrics}
                  onChange={(e) => setLyrics(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 transition-all text-xs h-40 font-sans"
                  placeholder="노래 가사를 기입하세요."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  스타일 프롬프트 (Style Prompt)
                </label>
                <textarea
                  value={stylePrompt}
                  onChange={(e) => setStylePrompt(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 transition-all text-xs h-20 font-mono"
                  placeholder="예: upbeat lofi pop, female vocals, 120bpm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    템포 (BPM)
                  </label>
                  <input
                    type="number"
                    value={bpm}
                    onChange={(e) => setBpm(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 transition-all text-sm font-mono"
                    placeholder="BPM 수치"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    조 (Song Key)
                  </label>
                  <input
                    type="text"
                    value={songKey}
                    onChange={(e) => setSongKey(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 transition-all text-sm font-mono"
                    placeholder="예: C Major"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => { setMetaDrawerOpen(false); setSelectedMetaTrack(null); }}
                  className="px-4 py-2 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-850 text-slate-300 text-xs font-semibold"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  메타 저장
                </button>
              </div>
            </form>
          </div>

        </div>
      )}

    </div>
  )
}
