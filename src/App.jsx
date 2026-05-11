import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const PROVIDERS = {
  openai: {
    name: 'GPT',
    models: ['gpt-4.1-mini', 'gpt-4.1', 'gpt-4o-mini'],
    keyLabel: 'OpenAI API Key',
  },
  gemini: {
    name: 'Gemini',
    models: ['gemini-1.5-flash', 'gemini-1.5-pro'],
    keyLabel: 'Google AI API Key',
  },
  claude: {
    name: 'Claude',
    models: ['claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest'],
    keyLabel: 'Anthropic API Key',
  },
};

const DEFAULT_GUIDES = [
  {
    id: 'suno-clear',
    title: 'Suno 기본 지침',
    body: 'Suno에 바로 넣을 수 있게 스타일 프롬프트는 영어 키워드 중심으로 짧고 구체적으로 작성한다. 가사는 [Verse], [Pre-Chorus], [Chorus], [Bridge], [Outro] 섹션 태그를 사용한다. 특정 아티스트 이름을 그대로 복제하지 말고 장르, 악기, 분위기, 보컬 톤으로 설명한다.',
  },
  {
    id: 'hook-first',
    title: '후렴 우선 지침',
    body: '후렴은 2~4줄 안에 기억하기 쉬운 핵심 문장을 반복한다. 첫 청취에서 따라 부를 수 있는 쉬운 단어를 쓰고, 벌스는 구체적인 장면으로 시작한다.',
  },
];


