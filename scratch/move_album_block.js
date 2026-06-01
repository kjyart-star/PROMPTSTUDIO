const fs = require('fs');
const path = require('path');

const filePath = path.resolve('/Users/jin/Documents/자동화 에이전트개발/프롬프트작성기/suno-prompt/src/components/profile/ProfileClient.tsx');
let content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// Find the start of the album block
const albumBlockStart = lines.findIndex(line => line.includes("{selectedPlaylistFilter === 'all' && ("));
// The album block ends at `            )}` just before `<div className="mb-10">` that has "모든 폴더 (전체 음원)".
// We can find the end by looking for the next `            )}` after albumBlockStart
let albumBlockEnd = -1;
for (let i = albumBlockStart + 1; i < lines.length; i++) {
  if (lines[i] === "            )}") {
    albumBlockEnd = i;
    break;
  }
}

if (albumBlockStart !== -1 && albumBlockEnd !== -1) {
  const albumBlock = lines.slice(albumBlockStart, albumBlockEnd + 1);
  
  // Remove the block from its current location
  lines.splice(albumBlockStart, albumBlockEnd - albumBlockStart + 1);
  
  // Find where to insert it: just before `<div className="flex gap-6 min-h-[80vh]">`
  const insertIndex = lines.findIndex(line => line.includes('<div className="flex gap-6 min-h-[80vh]">'));
  
  if (insertIndex !== -1) {
    // Insert the block and add an empty line after it
    lines.splice(insertIndex, 0, ...albumBlock, "");
    
    fs.writeFileSync(filePath, lines.join('\n'));
    console.log('Successfully moved the album block!');
  } else {
    console.log('Could not find insert index.');
  }
} else {
  console.log('Could not find album block.', albumBlockStart, albumBlockEnd);
}
