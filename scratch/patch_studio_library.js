const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/components/studio/StudioClient.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add state to LibraryView
const oldLibraryViewState = `function LibraryView({
  history,
  t,
  uiLanguage,
  openHistoryItem,
  deleteHistoryItem,
  searchTerm,
  setSearchTerm,
  currentPage,
  setCurrentPage,
  selectedItem,
  setSelectedItem,
  setCurrentTab,
  playlists,
  onRefreshHistory,
  user,
  profile
}: LibraryViewProps) {
  const itemsPerPage = 15 // 15 items per page
  const [deletedIds, setDeletedIds] = useState<string[]>(() => readJson(STORAGE_KEYS.deletedDummyItems, []))`;

const newLibraryViewState = `function LibraryView({
  history,
  t,
  uiLanguage,
  openHistoryItem,
  deleteHistoryItem,
  searchTerm,
  setSearchTerm,
  currentPage,
  setCurrentPage,
  selectedItem,
  setSelectedItem,
  setCurrentTab,
  playlists,
  onRefreshHistory,
  user,
  profile
}: LibraryViewProps) {
  const itemsPerPage = 15 // 15 items per page
  const [deletedIds, setDeletedIds] = useState<string[]>(() => readJson(STORAGE_KEYS.deletedDummyItems, []))
  
  // Folder Management State
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [isFolderManageModalOpen, setIsFolderManageModalOpen] = useState(false)
  
  const handleToggleFolder = (e: React.MouseEvent, folderId: string) => {
    e.stopPropagation()
    setExpandedFolders(prev => {
      const next = new Set(prev)
      if (next.has(folderId)) next.delete(folderId)
      else next.add(folderId)
      return next
    })
  }

  const buildFolderTree = (folders: any[]) => {
    const map = new Map<string, any>()
    folders.forEach(f => map.set(f.id, { ...f, children: [] }))
    const rootNodes: any[] = []
    map.forEach(node => {
      if (node.parent_id && map.has(node.parent_id)) {
        map.get(node.parent_id).children.push(node)
      } else {
        rootNodes.push(node)
      }
    })
    return rootNodes
  }

  const folderTree = buildFolderTree(playlists.filter(p => !p.isSystem))
`;

if (!content.includes('const folderTree = buildFolderTree')) {
  content = content.replace(oldLibraryViewState, newLibraryViewState);
}

// 2. Add FolderTreeNode definition at the top if it doesn't exist
if (!content.includes('function FolderTreeNode')) {
  const folderTreeNodeStr = `
function FolderTreeNode({ node, selectedPlaylist, setSelectedPlaylist, expandedFolders, handleToggleFolder, depth = 0 }: any) {
  const isExpanded = expandedFolders.has(node.id)
  const isSelected = selectedPlaylist === node.id
  const hasChildren = node.children && node.children.length > 0

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
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}
`;
  content = content.replace("export function StudioClient", folderTreeNodeStr + "\nexport function StudioClient");
}


// 3. Replace the return statement wrapper
const oldReturnStart = `  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between border-b border-outline-variant/10 pb-4">`;

const newReturnStart = `  return (
    <div className="flex gap-6 min-h-[80vh]">
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
            onClick={() => setSelectedPlaylistFilter('all')}
            className={\`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold transition-colors \${selectedPlaylistFilter === 'all' ? 'bg-primary text-black' : 'text-zinc-300 hover:bg-white/5'}\`}
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
              <span>모든 폴더</span>
            </div>
            <span className="text-xs opacity-70">({combinedHistory.length})</span>
          </button>
          
          <button 
            onClick={() => setSelectedPlaylistFilter('default')}
            className={\`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold transition-colors \${selectedPlaylistFilter === 'default' ? 'bg-primary text-black' : 'text-zinc-300 hover:bg-white/5'}\`}
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
              <span>기본 폴더</span>
            </div>
          </button>
          
          <button 
            onClick={() => setSelectedPlaylistFilter('liked')}
            className={\`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold transition-colors \${selectedPlaylistFilter === 'liked' ? 'bg-primary text-black' : 'text-zinc-300 hover:bg-white/5'}\`}
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
              selectedPlaylist={selectedPlaylistFilter}
              setSelectedPlaylist={setSelectedPlaylistFilter}
              expandedFolders={expandedFolders}
              handleToggleFolder={handleToggleFolder}
            />
          ))}
        </div>
      </div>

      {/* --- MAIN CONTENT --- */}
      <div className="flex-1 min-w-0 space-y-6">
      
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between border-b border-outline-variant/10 pb-4">`;

