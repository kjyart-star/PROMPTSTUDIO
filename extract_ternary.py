import os
import re
import json

files_to_check = [
    "src/components/profile/ProfileClient.tsx",
    "src/components/studio/GenerateClient.tsx",
    "src/components/studio/StudioClient.tsx",
    "src/components/studio/MasteringClient.tsx",
    "src/components/chart/ChartClient.tsx",
    "src/components/artist/ArtistClient.tsx",
    "src/components/settings/SettingsClient.tsx",
    "src/components/search/SearchClient.tsx",
    "src/components/pricing/PricingClient.tsx"
]

pattern = re.compile(r"uiLanguage === 'KO'\s*\?\s*['\"](.*?)['\"]\s*:\s*(?:uiLanguage === 'JA'\s*\?\s*['\"](.*?)['\"]\s*:\s*)?['\"](.*?)['\"]")

extracted = {}

for path in files_to_check:
    if not os.path.exists(path): continue
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
        matches = pattern.findall(content)
        for m in matches:
            ko_str = m[0]
            ja_str = m[1] if m[1] else m[2]
            en_str = m[2]
            if ko_str not in extracted:
                extracted[ko_str] = {
                    "en": en_str,
                    "ja": ja_str
                }

with open("ternary_strings.json", "w", encoding="utf-8") as f:
    json.dump(extracted, f, ensure_ascii=False, indent=2)

print(f"Extracted {len(extracted)} unique UI strings.")
