'use client'

import { useEffect, useState } from 'react'
import { Megaphone, Plus, Edit2, Trash2, Loader2, AlertCircle, Save, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Announcement {
  id: string
  title: string
  content: string
  created_at: string
}

export default function AdminNoticesPage() {
  const [notices, setNotices] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  
  // Form state
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingNotice, setEditingNotice] = useState<Announcement | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  // Confirm Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean
    id: string
    title: string
  } | null>(null)

  const fetchNotices = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/announcements')
      if (res.ok) {
        const data = await res.json()
        setNotices(data || [])
      } else {
        console.error('Failed to fetch announcements')
      }
    } catch (err) {
      console.error('Error fetching announcements:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNotices()
  }, [])

  const handleOpenCreate = () => {
    setEditingNotice(null)
    setTitle('')
    setContent('')
    setIsFormOpen(true)
  }

  const handleOpenEdit = (notice: Announcement) => {
    setEditingNotice(notice)
    setTitle(notice.title)
    setContent(notice.content)
    setIsFormOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !content.trim()) return

    setActionLoading('save')
    try {
      if (editingNotice) {
        // Update
        const res = await fetch('/api/announcements', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            id: editingNotice.id, 
            title: title.trim(), 
            content: content.trim()
          })
        })
        if (res.ok) {
          const updated = await res.json()
          setNotices(prev => prev.map(n => n.id === editingNotice.id ? updated : n))
          setIsFormOpen(false)
        } else {
          alert('공지사항 수정에 실패했습니다.')
        }
      } else {
        // Create
        const res = await fetch('/api/announcements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            title: title.trim(), 
            content: content.trim()
          })
        })
        if (res.ok) {
          const created = await res.json()
          setNotices(prev => [created, ...prev])
          setIsFormOpen(false)
        } else {
          alert('공지사항 등록에 실패했습니다.')
        }
      }
    } catch (err: any) {
      console.error(err)
      alert(err.message || '오류가 발생했습니다.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeleteClick = (id: string, noticeTitle: string) => {
    setConfirmModal({
      isOpen: true,
      id,
      title: noticeTitle
    })
  }

  const handleConfirmDelete = async () => {
    if (!confirmModal) return
    const { id } = confirmModal
    setActionLoading(id)
    try {
      const res = await fetch(`/api/announcements?id=${id}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        setNotices(prev => prev.filter(n => n.id !== id))
        setConfirmModal(null)
      } else {
        alert('공지사항 삭제에 실패했습니다.')
      }
    } catch (err) {
      console.error(err)
      alert('오류가 발생했습니다.')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="space-y-6 font-sans text-slate-100">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
            <Megaphone className="w-8 h-8 text-[#e3fe06]" />
            공지사항 관리 (Announcements)
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            사용자에게 노출될 시스템 공지사항 및 업데이트 내용을 관리합니다.
          </p>
        </div>
        
        <button
          onClick={handleOpenCreate}
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#e3fe06] hover:bg-[#cce305] text-black font-semibold text-sm transition-all shadow-lg shadow-[#e3fe06]/20 shrink-0"
        >
          <Plus className="w-4 h-4" />
          새 공지사항 등록
        </button>
      </div>

      {/* Form Section */}
      {isFormOpen && (
        <div className="bg-[#161d16] border border-[#242c24] rounded-2xl p-6 space-y-4 animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="flex items-center justify-between border-b border-[#242c24] pb-3">
            <h2 className="text-lg font-bold text-[#e3fe06]">
              {editingNotice ? '공지사항 수정' : '새 공지사항 등록'}
            </h2>
            <button 
              onClick={() => setIsFormOpen(false)}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider">공지사항 제목</label>
              <input
                type="text"
                placeholder="예: 2026년 5월 시스템 업데이트 안내"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full bg-[#091009] border border-[#242c24] rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-[#e3fe06]/50 transition-colors"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider">공지사항 내용</label>
              <textarea
                placeholder="공지할 내용을 상세하게 작성해주세요."
                value={content}
                onChange={e => setContent(e.target.value)}
                rows={12}
                className="w-full bg-[#091009] border border-[#242c24] rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-[#e3fe06]/50 transition-colors leading-relaxed whitespace-pre-wrap"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-4 py-2.5 text-xs font-semibold text-slate-400 hover:text-white hover:bg-[#091009] rounded-xl transition-all"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={actionLoading === 'save'}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-[#e3fe06] hover:bg-[#cce305] text-black rounded-xl text-xs font-bold transition-all shadow-lg shadow-[#e3fe06]/20 disabled:opacity-50"
              >
                {actionLoading === 'save' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                저장하기
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List Section */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#e3fe06]" />
          <span className="text-sm text-slate-400 font-medium">공지사항 데이터를 불러오는 중입니다...</span>
        </div>
      ) : notices.length > 0 ? (
        <div className="grid grid-cols-1 gap-6">
          {notices.map((notice) => (
            <div key={notice.id} className="bg-[#161d16] border border-[#242c24] rounded-2xl p-6 flex flex-col md:flex-row justify-between gap-6 hover:border-[#3d4a3d]/50 transition-all shadow-sm">
              <div className="space-y-3 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Megaphone className="w-5 h-5 text-[#e3fe06] shrink-0" />
                  <h3 className="font-bold text-lg text-slate-200 truncate">{notice.title}</h3>
                </div>
                <div className="bg-[#091009]/60 border border-[#242c24] p-4 rounded-xl text-sm text-slate-350 leading-relaxed whitespace-pre-wrap max-h-[300px] overflow-y-auto scrollbar-thin">
                  {notice.content}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                  <span>작성일: {new Date(notice.created_at).toLocaleString()}</span>
                </div>
              </div>

              <div className="flex md:flex-col justify-end gap-2 shrink-0">
                <button
                  onClick={() => handleOpenEdit(notice)}
                  className="flex items-center justify-center gap-1.5 px-4 py-2 bg-[#091009] hover:bg-[#161d16] text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-all border border-[#242c24]"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  수정
                </button>
                <button
                  disabled={actionLoading === notice.id}
                  onClick={() => handleDeleteClick(notice.id, notice.title)}
                  className="flex items-center justify-center gap-1.5 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-xl text-xs font-bold transition-all border border-red-500/10 disabled:opacity-50"
                >
                  {actionLoading === notice.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-[#161d16] border border-[#242c24] rounded-2xl py-16 text-center text-slate-500 space-y-2">
          <AlertCircle className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="font-medium text-sm">등록된 공지사항이 없습니다.</p>
          <p className="text-xs text-slate-600">상단의 [새 공지사항 등록] 버튼을 클릭해 작성해보세요.</p>
        </div>
      )}

      {/* Custom Confirm Modal */}
      {confirmModal && confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#161d16] border border-[#242c24] rounded-2xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 pb-3 flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-red-400 shrink-0" />
              <h3 className="text-lg font-bold text-white">공지사항 삭제</h3>
            </div>
            
            <div className="px-5 pb-5 text-sm text-slate-300 whitespace-pre-line leading-relaxed">
              정말 공지사항 '{confirmModal.title}'을(를) 삭제하시겠습니까?
              이 작업은 되돌릴 수 없습니다.
            </div>
            
            <div className="p-4 bg-[#091009] border-t border-[#242c24] flex justify-end gap-2">
              <button 
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white hover:bg-[#161d16] rounded-lg transition-all"
              >
                취소
              </button>
              <button 
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs font-bold bg-red-600 hover:bg-red-500 text-white rounded-lg transition-all"
              >
                삭제하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