const TRANSLATIONS = {
  KO: {
    studio: 'Studio',
    library: 'Library',
    explore: 'Explore',
    statusWaiting: '대기 중',
    statusGenerating: 'AI 생성 중',
    statusSampleGenerated: 'API 키가 없어 샘플 생성 결과를 만들었습니다',
    statusGenerated: '생성 완료',
    statusError: 'API 오류로 샘플 결과를 대신 표시했습니다',
    statusCopied: '복사 완료',
    statusCleared: '결과를 비웠습니다',
    statusLoginRequired: 'Supabase URL과 anon key를 먼저 입력하세요',
    statusLoginSuccess: '로그인 완료',
    statusLoginFail: '로그인 실패:',
    statusSignUpSuccess: '회원가입 완료. 이메일 확인 설정이 켜져 있으면 메일 인증 후 로그인됩니다',
    statusSignUpFail: '회원가입 실패:',
    statusGoogleLoginLocal: '현재 로컬 저장 모드입니다. Google 로그인은 Supabase 연결 후 사용할 수 있습니다',
    statusGoogleLoginFail: 'Google 로그인 실패:',
    statusLogout: '로그아웃 완료',
    statusHistoryLocalLoaded: '로컬 히스토리를 불러왔습니다',
    statusHistoryCloudLoginReq: '클라우드 히스토리는 로그인 후 조회할 수 있습니다',
    statusHistoryLoadFail: '히스토리 조회 실패:',
    statusHistoryLocalSaved: '로컬 히스토리에 저장했습니다',
    statusHistoryCloudSaveReq: '클라우드 저장은 로그인 후 사용할 수 있습니다',
    statusHistorySaveFail: '저장 실패:',
    statusHistorySaved: '히스토리에 저장했습니다',
    statusHistoryOpened: '히스토리에서 불러왔습니다',
    statusHistoryLocalDeleted: '로컬 히스토리 항목을 삭제했습니다',
    statusHistoryDeleteFail: '삭제 실패:',
    statusHistoryDeleted: '히스토리 항목을 삭제했습니다',
    
    panelAiConfig: 'AI 설정',
    provider: '제공자',
    model: '모델',
    apiKeyPlaceholder: '브라우저에만 저장됩니다',
    panelLoginSave: '로그인 · 저장',
    refresh: '새로고침',
    logout: '로그아웃',
    googleLogin: 'Google 계정으로 로그인',
    orEmail: 'Or Email',
    emailPlaceholder: '이메일 주소',
    passwordPlaceholder: '비밀번호',
    login: '로그인',
    signUp: '회원가입',
    
    panelHistory: '저장 히스토리',
    saveCurrentSong: '현재 곡 저장',
    refreshList: '목록 갱신',
    untitledProject: 'Untitled Project',
    open: '열기',
    delete: '삭제',
    historyEmptyCloud: '로그인 후 저장한 프로젝트가\n여기에 표시됩니다.',
    historyEmptyLocal: '프로젝트를 저장하면\n여기에 보관됩니다.',
    
    panelGuides: '지침서 (가이드)',
    remove: 'Remove',
    newGuideTitlePlaceholder: '새 지침서 제목',
    newGuideBodyPlaceholder: '작사 규칙, 금지어, 브랜드 톤, 구조 등을 입력',
    registerGuide: '지침서 등록하기',
    
    panelInput: '곡 정보 및 프롬프트 설정',
    songTitle: '곡 제목 (Title)',
    songTitlePlaceholder: '예: Neon City Lights',
    targetTool: '대상 툴 (Target AI)',
    targetToolPlaceholder: '예: Suno, Udio',
    genre: '장르 (Genre)',
    genrePlaceholder: '예: Synthwave, K-pop',
    mood: '분위기 (Mood)',
    moodPlaceholder: '예: 몽환적인, 에너제틱한',
    lyricsLanguage: '가사 언어 (Language)',
    vocalGender: '보컬 성별 (Gender)',
    vocalStyle: '보컬 톤/스타일 (Vocal Style)',
    vocalStylePlaceholder: '예: 허스키한, 맑은, 부드러운',
    vocalGroup: '보컬 구성 (Vocal Group)',
    tempo: '템포 (BPM/Tempo)',
    tempoVerySlow: '아주 느리게',
    tempoSlow: '느리게',
    tempoNormal: '보통',
    tempoFast: '빠르게',
    tempoVeryFast: '아주 빠르게',
    structure: '구조 (Structure)',
    structurePlaceholder: '예: [Intro] - [Verse 1] - [Chorus] - [Drop] - [Outro]',
    theme: '주제 및 네러티브 (Theme & Narrative)',
    themeSub: '곡이 전달하고자 하는 이야기',
    themePlaceholder: '이 노래가 어떤 이야기를 담고 있는지 자세히 적어주세요.',
    extraRequests: '추가 요청 (Extra Requests)',
    extraSub: '특정 악기, 특수 효과 등',
    extraPlaceholder: '예: 코러스에 일렉기타 솔로 추가, 리버브 이펙트 강조',
    
    generating: 'AI가 프롬프트를 생성 중입니다...',
    generateBtn: 'GENERATE PROMPT & LYRICS',
    generateSampleBtn: '샘플 생성',
    
    panelOutput: '생성 결과 (Output)',
    promptLabel: 'Suno 스타일 프롬프트',
    promptPlaceholder: '여기에 음악 스타일 프롬프트가 생성됩니다.',
    titleLabel: '곡 제목',
    titlePlaceholder: '곡 제목',
    lyricsLabel: '가사 편집기',
    lyricsPlaceholder: '섹션 태그가 포함된 가사가 여기에 표시됩니다. 직접 수정하여 최종 완성하세요.',
    notesLabel: 'AI 메모 (Suggestions)',
    notesPlaceholder: '제작 메모 또는 AI의 추가 제안이 표시됩니다.',
    copyAllBtn: '클립보드에 전체 복사',
    clearResultBtn: '결과 지우기',
    copyTooltip: '복사하기',
    copyPrompt: '프롬프트',
    copyTitle: '제목',
    copyLyrics: '가사',
    copyNotes: '메모',
    copyAll: '전체 결과',
    libraryEmpty: '저장된 프로젝트가 없습니다.',
    libPrompt: '스타일 프롬프트',
    libLyrics: '가사'
  },
  EN: {
    studio: 'Studio',
    library: 'Library',
    explore: 'Explore',
    statusWaiting: 'Waiting',
    statusGenerating: 'AI is generating...',
    statusSampleGenerated: 'Generated sample due to missing API key',
    statusGenerated: 'Generation Complete',
    statusError: 'API Error: Showed sample instead',
    statusCopied: 'Copied successfully',
    statusCleared: 'Cleared results',
    statusLoginRequired: 'Enter Supabase URL and anon key first',
    statusLoginSuccess: 'Login successful',
    statusLoginFail: 'Login failed:',
    statusSignUpSuccess: 'Sign up successful. Check your email to verify if required, then login.',
    statusSignUpFail: 'Sign up failed:',
    statusGoogleLoginLocal: 'Currently in local storage mode. Google Login requires Supabase connection.',
    statusGoogleLoginFail: 'Google login failed:',
    statusLogout: 'Logout successful',
    statusHistoryLocalLoaded: 'Local history loaded',
    statusHistoryCloudLoginReq: 'Please login to view cloud history',
    statusHistoryLoadFail: 'Failed to load history:',
    statusHistoryLocalSaved: 'Saved to local history',
    statusHistoryCloudSaveReq: 'Please login to save to cloud',
    statusHistorySaveFail: 'Failed to save:',
    statusHistorySaved: 'Saved to history',
    statusHistoryOpened: 'Loaded from history',
    statusHistoryLocalDeleted: 'Deleted local history item',
    statusHistoryDeleteFail: 'Failed to delete:',
    statusHistoryDeleted: 'Deleted history item',
    
    panelAiConfig: 'AI Settings',
    provider: 'Provider',
    model: 'Model',
    apiKeyPlaceholder: 'Stored only in browser',
    panelLoginSave: 'Login & Save',
    refresh: 'Refresh',
    logout: 'Logout',
    googleLogin: 'Sign in with Google',
    orEmail: 'Or Email',
    emailPlaceholder: 'Email Address',
    passwordPlaceholder: 'Password',
    login: 'Log In',
    signUp: 'Sign Up',
    
    panelHistory: 'Save History',
    saveCurrentSong: 'Save Current',
    refreshList: 'Refresh List',
    untitledProject: 'Untitled Project',
    open: 'Open',
    delete: 'Delete',
    historyEmptyCloud: 'Projects saved after login\nwill appear here.',
    historyEmptyLocal: 'Saved projects will\nappear here.',
    
    panelGuides: 'Guidelines',
    remove: 'Remove',
    newGuideTitlePlaceholder: 'New Guideline Title',
    newGuideBodyPlaceholder: 'Enter writing rules, forbidden words, brand tone, structure, etc.',
    registerGuide: 'Register Guideline',
    
    panelInput: 'Song Info & Prompt Settings',
    songTitle: 'Title',
    songTitlePlaceholder: 'ex: Neon City Lights',
    targetTool: 'Target AI',
    targetToolPlaceholder: 'ex: Suno, Udio',
    genre: 'Genre',
    genrePlaceholder: 'ex: Synthwave, K-pop',
    mood: 'Mood',
    moodPlaceholder: 'ex: Nostalgic, Energetic',
    lyricsLanguage: 'Lyrics Language',
    vocalGender: 'Vocal Gender',
    vocalStyle: 'Vocal Style',
    vocalStylePlaceholder: 'ex: Husky, Clear, Soft',
    vocalGroup: 'Vocal Group',
    tempo: 'Tempo (BPM)',
    tempoVerySlow: 'Very Slow',
    tempoSlow: 'Slow',
    tempoNormal: 'Normal',
    tempoFast: 'Fast',
    tempoVeryFast: 'Very Fast',
    structure: 'Structure',
    structurePlaceholder: 'ex: [Intro] - [Verse 1] - [Chorus] - [Drop] - [Outro]',
    theme: 'Theme & Narrative',
    themeSub: 'The story the song conveys',
    themePlaceholder: 'Describe the story this song tells in detail.',
    extraRequests: 'Extra Requests',
    extraSub: 'Specific instruments, effects, etc.',
    extraPlaceholder: 'ex: Add electric guitar solo in chorus, emphasize reverb',
    
    generating: 'AI is generating prompt...',
    generateBtn: 'GENERATE PROMPT & LYRICS',
    generateSampleBtn: 'Sample Output',
    
    panelOutput: 'Generated Output',
    promptLabel: 'Style Prompt',
    promptPlaceholder: 'Music style prompt will be generated here.',
    titleLabel: 'Title',
    titlePlaceholder: 'Song Title',
    lyricsLabel: 'Lyrics Editor',
    lyricsPlaceholder: 'Lyrics with section tags will appear here. Edit to finalize.',
    notesLabel: 'AI Suggestions (Notes)',
    notesPlaceholder: 'Production notes or AI suggestions will appear here.',
    copyAllBtn: 'Copy All to Clipboard',
    clearResultBtn: 'Clear Results',
    copyTooltip: 'Copy',
    copyPrompt: 'Prompt',
    copyTitle: 'Title',
    copyLyrics: 'Lyrics',
    copyNotes: 'Notes',
    copyAll: 'All Results',
    libraryEmpty: 'No saved projects found.',
    libPrompt: 'Style Prompt',
    libLyrics: 'Lyrics'
  }
};

const getOptions = (lang) => {
  if (lang === 'EN') {
    return {
      language: [{ value: '한국어', label: 'Korean' }, { value: '영어', label: 'English' }, { value: '일본어', label: 'Japanese' }],
      vocalGroup: [{ value: '솔로', label: 'Solo' }, { value: '중창', label: 'Duet' }, { value: '합창', label: 'Choir' }, { value: '그룹', label: 'Group' }],
      vocalGender: [{ value: '여성', label: 'Female' }, { value: '남성', label: 'Male' }, { value: '혼성/기타', label: 'Mixed/Other' }]
    };
  }
  return {
    language: [{ value: '한국어', label: '한국어' }, { value: '영어', label: '영어' }, { value: '일본어', label: '일본어' }],
    vocalGroup: [{ value: '솔로', label: '솔로' }, { value: '중창', label: '중창' }, { value: '합창', label: '합창' }, { value: '그룹', label: '그룹' }],
    vocalGender: [{ value: '여성', label: '여성' }, { value: '남성', label: '남성' }, { value: '혼성/기타', label: '혼성/기타' }]
  };
};


