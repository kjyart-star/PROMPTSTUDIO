import os
import re

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

ko_pattern = re.compile(r'([가-힣]+[가-힣\s\(\)0-9a-zA-Z\.\,\!\?\-]*[가-힣]+|[가-힣])')
# To avoid matching comments, we can just read line by line and ignore lines starting with //
ko_strings = set()

for path in files_to_check:
    if not os.path.exists(path): continue
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip().startswith("//"): continue
            if "console.log" in line or "console.error" in line: continue
            matches = ko_pattern.findall(line)
            for m in matches:
                # filter out single letters or weird things
                clean_m = m.strip()
                if len(clean_m) > 0:
                    ko_strings.add(clean_m)

with open("ko_strings.txt", "w", encoding="utf-8") as f:
    for s in sorted(list(ko_strings)):
        f.write(s + "\n")

print(f"Extracted {len(ko_strings)} Korean strings.")
