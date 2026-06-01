import json
import re

with open('src/lib/constants/genres.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Extract the GENRE_TRANSLATIONS dictionary
match = re.search(r'export const GENRE_TRANSLATIONS: Record<string, string> = ({.*?})', content, re.DOTALL)
if match:
    # simple parsing
    lines = match.group(1).strip()[1:-1].split('\n')
    ja_lines = ["export const GENRE_TRANSLATIONS_JA: Record<string, string> = {"]
    for line in lines:
        if ':' in line:
            parts = line.split(':')
            key = parts[0].strip()
            # Just append to the ja translation dictionary, using English as fallback for now
            ja_lines.append(f"  {key}: {parts[1].strip()},")
    ja_lines.append("}")
    
    with open('src/lib/constants/genres.ts', 'a', encoding='utf-8') as f:
        f.write('\n\n')
        f.write('\n'.join(ja_lines))
        f.write('\n')
