const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/components/library/LibraryClient.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update the main return wrapper
const oldReturnStart = `  return (
    <div className="max-w-7xl mx-auto px-[32px] py-8 text-on-surface font-sans">
      
      {!selectedPlaylist ? (
        // 1. Folders List View (Initial state)`;

const newReturnStart = `  return (
    <div className="max-w-7xl mx-auto px-[32px] py-8 text-on-surface font-sans flex gap-6 min-h-[80vh]">
      {/* --- SIDEBAR --- */}
      <div className="w-64 shrink-0 flex flex-col gap-4 border-r border-outline-variant/10 pr-6">
        <div className="flex items-center justify-between px-2 mb-2">
          <h2 className="text-xs font-black uppercase tracking-widest text-on-surface-variant">폴더</h2>
          <button 
            onClick={() => setIsFolderManageModalOpen(true)}
            className="text-[10px] text-zinc-400 hover:text-primary transition-colors cursor-pointer"
          >
            관리
          </button>
        </div>

        <div className="flex flex-col gap-1">
          <button 
            onClick={() => setSelectedPlaylist(null)}
            className={\`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold transition-colors \${!selectedPlaylist ? 'bg-primary text-black' : 'text-zinc-300 hover:bg-white/5'}\`}
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
              <span>모든 폴더</span>
            </div>
            <span className="text-xs opacity-70">({customPlaylists.length + systemPlaylists.length})</span>
          </button>
          
          <button 
            onClick={() => setSelectedPlaylist('default')}
            className={\`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold transition-colors \${selectedPlaylist === 'default' ? 'bg-primary text-black' : 'text-zinc-300 hover:bg-white/5'}\`}
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
              <span>기본 폴더</span>
            </div>
          </button>
          
          <button 
            onClick={() => setSelectedPlaylist('liked')}
            className={\`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold transition-colors \${selectedPlaylist === 'liked' ? 'bg-primary text-black' : 'text-zinc-300 hover:bg-white/5'}\`}
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
              <span>좋아요 표시한 음악</span>
            </div>
          </button>
        </div>

        <div className="h-px bg-outline-variant/10 my-2"></div>

        {/* Custom Folder Tree */}
        <div className="flex flex-col gap-1 overflow-y-auto pr-1 pb-20 scrollbar-thin">
          {folderTree.map(node => (
            <FolderTreeNode 
              key={node.id} 
              node={node} 
              selectedPlaylist={selectedPlaylist}
              setSelectedPlaylist={setSelectedPlaylist}
              expandedFolders={expandedFolders}
              handleToggleFolder={handleToggleFolder}
              handleOpenCreateFolder={handleOpenCreateFolder}
              handleDeletePlaylist={handleDeletePlaylist}
              handleOpenEdit={handleOpenEdit}
            />
          ))}
        </div>
      </div>

      {/* --- MAIN CONTENT --- */}
      <div className="flex-1 min-w-0">
      
      {!selectedPlaylist ? (
        // 1. Folders List View (Initial state)`;

