import os
import re
import json

matches = {}

pattern = re.compile(r"uiLanguage === 'KO'\s*\?\s*(['\"`])(.*?)(['\"`])\s*:\s*(['\"`])(.*?)(['\"`])")

for root, _, files in os.walk('src'):
    for file in files:
        if file.endswith(('.tsx', '.ts')):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            for match in pattern.finditer(content):
                # Exclude if it looks like it already has JA logic
                if "uiLanguage === 'JA'" not in match.group(5):
                    # We store the exact original match strings so we can replace them easily
                    # and the extracted english text
                    en_text = match.group(5)
                    ko_text = match.group(2)
                    
                    if en_text not in matches:
                        matches[en_text] = {
                            "ko": ko_text,
                            "en": en_text
                        }

with open('all_missing_en.json', 'w', encoding='utf-8') as f:
    json.dump([m['en'] for m in matches.values() if m['en']], f, ensure_ascii=False, indent=2)

