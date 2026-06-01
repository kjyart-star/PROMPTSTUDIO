import os
import json
import re

with open('ja_translations.json', 'r', encoding='utf-8') as f:
    ja_trans = json.load(f)

# Build a dictionary to escape quotes in JSON string values
# the script will look for: uiLanguage === 'JA' ? 'EN' : 'EN'
# or uiLanguage === 'JA' ? "EN" : "EN"

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content
    
    # We'll use a regex replacement function
    def replace_match(match):
        ja_cond = match.group(1) # uiLanguage === 'JA' ? 
        quote = match.group(2)   # ' or "
        en_str = match.group(3)  # the english string
        rest = match.group(4)    # : 'EN_STR'
        
        # unescape the extracted english string just in case
        clean_en = en_str.replace("\\'", "'").replace('\\"', '"')
        
        if clean_en in ja_trans:
            ja_str = ja_trans[clean_en]
            # escape for insertion
            if quote == "'":
                ja_str = ja_str.replace("'", "\\'")
            else:
                ja_str = ja_str.replace('"', '\\"')
            return f"{ja_cond}{quote}{ja_str}{quote}{rest}"
        
        return match.group(0)

    # regex: (uiLanguage === 'JA' \? )(['"])(.*?)(['"])( : ['"].*?['"])
    pattern = re.compile(r"(uiLanguage === 'JA'\s*\?\s*)(['\"])(.*?)(['\"])(\s*:\s*['\"].*?['\"])", re.DOTALL)
    
    content = pattern.sub(replace_match, content)

    if content != original_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated: {filepath}")

for root, _, files in os.walk('src'):
    for file in files:
        if file.endswith(('.tsx', '.ts')):
            process_file(os.path.join(root, file))

