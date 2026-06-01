import os
import re

count = 0
matches = []

pattern = re.compile(r"uiLanguage === 'KO'\s*\?\s*(['\"`].*?['\"`])\s*:\s*(['\"`].*?['\"`])")

for root, _, files in os.walk('src'):
    for file in files:
        if file.endswith(('.tsx', '.ts')):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            for match in pattern.finditer(content):
                # Exclude if it looks like the nested JA ternary already
                if "uiLanguage === 'JA'" not in match.group(2):
                    matches.append({'file': path, 'ko': match.group(1), 'en': match.group(2)})
                    count += 1

print(f'Found {count} simple bilingual ternaries.')
for m in matches[:20]:
    print(m['ko'], '->', m['en'])
