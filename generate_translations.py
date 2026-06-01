import json
with open('ternary_strings.json', 'r', encoding='utf-8') as f:
    data = json.load(f)
missing = {v['en']: v['en'] for k, v in data.items() if v['ja'] == v['en'] and v['en'] != ''}
with open('missing_en.json', 'w', encoding='utf-8') as f:
    json.dump(list(missing.keys()), f, ensure_ascii=False, indent=2)