if (!content.includes('--- SIDEBAR ---')) {
  content = content.replace(oldReturnStart, newReturnStart);
}

// 4. Remove the old Playlist Filter Dropdown from Header Controls
const oldPlaylistFilter = `<div className="relative z-10 w-48 shrink-0">
            <select
              value={selectedPlaylistFilter}
              onChange={(e) => {
                setSelectedPlaylistFilter(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full appearance-none bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-primary/50 transition-colors"
            >
              <option value="all">{uiLanguage === 'KO' ? '전체 보기' : uiLanguage === 'JA' ? 'すべて表示' : 'All Tracks'}</option>
              <option value="liked">❤️ {uiLanguage === 'KO' ? '좋아요' : uiLanguage === 'JA' ? 'いいね' : 'Liked'}</option>
              <option value="default">📁 {uiLanguage === 'KO' ? '기본 보관함' : uiLanguage === 'JA' ? 'デフォルト' : 'Default Library'}</option>
              {playlists.map(p => (
                <option key={p.id} value={p.id}>📁 {p.title}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-zinc-500 pointer-events-none" />
          </div>`;

content = content.replace(oldPlaylistFilter, "");

// 5. Update Move to Playlist dropdown in the table to use "Move to folder" modal
const oldMoveToPlaylist = `<div className="relative" title={uiLanguage === 'KO' ? '플레이리스트에 추가/이동' : uiLanguage === 'JA' ? 'プレイリストに追加' : 'Add to Playlist'}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setActivePlaylistMenuId(activePlaylistMenuId === item.id ? null : item.id)
                              }}
                              disabled={item.id.startsWith('dummy-')}
                              className="text-zinc-500 hover:text-primary p-1.5 rounded hover:bg-white/[0.05] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                            
                            {activePlaylistMenuId === item.id && (
                              <div className="absolute right-0 top-8 w-48 bg-[#111a12] border border-emerald-950/40 rounded-xl shadow-xl py-1 z-50">
                                <div className="px-3 py-1 text-[10px] font-black text-on-surface-variant/60 uppercase tracking-wider text-left">
                                  {uiLanguage === 'KO' ? '플레이리스트에 추가' : uiLanguage === 'JA' ? 'プレイリストに追加' : 'Add to Playlist'}
                                </div>
                                <div className="max-h-40 overflow-y-auto scrollbar-none">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      if (item.id.startsWith('dummy-')) {
                                        setDummyPlaylistId(item.id, 'default')
                                      } else {
                                        updateSongPlaylist(item.id, null)
                                      }
                                      setActivePlaylistMenuId(null)
                                    }}
                                    className="w-full text-left px-4 py-2 text-xs text-on-surface hover:bg-white/5 transition-colors cursor-pointer font-semibold"
                                  >
                                    📁 {uiLanguage === 'KO' ? '기본 보관함' : uiLanguage === 'JA' ? 'デフォルト' : 'Default Library'}
                                  </button>
                                  {playlists.map(p => (
                                    <button
                                      key={p.id}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        if (item.id.startsWith('dummy-')) {
                                          setDummyPlaylistId(item.id, p.id)
                                        } else {
                                          updateSongPlaylist(item.id, p.id)
                                        }
                                        setActivePlaylistMenuId(null)
                                      }}
                                      className="w-full text-left px-4 py-2 text-xs text-on-surface hover:bg-white/5 transition-colors cursor-pointer truncate font-semibold"
                                    >
                                      📁 {p.title}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>`;