const INITIAL_FORM = {
  title: '비 오는 밤의 드라이브',
  theme: '헤어진 뒤에도 잊히지 않는 밤길의 감정',
  genre: 'Korean city pop, synth pop',
  mood: 'nostalgic, rainy, warm, cinematic',
  language: '한국어',
  vocalGender: '여성',
  vocal: 'soft vocal, airy harmony',
  vocalGroup: '솔로',
  tempo: 120,
  targetTool: 'Suno',
  structure: 'Verse 1, Pre-Chorus, Chorus, Verse 2, Chorus, Bridge, Final Chorus',
  extra: '후렴에 영어 한 문장 훅을 섞어줘. 선정적 표현 없이 대중적인 가사로.',
};

const STORAGE_KEYS = {
  settings: 'songprompt-ai-settings-v1',
  guides: 'songprompt-guides-v1',
  supabase: 'songprompt-supabase-v1',
  localHistory: 'songprompt-local-history-v1',
};

const ENV_SUPABASE = {
  url: import.meta.env.VITE_SUPABASE_URL || '',
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
};

const SUPABASE_SQL = `create table if not exists song_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  prompt text default '',
  lyrics text default '',
  notes text default '',
  form jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table song_history enable row level security;

create policy "Users can read own song history"
on song_history for select
using (auth.uid() = user_id);

create policy "Users can insert own song history"
on song_history for insert
with check (auth.uid() = user_id);

create policy "Users can delete own song history"
on song_history for delete
using (auth.uid() = user_id);`;

const readJson = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const getInitialSupabaseConfig = () => {
  const saved = readJson(STORAGE_KEYS.supabase, {});
  return {
    dashboardUrl: saved.dashboardUrl || '',
    url: saved.url || ENV_SUPABASE.url,
    anonKey: saved.anonKey || ENV_SUPABASE.anonKey,
  };
};

const getSupabaseUrlFromInput = (value) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return { url: '', message: 'Supabase 주소를 입력하세요' };
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname.endsWith('.supabase.co')) {
      return { url: parsed.origin, message: 'Supabase API URL을 적용했습니다' };
    }

    const projectMatch = parsed.pathname.match(/\/dashboard\/project\/([a-z0-9]+)/i);
    if (parsed.hostname === 'supabase.com' && projectMatch?.[1]) {
      return {
        url: `https://${projectMatch[1]}.supabase.co`,
        message: '프로젝트 대시보드 주소에서 API URL을 자동 적용했습니다. anon key도 입력하세요',
      };
    }

    if (parsed.hostname === 'supabase.com' && parsed.pathname.includes('/dashboard/org/')) {
      return {
        url: '',
        message: '이 주소는 조직 주소입니다. 조직 안의 프로젝트를 클릭한 뒤 Project Settings > API의 Project URL과 anon key를 넣어야 합니다',
      };
    }
  } catch {
    return { url: '', message: '올바른 URL 형식이 아닙니다' };
  }

  return { url: '', message: 'Supabase 프로젝트 URL 또는 dashboard/project 주소를 넣어주세요' };
};

const getSupabaseCallbackUrl = (supabaseUrl) => {
  const trimmed = supabaseUrl.trim();
  if (!trimmed) return '';
  try {
    return `${new URL(trimmed).origin}/auth/v1/callback`;
  } catch {
    return '';
  }
};

const makeFallback = (form, guideText) => {
  const prompt = [
    form.genre,
    form.mood,
    form.vocalGender === '여성' ? 'female vocal' : form.vocalGender === '남성' ? 'male vocal' : form.vocalGender,
    form.vocal,
    `${form.vocalGroup} vocal arrangement`,
    `${form.tempo} BPM`,
    `${form.language} lyrics`,
    'catchy chorus',
    'polished production',
  ]
    .filter(Boolean)
    .join(', ');

  return `STYLE PROMPT\n${prompt}\n\nTITLE\n${form.title || 'Untitled'}\n\nLYRICS\n[Verse 1]\n젖은 유리창 위로 네 이름이 번져\n신호등 불빛마다 마음이 멈춰 서\n돌아갈 길은 없다는 걸 알면서도\n나는 같은 거리를 다시 지나가\n\n[Pre-Chorus]\n라디오 끝에 남은 작은 숨처럼\n아직도 넌 내 밤을 흔들어\n\n[Chorus]\nRain on the midnight road\n너를 잊는 법을 몰라\n흐려진 불빛 사이로\n우리의 계절이 또 지나가\nRain on the midnight road\n끝내 말하지 못한 말\n빗소리 안에 묻어둘게\n오늘도 널 지나쳐 가\n\n[Verse 2]\n텅 빈 조수석 위로 새벽이 내려\n익숙한 골목마다 추억이 켜져\n괜찮아질 거라는 흔한 말 대신\n가만히 속도를 낮춰 숨을 쉬어\n\n[Bridge]\n언젠가 이 노래가 끝나면\n나도 웃으며 널 놓을 수 있을까\n\n[Final Chorus]\nRain on the midnight road\n너를 잊는 법을 배워\n희미한 불빛 너머로\n새로운 아침이 날 부르나 봐\n\nNOTES\n- 대상 툴: ${form.targetTool}\n- 가사 언어: ${form.language}\n- 보컬 구성: ${form.vocalGroup}\n- 구조: ${form.structure}\n- 반영 지침: ${guideText ? '등록 지침 포함' : '기본 작법'}`;
};

const EMPTY_RESULT = {
  prompt: '',
  title: '',
  lyrics: '',
  notes: '',
  raw: '',
};

const parseGeneratedText = (text) => {
  const source = text.trim();
  if (!source) return EMPTY_RESULT;

  const sectionNames = ['STYLE PROMPT', 'TITLE', 'LYRICS', 'NOTES', 'API ERROR'];
  const pattern = new RegExp(`^(${sectionNames.join('|')})\\s*$`, 'gim');
  const matches = [...source.matchAll(pattern)];
  const sections = {};

  matches.forEach((match, index) => {
    const name = match[1].toUpperCase();
    const start = match.index + match[0].length;
    const end = matches[index + 1]?.index ?? source.length;
    sections[name] = source.slice(start, end).trim();
  });

  if (!matches.length) {
    return { ...EMPTY_RESULT, lyrics: source, raw: source };
  }

  return {
    prompt: sections['STYLE PROMPT'] || '',
    title: sections.TITLE || '',
    lyrics: sections.LYRICS || '',
    notes: [sections.NOTES, sections['API ERROR'] && `API ERROR\n${sections['API ERROR']}`].filter(Boolean).join('\n\n'),
    raw: source,
  };
};

