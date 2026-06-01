const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/components/profile/ProfileClient.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add state for newQuickFolderName and loading
const stateInjection = `
  const [newQuickFolderName, setNewQuickFolderName] = useState('')
  const [isQuickCreating, setIsQuickCreating] = useState(false)

  const handleQuickCreateFolder = async () => {
    if (!newQuickFolderName.trim()) return showToast('폴더 이름을 입력해주세요.', 'error')
    setIsQuickCreating(true)
    try {
      const descriptionToSave = JSON.stringify({ type: 'playlist', parent_id: null })
      const res = await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newQuickFolderName.trim(),
          description: descriptionToSave,
          cover_url: '',
          genre: '',
          is_published: false,
          exposure_order: null
        })
      })
      if (res.ok) {
        fetchPlaylists()
        setNewQuickFolderName('')
        showToast('새 폴더가 생성되었습니다.', 'success')
      } else {
        const err = await res.json()
        showToast('폴더 생성 실패: ' + (err.error || '오류가 발생했습니다.'), 'error')
      }
    } catch (e) {
      showToast('네트워크 오류가 발생했습니다.', 'error')
    } finally {
      setIsQuickCreating(false)
    }
  }
`;

if (!content.includes('newQuickFolderName')) {
  // Insert after isFolderManageModalOpen
  content = content.replace(
    /const \[isFolderManageModalOpen, setIsFolderManageModalOpen\] = useState\(false\)/,
    match => match + '\n' + stateInjection
  );
}

// 2. Replace the Folder Management Modal content
// The current modal starts with `{/* Folder Management Modal */}`
const oldModalRegex = /\{\/\* Folder Management Modal \*\/\}\s*\{isFolderManageModalOpen &&[\s\S]*?\{\/\* Beautiful Custom Toast Notifications \*\/\}/;

const newModalCode = `{/* Folder Management Modal */}
      {isFolderManageModalOpen && typeof window !== 'undefined' && require('react-dom').createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm grid place-items-center z-[9999] p-4" onClick={(e) => e.stopPropagation()}>
          <div className="bg-white rounded w-full max-w-lg shadow-2xl overflow-hidden text-left flex flex-col max-h-[80vh] text-black" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-200">
              <h2 className="text-xl font-bold">폴더 관리</h2>
            </div>
            
            <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-6">
              {/* 새 폴더 만들기 */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-gray-700">새 폴더 만들기</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={newQuickFolderName}
                    onChange={(e) => setNewQuickFolderName(e.target.value)}
                    placeholder="아침"
                    className="flex-1 border border-blue-400 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 bg-white"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleQuickCreateFolder()
                    }}
                  />
                  <button 
                    onClick={handleQuickCreateFolder}
                    disabled={isQuickCreating}
                    className="bg-[#1877F2] hover:bg-blue-600 text-white px-5 py-2 rounded text-sm font-bold transition-colors whitespace-nowrap"
                  >
                    {isQuickCreating ? '추가 중...' : '추가'}
                  </button>
                </div>
              </div>

              {/* 시스템 폴더 */}
              <div className="flex flex-col gap-3">
                <label className="text-sm font-semibold text-gray-700">시스템 폴더</label>
                
                <div className="flex flex-col gap-2">
                  {/* 기본 폴더 */}
                  <div className="flex items-center justify-between p-3 border border-gray-200 rounded">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 flex items-center justify-center bg-gray-400 rounded">
                        <svg className="w-4 h-4 text-white fill-current" viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold">기본 폴더</span>
                        <span className="text-xs text-gray-500">{visibleLooseTracksRaw.filter(h => !h.playlist_id).length} 곡</span>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400">수정 불가</span>
                  </div>

                  {/* 숨긴 곡 */}
                  <div className="flex items-center justify-between p-3 border border-gray-200 rounded">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 flex items-center justify-center bg-gray-400 rounded">
                        <svg className="w-4 h-4 text-white fill-current" viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold">숨긴 곡</span>
                        <span className="text-xs text-gray-500">{visibleLooseTracksRaw.filter(h => h.status === 'hidden').length} 곡</span>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400">수정 불가</span>
                  </div>

                  {/* 업로드 */}
                  <div className="flex items-center justify-between p-3 border border-gray-200 rounded">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 flex items-center justify-center bg-gray-400 rounded">
                        <svg className="w-4 h-4 text-white fill-current" viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold">업로드</span>
                        <span className="text-xs text-gray-500">{visibleLooseTracksRaw.filter(h => h.source === 'upload' || h.type === 'upload').length} 곡</span>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400">수정 불가</span>
                  </div>

                  {/* 생성 실패 */}
                  <div className="flex items-center justify-between p-3 border border-gray-200 rounded">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 flex items-center justify-center bg-gray-400 rounded">
                        <svg className="w-4 h-4 text-white fill-current" viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold">생성 실패</span>
                        <span className="text-xs text-gray-500">{visibleLooseTracksRaw.filter(h => h.status === 'error' || h.status === 'failed').length} 곡</span>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400">수정 불가</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 flex justify-end">
              <button onClick={() => setIsFolderManageModalOpen(false)} className="text-sm text-[#1877F2] font-bold hover:underline cursor-pointer">
                닫기
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Beautiful Custom Toast Notifications */}`;

content = content.replace(oldModalRegex, newModalCode);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated modal UI in ProfileClient.tsx!');
