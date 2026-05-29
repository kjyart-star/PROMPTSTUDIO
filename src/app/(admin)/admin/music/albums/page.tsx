'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Album, Artist, ReleaseType, Status } from '@/types/music'
import { Plus, Edit2, Trash2, Upload, Loader2, X, Library } from 'lucide-react'

export default function AlbumsPage() {
  const [albums, setAlbums] = useState<Album[]>([])
  const [artists, setArtists] = useState<Artist[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 폼 상태
  const [currentAlbumId, setCurrentAlbumId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [artistId, setArtistId] = useState('')
  const [releaseType, setReleaseType] = useState<ReleaseType>('single')
  const [status, setStatus] = useState<Status>('draft')
  const [coverUrl, setCoverUrl] = useState('')
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [genresInput, setGenresInput] = useState('')
  const [moodsInput, setMoodsInput] = useState('')
  const [description, setDescription] = useState('')

  const supabase = createClient()

  // 앨범 및 아티스트 정보 가져오기
  const fetchData = async () => {
    setLoading(true)
    try {
      // 1. 아티스트 목록 가져오기 (셀렉트용)
      const { data: artistsData, error: artistsError } = await supabase
        .from('artists')
        .select('*')
        .order('name')
      
      if (artistsError) throw artistsError
      setArtists(artistsData || [])

      // 2. 앨범 목록 가져오기 (아티스트 조인)
      const { data: albumsData, error: albumsError } = await supabase
        .from('albums')
        .select('*, artists(*)')
        .order('created_at', { ascending: false })

      if (albumsError) throw albumsError

      // 타입 호환 처리를 위한 변형
      const formattedAlbums: Album[] = (albumsData || []).map((album: any) => ({
        ...album,
        artist: album.artists // Supabase 조인은 단수형 혹은 별칭이 아닌 테이블명 원본(artists) 배열 또는 객체로 넘어옵니다.
      }))
      setAlbums(formattedAlbums)
    } catch (err) {
      console.error('Error fetching albums/artists:', err)
      alert('데이터를 가져오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // 제목 작성 시 슬러그 제안
  const handleTitleChange = (val: string) => {
    setTitle(val)
    if (!currentAlbumId) {
      const suggestedSlug = val
        .toLowerCase()
        .replace(/[^a-z0-9ㄱ-ㅎㅏ-ㅣ가-힣]+/g, '-')
        .replace(/(^-|-$)+/g, '')
      setSlug(suggestedSlug)
    }
  }

  // 모달 닫기 및 폼 초기화
  const closeModal = () => {
    setModalOpen(false)
    setCurrentAlbumId(null)
    setTitle('')
    setSlug('')
    setArtistId(artists[0]?.id || '')
    setReleaseType('single')
    setStatus('draft')
    setCoverUrl('')
    setCoverFile(null)
    setGenresInput('')
    setMoodsInput('')
    setDescription('')
  }

  // 수정 모달 열기
  const openEditModal = (album: Album) => {
    setCurrentAlbumId(album.id)
    setTitle(album.title)
    setSlug(album.slug)
    setArtistId(album.artist_id)
    setReleaseType(album.release_type)
    setStatus(album.status)
    setCoverUrl(album.cover_url || '')
    setGenresInput(album.genres ? album.genres.join(', ') : '')
    setMoodsInput(album.moods ? album.moods.join(', ') : '')
    setDescription(album.description || '')
    setModalOpen(true)
  }

  // 앨범 생성/수정 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !slug || !artistId) {
      alert('제목, 슬러그, 아티스트는 필수 항목입니다.')
      return
    }

    setIsSubmitting(true)
    try {
      let finalCoverUrl = coverUrl

      // 파일 업로드 처리
      if (coverFile) {
        const fileExt = coverFile.name.split('.').pop()
        const fileName = `cover_${Date.now()}.${fileExt}`
        const filePath = `covers/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('albums')
          .upload(filePath, coverFile)

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from('albums')
          .getPublicUrl(filePath)
        
        finalCoverUrl = publicUrl
      }

      // 장르 및 무드 콤마 스플릿 배열 처리
      const genres = genresInput
        .split(',')
        .map((g) => g.trim())
        .filter((g) => g !== '')
      
      const moods = moodsInput
        .split(',')
        .map((m) => m.trim())
        .filter((m) => m !== '')

      const payload = {
        title,
        slug,
        artist_id: artistId,
        release_type: releaseType,
        status,
        cover_url: finalCoverUrl || null,
        genres,
        moods,
        description: description || null,
        updated_at: new Date().toISOString()
      }

      if (currentAlbumId) {
        const { error } = await supabase
          .from('albums')
          .update(payload)
          .eq('id', currentAlbumId)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('albums')
          .insert([payload])

        if (error) throw error
      }

      closeModal()
      fetchData()
    } catch (err: any) {
      console.error('Error saving album:', err)
      alert(err.message || '앨범 저장에 실패했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 앨범 삭제
  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까? 앨범에 속한 모든 음악 트랙이 함께 삭제됩니다.')) return

    try {
      const { error } = await supabase
        .from('albums')
        .delete()
        .eq('id', id)

      if (error) throw error
      fetchData()
    } catch (err: any) {
      console.error('Error deleting album:', err)
      alert(err.message || '삭제에 실패했습니다.')
    }
  }

  // 아티스트가 변경될 때 기본값 세팅 보정
  useEffect(() => {
    if (artists.length > 0 && !artistId && !currentAlbumId) {
      setArtistId(artists[0].id)
    }
  }, [artists, artistId, currentAlbumId])

  return (
    <div className="space-y-6 font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">앨범 관리</h1>
          <p className="text-xs text-slate-400 mt-1">싱글, EP, LP 등의 앨범 패키지 정보를 제어합니다.</p>
        </div>
        <button
          id="btn-add-album"
          onClick={() => {
            if (artists.length === 0) {
              alert('앨범을 등록하려면 최소 1명 이상의 아티스트가 먼저 등록되어 있어야 합니다.')
              return
            }
            setModalOpen(true)
          }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          앨범 추가
        </button>
      </div>

      {/* 리스트 그리드 */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
          {albums.length > 0 ? (
            albums.map((album) => (
              <div key={album.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col justify-between group shadow-sm">
                
                {/* 앨범 커버 */}
                <div className="relative aspect-square w-full bg-slate-950 border-b border-slate-850 flex items-center justify-center overflow-hidden">
                  {album.cover_url ? (
                    <img src={album.cover_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300" />
                  ) : (
                    <Library className="w-12 h-12 text-slate-700" />
                  )}
                  
                  {/* 오버레이 뱃지 */}
                  <div className="absolute top-3 right-3 flex flex-col gap-1.5 items-end">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      album.release_type === 'single' ? 'bg-blue-500 text-white' :
                      album.release_type === 'ep' ? 'bg-violet-500 text-white' :
                      album.release_type === 'lp' ? 'bg-fuchsia-500 text-white' :
                      'bg-slate-500 text-white'
                    }`}>
                      {album.release_type}
                    </span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      album.status === 'published' ? 'bg-emerald-500 text-white animate-pulse' :
                      album.status === 'draft' ? 'bg-yellow-500 text-slate-900' :
                      'bg-slate-700 text-slate-200'
                    }`}>
                      {album.status}
                    </span>
                  </div>
                </div>

                {/* 정보 */}
                <div className="p-5 flex-grow space-y-2">
                  <h3 className="font-bold text-base text-slate-100 truncate">{album.title}</h3>
                  <p className="text-xs text-slate-400 truncate">
                    아티스트: <span className="font-medium text-slate-200">{album.artist?.name || '알 수 없음'}</span>
                  </p>
                  {album.genres && album.genres.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {album.genres.slice(0, 3).map((genre, index) => (
                        <span key={index} className="text-[10px] bg-slate-950 px-2 py-0.5 rounded text-slate-400 border border-slate-800">
                          {genre}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* 관리 버튼 */}
                <div className="px-5 pb-5 pt-0 border-t border-slate-850 flex items-center justify-between bg-slate-950/20">
                  <span className="text-[10px] text-slate-500 font-mono">
                    {new Date(album.created_at).toLocaleDateString()}
                  </span>
                  
                  <div className="flex items-center gap-1.5">
                    <button
                      id={`btn-edit-album-${album.id}`}
                      onClick={() => openEditModal(album)}
                      className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      id={`btn-delete-album-${album.id}`}
                      onClick={() => handleDelete(album.id)}
                      className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-950/20 rounded-lg transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

              </div>
            ))
          ) : (
            <div className="col-span-full py-16 text-center text-slate-500 border border-dashed border-slate-800 rounded-2xl bg-slate-900/30">
              등록된 앨범이 없습니다. 첫 앨범을 등록해 보세요.
            </div>
          )}
        </div>
      )}

      {/* CRUD 모달 */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/20">
              <h3 className="font-bold text-lg">
                {currentAlbumId ? '앨범 수정' : '앨범 등록'}
              </h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-white p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    앨범 제목 *
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 transition-all text-sm"
                    placeholder="예: AI Beats Vol. 1"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    슬러그 (영문 고유주소) *
                  </label>
                  <input
                    type="text"
                    required
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 transition-all text-sm font-mono"
                    placeholder="예: ai-beats-vol-1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  소속 아티스트 선택 *
                </label>
                <select
                  required
                  value={artistId}
                  onChange={(e) => setArtistId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 transition-all text-sm"
                >
                  {artists.map((artist) => (
                    <option key={artist.id} value={artist.id}>
                      {artist.name} ({artist.slug})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    발매 형태 *
                  </label>
                  <select
                    value={releaseType}
                    onChange={(e) => setReleaseType(e.target.value as ReleaseType)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 transition-all text-sm uppercase"
                  >
                    <option value="single">Single (싱글)</option>
                    <option value="ep">EP (미니)</option>
                    <option value="lp">LP (정규)</option>
                    <option value="compilation">Compilation</option>
                  </select>
                </div>

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
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    장르 (쉼표로 구분)
                  </label>
                  <input
                    type="text"
                    value={genresInput}
                    onChange={(e) => setGenresInput(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 transition-all text-sm"
                    placeholder="예: Pop, Electronic, Lofi"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    무드 (쉼표로 구분)
                  </label>
                  <input
                    type="text"
                    value={moodsInput}
                    onChange={(e) => setMoodsInput(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 transition-all text-sm"
                    placeholder="예: Relaxing, Energetic"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  앨범 설명
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 transition-all text-sm h-20 resize-none"
                  placeholder="앨범 소개 및 제작 노트를 적어주세요."
                />
              </div>

              {/* 아트워크 커버 이미지 업로드 */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  앨범 커버 이미지
                </label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0">
                    {coverFile ? (
                      <img src={URL.createObjectURL(coverFile)} alt="" className="w-full h-full object-cover" />
                    ) : coverUrl ? (
                      <img src={coverUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Library className="w-6 h-6 text-slate-600" />
                    )}
                  </div>
                  
                  <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 cursor-pointer transition-all text-xs font-medium text-slate-300">
                    <Upload className="w-4 h-4 text-slate-400" />
                    커버 선택
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) setCoverFile(file)
                      }}
                    />
                  </label>
                </div>
              </div>

              {/* Modal Actions */}
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
                  {currentAlbumId ? '수정 완료' : '추가 완료'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
    </div>
  )
}