const composeGeneratedText = (resultParts) => [
  ['STYLE PROMPT', resultParts.prompt],
  ['TITLE', resultParts.title],
  ['LYRICS', resultParts.lyrics],
  ['NOTES', resultParts.notes],
]
  .filter(([, value]) => value.trim())
  .map(([label, value]) => `${label}\n${value.trim()}`)
  .join('\n\n');

const buildInstructionPrompt = (form, guideText) => `너는 음악 생성 AI용 프롬프트와 가사를 만드는 전문 작사가/프로듀서다.

목표: ${form.targetTool}에 바로 넣을 수 있는 스타일 프롬프트와 완성형 가사를 작성한다.

곡 정보:
- 제목: ${form.title}
- 주제: ${form.theme}
- 장르: ${form.genre}
- 분위기: ${form.mood}
- 언어: ${form.language}
- 보컬 성별: ${form.vocalGender || '여성'}
- 보컬 톤: ${form.vocal}
- 보컬 구성: ${form.vocalGroup}
- 템포: ${form.tempo} BPM
- 구조: ${form.structure}
- 추가 요청: ${form.extra}

등록 지침서:
${guideText || '등록된 추가 지침 없음'}

출력 형식은 반드시 아래 순서를 따른다.
STYLE PROMPT
영어 중심의 음악 스타일 프롬프트 1개

TITLE
곡 제목

LYRICS
섹션 태그가 포함된 완성 가사

NOTES
짧은 제작 메모 3개`;

async function callOpenAI(settings, prompt) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      input: prompt,
      temperature: 0.85,
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || 'OpenAI 호출 실패');
  return data.output_text || data.output?.flatMap((item) => item.content || []).map((part) => part.text).join('\n') || '';
}

async function callGemini(settings, prompt) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${settings.model}:generateContent?key=${settings.apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || 'Gemini 호출 실패');
  return data?.candidates?.[0]?.content?.parts?.map((part) => part.text).join('\n') || '';
}

async function callClaude(settings, prompt) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': settings.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: settings.model,
      max_tokens: 2200,
      temperature: 0.85,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || 'Claude 호출 실패');
  return data?.content?.map((part) => part.text).join('\n') || '';
}

