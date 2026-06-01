const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '../src/components/profile/ProfileClient.tsx');
let content = fs.readFileSync(targetPath, 'utf8');

// 1. Make tracks draggable
content = content.replace(
  /<tr key=\{song\.id\} className=\{`hover:bg-white\/\[0\.02\] border-b border-white\/\[0\.03\] last:border-0 transition-all duration-200 group \$\{isPlayingThis \? 'bg-primary\/5' : ''\}`\}>/g,
  `<tr 
                                key={song.id} 
                                draggable={true}
                                onDragStart={(e) => {
                                  e.dataTransfer.setData('text/plain', song.id)
                                  e.dataTransfer.effectAllowed = 'move'
                                }}
                                className={\`hover:bg-white/[0.02] border-b border-white/[0.03] last:border-0 transition-all duration-200 group \${isPlayingThis ? 'bg-primary/5' : ''} cursor-grab active:cursor-grabbing\`}>`
);

// 2. Make 'All Folders' droppable (Line ~2850)
content = content.replace(
  /<button\s+onClick=\{\(\) => setSelectedPlaylistFilter\('all'\)\}\s+className=\{`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold transition-colors \$\{selectedPlaylistFilter === 'all' \? 'bg-primary text-black' : 'text-zinc-300 hover:bg-white\/5'\}`\}>/g,
  `<button 
                    onClick={() => setSelectedPlaylistFilter('all')}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const trackId = e.dataTransfer.getData('text/plain');
                      if (trackId) {
                        handleMoveTrack(trackId, null);
                        showToast('기본 폴더로 이동되었습니다.', 'success');
                      }
                    }}
                    className={\`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold transition-colors \${selectedPlaylistFilter === 'all' ? 'bg-primary text-black' : 'text-zinc-300 hover:bg-white/5'}\`}>`
);

// 3. Make 'Uploads' droppable (Line ~2860)
// wait, uploads folder logic is selectedPlaylistFilter === 'uploaded', but it shouldn't be a valid folder to move tracks TO.
// The user said "음원 업로드는 왼쪽폴더에 업로드에서만 올리수 있게해줘" (Make audio uploads only possible in the 'Upload' folder in the left menu). They didn't explicitly say moving existing tracks TO upload is allowed. So let's skip making 'uploaded' a drop target.

// 4. Update FolderTreeNode function signature and drop logic
// Update function definition
content = content.replace(
  /function FolderTreeNode\(\{ node, selectedPlaylist, setSelectedPlaylist, expandedFolders, handleToggleFolder, depth = 0, handleCreateSubfolder, handleRenameFolder, deletePlaylist \}: any\) \{/g,
  `function FolderTreeNode({ node, selectedPlaylist, setSelectedPlaylist, expandedFolders, handleToggleFolder, depth = 0, handleCreateSubfolder, handleRenameFolder, deletePlaylist, handleMoveTrack, showToast }: any) {`
);

// Update div in FolderTreeNode
content = content.replace(
  /<div\s+className=\{`group relative flex items-center justify-between py-1\.5 px-2 rounded-lg cursor-pointer transition-colors \$\{isSelected \? 'bg-primary\/10 text-primary' : 'text-zinc-300 hover:bg-white\/5'\}`\}\s+style=\{\{ paddingLeft: `\$\{depth \* 12 \+ 8\}px` \}\}\s+onClick=\{\(e\) => \{/g,
  `<div 
        className={\`group relative flex items-center justify-between py-1.5 px-2 rounded-lg cursor-pointer transition-colors \${isSelected ? 'bg-primary/10 text-primary' : 'text-zinc-300 hover:bg-white/5'}\`}
        style={{ paddingLeft: \`\${depth * 12 + 8}px\` }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const trackId = e.dataTransfer.getData('text/plain');
          if (trackId && handleMoveTrack && showToast) {
            handleMoveTrack(trackId, node.id);
            showToast(\`'\${node.title}' 폴더로 이동되었습니다.\`, 'success');
          }
        }}
        onClick={(e) => {`
);

// 5. Pass handleMoveTrack and showToast to FolderTreeNode usages
// In recursive FolderTreeNode call
content = content.replace(
  /deletePlaylist=\{deletePlaylist\}\s+\/>/g,
  `deletePlaylist={deletePlaylist}\n                      handleMoveTrack={handleMoveTrack}\n                      showToast={showToast}\n                    />`
);

fs.writeFileSync(targetPath, content, 'utf8');
console.log('Drag and Drop applied.');
