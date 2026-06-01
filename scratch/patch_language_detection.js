const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else if (file.endsWith('.tsx') || file.endsWith('.ts')) { 
            results.push(file);
        }
    });
    return results;
}

const files = walk(path.join(__dirname, '../src'));
let count = 0;

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Pattern to match
    const target1 = "const defaultLang = browserLang.toLowerCase().startsWith('ko') ? 'KO' : 'EN'";
    const replacement1 = "const defaultLang = browserLang.toLowerCase().startsWith('ko') ? 'KO' : browserLang.toLowerCase().startsWith('ja') ? 'JA' : 'EN'";
    
    if (content.includes(target1)) {
        content = content.replace(new RegExp(target1.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacement1);
        fs.writeFileSync(file, content, 'utf8');
        console.log(`Updated ${file}`);
        count++;
    }
}

console.log(`Finished updating ${count} files.`);
