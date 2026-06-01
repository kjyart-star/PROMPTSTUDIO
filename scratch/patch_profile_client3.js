const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/components/profile/ProfileClient.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update `folderTree` to only include `folder` types
content = content.replace(
  /const folderTree = buildFolderTree\(playlists\.filter\(p => !p\.isSystem\)\)/,
  `const folderTree = buildFolderTree(playlists.filter(p => !p.isSystem && parsePlaylistDescription(p.description).type === 'folder'))`
);

// 2. Remove "기본 폴더" button from the Sidebar
const defaultFolderBtnRegex = /<button\s+onClick=\{\(\) => setSelectedPlaylistFilter\('default'\)\}[\s\S]*?<\/button>/;
content = content.replace(defaultFolderBtnRegex, '');

// 3. Update handleQuickCreateFolder to use 'folder'
content = content.replace(
  /const descriptionToSave = JSON\.stringify\(\{ type: 'playlist', parent_id: null \}\)/,
  `const descriptionToSave = serializePlaylistDescription('folder', '', null)`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully applied third round of UI patches to ProfileClient.tsx!');
