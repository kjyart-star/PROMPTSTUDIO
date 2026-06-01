import re

file_path = 'src/components/studio/MasteringClient.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

replacements = {
    "'최대 20곡까지만 업로드 가능합니다.'": "'Maximum 20 tracks can be uploaded at once.'",
    "'트루 피크 가드 (True Peak)'": "'True Peak Guard'",
    "'출력 전단 클리핑 방지 리미터 적용'": "'Limiter to prevent output clipping'",
    "'아날로그 진공관 배음 증폭 (따뜻하고 묵직한 질감)'": "'Analog tube harmonic amplification (warm and heavy texture)'",
    "'좌우 위상 확장으로 공간감 극대화'": "'Maximize spatial feel by expanding stereo phase'",
    "'음압'": "'Loudness'",
    "'목표 음압 (Loudness Target)'": "'Loudness Target'",
    "'스트리밍 기본 (-14 LUFS)'": "'Streaming Default (-14 LUFS)'",
    "'모던 라우드 (-10 LUFS)'": "'Modern Loud (-10 LUFS)'",
    "'익스트림 부스터 (Extreme)'": "'Extreme Booster'",
    "'공격적인 압축 및 게인 부스트 (음압 극대화)'": "'Aggressive compression and gain boost'",
    '"WAV 다운로드"': "'Download WAV'"
}

def replace_fallback(match):
    full_str = match.group(0)
    ko_str = match.group(1)
    ja_str = match.group(2)
    fallback_str = match.group(3)
    
    if fallback_str == ko_str and ko_str in replacements:
        new_fallback = replacements[ko_str]
        return f"uiLanguage === 'KO' ? {ko_str} : uiLanguage === 'JA' ? {ja_str} : {new_fallback}"
    
    return full_str

pattern = r"uiLanguage === 'KO' \? ('[^']+'|\"[^\"]+\"|`[^`]+`) : uiLanguage === 'JA' \? ('[^']+'|\"[^\"]+\"|`[^`]+`) : ('[^']+'|\"[^\"]+\"|`[^`]+`)"

new_content = re.sub(pattern, replace_fallback, content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Patch applied successfully.")
