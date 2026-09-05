'use client'

import { useEffect, useState, useRef } from 'react'
import { FileText, Plus, Edit2, Trash2, Loader2, AlertCircle, Save, X, Upload, Download } from 'lucide-react'
import Script from 'next/script'
import { createClient } from '@/lib/supabase/client'

interface SystemGuide {
  id: string
  title: string
  body: string
  file_url?: string
  file_name?: string
  created_at: string
}

function getStoragePathFromUrl(url: string): string | null {
  if (!url) return null
  const marker = '/storage/v1/object/public/system-guides/'
  const index = url.indexOf(marker)
  if (index !== -1) {
    return decodeURIComponent(url.substring(index + marker.length))
  }
  return null
}

export default function AdminGuidesPage() {
  const [guides, setGuides] = useState<SystemGuide[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  
  // Form state
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingGuide, setEditingGuide] = useState<SystemGuide | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [isParsing, setIsParsing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // File Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [existingFileUrl, setExistingFileUrl] = useState<string | null>(null)
  const [existingFileName, setExistingFileName] = useState<string | null>(null)
  const [isFileDeleted, setIsFileDeleted] = useState(false)

  // Custom Confirm Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean
    id: string
    title: string
  } | null>(null)

  const fetchGuides = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/system-guides')
      if (res.ok) {
        const data = await res.json()
        setGuides(data || [])
      } else {
        console.error('Failed to fetch system guides')
      }
    } catch (err) {
      console.error('Error fetching system guides:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchGuides()
  }, [])

  const handleOpenCreate = () => {
    setEditingGuide(null)
    setTitle('')
    setBody('')
    setSelectedFile(null)
    setExistingFileUrl(null)
    setExistingFileName(null)
    setIsFileDeleted(false)
    setIsFormOpen(true)
  }

  const handleOpenEdit = (guide: SystemGuide) => {
    setEditingGuide(guide)
    setTitle(guide.title)
    setBody(guide.body)
    setSelectedFile(null)
    setExistingFileUrl(guide.file_url || null)
    setExistingFileName(guide.file_name || null)
    setIsFileDeleted(false)
    setIsFormOpen(true)
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsParsing(true)
    try {
      let parsedText = ''
      if (file.type === 'application/pdf') {
        const pdfjsLib = (window as any).pdfjsLib
        if (!pdfjsLib) {
          alert('PDF 파싱 라이브러리가 로드되는 중입니다. 잠시 후 다시 시도해 주세요.')
          setIsParsing(false)
          return
        }

        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
        const arrayBuffer = await file.arrayBuffer()
        const pdf = await pdfjsLib.getDocument({
          data: arrayBuffer,
          cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
          cMapPacked: true
        }).promise
        let fullText = ''
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i)
          const content = await page.getTextContent()
          
          let pageText = ''
          let lastX = -1
          let lastY = -1
          let lastWidth = 0
          
          for (const item of content.items as any[]) {
            const currentX = item.transform?.[4]
            const currentY = item.transform?.[5]
            const str = item.str || ''
            
            if (lastY !== -1) {
              if (Math.abs(currentY - lastY) > 5) {
                pageText += '\n'
              } else {
                // 이전 문자의 우측 끝과 현재 문자의 좌측 시작 사이의 벌어짐 간격(gap) 계산
                const gap = currentX - (lastX + lastWidth)
                // 간격이 2px보다 크고, 아직 공백이 없는 경우에만 띄어쓰기 삽입
                if (gap > 2 && !pageText.endsWith(' ') && !str.startsWith(' ')) {
                  pageText += ' '
                }
              }
            }
            
            pageText += str
            lastX = currentX
            lastY = currentY
            lastWidth = item.width || 0
          }
          fullText += pageText + '\n\n'
        }
        parsedText = fullText
      } else if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
        parsedText = await file.text()
      } else {
        alert('지원하지 않는 파일 형식입니다. PDF 또는 TXT 파일만 업로드할 수 있습니다.')
        setIsParsing(false)
        return
      }

      setTitle(file.name.replace(/\.[^/.]+$/, ""))
      setBody(parsedText.trim())
      setSelectedFile(file)
      setIsFileDeleted(false)
    } catch (err) {
      console.error('File parsing error:', err)
      alert('파일 파싱 중 오류가 발생했습니다. 파일 형식이 정상적인지 확인해 주세요.')
    } finally {
      setIsParsing(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !body.trim()) return

    setActionLoading('save')
    try {
      const supabase = createClient()
      let finalFileUrl = existingFileUrl
      let finalFileName = existingFileName

      // 1. 만약 파일을 명시적으로 삭제했거나 새 파일로 교체하는 경우 기존 실물 파일 삭제
      if (isFileDeleted || selectedFile) {
        if (existingFileUrl) {
          const storagePath = getStoragePathFromUrl(existingFileUrl)
          if (storagePath) {
            await supabase.storage.from('system-guides').remove([storagePath])
          }
        }
        finalFileUrl = null
        finalFileName = null
      }

      // 2. 새 파일 업로드
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop()
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`
        const filePath = `system-guides/${fileName}`

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('system-guides')
          .upload(filePath, selectedFile)

        if (uploadError) {
          const isBucketError = uploadError.message?.toLowerCase().includes('bucket not found')
          throw new Error(
            isBucketError
              ? '파일 업로드에 실패했습니다. (Bucket not found)\n\nSupabase Dashboard의 [Storage] 메뉴로 이동하셔서 [system-guides] 버킷을 "Public"으로 직접 생성해 주시기 바랍니다.'
              : `파일 업로드에 실패했습니다: ${uploadError.message}`
          )
        }

        const { data: { publicUrl } } = supabase.storage
          .from('system-guides')
          .getPublicUrl(filePath)

        finalFileUrl = publicUrl
        finalFileName = selectedFile.name
      }

      if (editingGuide) {
        // Update
        const res = await fetch('/api/system-guides', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            id: editingGuide.id, 
            title: title.trim(), 
            body: body.trim(),
            file_url: finalFileUrl,
            file_name: finalFileName
          })
        })
        if (res.ok) {
          const updated = await res.json()
          setGuides(prev => prev.map(g => g.id === editingGuide.id ? updated : g))
          setIsFormOpen(false)
        } else {
          alert('지침서 수정에 실패했습니다.')
        }
      } else {
        // Create
        const res = await fetch('/api/system-guides', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            title: title.trim(), 
            body: body.trim(),
            file_url: finalFileUrl,
            file_name: finalFileName
          })
        })
        if (res.ok) {
          const created = await res.json()
          setGuides(prev => [...prev, created])
          setIsFormOpen(false)
        } else {
          alert('지침서 등록에 실패했습니다.')
        }
      }
    } catch (err: any) {
      console.error(err)
      alert(err.message || '오류가 발생했습니다.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeleteClick = (id: string, guideTitle: string) => {
    setConfirmModal({
      isOpen: true,
      id,
      title: guideTitle
    })
  }

  const handleConfirmDelete = async () => {
    if (!confirmModal) return
    const { id } = confirmModal
    setActionLoading(id)
    try {
      const res = await fetch(`/api/system-guides?id=${id}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        setGuides(prev => prev.filter(g => g.id !== id))
        setConfirmModal(null)
      } else {
        alert('지침서 삭제에 실패했습니다.')
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
            <FileText className="w-8 h-8 text-primary" />
            공용 지침서 관리 (System Guidelines)
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            AI 음악 프롬프트 및 가사 생성 시 전체 사용자에게 공통으로 최우선 적용될 시스템 지침서들을 제어합니다.
          </p>
          <p className="mt-3 text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
            지침서 관리는 쿠키플레이 관리자단으로 옮겨졌습니다. 스튜디오는 이제 그쪽 지침서를 읽습니다.
          </p>
        </div>
        
        <button
          onClick={handleOpenCreate}
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary hover:bg-[#e51d75] text-black font-semibold text-sm transition-all shadow-lg shadow-primary/20 shrink-0"
        >
          <Plus className="w-4 h-4" />
          새 공용 지침 등록
        </button>
      </div>

      {/* Form Section */}
      {isFormOpen && (
        <div className="bg-[#161616] border border-[#232323] rounded-2xl p-6 space-y-4 animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="flex items-center justify-between border-b border-[#232323] pb-3">
            <h2 className="text-lg font-bold text-primary">
              {editingGuide ? '공용 지침서 수정' : '새 공용 지침서 등록'}
            </h2>
            <button 
              onClick={() => setIsFormOpen(false)}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            {/* File Upload Section */}
            <div className="flex flex-col gap-4 bg-[#0a0a0a]/40 p-4 rounded-xl border border-[#232323]">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-slate-300">지침서 문서 업로드 (PDF / TXT)</h4>
                  <p className="text-[10px] text-slate-500 leading-relaxed">지침서 파일을 업로드하면 파일명과 본문 텍스트가 자동으로 입력 폼에 채워집니다.</p>
                </div>
                <label className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#0a0a0a] border border-[#232323] hover:border-[#292929] cursor-pointer transition-all text-xs font-semibold text-slate-300 shrink-0 select-none">
                  <Upload className="w-4 h-4 text-primary" />
                  {isParsing ? '파싱 진행 중...' : '문서 선택'}
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".txt,application/pdf"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={isParsing}
                  />
                </label>
              </div>

              {/* 업로드 상태 표시 */}
              {(selectedFile || (existingFileName && !isFileDeleted)) && (
                <div className="flex items-center justify-between bg-[#0a0a0a] px-3 py-2 rounded-lg border border-[#232323] text-xs">
                  <div className="flex items-center gap-2 text-slate-300 truncate">
                    <FileText className="w-4 h-4 text-primary shrink-0" />
                    <span className="truncate">{selectedFile ? selectedFile.name : existingFileName}</span>
                    <span className="text-[10px] text-slate-500">
                      {selectedFile ? '(신규 업로드 예정)' : '(기존 파일)'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null)
                      setIsFileDeleted(true)
                      if (fileInputRef.current) fileInputRef.current.value = ''
                    }}
                    className="p-1 hover:bg-slate-800 text-slate-400 hover:text-red-400 rounded-md transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider">지침서 제목</label>
              <input
                type="text"
                placeholder="예: 수노ai 랩 작법 지침"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#232323] rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-primary/50 transition-colors"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider">지침서 본문 (작사 규칙, 프롬프트 구조 등)</label>
              <textarea
                placeholder="가사 및 프롬프트 생성 시 AI가 강제적으로 준수할 프롬프트 구조, 키워드 나열 조건, 금지 사항 등을 자세히 기술하세요."
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={16}
                className="w-full bg-[#0a0a0a] border border-[#232323] rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-primary/50 transition-colors font-mono leading-relaxed"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-4 py-2.5 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={actionLoading === 'save' || isParsing}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-primary hover:bg-[#e51d75] text-black rounded-xl text-xs font-bold transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
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
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="text-sm text-slate-400 font-medium">지침서 데이터를 불러오는 중입니다...</span>
        </div>
      ) : guides.length > 0 ? (
        <div className="grid grid-cols-1 gap-6">
          {guides.map((guide) => (
            <div key={guide.id} className="bg-[#161616] border border-[#232323] rounded-2xl p-6 flex flex-col md:flex-row justify-between gap-6 hover:border-[#292929]/50 transition-all shadow-sm">
              <div className="space-y-3 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary shrink-0" />
                  <h3 className="font-bold text-lg text-slate-200 truncate">{guide.title}</h3>
                </div>
                <div className="bg-[#0a0a0a]/60 border border-[#232323] p-4 rounded-xl text-sm text-slate-350 leading-relaxed font-mono whitespace-pre-wrap max-h-[600px] overflow-y-auto scrollbar-thin">
                  {guide.body}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500 font-mono">
                  <span>등록일: {new Date(guide.created_at).toLocaleString()}</span>
                  {guide.file_url && (
                    <a
                      href={guide.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#0a0a0a] border border-[#232323] text-primary hover:text-[#e51d75] hover:border-[#292929] transition-colors font-sans text-xs"
                      title="원본 지침 파일 다운로드"
                    >
                      <Download className="w-3.5 h-3.5" />
                      {guide.file_name || '다운로드'}
                    </a>
                  )}
                </div>
              </div>

              <div className="flex md:flex-col justify-end gap-2 shrink-0">
                <button
                  onClick={() => handleOpenEdit(guide)}
                  className="flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-all border border-slate-750"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  수정
                </button>
                <button
                  disabled={actionLoading === guide.id}
                  onClick={() => handleDeleteClick(guide.id, guide.title)}
                  className="flex items-center justify-center gap-1.5 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-xl text-xs font-bold transition-all border border-red-500/10 disabled:opacity-50"
                >
                  {actionLoading === guide.id ? (
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
        <div className="bg-[#161616] border border-[#232323] rounded-2xl py-16 text-center text-slate-500 space-y-2">
          <AlertCircle className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="font-medium text-sm">등록된 공용 지침서가 없습니다.</p>
          <p className="text-xs text-slate-600">상단의 [새 공용 지침 등록] 버튼을 클릭해 지침을 생성하세요.</p>
        </div>
      )}

      {/* --- Custom Confirm Modal --- */}
      {confirmModal && confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#161616] border border-[#232323] rounded-2xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-5 pb-3 flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-red-400 shrink-0" />
              <h3 className="text-lg font-bold text-white">공용 지침서 삭제</h3>
            </div>
            
            {/* Message */}
            <div className="px-5 pb-5 text-sm text-slate-300 whitespace-pre-line leading-relaxed">
              정말 공용 지침서 '{confirmModal.title}'을(를) 삭제하시겠습니까?
              삭제된 지침은 AI 프롬프트 생성 시 더 이상 반영되지 않으며 되돌릴 수 없습니다.
            </div>
            
            {/* Action Buttons */}
            <div className="p-4 bg-[#0a0a0a] border-t border-[#232323] flex justify-end gap-2">
              <button 
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
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
      <Script 
        src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js" 
        strategy="lazyOnload" 
      />
    </div>
  )
}
