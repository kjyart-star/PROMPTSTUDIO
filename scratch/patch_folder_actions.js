const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/components/profile/ProfileClient.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Replace FolderTreeNode Component
const newFolderTreeNode = `
function FolderTreeNode({ node, selectedPlaylist, setSelectedPlaylist, expandedFolders, handleToggleFolder, depth = 0, handleCreateSubfolder, handleRenameFolder, deletePlaylist }: any) {
  const isExpanded = expandedFolders.has(node.id)
  const isSelected = selectedPlaylist === node.id
  const hasChildren = node.children && node.children.length > 0
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div className="flex flex-col w-full">
      <div 
        className={\`group relative flex items-center justify-between py-1.5 px-2 rounded-lg cursor-pointer transition-colors \${isSelected ? 'bg-primary/10 text-primary' : 'text-zinc-300 hover:bg-white/5'}\`}
        style={{ paddingLeft: \`\${depth * 12 + 8}px\` }}
        onClick={() => setSelectedPlaylist(node.id)}
      >
        <div className="flex items-center gap-1.5 overflow-hidden pr-6">
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

        {/* The 3-dot menu icon */}
        <div className={\`absolute right-2 top-1/2 -translate-y-1/2 \${isMenuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}\`} ref={menuRef}>
          <button 
            onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }}
            className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white"
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
          </button>
          
          {isMenuOpen && (
            <div className="absolute right-0 top-full mt-1 w-32 bg-[#1C1C1E] border border-outline-variant/20 rounded shadow-xl z-50 text-sm font-medium overflow-hidden">
              <button 
                onClick={(e) => { e.stopPropagation(); setIsMenuOpen(false); handleCreateSubfolder(node.id); }}
                className="w-full text-left px-3 py-2 hover:bg-white/5 text-zinc-200"
              >
                하위 폴더 생성
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); setIsMenuOpen(false); handleRenameFolder(node.id, node.title); }}
                className="w-full text-left px-3 py-2 hover:bg-white/5 text-zinc-200"
              >
                이름 변경
              </button>
              <button 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  setIsMenuOpen(false); 
                  if(window.confirm('정말 삭제하시겠습니까? (하위 폴더/트랙 연결 해제)')) deletePlaylist(node.id); 
                }}
                className="w-full text-left px-3 py-2 hover:bg-white/5 text-red-400"
              >
                삭제
              </button>
            </div>
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
              handleCreateSubfolder={handleCreateSubfolder}
              handleRenameFolder={handleRenameFolder}
              deletePlaylist={deletePlaylist}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}
`;

content = content.replace(/function FolderTreeNode\([\s\S]*?\}\n\nexport function ProfileClient/, newFolderTreeNode + "\nexport function ProfileClient");


// 2. Inject handler functions in ProfileClient
const handlerFunctions = `
  const handleRenameFolder = async (folderId: string, oldName: string) => {
    const newName = window.prompt('새 폴더 이름을 입력하세요:', oldName)
    if (!newName || newName === oldName) return;
    try {
      const folder = playlists.find(p => p.id === folderId)
      if (!folder) return
      
      const res = await fetch(\`/api/playlists/\${folderId}\`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title: newName.trim(), 
          description: folder.description 
        })
      })
      if (res.ok) {
        fetchPlaylists()
        showToast('폴더 이름이 변경되었습니다.', 'success')
      } else {
        showToast('이름 변경 실패', 'error')
      }
    } catch (e) {
      showToast('오류가 발생했습니다.', 'error')
    }
  }

  const handleCreateSubfolder = async (parentId: string) => {
    const newName = window.prompt('새 하위 폴더 이름을 입력하세요:')
    if (!newName) return;
    try {
      const descriptionToSave = serializePlaylistDescription('folder', '', parentId)
      const res = await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newName.trim(),
          description: descriptionToSave,
          cover_url: '',
          genre: '',
          is_published: false,
          exposure_order: null
        })
      })
      if (res.ok) {
        fetchPlaylists()
        setExpandedFolders(prev => new Set(prev).add(parentId))
        showToast('하위 폴더가 생성되었습니다.', 'success')
      } else {
        showToast('하위 폴더 생성 실패', 'error')
      }
    } catch (e) {
      showToast('오류가 발생했습니다.', 'error')
    }
  }

  // --- Folder Management State ---`;

content = content.replace(/\/\/ --- Folder Management State ---/, handlerFunctions);

// 3. Add props to the root FolderTreeNode mapping
content = content.replace(/<FolderTreeNode\s*key=\{node\.id\}\s*node=\{node\}\s*selectedPlaylist=\{selectedPlaylistFilter\}\s*setSelectedPlaylist=\{setSelectedPlaylistFilter\}\s*expandedFolders=\{expandedFolders\}\s*handleToggleFolder=\{handleToggleFolder\}\s*\/>/g, 
  `<FolderTreeNode 
                      key={node.id} 
                      node={node} 
                      selectedPlaylist={selectedPlaylistFilter}
                      setSelectedPlaylist={setSelectedPlaylistFilter}
                      expandedFolders={expandedFolders}
                      handleToggleFolder={handleToggleFolder}
                      handleCreateSubfolder={handleCreateSubfolder}
                      handleRenameFolder={handleRenameFolder}
                      deletePlaylist={deletePlaylist}
                    />`);


fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully added dropdown menu to FolderTreeNode');