function App() {
  const [currentTab, setCurrentTab] = useState('studio');
  const [uiLanguage, setUiLanguage] = useState(() => {
    const browserLang = navigator.language || navigator.userLanguage || '';
    return browserLang.toLowerCase().startsWith('ko') ? 'KO' : 'EN';
  });
  const t = TRANSLATIONS[uiLanguage];
  const [form, setForm] = useState(INITIAL_FORM);
  const [settings, setSettings] = useState(() => readJson(STORAGE_KEYS.settings, {
    provider: 'openai',
    model: PROVIDERS.openai.models[0],
    apiKey: '',
  }));
  const [guides, setGuides] = useState(() => readJson(STORAGE_KEYS.guides, DEFAULT_GUIDES));
  const [activeGuideIds, setActiveGuideIds] = useState(['suno-clear', 'hook-first']);
  const [draftGuide, setDraftGuide] = useState({ title: '', body: '' });
  const [resultParts, setResultParts] = useState(EMPTY_RESULT);
  const [supabaseConfig, setSupabaseConfig] = useState(getInitialSupabaseConfig);
  const [authForm, setAuthForm] = useState({ email: '', password: '' });
  const [user, setUser] = useState(null);
  const [history, setHistory] = useState([]);
  const [status, setStatus] = useState('대기 중'); // Will be localized dynamically
  const [isGenerating, setIsGenerating] = useState(false);

  const provider = PROVIDERS[settings.provider];
  useEffect(() => {
    if (status === '대기 중' || status === 'Waiting') setStatus(t.statusWaiting);
  }, [uiLanguage]);
  const isCloudMode = Boolean(supabaseConfig.url.trim() && supabaseConfig.anonKey.trim());
  const supabaseCallbackUrl = getSupabaseCallbackUrl(supabaseConfig.url);
  const supabase = useMemo(() => {
    if (!supabaseConfig.url.trim() || !supabaseConfig.anonKey.trim()) return null;
    return createClient(supabaseConfig.url.trim(), supabaseConfig.anonKey.trim());
  }, [supabaseConfig]);
  const guideText = useMemo(
    () => guides.filter((guide) => activeGuideIds.includes(guide.id)).map((guide) => `## ${guide.title}\n${guide.body}`).join('\n\n'),
    [guides, activeGuideIds]
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.guides, JSON.stringify(guides));
  }, [guides]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.supabase, JSON.stringify(supabaseConfig));
  }, [supabaseConfig]);

  useEffect(() => {
    if (!supabase) {
      setUser(null);
      setHistory(readJson(STORAGE_KEYS.localHistory, []));
      return undefined;
    }

    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user || null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (supabase && user) {
      loadHistory();
    } else if (supabase && !user) {
      setHistory([]);
    } else {
      setHistory(readJson(STORAGE_KEYS.localHistory, []));
    }
  }, [supabase, user]);

  const updateForm = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const updateProvider = (providerId) => {
    setSettings((current) => ({
      ...current,
      provider: providerId,
      model: PROVIDERS[providerId].models[0],
    }));
  };

  const addGuide = () => {
    if (!draftGuide.title.trim() || !draftGuide.body.trim()) return;
    const id = `guide-${Date.now()}`;
    setGuides((current) => [...current, { id, title: draftGuide.title.trim(), body: draftGuide.body.trim() }]);
    setActiveGuideIds((current) => [...current, id]);
    setDraftGuide({ title: '', body: '' });
  };

  const removeGuide = (id) => {
    setGuides((current) => current.filter((guide) => guide.id !== id));
    setActiveGuideIds((current) => current.filter((guideId) => guideId !== id));
  };

  const setGeneratedText = (text) => {
    setResultParts(parseGeneratedText(text));
  };

  const updateResultPart = (key, value) => {
    setResultParts((current) => ({ ...current, [key]: value }));
  };

  const generate = async () => {
    const prompt = buildInstructionPrompt(form, guideText);
    setIsGenerating(true);
    setStatus(t.statusGenerating);
    try {
      if (!settings.apiKey.trim()) {
        setGeneratedText(makeFallback(form, guideText));
        setStatus(t.statusSampleGenerated);
        return;
      }
      const nextResult = settings.provider === 'openai'
        ? await callOpenAI(settings, prompt)
        : settings.provider === 'gemini'
          ? await callGemini(settings, prompt)
          : await callClaude(settings, prompt);
      setGeneratedText(nextResult.trim() || makeFallback(form, guideText));
      setStatus(`${provider.name} ${t.statusGenerated}`);
    } catch (error) {
      setGeneratedText(`${makeFallback(form, guideText)}\n\nAPI ERROR\n${error.message}`);
      setStatus(t.statusError);
    } finally {
      setIsGenerating(false);
    }
  };

  const copyText = async (label, text) => {
    await navigator.clipboard.writeText(text);
    setStatus(`${label} ${t.statusCopied}`);
  };

  const clearResult = () => {
    setResultParts(EMPTY_RESULT);
    setStatus(t.statusCleared);
  };

  const applySupabaseAddress = () => {
    const result = getSupabaseUrlFromInput(supabaseConfig.dashboardUrl || supabaseConfig.url);
    if (result.url) {
      setSupabaseConfig((current) => ({ ...current, url: result.url }));
    }
    setStatus(result.message);
  };

  const signIn = async () => {
    if (!supabase) {
      setStatus(t.statusLoginRequired);
      return;
    }
    const { error } = await supabase.auth.signInWithPassword(authForm);
    if (error) {
      setStatus(`${t.statusLoginFail} ${error.message}`);
      return;
    }
    setStatus(t.statusLoginSuccess);
  };

  const signUp = async () => {
    if (!supabase) {
      setStatus(t.statusLoginRequired);
      return;
    }
    const { error } = await supabase.auth.signUp(authForm);
    if (error) {
      setStatus(`${t.statusSignUpFail} ${error.message}`);
      return;
    }
    setStatus(t.statusSignUpSuccess);
  };

  const signInWithGoogle = async () => {
    if (!supabase) {
      setStatus(t.statusGoogleLoginLocal);
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        // 항상 구글 계정 선택 화면을 띄우도록 강제 (자동 로그인 방지)
        queryParams: {
          prompt: 'select_account',
        },
      },
    });
    if (error) {
      setStatus(`${t.statusGoogleLoginFail} ${error.message}`);
    }
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setStatus(t.statusLogout);
  };

  const loadHistory = async () => {
    if (!supabase) {
      setHistory(readJson(STORAGE_KEYS.localHistory, []));
      setStatus(t.statusHistoryLocalLoaded);
      return;
    }
    if (!user) {
      setStatus(t.statusHistoryCloudLoginReq);
      return;
    }
    const { data, error } = await supabase
      .from('song_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      setStatus(`${t.statusHistoryLoadFail} ${error.message}`);
      return;
    }
    setHistory(data || []);
  };

  const saveHistory = async () => {
    const payload = {
      title: resultParts.title.trim() || form.title || 'Untitled',
      prompt: resultParts.prompt,
      lyrics: resultParts.lyrics,
      notes: resultParts.notes,
      form,
    };

    if (!supabase) {
      const localItem = {
        ...payload,
        id: `local-${Date.now()}`,
        created_at: new Date().toISOString(),
      };
      const nextHistory = [localItem, ...readJson(STORAGE_KEYS.localHistory, [])].slice(0, 50);
      writeJson(STORAGE_KEYS.localHistory, nextHistory);
      setHistory(nextHistory);
      setStatus(t.statusHistoryLocalSaved);
      return;
    }

    if (!user) {
      setStatus(t.statusHistoryCloudSaveReq);
      return;
    }

    const cloudPayload = {
      ...payload,
      user_id: user.id,
    };

    const { error } = await supabase.from('song_history').insert(cloudPayload);
    if (error) {
      setStatus(`${t.statusHistorySaveFail} ${error.message}`);
      return;
    }
    setStatus(t.statusHistorySaved);
    loadHistory();
  };

  const openHistoryItem = (item) => {
    setResultParts({
      prompt: item.prompt || '',
      title: item.title || '',
      lyrics: item.lyrics || '',
      notes: item.notes || '',
      raw: '',
    });
    if (item.form) setForm((current) => ({ ...current, ...item.form }));
    setStatus(t.statusHistoryOpened);
  };

  const deleteHistoryItem = async (id) => {
    if (!supabase) {
      const nextHistory = readJson(STORAGE_KEYS.localHistory, []).filter((item) => item.id !== id);
      writeJson(STORAGE_KEYS.localHistory, nextHistory);
      setHistory(nextHistory);
      setStatus(t.statusHistoryLocalDeleted);
      return;
    }
    if (!user) return;
    const { error } = await supabase.from('song_history').delete().eq('id', id);
    if (error) {
      setStatus(`${t.statusHistoryDeleteFail} ${error.message}`);
      return;
    }
    setStatus(t.statusHistoryDeleted);
    loadHistory();
  };

  return (
    <main className="min-h-screen bg-[#0A0A0A] text-[#EDEDED] font-sans selection:bg-[#FF3366]/30">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 border-b border-[#2E2E2E] bg-[#0A0A0A]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-5">
          
          {/* Left: Logo & Navigation */}
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2 cursor-pointer">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#FF3366] to-[#9213ec] text-white font-bold text-xl shadow-lg shadow-[#FF3366]/20">P</span>
              <span className="text-lg font-black tracking-widest text-[#EDEDED]">PROMPT<span className="text-[#FF3366]">STUDIO</span></span>
            </div>
            
            <nav className="hidden md:flex items-center gap-6">
              <button onClick={() => setCurrentTab('studio')} className={`text-sm font-semibold transition-colors ${currentTab === 'studio' ? 'text-[#FF3366]' : 'text-[#A1A1AA] hover:text-[#EDEDED]'}`}>{t.studio}</button>
              <button onClick={() => setCurrentTab('library')} className={`text-sm font-semibold transition-colors ${currentTab === 'library' ? 'text-[#FF3366]' : 'text-[#A1A1AA] hover:text-[#EDEDED]'}`}>{t.library}</button>
              <button className="text-sm font-medium text-[#A1A1AA] transition-colors hover:text-[#EDEDED] cursor-not-allowed">{t.explore}</button>
            </nav>
          </div>

          {/* Right: Language, Notifications, Profile */}
          <div className="flex items-center gap-5">
            
            {/* Engine Status / Latency */}
            <div className="hidden lg:flex items-center rounded-full border border-[#2E2E2E] bg-[#1A1A1A] px-3 py-1.5 text-[11px] font-medium text-[#A1A1AA] tracking-wide">
              <span className="mr-2 h-1.5 w-1.5 rounded-full bg-[#FF3366] animate-pulse shadow-[0_0_8px_#FF3366]"></span>
              {status}
            </div>

            {/* Language Toggle */}
            <div className="flex items-center rounded-full border border-[#2E2E2E] bg-[#1A1A1A] p-0.5">
              <button 
                onClick={() => setUiLanguage('KO')}
                className={`rounded-full px-3 py-1 text-[11px] font-bold transition-colors ${uiLanguage === 'KO' ? 'bg-[#2E2E2E] text-white shadow-sm' : 'text-[#A1A1AA] hover:text-white'}`}
              >KO</button>
              <button 
                onClick={() => setUiLanguage('EN')}
                className={`rounded-full px-3 py-1 text-[11px] font-bold transition-colors ${uiLanguage === 'EN' ? 'bg-[#2E2E2E] text-white shadow-sm' : 'text-[#A1A1AA] hover:text-white'}`}
              >EN</button>
            </div>

            <div className="h-4 w-px bg-[#2E2E2E]"></div>

            {/* Notification Icon */}
            <button className="relative text-[#A1A1AA] hover:text-white transition-colors">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
              <span className="absolute top-0 right-0.5 h-1.5 w-1.5 rounded-full bg-[#FF3366] shadow-[0_0_5px_#FF3366]"></span>
            </button>

            {/* User Profile / Login */}
            {user ? (
              <button className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#FF3366] to-[#9213ec] text-sm font-bold text-white shadow-lg ring-2 ring-[#0A0A0A] ring-offset-1 ring-offset-[#2E2E2E]">
                {user.email[0].toUpperCase()}
              </button>
            ) : (
              <button onClick={signInWithGoogle} className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1A1A1A] border border-[#2E2E2E] text-sm text-[#A1A1AA] hover:text-white hover:border-[#FF3366] transition-all">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
              </button>
            )}
          </div>
        </div>
      </header>

      {currentTab === 'studio' ? (
      <div className="mx-auto grid max-w-[1600px] gap-6 px-5 py-5 lg:grid-cols-[300px_1fr_340px] xl:grid-cols-[340px_1fr_460px]">
        {/* Left Column: Settings, Auth, History, Guides */}
        <section className="flex flex-col gap-5">
          <Panel title={t.panelAiConfig}>
            <label className="field-label">{t.provider}</label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(PROVIDERS).map(([id, item]) => (
                <button key={id} className={`seg-btn ${settings.provider === id ? 'seg-btn-active' : ''}`} onClick={() => updateProvider(id)}>
                  {item.name}
                </button>
              ))}
            </div>
            <label className="field-label mt-4">{t.model}</label>
            <select className="input" value={settings.model} onChange={(event) => setSettings({ ...settings, model: event.target.value })}>
              {provider.models.map((model) => <option key={model}>{model}</option>)}
            </select>
            <label className="field-label mt-4">{provider.keyLabel}</label>
            <input className="input" type="password" value={settings.apiKey} onChange={(event) => setSettings({ ...settings, apiKey: event.target.value })} placeholder={t.apiKeyPlaceholder} />
          </Panel>

          <Panel title={t.panelLoginSave}>
            {user ? (
              <div className="rounded-xl border border-[#2E2E2E] bg-[#121212]/80 p-4 text-sm text-[#EDEDED] shadow-inner">
                <div className="flex items-center gap-3 truncate font-bold">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#FF3366] to-[#9213ec] text-sm text-white shadow-lg shadow-[#FF3366]/20">
                    {user.email[0].toUpperCase()}
                  </div>
                  <span className="truncate">{user.email}</span>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <button className="secondary-btn" onClick={loadHistory}>{t.refresh}</button>
                  <button className="secondary-btn border-[#FF3366]/20 text-[#FF3366] hover:bg-[#FF3366]/10" onClick={signOut}>{t.logout}</button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <button className="google-btn w-full shadow-lg" onClick={signInWithGoogle}>{t.googleLogin}</button>
                
                <div className="relative flex items-center py-2">
                  <div className="flex-grow border-t border-[#2E2E2E]"></div>
                  <span className="mx-3 flex-shrink-0 text-[11px] font-bold tracking-wider text-[#A1A1AA] uppercase">{t.orEmail}</span>
                  <div className="flex-grow border-t border-[#2E2E2E]"></div>
                </div>

                <div className="grid gap-2.5">
                  <input className="input" value={authForm.email} onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })} placeholder={t.emailPlaceholder} />
                  <input className="input" type="password" value={authForm.password} onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })} placeholder={t.passwordPlaceholder} />
                </div>
                <div className="grid grid-cols-2 gap-2.5 mt-1">
                  <button className="primary-btn" onClick={signIn}>{t.login}</button>
                  <button className="secondary-btn" onClick={signUp}>{t.signUp}</button>
                </div>
              </div>
            )}
          </Panel>

          <Panel title={t.panelHistory}>
            <div className="mb-4 grid grid-cols-2 gap-2.5">
              <button className="primary-btn shadow-md shadow-[#FF3366]/10" onClick={saveHistory} disabled={!composeGeneratedText(resultParts)}>{t.saveCurrentSong}</button>
              <button className="secondary-btn" onClick={loadHistory} disabled={isCloudMode && !user}>{t.refreshList}</button>
            </div>
            <div className="max-h-64 space-y-2.5 overflow-auto pr-2 custom-scrollbar">
              {history.length ? history.map((item) => (
                <div key={item.id} className="group relative rounded-xl border border-[#2E2E2E] bg-[#121212]/80 p-3.5 transition-all duration-300 hover:border-[#FF3366]/50 hover:bg-[#1A1A1A] hover:shadow-lg hover:shadow-[#FF3366]/5">
                  <button className="block w-full text-left text-sm font-bold text-[#EDEDED] transition-colors group-hover:text-[#FF3366]" onClick={() => openHistoryItem(item)}>
                    {item.title || t.untitledProject}
                  </button>
                  <div className="mt-1.5 text-[11px] font-medium text-[#71717A] tracking-wide">{new Date(item.created_at).toLocaleString()}</div>
                  <div className="mt-3 flex gap-2">
                    <button className="copy-btn flex-1" onClick={() => openHistoryItem(item)}>{t.open}</button>
                    <button className="copy-btn flex-1 hover:bg-red-500/10 hover:text-red-400" onClick={() => deleteHistoryItem(item.id)}>{t.delete}</button>
                  </div>
                </div>
              )) : (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#2E2E2E] bg-[#121212]/30 px-4 py-8 text-center">
                  <svg className="mb-2 h-6 w-6 text-[#4A4A4A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <p className="text-xs leading-5 text-[#71717A]">
                    {isCloudMode ? t.historyEmptyCloud : t.historyEmptyLocal}
                  </p>
                </div>
              )}
            </div>
          </Panel>

          <Panel title={t.panelGuides}>
            <div className="space-y-2.5 max-h-60 overflow-auto pr-2 custom-scrollbar">
              {guides.map((guide) => (
                <div key={guide.id} className="rounded-xl border border-[#2E2E2E] bg-[#121212]/80 p-3.5 transition-all hover:border-[#4A4A4A] hover:bg-[#1A1A1A]">
                  <label className="flex cursor-pointer items-start gap-3 text-sm font-semibold text-[#EDEDED]">
                    <div className="relative flex items-center pt-0.5">
                      <input type="checkbox" className="peer h-4 w-4 appearance-none rounded border border-[#4A4A4A] bg-[#121212] checked:border-[#FF3366] checked:bg-[#FF3366] transition-all" checked={activeGuideIds.includes(guide.id)} onChange={(event) => {
                        setActiveGuideIds((current) => event.target.checked ? [...current, guide.id] : current.filter((id) => id !== guide.id));
                      }} />
                      <svg className="absolute left-1/2 top-1/2 mt-[1px] h-3 w-3 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 transition-opacity peer-checked:opacity-100 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <span className="leading-snug">{guide.title}</span>
                  </label>
                  <p className="mt-2.5 line-clamp-3 text-xs leading-relaxed text-[#A1A1AA] pl-7">{guide.body}</p>
                  <div className="mt-2.5 flex justify-end">
                    <button className="text-[11px] font-bold uppercase tracking-wide text-[#71717A] hover:text-[#FF3366] transition-colors" onClick={() => removeGuide(guide.id)}>{t.remove}</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-3 border-t border-[#2E2E2E] pt-4">
              <input className="input text-sm" value={draftGuide.title} onChange={(event) => setDraftGuide({ ...draftGuide, title: event.target.value })} placeholder={t.newGuideTitlePlaceholder} />
              <textarea className="input min-h-[80px] text-sm" value={draftGuide.body} onChange={(event) => setDraftGuide({ ...draftGuide, body: event.target.value })} placeholder={t.newGuideBodyPlaceholder} />
              <button className="secondary-btn w-full" onClick={addGuide}>{t.registerGuide}</button>
            </div>
          </Panel>
        </section>

        {/* Middle Column: Input Form */}
        <section className="flex flex-col">
          <Panel title={t.panelInput} className="flex-grow flex flex-col">
            <div className="grid gap-5 md:grid-cols-2">
              <TextInput label={t.songTitle} value={form.title} onChange={(value) => updateForm('title', value)} placeholder={t.songTitlePlaceholder} />
              <TextInput label={t.targetTool} value={form.targetTool} onChange={(value) => updateForm('targetTool', value)} placeholder={t.targetToolPlaceholder} />
              <TextInput label={t.genre} value={form.genre} onChange={(value) => updateForm('genre', value)} placeholder={t.genrePlaceholder} />
              <TextInput label={t.mood} value={form.mood} onChange={(value) => updateForm('mood', value)} placeholder={t.moodPlaceholder} />
              <ButtonGroupInput label={t.lyricsLanguage} value={form.language} options={getOptions(uiLanguage).language} onChange={(value) => updateForm('language', value)} />
              <ButtonGroupInput label={t.vocalGender} value={form.vocalGender || '여성'} options={getOptions(uiLanguage).vocalGender} onChange={(value) => updateForm('vocalGender', value)} />
              <TextInput label={t.vocalStyle} value={form.vocal} onChange={(value) => updateForm('vocal', value)} placeholder={t.vocalStylePlaceholder} />
              <SelectInput label={t.vocalGroup} value={form.vocalGroup} options={getOptions(uiLanguage).vocalGroup} onChange={(value) => updateForm('vocalGroup', value)} />
              <div className="md:col-span-2">
                <RangeInput 
                  label={t.tempo} 
                  value={form.tempo} 
                  onChange={(value) => updateForm('tempo', value)} 
                  min={60} 
                  max={200} 
                  presets={[
                    { label: t.tempoVerySlow, value: 60 },
                    { label: t.tempoSlow, value: 90 },
                    { label: t.tempoNormal, value: 120 },
                    { label: t.tempoFast, value: 150 },
                    { label: t.tempoVeryFast, value: 180 }
                  ]}
                />
              </div>
              <div className="md:col-span-2">
                <TextInput label={t.structure} value={form.structure} onChange={(value) => updateForm('structure', value)} placeholder="예: [Intro] - [Verse 1] - [Chorus] - [Drop] - [Outro]" />
              </div>
            </div>
            
            <div className="mt-6 flex-grow flex flex-col gap-5">
              <div className="flex flex-col flex-grow">
                <label className="field-label flex items-center justify-between">
                  <span>{t.theme}</span>
                  <span className="text-[10px] font-normal text-[#71717A]">{t.themeSub}</span>
                </label>
                <textarea className="input flex-grow min-h-[140px] resize-none" value={form.theme} onChange={(event) => updateForm('theme', event.target.value)} placeholder={t.themePlaceholder} />
              </div>
              
              <div className="flex flex-col">
                <label className="field-label flex items-center justify-between">
                  <span>{t.extraRequests}</span>
                  <span className="text-[10px] font-normal text-[#71717A]">{t.extraSub}</span>
                </label>
                <textarea className="input min-h-[100px] resize-none" value={form.extra} onChange={(event) => updateForm('extra', event.target.value)} placeholder={t.extraPlaceholder} />
              </div>
            </div>

            <div className="mt-8 flex gap-3 pt-5 border-t border-[#2E2E2E]">
              <button className="primary-btn flex-1 py-4 text-base shadow-lg shadow-[#FF3366]/20 relative overflow-hidden group" onClick={generate} disabled={isGenerating}>
                <span className="relative z-10 font-black tracking-wide">{isGenerating ? t.generating : t.generateBtn}</span>
                {!isGenerating && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-[100%] group-hover:animate-[shimmer_1.5s_infinite]"></div>}
              </button>
              <button className="secondary-btn w-32 font-bold" onClick={() => setGeneratedText(makeFallback(form, guideText))}>{t.generateSampleBtn}</button>
            </div>
          </Panel>
        </section>

        {/* Right Column: Output Results */}
        <section className="flex flex-col">
          <Panel title={t.panelOutput} className="flex-grow flex flex-col h-full">
            <div className="flex flex-col flex-grow gap-4 h-full">
              <ResultField
                label={t.promptLabel}
                value={resultParts.prompt}
                minHeight="h-32"
                placeholder={t.promptPlaceholder}
                onChange={(value) => updateResultPart('prompt', value)}
                onCopy={() => copyText(t.copyPrompt, resultParts.prompt)}
                tooltip={t.copyTooltip}
              />
              <ResultField
                label={t.titleLabel}
                value={resultParts.title}
                minHeight="h-12"
                placeholder={t.titlePlaceholder}
                onChange={(value) => updateResultPart('title', value)}
                onCopy={() => copyText(t.copyTitle, resultParts.title)}
                tooltip={t.copyTooltip}
              />
              <ResultField
                label={t.lyricsLabel}
                value={resultParts.lyrics}
                minHeight="flex-grow h-full"
                wrapperClassName="flex-grow flex flex-col min-h-[300px]"
                placeholder={t.lyricsPlaceholder}
                onChange={(value) => updateResultPart('lyrics', value)}
                onCopy={() => copyText(t.copyLyrics, resultParts.lyrics)}
                tooltip={t.copyTooltip}
              />
              <ResultField
                label={t.notesLabel}
                value={resultParts.notes}
                minHeight="h-28"
                placeholder={t.notesPlaceholder}
                onChange={(value) => updateResultPart('notes', value)}
                onCopy={() => copyText(t.copyNotes, resultParts.notes)}
                tooltip={t.copyTooltip}
              />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 pt-5 border-t border-[#2E2E2E]">
              <button className="secondary-btn flex items-center justify-center gap-2 border-[#FF3366] text-[#FF3366] hover:bg-[#FF3366] hover:text-white transition-colors" onClick={() => copyText(t.copyAll, composeGeneratedText(resultParts))} disabled={!composeGeneratedText(resultParts)}>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                {t.copyAllBtn}
              </button>
              <button className="secondary-btn text-[#71717A] hover:bg-white/5 hover:text-white" onClick={clearResult}>{t.clearResultBtn}</button>
            </div>
          </Panel>
        </section>
      </div>
      ) : (
        <LibraryView history={history} t={t} openHistoryItem={(item) => { openHistoryItem(item); setCurrentTab('studio'); }} deleteHistoryItem={deleteHistoryItem} />
      )}
    </main>
  );
}

function Panel({ title, children, className = "" }) {
  return (
    <div className={`rounded-xl border border-[#2E2E2E] bg-[#1A1A1A] p-5 shadow-lg shadow-black/20 ${className}`}>
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-[#EDEDED]">
        <span className="inline-block h-5 w-1 rounded-full bg-[#FF3366]"></span>
        {title}
      </h2>
      {children}
    </div>
  );
}

function TextInput({ label, value, onChange, placeholder = "" }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <input className="input" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}

function SelectInput({ label, value, options, onChange }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <select className="input" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => typeof option === 'string' ? <option key={option.value} value={option}>{option}</option> : <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function ButtonGroupInput({ label, value, options, onChange }) {
  return (
    <div className="block">
      <span className="field-label">{label}</span>
      <div className="flex h-[42px] bg-[#121212] border border-[#2E2E2E] rounded-xl p-1 gap-1">
        {options.map((option) => typeof option === 'string' ? {value: option, label: option} : option).map((option) => (
          <button
            key={option.value}
            className={`flex-1 rounded-lg text-sm font-semibold transition-all ${
              value === option.value 
                ? 'bg-gradient-to-r from-[#FF3366] to-[#9213ec] text-white shadow-md shadow-[#FF3366]/20' 
                : 'text-[#A1A1AA] hover:text-[#EDEDED] hover:bg-[#1A1A1A]'
            }`}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function RangeInput({ label, value, onChange, min = 60, max = 200, step = 1, unit = "BPM", presets = null }) {
  const numericValue = typeof value === 'number' && !isNaN(value) ? value : parseInt(value, 10) || 120;
  
  const handleChange = (e) => {
    onChange(Number(e.target.value));
  };
  
  return (
    <div className="block">
      <div className="flex justify-between items-center mb-1.5">
        <span className="field-label mb-0">{label}</span>
        <span className="text-[#FF3366] font-bold text-sm tracking-wider">{numericValue} {unit}</span>
      </div>
      <div className="relative flex items-center h-[42px] w-full rounded-xl bg-[#121212] border border-[#2E2E2E] px-4">
        <input 
          type="range" 
          min={min} 
          max={max} 
          step={step} 
          value={numericValue} 
          onChange={handleChange} 
          className="w-full h-1.5 bg-[#2E2E2E] rounded-lg appearance-none cursor-pointer outline-none hover:bg-[#4A4A4A] transition-colors accent-[#FF3366]" 
        />
      </div>
      {presets && (
        <div className="flex flex-wrap gap-2 mt-3">
          {presets.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => onChange(preset.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${numericValue === preset.value ? 'bg-[#FF3366] text-white border border-[#FF3366]' : 'bg-[#1A1A1A] text-[#A1A1AA] hover:bg-[#2A2A2A] hover:text-white border border-[#2E2E2E]'}`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ResultField({ label, value, placeholder, minHeight, onChange, onCopy, wrapperClassName = "mb-4", tooltip = "복사하기" }) {
  return (
    <div className={wrapperClassName}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <label className="field-label mb-0">{label}</label>
        <button className="copy-btn flex items-center justify-center p-1.5" onClick={onCopy} disabled={!value.trim()} title={tooltip}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </button>
      </div>
      <textarea
        className={`input ${minHeight} font-mono text-sm leading-6 resize-none`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function LibraryView({ history, t, openHistoryItem, deleteHistoryItem }) {
  return (
    <div className="mx-auto max-w-[1600px] px-5 py-8">
      <h1 className="mb-6 text-2xl font-bold text-[#EDEDED] flex items-center gap-2">
        <span className="inline-block h-6 w-1.5 rounded-full bg-[#FF3366]"></span>
        {t.library}
      </h1>
      
      {history.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#2E2E2E] bg-[#1A1A1A] py-20 text-center">
          <svg className="mb-4 h-12 w-12 text-[#4A4A4A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <p className="text-lg font-medium text-[#A1A1AA]">{t.libraryEmpty}</p>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {history.map(item => (
            <div key={item.id} className="group flex flex-col overflow-hidden rounded-xl border border-[#2E2E2E] bg-[#1A1A1A] transition-all hover:border-[#FF3366]/50 hover:shadow-lg hover:shadow-[#FF3366]/5">
              <div className="border-b border-[#2E2E2E] bg-[#121212]/50 p-4">
                <h3 className="truncate text-lg font-bold text-[#EDEDED] group-hover:text-[#FF3366] transition-colors">{item.title || t.untitledProject}</h3>
                <div className="mt-2 flex items-center justify-between text-[11px] font-medium text-[#71717A]">
                  <span>{new Date(item.created_at).toLocaleDateString()}</span>
                  <div className="flex gap-2">
                    {item.form?.genre && <span className="rounded-full bg-[#2E2E2E] px-2 py-0.5 text-[#EDEDED] border border-[#4A4A4A] truncate max-w-[80px]" title={item.form.genre}>{item.form.genre}</span>}
                    {item.form?.language && <span className="rounded-full bg-[#2E2E2E] px-2 py-0.5 text-[#EDEDED] border border-[#4A4A4A]">{item.form.language}</span>}
                  </div>
                </div>
              </div>
              
              <div className="flex-grow p-4">
                <div className="mb-4">
                  <h4 className="mb-1 text-[10px] font-black text-[#A1A1AA] tracking-wider uppercase">{t.libPrompt}</h4>
                  <p className="line-clamp-3 text-sm text-[#D4D4D8]">{item.prompt || '-'}</p>
                </div>
                <div>
                  <h4 className="mb-1 text-[10px] font-black text-[#A1A1AA] tracking-wider uppercase">{t.libLyrics}</h4>
                  <p className="line-clamp-4 text-sm text-[#D4D4D8] whitespace-pre-line">{item.lyrics || '-'}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-px bg-[#2E2E2E] border-t border-[#2E2E2E]">
                <button onClick={() => openHistoryItem(item)} className="bg-[#1A1A1A] p-2.5 text-sm font-bold text-[#EDEDED] transition-colors hover:bg-[#FF3366] hover:text-white">{t.open}</button>
                <button onClick={() => deleteHistoryItem(item.id)} className="bg-[#1A1A1A] p-2.5 text-sm font-bold text-[#A1A1AA] transition-colors hover:bg-red-500/10 hover:text-red-500">{t.delete}</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;