if (!content.includes('const FolderTreeNode')) {
  const componentStr = `
function FolderTreeNode({ node, selectedPlaylist, setSelectedPlaylist, expandedFolders, handleToggleFolder, handleOpenCreateFolder, handleDeletePlaylist, handleOpenEdit, depth = 0 }: any) {
  const isExpanded = expandedFolders.has(node.id)
  const isSelected = selectedPlaylist === node.id
  const hasChildren = node.children && node.children.length > 0
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="flex flex-col w-full">
      <div 
        className={\`group flex items-center justify-between py-1.5 px-2 rounded-lg cursor-pointer transition-colors \${isSelected ? 'bg-primary/10 text-primary' : 'text-zinc-300 hover:bg-white/5'}\`}
        style={{ paddingLeft: \`\${depth * 12 + 8}px\` }}
        onClick={() => setSelectedPlaylist(node.id)}
      >
        <div className="flex items-center gap-1.5 overflow-hidden">
          {hasChildren ? (
            <button 
              onClick={(e) => handleToggleFolder(e, node.id)} 
              className="p-0.5 text-zinc-500 hover:text-white shrink-0"
            >
              <svg className={\`w-3.5 h-3.5 fill-current transition-transform \${isExpanded ? 'rotate-90' : ''}\`} viewBox="0 0 24 24"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/></svg>
            </button>
          ) : (
            <div className="w-4.5 shrink-0"></div>
          )}
          <svg className="w-3.5 h-3.5 fill-current shrink-0" viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
          <span className="text-sm truncate font-medium">{node.title}</span>
        </div>

        <div className="relative">
          <button 
            onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
            className="p-1 opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded transition-all shrink-0"
          >
            <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
          </button>
          
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }}></div>
              <div className="absolute right-0 top-6 w-36 bg-[#111a12] border border-emerald-950/40 rounded-lg shadow-xl py-1 z-50 text-left">
                <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); handleOpenCreateFolder(node.id); }} className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 text-white">하위 폴더 생성</button>
                <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); handleOpenEdit(node); }} className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 text-white">이름 변경</button>
                <div className="h-px bg-white/10 my-1"></div>
                <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); handleDeletePlaylist(node.id); }} className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 text-red-400">삭제</button>
              </div>
            </>
          )}
        </div>
      </div>
      
      {isExpanded && hasChildren && (
        <div className="flex flex-col w-full">
          {node.children.map((child: any) => (
            <FolderTreeNode 
              key={child.id} 
              node={child} 
              selectedPlaylist={selectedPlaylist}
              setSelectedPlaylist={setSelectedPlaylist}
              expandedFolders={expandedFolders}
              handleToggleFolder={handleToggleFolder}
              handleOpenCreateFolder={handleOpenCreateFolder}
              handleDeletePlaylist={handleDeletePlaylist}
              handleOpenEdit={handleOpenEdit}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}
`;
  content = content.replace("export function LibraryClient", componentStr + "\nexport function LibraryClient");
}

content = content.replace(oldReturnStart, newReturnStart);

// Add Move to Folder button in song menu
const oldMoveBtn = `<button
                                        onClick={() => handleMoveTrack(track.id, null)}
                                        className="w-full text-left px-4 py-2.5 text-xs font-semibold text-red-400 hover:bg-white/5 transition-colors cursor-pointer flex items-center gap-2"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                        {uiLanguage === 'KO' ? '이 플레이리스트에서 빼기' : uiLanguage === 'JA' ? 'プレイリストから削除' : 'Remove from Playlist'}
                                      </button>`;

const newMoveBtn = `<button
                                        onClick={() => { setMoveTrackModalData(track); setOpenPlaylistTrackMenuId(null); }}
                                        className="w-full text-left px-4 py-2.5 text-xs font-semibold text-white hover:bg-white/5 transition-colors cursor-pointer flex items-center gap-2"
                                      >
                                        <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
                                        {uiLanguage === 'KO' ? '폴더로 이동' : 'Move to folder'}
                                      </button>
                                      ` + oldMoveBtn;

if (!content.includes("setMoveTrackModalData")) {
  content = content.replace(oldMoveBtn, newMoveBtn);
  // Add state for MoveTrackModal
  content = content.replace(
    "const [parentFolderId, setParentFolderId] = useState<string | null>(null)",
    "const [parentFolderId, setParentFolderId] = useState<string | null>(null)\n  const [moveTrackModalData, setMoveTrackModalData] = useState<any | null>(null)"
  );
}

