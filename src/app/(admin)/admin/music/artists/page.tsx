'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Artist } from '@/types/music'
import { Plus, Edit2, Trash2, Upload, Loader2, X, Users } from 'lucide-react'

export default function ArtistsPage() {
  const [artists, setArtists] = useState<Artist[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 폼 상태
  const [currentArtistId, setCurrentArtistId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [isAiGenerated, setIsAiGenerated] = useState(true)

  const supabase = createClient()

  // 아티스트 목록 가져오기
  const fetchArtists = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('artists')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setArtists(data || [])
    } catch (err) {
      console.error('Error fetching artists:', err)
      alert('아티스트 목록을 가져오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchArtists()
  }, [])

  // 이름 작성 시 슬러그 제안
  const handleNameChange = (val: string) => {
    setName(val)
    if (!currentArtistId) {
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
    setCurrentArtistId(null)
    setName('')
    setSlug('')
    setBio('')
    setAvatarUrl('')
    setAvatarFile(null)
    setIsAiGenerated(true)
  }

  // 수정 모달 열기
  const openEditModal = (artist: Artist) => {
    setCurrentArtistId(artist.id)
    setName(artist.name)
    setSlug(artist.slug)
    setBio(artist.bio || '')
    setAvatarUrl(artist.avatar_url || '')
    setIsAiGenerated(artist.is_ai_generated)
    setModalOpen(true)
  }

  // 아티스트 생성/수정 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !slug) {
      alert('이름과 슬러그는 필수 항목입니다.')
      return
    }

    setIsSubmitting(true)
    try {
      let finalAvatarUrl = avatarUrl

      // 파일 업로드 처리
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop()
        const fileName = `avatar_${Date.now()}.${fileExt}`
        const filePath = `avatars/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('artists')
          .upload(filePath, avatarFile)

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from('artists')
          .getPublicUrl(filePath)
        
        finalAvatarUrl = publicUrl
      }

      const payload = {
        name,
        slug,
        bio: bio || null,
        avatar_url: finalAvatarUrl || null,
        is_ai_generated: isAiGenerated,
        updated_at: new Date().toISOString()
      }

      if (currentArtistId) {
        const { error } = await supabase
          .from('artists')
          .update(payload)
          .eq('id', currentArtistId)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('artists')
          .insert([payload])

        if (error) throw error
      }

      closeModal()
      fetchArtists()
    } catch (err: any) {
      console.error('Error saving artist:', err)
      alert(err.message || '아티스트 저장에 실패했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 아티스트 삭제
  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까? 관련 앨범 및 트랙도 함께 삭제될 수 있습니다.')) return

    try {
      const { error } = await supabase
        .from('artists')
        .delete()
        .eq('id', id)

      if (error) throw error
      fetchArtists()
    } catch (err: any) {
      console.error('Error deleting artist:', err)
      alert(err.message || '삭제에 실패했습니다.')
    }
  }

  return (
    <div className="space-y-6 font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">아티스트 관리</h1>
          <p className="text-xs text-slate-400 mt-1">AI 음악 아티스트 프로필을 등록하고 수정합니다.</p>
        </div>
        <button
          id="btn-add-artist"
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          아티스트 추가
        </button>
      </div>

      {/* 리스트 테이블 */}
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
                  <th className="py-4 px-6 w-20">사진</th>
                  <th className="py-4 px-6">이름</th>
                  <th className="py-4 px-6">슬러그</th>
                  <th className="py-4 px-6 w-28">AI 생성</th>
                  <th className="py-4 px-6 w-36">등록일</th>
                  <th className="py-4 px-6 w-24 text-right">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-sm">
                {artists.length > 0 ? (
                  artists.map((artist) => (
                    <tr key={artist.id} className="hover:bg-slate-950/35 transition-all">
                      <td className="py-4 px-6">
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                          {artist.avatar_url ? (
                            <img src={artist.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Users className="w-5 h-5 text-slate-500" />
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6 font-medium text-slate-100">{artist.name}</td>
                      <td className="py-4 px-6 font-mono text-xs text-slate-400">{artist.slug}</td>
                      <td className="py-4 px-6">
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                          artist.is_ai_generated 
                            ? 'bg-violet-500/10 text-violet-400 border-violet-500/20' 
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}>
                          {artist.is_ai_generated ? 'AI' : '일반'}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-slate-400 text-xs">
                        {new Date(artist.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            id={`btn-edit-artist-${artist.id}`}
                            onClick={() => openEditModal(artist)}
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            id={`btn-delete-artist-${artist.id}`}
                            onClick={() => handleDelete(artist.id)}
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
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      등록된 아티스트가 없습니다. 아티스트를 추가해 보세요.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CRUD 모달 */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/20">
              <h3 className="font-bold text-lg">
                {currentArtistId ? '아티스트 수정' : '아티스트 등록'}
              </h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-white p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  아티스트 이름 *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 transition-all text-sm"
                  placeholder="예: Suno AI Melody"
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
                  placeholder="예: suno-ai-melody"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  소개글 (Bio)
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 transition-all text-sm h-24 resize-none"
                  placeholder="아티스트 소개글을 적어주세요."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  프로필 아바타 이미지
                </label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0">
                    {avatarFile ? (
                      <img src={URL.createObjectURL(avatarFile)} alt="" className="w-full h-full object-cover" />
                    ) : avatarUrl ? (
                      <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Users className="w-6 h-6 text-slate-600" />
                    )}
                  </div>
                  
                  <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 cursor-pointer transition-all text-xs font-medium text-slate-300">
                    <Upload className="w-4 h-4 text-slate-400" />
                    사진 선택
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) setAvatarFile(file)
                      }}
                    />
                  </label>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  id="ai-generated-checkbox"
                  type="checkbox"
                  checked={isAiGenerated}
                  onChange={(e) => setIsAiGenerated(e.target.checked)}
                  className="w-4 h-4 accent-violet-600 rounded"
                />
                <label htmlFor="ai-generated-checkbox" className="text-xs text-slate-300 select-none">
                  AI로 생성된 아티스트 프로필입니다
                </label>
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
                  {currentArtistId ? '수정 완료' : '추가 완료'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
    </div>
  )
}