const newMoveToFolderBtn = `<button
                            onClick={(e) => {
                              e.stopPropagation()
                              setMoveTrackModalData(item)
                            }}
                            disabled={item.id.startsWith('dummy-')}
                            className="text-zinc-500 hover:text-primary p-1.5 rounded hover:bg-white/[0.05] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            title={uiLanguage === 'KO' ? '폴더로 이동' : 'Move to Folder'}
                          >
                            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
                          </button>`;

if (content.includes(oldMoveToPlaylist)) {
  content = content.replace(oldMoveToPlaylist, newMoveToFolderBtn);
  content = content.replace("const [activePlaylistMenuId, setActivePlaylistMenuId] = useState<string | null>(null)", "const [activePlaylistMenuId, setActivePlaylistMenuId] = useState<string | null>(null)\n  const [moveTrackModalData, setMoveTrackModalData] = useState<any | null>(null)");
}


// 6. Add portals to the end of the return statement
const oldEnd = `  return (
    <div className="flex gap-6 min-h-[80vh]">`; // This is earlier in the file, need to find the end of LibraryView
    
const endRegex = /<\/div>\s*<\/div>\s*\)\s*}\s*export function/m;
const endMatch = content.match(endRegex);

if (endMatch && !content.includes('Folder Management Modal')) {
  const portalsCode = `
      {/* Move to Folder Modal */}
      {moveTrackModalData && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm grid place-items-center z-50 p-4" onClick={(e) => e.stopPropagation()}>
          <div className="bg-[#1C1C1E] border border-outline-variant/10 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden text-left" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-white/10 font-bold text-white text-lg">
              폴더로 이동
            </div>
            <div className="p-2 max-h-[60vh] overflow-y-auto">
              <button 
                onClick={() => { 
                  if (moveTrackModalData.id.startsWith('dummy-')) {
                    setDummyPlaylistId(moveTrackModalData.id, null);
                  } else {
                    updateSongPlaylist(moveTrackModalData.id, null);
                  }
                  setMoveTrackModalData(null); 
                }}
                className="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:bg-white/5 rounded flex items-center gap-2 mb-1 cursor-pointer"
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
                    setSelectedPlaylist={(id: string) => { 
                      if (moveTrackModalData.id.startsWith('dummy-')) {
                        setDummyPlaylistId(moveTrackModalData.id, id);
                      } else {
                        updateSongPlaylist(moveTrackModalData.id, id);
                      }
                      setMoveTrackModalData(null); 
                    }}
                    expandedFolders={expandedFolders}
                    handleToggleFolder={handleToggleFolder}
                  />
                ))}
              </div>
            </div>
            <div className="p-4 border-t border-white/10 flex justify-end">
              <button onClick={() => setMoveTrackModalData(null)} className="px-4 py-2 text-sm text-zinc-400 hover:text-white cursor-pointer">취소</button>
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
              <span>스튜디오 보관함 (폴더 관리 메뉴는 내음원관리 탭에서 가능합니다.)</span>
              <button onClick={() => setIsFolderManageModalOpen(false)} className="text-zinc-500 hover:text-white">닫기</button>
            </div>
            
            <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-6">
              <p className="text-sm text-zinc-400 leading-relaxed">
                현재 버전에서는 "내음원관리(Library)" 탭에서 폴더를 생성하고 삭제할 수 있습니다. <br/><br/>
                상단 네비게이션에서 [내음원관리]로 이동하여 폴더를 관리해주세요!
              </p>
            </div>
            
            <div className="p-4 border-t border-white/10 flex justify-end">
              <button onClick={() => setIsFolderManageModalOpen(false)} className="text-sm text-blue-500 hover:text-blue-400 px-2 font-bold cursor-pointer">닫기</button>
            </div>
          </div>
        </div>,
        document.body
      )}
      </div>
    </div>
  )
}
export function`;
  content = content.replace(endMatch[0], portalsCode);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully patched StudioClient.tsx');
