const fs = require('fs');
const path = require('path');

const dir = '/Users/jin/.npm/_npx/53c4795544aaa350/node_modules/@supabase/mcp-server-supabase/dist';

function searchInFile(filePath) {
  if (fs.statSync(filePath).isDirectory()) {
    fs.readdirSync(filePath).forEach(file => searchInFile(path.join(filePath, file)));
    return;
  }
  if (!filePath.endsWith('.js') && !filePath.endsWith('.cjs')) return;
  const content = fs.readFileSync(filePath, 'utf8');
  
  const index = content.indexOf('executeSql(');
  if (index !== -1) {
    console.log(`Found executeSql( in ${path.basename(filePath)} at index ${index}`);
    const start = Math.max(0, index - 1000);
    const end = Math.min(content.length, index + 2000);
    console.log('--- Context ---');
    console.log(content.slice(start, end));
  }

  const index2 = content.indexOf('executeSql:');
  if (index2 !== -1) {
    console.log(`Found executeSql: in ${path.basename(filePath)} at index ${index2}`);
    const start = Math.max(0, index2 - 1000);
    const end = Math.min(content.length, index2 + 2000);
    console.log('--- Context ---');
    console.log(content.slice(start, end));
  }
}

searchInFile(dir);