// Ensure portals for MoveTrackModal and FolderManagementModal exist
const modalsCode = `
          {/* Move to Folder Modal */}
          {moveTrackModalData && createPortal(
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm grid place-items-center z-50 p-4">
              <div className="bg-[#1C1C1E] border border-outline-variant/10 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden text-left">
                <div className="p-4 border-b border-white/10 font-bold text-white text-lg">
                  폴더로 이동
                </div>
                <div className="p-2 max-h-[60vh] overflow-y-auto">
                  <button 
                    onClick={() => { handleMoveToFolderSubmit(moveTrackModalData.id, null); setMoveTrackModalData(null); }}
                    className="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:bg-white/5 rounded flex items-center gap-2 mb-1"
                  >
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
                    기본 폴더
                  </button>
                  <div className="flex flex-col gap-1">
                    {folderTree.map(node => (
                      <FolderTreeNode 
                        key={node.id} 
                        node={node} 
                        selectedPlaylist={null}
                        setSelectedPlaylist={(id) => { handleMoveToFolderSubmit(moveTrackModalData.id, id); setMoveTrackModalData(null); }}
                        expandedFolders={expandedFolders}
                        handleToggleFolder={handleToggleFolder}
                        handleOpenCreateFolder={() => {}}
                        handleDeletePlaylist={() => {}}
                        handleOpenEdit={() => {}}
                      />
                    ))}
                  </div>
                </div>
                <div className="p-4 border-t border-white/10 flex justify-end">
                  <button onClick={() => setMoveTrackModalData(null)} className="px-4 py-2 text-sm text-zinc-400 hover:text-white">취소</button>
                </div>
              </div>
            </div>,
            document.body
          )}
          
          {/* Folder Management Modal */}
          {isFolderManageModalOpen && createPortal(
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm grid place-items-center z-50 p-4">
              <div className="bg-[#1C1C1E] border border-outline-variant/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden text-left flex flex-col max-h-[80vh]">
                <div className="p-5 border-b border-white/10 font-bold text-white text-xl flex justify-between items-center">
                  <span>폴더 관리</span>
                  <button onClick={() => setIsFolderManageModalOpen(false)} className="text-zinc-500 hover:text-white"><X className="w-5 h-5" /></button>
                </div>
                
                <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-6">
                  <div>
                    <div className="text-xs font-bold text-zinc-400 mb-2">새 폴더 만들기</div>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="새 폴더 이름"
                        className="flex-1 bg-[#141415] border border-outline-variant/20 rounded-lg p-3 text-white focus:outline-none focus:border-primary/50 text-sm"
                      />
                      <button 
                        onClick={() => { handleSaveEdit(); setEditTitle(''); }}
                        disabled={!editTitle}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg disabled:opacity-50"
                      >
                        추가
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-bold text-zinc-400 mb-2">시스템 폴더</div>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between p-4 bg-[#141415] rounded-xl border border-white/5">
                        <div className="flex items-center gap-3">
                          <svg className="w-5 h-5 fill-current text-zinc-400" viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-white">기본 폴더</span>
                          </div>
                        </div>
                        <span className="text-xs text-zinc-500">수정 불가</span>
                      </div>
                      
                      <div className="flex items-center justify-between p-4 bg-[#141415] rounded-xl border border-white/5">
                        <div className="flex items-center gap-3">
                          <svg className="w-5 h-5 fill-current text-zinc-400" viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-white">숨긴 곡</span>
                          </div>
                        </div>
                        <span className="text-xs text-zinc-500">수정 불가</span>
                      </div>
                      
                      <div className="flex items-center justify-between p-4 bg-[#141415] rounded-xl border border-white/5">
                        <div className="flex items-center gap-3">
                          <Upload className="w-5 h-5 text-zinc-400" />
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-white">업로드</span>
                          </div>
                        </div>
                        <span className="text-xs text-zinc-500">수정 불가</span>
                      </div>
                      
                      <div className="flex items-center justify-between p-4 bg-[#141415] rounded-xl border border-white/5">
                        <div className="flex items-center gap-3">
                          <X className="w-5 h-5 text-zinc-400 bg-white/10 rounded-full" />
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-white">생성 실패</span>
                          </div>
                        </div>
                        <span className="text-xs text-zinc-500">수정 불가</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 border-t border-white/10 flex justify-end">
                  <button onClick={() => setIsFolderManageModalOpen(false)} className="text-sm text-blue-500 hover:text-blue-400 px-2 font-bold">닫기</button>
                </div>
              </div>
            </div>,
            document.body
          )}
`;

if (!content.includes("Move to Folder Modal")) {
  content = content.replace("{/* Custom Confirm Modal */}", modalsCode + "\n          {/* Custom Confirm Modal */}");
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully patched LibraryClient.tsx');
