const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '../src/components/profile/ProfileClient.tsx');
let content = fs.readFileSync(targetPath, 'utf8');

const moveModalJSX = `
      {/* Move Track Modal */}
      {moveTrackModalData && typeof window !== 'undefined' && require('react-dom').createPortal(
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md grid place-items-center z-[9999] p-4" onClick={() => setMoveTrackModalData(null)}>
          <div className="bg-surface-container border border-outline-variant/10 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden text-left flex flex-col max-h-[80vh] text-on-surface" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-outline-variant/10 flex justify-between items-center">
              <h2 className="text-xl font-bold">폴더로 이동</h2>
            </div>
            
            <div className="overflow-y-auto flex-1 flex flex-col p-2">
              <button
                onClick={() => {
                  handleMoveTrack(moveTrackModalData.id, null);
                  setMoveTrackModalData(null);
                  showToast('기본 폴더로 이동되었습니다.', 'success');
                }}
                className="flex items-center gap-4 px-4 py-3.5 hover:bg-white/10 rounded-xl transition-colors cursor-pointer text-left w-full"
              >
                <Folder className="w-5 h-5 text-primary fill-current" />
                <span className="text-sm font-bold text-white">기본 폴더 (모든 폴더)</span>
              </button>

              {playlists.map(folder => (
                <button
                  key={folder.id}
                  onClick={() => {
                    handleMoveTrack(moveTrackModalData.id, folder.id);
                    setMoveTrackModalData(null);
                    showToast(\`'\${folder.title}' 폴더로 이동되었습니다.\`, 'success');
                  }}
                  className="flex items-center gap-4 px-4 py-3.5 hover:bg-white/10 rounded-xl transition-colors cursor-pointer text-left w-full"
                >
                  <Folder className="w-5 h-5 text-zinc-400" />
                  <span className="text-sm font-bold text-zinc-200">{folder.title}</span>
                </button>
              ))}
            </div>

            <div className="p-4 border-t border-outline-variant/10 flex justify-end bg-surface-container-low/50">
              <button 
                onClick={() => setMoveTrackModalData(null)} 
                className="px-6 py-2 rounded-xl text-sm font-bold text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                취소
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
`;

content = content.replace('{/* Folder Management Modal */}', moveModalJSX + '\n      {/* Folder Management Modal */}');

fs.writeFileSync(targetPath, content, 'utf8');
console.log('Move modal inserted.');
