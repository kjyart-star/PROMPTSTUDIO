import os
import json
import re

with open('ja_translations_v2.json', 'r', encoding='utf-8') as f:
    ja_trans = json.load(f)

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content
    
    # We'll use a regex replacement function for simple ternaries
    def replace_match(match):
        prefix = match.group(1) # uiLanguage === 'KO' ? 
        ko_quote = match.group(2) # ' or "
        ko_str = match.group(3)
        ko_close = match.group(4)
        mid = match.group(5)    # : 
        en_quote = match.group(6) # ' or "
        en_str = match.group(7)
        en_close = match.group(8)
        
        # Don't touch if JA is already handled inside the right side
        if "uiLanguage === 'JA'" in en_str or "uiLanguage ===" in en_str:
            return match.group(0)

        clean_en = en_str.replace("\\'", "'").replace('\\"', '"')
        
        if clean_en in ja_trans:
            ja_str = ja_trans[clean_en]
            
            # escape for insertion
            if en_quote == "'":
                ja_str = ja_str.replace("'", "\\'")
            else:
                ja_str = ja_str.replace('"', '\\"')
                
            # Form the new expression:
            # uiLanguage === 'KO' ? 'KO' : uiLanguage === 'JA' ? 'JA' : 'EN'
            new_expr = f"{prefix}{ko_quote}{ko_str}{ko_close}{mid}uiLanguage === 'JA' ? {en_quote}{ja_str}{en_quote} : {en_quote}{en_str}{en_close}"
            return new_expr
        
        return match.group(0)

    # regex: (uiLanguage === 'KO'\s*\?\s*)(['"`])(.*?)(['"`])(\s*:\s*)(['"`])(.*?)(['"`])
    pattern = re.compile(r"(uiLanguage === 'KO'\s*\?\s*)(['\"`])(.*?)(['\"`])(\s*:\s*)(['\"`])(.*?)(['\"`])", re.DOTALL)
    
    content = pattern.sub(replace_match, content)

    if content != original_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated simple ternaries in: {filepath}")

for root, _, files in os.walk('src'):
    for file in files:
        if file.endswith(('.tsx', '.ts')):
            process_file(os.path.join(root, file))

