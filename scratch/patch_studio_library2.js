const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/components/studio/StudioClient.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. We need to add state for Folder Tree. We tried to do it before but maybe the old script failed.
const folderStateCode = `
  // Folder Management State
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [isFolderManageModalOpen, setIsFolderManageModalOpen] = useState(false)
  const [moveTrackModalData, setMoveTrackModalData] = useState<any | null>(null)
  const [activePlaylistMenuId, setActivePlaylistMenuId] = useState<string | null>(null)
  
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
      // Use parsed description to get parent_id
      const parsed = typeof node.description === 'string' && node.description.startsWith('{') 
        ? JSON.parse(node.description) 
        : { parent_id: null };
        
      if (parsed.parent_id && map.has(parsed.parent_id)) {
        map.get(parsed.parent_id).children.push(node)
      } else {
        rootNodes.push(node)
      }
    })
    return rootNodes
  }

  const folderTree = buildFolderTree(playlists.filter(p => !p.isSystem))
`;

// Insert the state before the return statement if it's not there
if (!content.includes('const [isFolderManageModalOpen')) {
  content = content.replace('return (\n    <div className="mx-auto', folderStateCode + '\n  return (\n    <div className="mx-auto');
}

// 2. Add FolderTreeNode if not exists
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
if (!content.includes('function FolderTreeNode')) {
  content = content.replace("export function StudioClient", folderTreeNodeStr + "\nexport function StudioClient");
}

// 3. Replace the layout
const layoutRegex = /return \(\s*<div className="mx-auto max-w-7xl px-6 py-8 font-sans space-y-6 text-on-surface">([\s\S]*?)\{\/\* Playlist Filter Chips \*\/\}([\s\S]*?)<div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">([\s\S]*?)<\/div>\s*\{\/\* Main Full-Width Table \*\/\}/m;

const newLayout = `return (
    <div className="mx-auto max-w-7xl px-6 py-8 font-sans text-on-surface">
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
$1
          {/* Main Full-Width Table */}`;

if (!content.includes('--- SIDEBAR ---')) {
  content = content.replace(layoutRegex, newLayout);
}

// 4. Update the "Add to Playlist" button to "Move to Folder"
const oldAddPlaylistBtn = `<div className="relative" title={uiLanguage === 'KO' ? '플레이리스트에 추가/이동' : uiLanguage === 'JA' ? 'プレイリストに追加' : 'Add to Playlist'}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setActivePlaylistMenuId(activePlaylistMenuId === item.id ? null : item.id)
                              }}`;

const newMoveFolderBtn = `<div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setMoveTrackModalData(item)
                              }}
                              className="text-zinc-500 hover:text-primary p-1.5 rounded hover:bg-white/[0.05] transition-colors cursor-pointer"
                              title={uiLanguage === 'KO' ? '폴더로 이동' : 'Move to Folder'}
                            >
                              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
                            </button>
                            <div className="hidden">
                            <button onClick={(e) => {
                              e.stopPropagation()
                              setActivePlaylistMenuId(activePlaylistMenuId === item.id ? null : item.id)
                            }}`;

if (content.includes(oldAddPlaylistBtn)) {
  content = content.replace(oldAddPlaylistBtn, newMoveFolderBtn);
  // Hide the old dropdown by closing the hidden div after it... actually replacing it completely is better.
}

// Let's replace the whole table's manage section if possible, or just the dropdown.
const tableDropdownRegex = /<div className="relative" title=\{uiLanguage === 'KO' \? '플레이리스트에 추가\/이동' : uiLanguage === 'JA' \? 'プレイリストに追加' : 'Add to Playlist'\}>([\s\S]*?)<\/div>\s*<\/div>\s*<\/td>/g;

const tableDropdownReplacement = `<button
                            onClick={(e) => {
                              e.stopPropagation()
                              setMoveTrackModalData(item)
                            }}
                            className="text-zinc-500 hover:text-primary p-1.5 rounded hover:bg-white/[0.05] transition-colors cursor-pointer"
                            title={uiLanguage === 'KO' ? '폴더로 이동' : 'Move to Folder'}
                          >
                            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
                          </button>
                        </div>
                      </td>`;

content = content.replace(tableDropdownRegex, tableDropdownReplacement);


// 5. Add Modals at the end and close the flex container
const oldEnd = /<\/div>\s*<\/div>\s*\)\s*}\s*export function/m;

const newEnd = `
        {/* Move to Folder Modal */}
        {moveTrackModalData && typeof window !== 'undefined' && require('react-dom').createPortal(
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm grid place-items-center z-[9999] p-4" onClick={(e) => e.stopPropagation()}>
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
                      // Call your update playlist api
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
                          // update via api
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
        {isFolderManageModalOpen && typeof window !== 'undefined' && require('react-dom').createPortal(
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm grid place-items-center z-[9999] p-4" onClick={(e) => e.stopPropagation()}>
            <div className="bg-[#1C1C1E] border border-outline-variant/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden text-left flex flex-col max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
              <div className="p-5 border-b border-white/10 font-bold text-white text-xl flex justify-between items-center">
                <span>폴더 관리 안내</span>
                <button onClick={() => setIsFolderManageModalOpen(false)} className="text-zinc-500 hover:text-white">✕</button>
              </div>
              <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-6">
                <p className="text-sm text-zinc-400 leading-relaxed">
                  스튜디오 보관함에서 폴더(플레이리스트)를 생성하거나 삭제하는 기능은 통합 관리를 위해 상단 <strong>[내음원관리]</strong> 메뉴에서 지원합니다. <br/><br/>
                  내음원관리 화면에서 폴더를 자유롭게 중첩 생성하고 관리해 주세요!
                </p>
              </div>
              <div className="p-4 border-t border-white/10 flex justify-end">
                <button onClick={() => setIsFolderManageModalOpen(false)} className="text-sm text-blue-500 hover:text-blue-400 px-2 font-bold cursor-pointer">확인</button>
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

if (!content.includes('Move to Folder Modal')) {
  content = content.replace(oldEnd, newEnd);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully patched StudioClient.tsx layout!');
