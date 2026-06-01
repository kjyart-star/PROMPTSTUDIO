const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/components/profile/ProfileClient.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Inject State
const stateInjection = `
  // --- Folder Management State ---
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [isFolderManageModalOpen, setIsFolderManageModalOpen] = useState(false)
  const [moveTrackModalData, setMoveTrackModalData] = useState<any | null>(null)
  const [selectedPlaylistFilter, setSelectedPlaylistFilter] = useState<string>('all')
  
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
      let parsed = { parent_id: null };
      try {
        parsed = typeof node.description === 'string' && node.description.startsWith('{') 
          ? JSON.parse(node.description) 
          : { parent_id: null };
      } catch (e) {}
        
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

if (!content.includes('// --- Folder Management State ---')) {
  // Insert right after selectedPlaylist definition
  const selectedPlaylistRegex = /const \[selectedPlaylist, setSelectedPlaylist\] = useState<any \| null>\(null\)/;
  content = content.replace(selectedPlaylistRegex, match => match + '\n' + stateInjection);
}

// 2. Add FolderTreeNode component
const folderTreeNodeComponent = `
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
  content = content.replace("export function ProfileClient", folderTreeNodeComponent + "\nexport function ProfileClient");
}

// 3. Update visibleLooseTracks filtering
const visibleLooseTracksRegex = /(const visibleLooseTracksRaw[\s\S]*?const visibleLooseTracks = [^:]+:\s*visibleLooseTracksRaw)([\s\S]*?)(\n\s*const \[currentPage)/;
const newVisibleLooseTracks = `$1
  
  let finalVisibleTracks = visibleLooseTracks;
  if (selectedPlaylistFilter === 'liked') {
    finalVisibleTracks = finalVisibleTracks.filter(h => isSongLiked(h.id))
  } else if (selectedPlaylistFilter === 'default') {
    finalVisibleTracks = finalVisibleTracks.filter(h => !h.playlist_id)
  } else if (selectedPlaylistFilter !== 'all') {
    finalVisibleTracks = finalVisibleTracks.filter(h => h.playlist_id === selectedPlaylistFilter)
  }
$3`;

// Change variable name to finalVisibleTracks in the whole component later or just re-assign visibleLooseTracks since it's const. 
// Ah, let's redefine visibleLooseTracks:
const replaceVisibleTracks = `
  let visibleLooseTracks = trackSearchQuery
    ? visibleLooseTracksRaw.filter(h => 
        h.title?.toLowerCase().includes(trackSearchQuery.toLowerCase()) || 
        h.genre?.toLowerCase().includes(trackSearchQuery.toLowerCase())
      )
    : visibleLooseTracksRaw

  if (selectedPlaylistFilter === 'liked') {
    visibleLooseTracks = visibleLooseTracks.filter(h => isSongLiked(h.id))
  } else if (selectedPlaylistFilter === 'default') {
    visibleLooseTracks = visibleLooseTracks.filter(h => !h.playlist_id)
  } else if (selectedPlaylistFilter !== 'all') {
    visibleLooseTracks = visibleLooseTracks.filter(h => h.playlist_id === selectedPlaylistFilter)
  }
`;

content = content.replace(/const visibleLooseTracks = trackSearchQuery\s*\?[^:]+:\s*visibleLooseTracksRaw/g, replaceVisibleTracks);


// 4. Inject Layout in Private Tab
const privateTabStartRegex = /\) : activeTab === 'private' \? \(\s*\/\* Private Tab View \(Management Dashboard\) \*\/\s*<>/;

const sidebarLayout = `) : activeTab === 'private' ? (
          /* Private Tab View (Management Dashboard) */
          <div className="flex flex-col w-full">`;

if (content.match(privateTabStartRegex)) {
  content = content.replace(privateTabStartRegex, sidebarLayout);
}

const navTabsRegex = /(<div className="flex gap-4 mb-6 border-b border-outline-variant\/20 pb-4">[\s\S]*?<\/div>)/;
const twoColumnStart = `$1
            
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
              <div className="flex-1 min-w-0">
`;
if (content.includes('--- SIDEBAR ---')) {
  // already patched? skip
} else {
  content = content.replace(navTabsRegex, twoColumnStart);
}

// Wrap the Albums section to only show when 'all'
const albumStartStr = `<div className="mb-10">\n              <div className="flex items-center justify-between mb-4">\n                <h2 className="text-lg font-bold text-on-surface flex items-center gap-2"><Folder className="w-5 h-5 text-primary" /> {uiLanguage === 'KO' ? '내 앨범' : uiLanguage === 'JA' ? 'マイアルバム' : 'My Albums'}</h2>`;

const songsStartStr = `<div className="mb-10">\n              <div className="flex items-center justify-between mb-4">\n                <h2 className="text-lg font-bold text-on-surface flex items-center gap-2">\n                  <Music className="w-5 h-5 text-primary" /> {uiLanguage === 'KO' ? '음원 목록' : uiLanguage === 'JA' ? '曲' : 'Songs'}`;

content = content.replace(albumStartStr, `{selectedPlaylistFilter === 'all' && (\n              ` + albumStartStr);
content = content.replace(songsStartStr, `)}\n\n            ` + songsStartStr);


// Close the two flex divs at the end of the private tab
//           </>
const privateTabEndRegex = /(<\/div>\s*)\s*(<div className="mb-10">\s*<div className="flex items-center justify-between mb-4">\s*<h2 className="text-lg font-bold text-on-surface flex items-center gap-2">\s*<Folder className="w-5 h-5 text-primary" \/> \{uiLanguage === 'KO' \? '내 채널 연결 대기중' : uiLanguage === 'JA' \? 'チャンネル接続待ち' : 'Pending Channel Connection'\})/
// Wait, the private tab ends with the pending channels section, or somewhere else?
// In ProfileClient, activeTab === 'private' covers a lot.
// Let's find the closing of the fragment <> we replaced.

// I'll run a safer replacement using string manipulation for the end of the block.
// Or just find: `) : activeTab === 'channels' ? (` and replace `</>` before it with `</div></div></div>`.
const channelsTabRegex = /<\/>\s*\)\s*:\s*activeTab === 'channels'\s*\?\s*\(/;
const newEnd = `</div>
            </div>
          </div>
        ) : activeTab === 'channels' ? (`;

if (content.match(channelsTabRegex)) {
  content = content.replace(channelsTabRegex, newEnd);
}

// Update the "폴더 이동" button in the track row to open the Modal
const oldMoveBtn = `<div className="relative p-1.5 rounded-full bg-surface-container hover:bg-primary hover:text-black transition-colors cursor-pointer text-zinc-500 hover:text-black" title="폴더 이동">
                                        <Folder className="w-3.5 h-3.5" />
                                        <select 
                                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                          value={song.playlist_id || ''}
                                          onChange={(e) => addMusicToPlaylist(song.id, e.target.value || null)}
                                        >
                                          <option value="">단일 곡 (지정 안 함)</option>
                                          {userAlbums.length > 0 && (
                                            <optgroup label="내 앨범">
                                              {userAlbums.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                                            </optgroup>
                                          )}
                                          {userPlaylists.length > 0 && (
                                            <optgroup label="나만의 플레이리스트">
                                              {userPlaylists.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                                            </optgroup>
                                          )}
                                        </select>
                                      </div>`;

const newMoveBtn = `<button 
                                        onClick={() => setMoveTrackModalData(song)}
                                        className="p-1.5 rounded-full bg-surface-container hover:bg-primary hover:text-black transition-colors cursor-pointer text-zinc-500" 
                                        title="폴더 이동"
                                      >
                                        <Folder className="w-3.5 h-3.5" />
                                      </button>`;

content = content.replace(oldMoveBtn, newMoveBtn);

// Add the Modals right before the end of the main `return (` in ProfileClient
// Search for `</main>` and put it before.
const mainEndRegex = /(<\/div>\s*<\/main>)/;
const modalsCode = `
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
                    addMusicToPlaylist(moveTrackModalData.id, null);
                    setMoveTrackModalData(null); 
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:bg-white/5 rounded flex items-center gap-2 mb-1 cursor-pointer"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
                  기본 폴더
                </button>
                <div className="flex flex-col gap-1">
                  {folderTree.map((node: any) => (
                    <FolderTreeNode 
                      key={node.id} 
                      node={node} 
                      selectedPlaylist={null}
                      setSelectedPlaylist={(id: string) => { 
                        addMusicToPlaylist(moveTrackModalData.id, id);
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
                <span>폴더 관리</span>
                <button onClick={() => setIsFolderManageModalOpen(false)} className="text-zinc-500 hover:text-white">✕</button>
              </div>
              <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-6">
                <p className="text-sm text-zinc-400">새 폴더를 만들거나 기존 폴더를 수정할 수 있습니다.</p>
                <button 
                  onClick={() => {
                    setIsFolderManageModalOpen(false);
                    openCreateModal('playlist');
                  }}
                  className="px-4 py-2 rounded-lg bg-primary text-black font-bold text-sm hover:bg-[#e3fe06] cursor-pointer"
                >
                  + 새 폴더 만들기
                </button>
                <p className="text-xs text-zinc-500 mt-2">이름 변경이나 부모 폴더 지정 기능은 내 앨범 영역의 기존 편집 기능을 활용하세요.</p>
              </div>
            </div>
          </div>,
          document.body
        )}
        $1`;

if (!content.includes('Move to Folder Modal')) {
  content = content.replace(mainEndRegex, modalsCode);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully patched ProfileClient.tsx!');
