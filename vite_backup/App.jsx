import { useEffect, useMemo, useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const PROVIDERS = {
  openai: {
    name: 'GPT',
    models: ['gpt-4o-mini', 'gpt-4o', 'o3-mini'],
    keyLabel: 'OpenAI API Key',
  },
  gemini: {
    name: 'Gemini',
    models: ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'],
    keyLabel: 'Google AI API Key',
  },
  claude: {
    name: 'Claude',
    models: ['claude-3-5-haiku-latest', 'claude-3-5-sonnet-latest', 'claude-3-7-sonnet-latest'],
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
    uploadGuideline: '문서 업로드 (PDF/TXT)',
    uploadPlaceholder: '드래그하거나 클릭하여 파일 선택',
    parsingFile: '문서 읽는 중...',
    parsingError: '문서를 읽을 수 없습니다.',
    
    panelInput: '곡 정보 및 프롬프트 설정',
    songTitle: '곡 제목 (Title)',
    songTitlePlaceholder: '예: Neon City Lights',
    targetTool: '대상 툴 (Target AI)',
    targetToolPlaceholder: '예: Suno, Udio',
    styleDesc: '스타일 설명 (Style Description)',
    styleDescPlaceholder: '예: Synthwave, K-pop, 몽환적인, 에너제틱한',
    lyricsLanguage: '가사 언어 (Language)',
    vocalGender: '보컬 성별 (Gender)',
    vocalFeaturing: '보컬 피쳐링 (Featuring)',
    vocalStyle: '보컬 톤/스타일 (Vocal Style)',
    vocalStylePlaceholder: '예: 허스키한, 맑은, 부드러운',
    vocalGroup: '보컬 구성 (Vocal Group)',
    songType: '곡 유형 (Song Type)',
    bgmType: 'BGM 용도 (BGM Type)',
    musicLength: '음악 길이 (Length)',
    tempo: '템포 (BPM/Tempo)',
    tempoVerySlow: '아주 느리게',
    tempoSlow: '느리게',
    tempoNormal: '보통',
    tempoFast: '빠르게',
    tempoVeryFast: '아주 빠르게',
    extraRequests: '추가 요청 (Extra Requests)',
    extraSub: '특정 악기, 특수 효과 등',
    extraPlaceholder: '예: 코러스에 일렉기타 솔로 추가, 리버브 이펙트 강조',
    excludeElements: '제외 요소 (Negative Prompt)',
    excludePlaceholder: '예: lo-fi, noise, bad vocals (선택 사항)',
    
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
    negativePromptLabel: '제외 프롬프트 (Negative Prompt)',
    negativePromptPlaceholder: '제외할 스타일 프롬프트가 여기에 생성됩니다.',
    copyAllBtn: '클립보드에 전체 복사',
    clearResultBtn: '결과 지우기',
    copyTooltip: '복사하기',
    copyPrompt: '프롬프트',
    copyTitle: '제목',
    copyLyrics: '가사',
    copyNotes: '메모',
    copyNegativePrompt: '제외 프롬프트',
    copyAll: '전체 결과',
    libraryEmpty: '저장된 프로젝트가 없습니다.',
    libPrompt: '스타일 프롬프트',
    libLyrics: '가사',
    thDate: '작성일',
    thTitle: '제목',
    thStyleDesc: '스타일 설명',
    thLanguage: '언어',
    thActions: '관리',
    thNumber: '번호',
    searchPlaceholder: '제목, 스타일 설명 검색...',
    prevPage: '이전',
    nextPage: '다음',
    pageInfo: '페이지 {current} / {total}',
    
    admin: '관리자',
    announcements: '공지사항',
    systemGuide: '고유 지침서',
    adminNotice: '모든 유저에게 표시될 공지사항입니다.',
    manageUsers: '유저 관리',
    manageGuides: '고유 지침서 관리',
    addAnnouncement: '공지사항 등록',
    addGuide: '지침서 등록',
    postAnnouncement: '작성 완료',
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
    uploadGuideline: 'Upload Document (PDF/TXT)',
    uploadPlaceholder: 'Drag or click to select file',
    parsingFile: 'Reading document...',
    parsingError: 'Cannot read document.',
    
    panelInput: 'Song Info & Prompt Settings',
    songTitle: 'Title',
    songTitlePlaceholder: 'ex: Neon City Lights',
    targetTool: 'Target AI',
    targetToolPlaceholder: 'ex: Suno, Udio',
    styleDesc: 'Style Description',
    styleDescPlaceholder: 'ex: Synthwave, K-pop, Nostalgic, Energetic',
    lyricsLanguage: 'Lyrics Language',
    vocalGender: 'Vocal Gender',
    vocalFeaturing: 'Vocal Featuring',
    vocalStyle: 'Vocal Style',
    vocalStylePlaceholder: 'ex: Husky, Clear, Soft',
    vocalGroup: 'Vocal Group',
    songType: 'Song Type',
    bgmType: 'BGM Type',
    musicLength: 'Music Length',
    tempo: 'Tempo (BPM)',
    tempoVerySlow: 'Very Slow',
    tempoSlow: 'Slow',
    tempoNormal: 'Normal',
    tempoFast: 'Fast',
    tempoVeryFast: 'Very Fast',
    extraRequests: 'Extra Requests',
    extraSub: 'Specific instruments, effects, etc.',
    extraPlaceholder: 'ex: Add electric guitar solo in chorus, emphasize reverb',
    excludeElements: 'Exclude Elements (Negative Prompt)',
    excludePlaceholder: 'ex: lo-fi, noise, bad vocals (optional)',
    
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
    negativePromptLabel: 'Negative Prompt',
    negativePromptPlaceholder: 'Negative style prompt will appear here.',
    copyAllBtn: 'Copy All to Clipboard',
    clearResultBtn: 'Clear Results',
    copyTooltip: 'Copy',
    copyPrompt: 'Prompt',
    copyTitle: 'Title',
    copyLyrics: 'Lyrics',
    copyNotes: 'Notes',
    copyNegativePrompt: 'Negative Prompt',
    copyAll: 'All Results',
    libraryEmpty: 'No saved projects found.',
    libPrompt: 'Style Prompt',
    libLyrics: 'Lyrics',
    thDate: 'Date',
    thTitle: 'Title',
    thStyleDesc: 'Style Description',
    thLanguage: 'Language',
    thActions: 'Actions',
    thNumber: 'No.',
    searchPlaceholder: 'Search title, style or prompt...',
    prevPage: 'Prev',
    nextPage: 'Next',
    pageInfo: 'Page {current} of {total}',
    
    admin: 'Admin',
    announcements: 'Announcements',
    systemGuide: 'System Guidelines',
    adminNotice: 'Announcements will be displayed to all users.',
    manageUsers: 'Manage Users',
    manageGuides: 'Manage System Guidelines',
    addAnnouncement: 'Add Announcement',
    addGuide: 'Add Guideline',
    postAnnouncement: 'Post',
  }
};

const getOptions = (lang) => {
  if (lang === 'EN') {
    return {
      language: [{ value: '한국어', label: 'Korean' }, { value: '영어', label: 'English' }, { value: '일본어', label: 'Japanese' }],
      vocalGroup: [{ value: '솔로', label: 'Solo' }, { value: '듀엣', label: 'Duet' }, { value: '듀오', label: 'Duo' }, { value: '중창', label: 'Vocal Ensemble' }, { value: '합창', label: 'Choir' }, { value: '그룹', label: 'Group' }],
      vocalGender: [{ value: '여성', label: 'Female' }, { value: '남성', label: 'Male' }, { value: '혼성/기타', label: 'Mixed/Other' }],
      vocalFeaturing: [{ value: '없음', label: 'None' }, { value: '남성 피쳐링', label: 'Male Ft.' }, { value: '여성 피쳐링', label: 'Female Ft.' }],
      songType: [{ value: 'vocal', label: 'Vocal Song' }, { value: 'instrumental', label: 'Instrumental / BGM' }],
      bgmType: [{ value: '영화음악', label: 'Film Score' }, { value: '홍보음악', label: 'Promotional' }, { value: '광고음악', label: 'Commercial' }, { value: '애니메이션', label: 'Animation' }, { value: '게임음악', label: 'Game Music' }, { value: '유튜브/기타', label: 'YouTube/Other' }],
      musicLength: [{ value: '15초', label: '15s' }, { value: '30초', label: '30s' }, { value: '1분', label: '1m' }, { value: '2분', label: '2m' }, { value: '3분 이상', label: '3m+' }]
    };
  }
  return {
    language: [{ value: '한국어', label: '한국어' }, { value: '영어', label: '영어' }, { value: '일본어', label: '일본어' }],
    vocalGroup: [{ value: '솔로', label: '솔로' }, { value: '듀엣', label: '듀엣 (Duet)' }, { value: '듀오', label: '듀오 (Duo)' }, { value: '중창', label: '중창' }, { value: '합창', label: '합창' }, { value: '그룹', label: '그룹' }],
    vocalGender: [{ value: '여성', label: '여성' }, { value: '남성', label: '남성' }, { value: '혼성/기타', label: '혼성/기타' }],
    vocalFeaturing: [{ value: '없음', label: '없음' }, { value: '남성 피쳐링', label: '남자 피쳐링' }, { value: '여성 피쳐링', label: '여자 피쳐링' }],
    songType: [{ value: 'vocal', label: '가사 있는 곡' }, { value: 'instrumental', label: '가사 없는 연주곡 (BGM)' }],
    bgmType: [{ value: '영화음악', label: '영화음악' }, { value: '홍보음악', label: '홍보음악' }, { value: '광고음악', label: '광고음악' }, { value: '애니메이션', label: '애니메이션' }, { value: '게임음악', label: '게임음악' }, { value: '유튜브/기타', label: '유튜브/기타' }],
    musicLength: [{ value: '15초', label: '15초' }, { value: '30초', label: '30초' }, { value: '1분', label: '1분' }, { value: '2분', label: '2분' }, { value: '3분 이상', label: '3분 이상' }]
  };
};


const INITIAL_FORM = {
  title: '비 오는 밤의 드라이브',
  styleDesc: 'Korean city pop, synth pop, nostalgic, rainy, warm, cinematic',
  language: '한국어',
  vocalGender: '여성',
  vocalFeaturing: '없음',
  vocal: 'soft vocal, airy harmony',
  vocalGroup: '솔로',
  songType: 'vocal',
  bgmType: '영화음악',
  musicLength: '1분',
  tempo: 120,
  targetTool: 'Suno',
  extra: '후렴에 영어 한 문장 훅을 섞어줘. 선정적 표현 없이 대중적인 가사로.',
  exclude: '',
};

const STORAGE_KEYS = {
  settings: 'songprompt-ai-settings-v1',
  guides: 'songprompt-guides-v1',
  activeGuides: 'songprompt-active-guides-v1',
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
using (auth.uid() = user_id);

-- Profiles Table
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  is_admin boolean default false,
  active_guide_ids text[] default '{}'::text[],
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "Enable read access for all authenticated users"
on profiles for select
using (auth.role() = 'authenticated');

create policy "Users can insert own profile"
on profiles for insert
with check (auth.uid() = id and is_admin = false);

create policy "Users can update own profile"
on profiles for update
using (auth.uid() = id)
with check (
  (is_admin = false) or 
  exists (
    select 1 from profiles
    where profiles.id = auth.uid() and profiles.is_admin = true
  )
);

create policy "Admins can update any profile"
on profiles for update
using (
  exists (
    select 1 from profiles
    where profiles.id = auth.uid() and profiles.is_admin = true
  )
);

-- System Guides Table
create table if not exists system_guides (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

alter table system_guides enable row level security;

create policy "Enable read access for all users"
on system_guides for select
using (true);

create policy "Enable all access for admins only"
on system_guides for all
using (
  exists (
    select 1 from profiles
    where profiles.id = auth.uid() and profiles.is_admin = true
  )
);

-- User Guides Table
create table if not exists user_guides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

alter table user_guides enable row level security;

create policy "Users can read own guides"
on user_guides for select
using (auth.uid() = user_id);

create policy "Users can insert own guides"
on user_guides for insert
with check (auth.uid() = user_id);

create policy "Users can update own guides"
on user_guides for update
using (auth.uid() = user_id);

create policy "Users can delete own guides"
on user_guides for delete
using (auth.uid() = user_id);

-- Announcements Table
create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  created_at timestamptz not null default now()
);

alter table announcements enable row level security;

create policy "Enable read access for all users"
on announcements for select
using (true);

create policy "Enable all access for admins only"
on announcements for all
using (
  exists (
    select 1 from profiles
    where profiles.id = auth.uid() and profiles.is_admin = true
  )
);

-- System Settings Table (Global API Keys, etc.)
create table if not exists system_settings (
  key text primary key,
  value text not null,
  created_at timestamptz not null default now()
);

alter table system_settings enable row level security;

create policy "Enable read access for all users"
on system_settings for select
using (true);

create policy "Enable all access for admins only"
on system_settings for all
using (
  exists (
    select 1 from profiles
    where profiles.id = auth.uid() and profiles.is_admin = true
  )
);

-- User Withdrawal Function
create or replace function delete_user()
returns void
language plpgsql
security definer
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;`;

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
    url: ENV_SUPABASE.url || saved.url || '',
    anonKey: ENV_SUPABASE.anonKey || saved.anonKey || '',
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
  if (form.songType === 'instrumental') {
    const prompt = [
      form.styleDesc,
      'instrumental',
      `${form.bgmType} style`,
      `${form.tempo} BPM`,
      'polished production',
      form.extra
    ].filter(Boolean).join(', ');
    const negativePrompt = form.exclude || 'noise, bad quality, vocal, voice, singing, speaking';

    return `STYLE PROMPT\n${prompt}\n\nNEGATIVE PROMPT\n${negativePrompt}\n\nTITLE\n${form.title || 'Untitled BGM'}\n\nLYRICS\n[Instrumental]\n\nNOTES\n- 대상 툴: ${form.targetTool}\n- 길이: ${form.musicLength}\n- 용도: ${form.bgmType}\n- 반영 지침: ${guideText ? '등록 지침 포함' : '기본 작법'}`;
  }

  const prompt = [
    form.styleDesc,
    form.vocalGender === '여성' ? 'female vocal' : form.vocalGender === '남성' ? 'male vocal' : form.vocalGender,
    form.vocalFeaturing !== '없음' ? (form.vocalFeaturing === '남성 피쳐링' ? 'featuring male vocal' : 'featuring female vocal') : '',
    form.vocal,
    `${form.vocalGroup} vocal arrangement`,
    `${form.tempo} BPM`,
    `${form.language} lyrics`,
    'catchy chorus',
    'polished production',
  ]
    .filter(Boolean)
    .join(', ');
  const negativePrompt = form.exclude || 'lo-fi, bad vocals, poor recording, out of tune';

  return `STYLE PROMPT\n${prompt}\n\nNEGATIVE PROMPT\n${negativePrompt}\n\nTITLE\n${form.title || 'Untitled'}\n\nLYRICS\n[Verse 1]\n젖은 유리창 위로 네 이름이 번져\n신호등 불빛마다 마음이 멈춰 서\n돌아갈 길은 없다는 걸 알면서도\n나는 같은 거리를 다시 지나가\n\n[Pre-Chorus]\n라디오 끝에 남은 작은 숨처럼\n아직도 넌 내 밤을 흔들어\n\n[Chorus]\nRain on the midnight road\n너를 잊는 법을 몰라\n흐려진 불빛 사이로\n우리의 계절이 또 지나가\nRain on the midnight road\n끝내 말하지 못한 말\n빗소리 안에 묻어둘게\n오늘도 널 지나쳐 가\n\n[Verse 2]\n텅 빈 조수석 위로 새벽이 내려\n익숙한 골목마다 추억이 켜져\n괜찮아질 거라는 흔한 말 대신\n가만히 속도를 낮춰 숨을 쉬어\n\n[Bridge]\n언젠가 이 노래가 끝나면\n나도 웃으며 널 놓을 수 있을까\n\n[Final Chorus]\nRain on the midnight road\n너를 잊는 법을 배워\n희미한 불빛 너머로\n새로운 아침이 날 부르나 봐\n\nNOTES\n- 대상 툴: ${form.targetTool}\n- 가사 언어: ${form.language}\n- 보컬 구성: ${form.vocalGroup}\n- 반영 지침: ${guideText ? '등록 지침 포함' : '기본 작법'}`;
};

const EMPTY_RESULT = {
  prompt: '',
  negativePrompt: '',
  title: '',
  lyrics: '',
  notes: '',
  raw: '',
};

const parseGeneratedText = (text) => {
  const source = text.trim();
  if (!source) return EMPTY_RESULT;

  const sectionNames = ['STYLE PROMPT', 'NEGATIVE PROMPT', 'TITLE', 'LYRICS', 'NOTES', 'API ERROR'];
  const pattern = new RegExp(`^[\\s#\\*\\-]*(${sectionNames.join('|')})[\\s:\\*\\-]*$`, 'gim');
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
    negativePrompt: sections['NEGATIVE PROMPT'] || '',
    title: sections.TITLE || '',
    lyrics: sections.LYRICS || '',
    notes: [sections.NOTES, sections['API ERROR'] && `API ERROR\n${sections['API ERROR']}`].filter(Boolean).join('\n\n'),
    raw: source,
  };
};

const composeGeneratedText = (resultParts) => [
  ['STYLE PROMPT', resultParts.prompt],
  ['NEGATIVE PROMPT', resultParts.negativePrompt],
  ['TITLE', resultParts.title],
  ['LYRICS', resultParts.lyrics],
  ['NOTES', resultParts.notes],
]
  .filter(([, value]) => value && value.trim())
  .map(([label, value]) => `${label}\n${value.trim()}`)
  .join('\n\n');

const buildInstructionPrompt = (form, guideText) => `너는 음악 생성 AI용 프롬프트와 가사를 만드는 전문 작사가/프로듀서다.

[사용자 정의 지침서 (1순위 반영)]
${guideText ? `아래 내용은 사용자가 설정한 고유 지침입니다. 프롬프트 및 가사 생성 시 **절대적으로 준수**하세요:\n${guideText}` : '등록된 추가 지침 없음'}

[우선순위 원칙 (PRIORITY RULES)]
모든 내용 생성 시 다음의 우선순위를 기본으로 가장 강력하게 적용해야 합니다:
1순위: [사용자 정의 지침서]의 내용
2순위: 곡 제목 (분위기와 주제의 핵심 뼈대)
3순위: 스타일 설명 (전반적인 장르와 무드)
다른 어떤 설정(보컬, 템포 등)보다 이 세 가지 핵심 요소가 프롬프트의 전반적인 방향성과 결과물을 지배하도록 작성하세요.

[CRITICAL RULE]
1. "STYLE PROMPT" 및 "NEGATIVE PROMPT" 섹션은 **반드시 100% 영어 쉼표 구분 키워드(English comma-separated keywords)로만** 작성해야 합니다. 절대 문장으로 작성하지 마세요.
2. "LYRICS", "TITLE", "NOTES" 섹션은 사용자가 지정한 [언어: ${form.language}]에 맞추어 작성해야 합니다.
3. 음악이 촌스럽거나 뻔하게 들리지 않도록, 최고 수준의 전문적인 프로듀싱 키워드와 세련된 사운드 질감을 적극적으로 추가하세요.
4. 출력 형식의 순서와 이름을 정확히 지키세요.

목표: ${form.targetTool}에 바로 복사하여 붙여넣을 수 있는 극도로 정교하고 트렌디한 스타일 프롬프트${form.songType === 'instrumental' ? '' : '와 완성형 가사'}를 생성한다.

곡 정보:
- 제목: ${form.title}
- 스타일 설명: ${form.styleDesc}
- 곡 유형: ${form.songType === 'instrumental' ? '가사 없는 연주곡/BGM (Instrumental)' : '보컬 곡'}
${form.songType === 'instrumental' ? 
`- 용도: ${form.bgmType || '영화음악'}
- 음악 길이: ${form.musicLength || '1분'}` 
: 
`- 언어: ${form.language}
- 보컬 성별: ${form.vocalGender || '여성'}
- 피쳐링: ${form.vocalFeaturing || '없음'}
- 보컬 톤: ${form.vocal}
- 보컬 구성: ${form.vocalGroup}`
}
- 템포: ${form.tempo} BPM
- 추가 요청: ${form.extra}
- 제외 요소 (Negative Prompt): ${form.exclude || (form.songType === 'instrumental' ? 'vocal, voice, singing, speaking, words' : 'lo-fi, bad vocals')}

출력 형식은 반드시 아래 순서를 따른다.
STYLE PROMPT
사용자가 제공한 정보(스타일, 템포, 보컬 등)를 바탕으로, 단순히 번역하는 것을 넘어 곡에 가장 잘 어울리는 구체적인 악기(instruments), 리듬/그루브(rhythm/groove), 특정 템포(예: tempo ${form.tempo} bpm), 프로듀싱 스타일(production style) 등을 포함한 15~20개의 고품질 영어 키워드를 쉼표(,)로 구분하여 나열하세요. 문장이 아닌 키워드 나열 형식이어야 합니다.
예시: k-hip hop, swing jazz groove, funky rhythm guitars, orchestral strings stabs, energetic brass hits, bouncy bassline, vinyl scratches, syncopated drums, tempo ${form.tempo} bpm, urban night mood, polished production
${form.songType === 'instrumental' ? '(반드시 맨 처음에 "instrumental, no vocal," 을 포함할 것)' : ''}

NEGATIVE PROMPT
제외할 요소를 영어 쉼표 구분 키워드로 나열.

TITLE
곡 제목

LYRICS
${form.songType === 'instrumental' ? '[Instrumental] 만 작성하고 다른 텍스트는 작성하지 마세요.' : '섹션 태그가 포함된 완성 가사'}

NOTES
짧은 제작 메모 3개`;

async function callOpenAI(settings, prompt, globalKey) {
  let apiKey = (globalKey || import.meta.env.VITE_OPENAI_API_KEY || settings.apiKey || '').trim();
  apiKey = apiKey.replace(/^["']|["']$/g, ''); // 쌍따옴표/홑따옴표가 잘못 들어간 경우 제거
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.85,
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || 'OpenAI 호출 실패');
  return data.choices?.[0]?.message?.content || '';
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
  const [activeGuideIds, setActiveGuideIds] = useState(() => readJson(STORAGE_KEYS.activeGuides, ['suno-clear', 'hook-first']));
  const [draftGuide, setDraftGuide] = useState({ title: '', body: '' });
  const [resultParts, setResultParts] = useState(EMPTY_RESULT);
  const [supabaseConfig, setSupabaseConfig] = useState(getInitialSupabaseConfig);
  const [authForm, setAuthForm] = useState({ email: '', password: '' });
  const [user, setUser] = useState(null);
  const [history, setHistory] = useState([]);
  const [status, setStatus] = useState('대기 중'); // Will be localized dynamically
  const [isGenerating, setIsGenerating] = useState(false);
  const fileInputRef = useRef(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [systemGuides, setSystemGuides] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [lastReadAnnouncementAt, setLastReadAnnouncementAt] = useState(() => localStorage.getItem('lastReadAnnouncementAt') || null);
  const [draftAnnouncement, setDraftAnnouncement] = useState({ title: '', content: '' });
  const [adminUsers, setAdminUsers] = useState([]);
  const [editingAnnouncementId, setEditingAnnouncementId] = useState(null);
  const [editingGuideId, setEditingGuideId] = useState(null);
  const [editingLocalGuideId, setEditingLocalGuideId] = useState(null);
  const [isAuthMenuOpen, setIsAuthMenuOpen] = useState(false);
  const [isAnnouncementsModalOpen, setIsAnnouncementsModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const authDropdownRef = useRef(null);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
  const [globalOpenAIKey, setGlobalOpenAIKey] = useState('');
  const [adminOpenAIKey, setAdminOpenAIKey] = useState('');

  const hasUnreadAnnouncements = announcements.length > 0 && 
    (!lastReadAnnouncementAt || new Date(announcements[0].created_at) > new Date(lastReadAnnouncementAt));

  const handleOpenAnnouncements = () => {
    setIsAnnouncementsModalOpen(true);
    if (announcements.length > 0) {
      const latestAt = announcements[0].created_at;
      localStorage.setItem('lastReadAnnouncementAt', latestAt);
      setLastReadAnnouncementAt(latestAt);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (authDropdownRef.current && !authDropdownRef.current.contains(event.target)) {
        setIsAuthMenuOpen(false);
      }
    };

    if (isAuthMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isAuthMenuOpen]);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsParsing(true);
    try {
      let text = '';
      if (file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const pageText = content.items.map(item => item.str).join(' ');
          fullText += pageText + '\\n';
        }
        text = fullText;
      } else if (file.type === 'text/plain') {
        text = await file.text();
      } else {
        alert(t.parsingError);
        setIsParsing(false);
        return;
      }

      setDraftGuide({
        title: file.name.replace(/\\.[^/.]+$/, ""),
        body: text.trim()
      });
    } catch (error) {
      console.error(error);
      alert(t.parsingError);
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

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
  const guideText = useMemo(() => {
    const activeLocal = guides.filter((g) => activeGuideIds.includes(g.id));
    const activeSystem = systemGuides.filter((g) => activeGuideIds.includes(g.id));
    return [...activeSystem, ...activeLocal].map((g) => `## ${g.title}\n${g.body}`).join('\n\n');
  }, [guides, systemGuides, activeGuideIds]);


  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    if (!supabase || !user) {
      localStorage.setItem(STORAGE_KEYS.guides, JSON.stringify(guides));
    }
  }, [guides, supabase, user]);

  useEffect(() => {
    if (!supabase || !user) {
      localStorage.setItem(STORAGE_KEYS.activeGuides, JSON.stringify(activeGuideIds));
    }
  }, [activeGuideIds, supabase, user]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.supabase, JSON.stringify(supabaseConfig));
  }, [supabaseConfig]);

  useEffect(() => {
    if (!supabase) {
      setUser(null);
      setIsAdmin(false);
      setSystemGuides([]);
      setAnnouncements([]);
      setHistory(readJson(STORAGE_KEYS.localHistory, []));
      setGuides(readJson(STORAGE_KEYS.guides, DEFAULT_GUIDES));
      setActiveGuideIds(readJson(STORAGE_KEYS.activeGuides, ['suno-clear', 'hook-first']));
      return undefined;
    }

    const fetchPublicData = async () => {
      try {
        const { data: sg } = await supabase.from('system_guides').select('*').order('created_at', { ascending: false });
        if (sg) {
          setSystemGuides(sg);
          setActiveGuideIds((curr) => {
            const newIds = sg.map(g => g.id).filter(id => !curr.includes(id));
            return [...curr, ...newIds];
          });
        }
      } catch (e) {
        console.error("Error fetching system guides:", e);
      }

      try {
        const { data: anns } = await supabase.from('announcements').select('*').order('created_at', { ascending: false });
        if (anns) setAnnouncements(anns);
      } catch (e) {
        console.error("Error fetching announcements:", e);
      }
      
      try {
        const { data: ss } = await supabase.from('system_settings').select('*').eq('key', 'openai_api_key').maybeSingle();
        if (ss?.value) {
          setGlobalOpenAIKey(ss.value);
          setAdminOpenAIKey(ss.value);
        }
      } catch (e) {
        console.error("Error fetching system settings:", e);
      }
    };
    fetchPublicData();

    const fetchProfile = async (u) => {
      if (!u) {
        setIsAdmin(false);
        setGuides(readJson(STORAGE_KEYS.guides, DEFAULT_GUIDES));
        setActiveGuideIds(readJson(STORAGE_KEYS.activeGuides, ['suno-clear', 'hook-first']));
        return;
      }
      try {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', u.id).single();
        if (profile) {
          setIsAdmin(profile.is_admin);
          if (profile.active_guide_ids) {
            setActiveGuideIds(profile.active_guide_ids);
          }
          if (profile.is_admin) {
            loadAdminUsers();
          }
        } else {
          await supabase.from('profiles').insert({ id: u.id, email: u.email, is_admin: false, active_guide_ids: ['suno-clear', 'hook-first'] });
          setIsAdmin(false);
          setActiveGuideIds(['suno-clear', 'hook-first']);
        }
      } catch (e) {
        console.error("Error fetching user profile:", e);
      }

      try {
        const { data: ug } = await supabase.from('user_guides').select('*').order('created_at', { ascending: false });
        if (ug) {
          setGuides(ug);
        }
      } catch (e) {
        console.error("Error fetching user guides:", e);
      }
    };

    const loadAdminUsers = async () => {
      const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (data) setAdminUsers(data);
    };

    supabase.auth.getSession().then(({ data }) => {
      const currentUser = data.session?.user || null;
      setUser(currentUser);
      fetchProfile(currentUser);
      if (currentUser) {
        setStatus(t.statusLoginSuccess);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user || null;
      setUser(currentUser);
      fetchProfile(currentUser);
      if (currentUser) {
        setStatus(t.statusLoginSuccess);
      } else {
        setStatus(t.statusLogout);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  const toggleAdminRole = async (userId, currentRole) => {
    if (!supabase || !isAdmin) return;
    const { error } = await supabase.from('profiles').update({ is_admin: !currentRole }).eq('id', userId);
    if (!error) {
      setAdminUsers(adminUsers.map(u => u.id === userId ? { ...u, is_admin: !currentRole } : u));
    }
  };

  useEffect(() => {
    if (supabase && user) {
      loadHistory();
    } else {
      if (supabase && !user) {
        setHistory([]);
      } else {
        setHistory(readJson(STORAGE_KEYS.localHistory, []));
      }
      setGuides(readJson(STORAGE_KEYS.guides, DEFAULT_GUIDES));
      setActiveGuideIds(readJson(STORAGE_KEYS.activeGuides, ['suno-clear', 'hook-first']));
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

  const addGuide = async () => {
    if (!draftGuide.title.trim() || !draftGuide.body.trim()) return;

    if (supabase && user) {
      if (editingLocalGuideId) {
        const { error } = await supabase.from('user_guides')
          .update({ title: draftGuide.title.trim(), body: draftGuide.body.trim() })
          .eq('id', editingLocalGuideId)
          .eq('user_id', user.id);
        if (!error) {
          setGuides((current) => current.map(g => g.id === editingLocalGuideId ? { ...g, title: draftGuide.title.trim(), body: draftGuide.body.trim() } : g));
          setEditingLocalGuideId(null);
          setStatus("지침서가 수정되었습니다.");
        } else {
          setStatus("지침서 수정 실패: " + error.message);
        }
      } else {
        const { data, error } = await supabase.from('user_guides').insert({
          title: draftGuide.title.trim(),
          body: draftGuide.body.trim(),
          user_id: user.id
        }).select();
        if (!error && data) {
          const newGuide = data[0];
          setGuides((current) => [...current, newGuide]);
          const nextActive = [...activeGuideIds, newGuide.id];
          setActiveGuideIds(nextActive);
          await supabase.from('profiles').update({ active_guide_ids: nextActive }).eq('id', user.id);
          setStatus("지침서가 등록되었습니다.");
        } else {
          setStatus("지침서 등록 실패: " + error.message);
        }
      }
    } else {
      if (editingLocalGuideId) {
        setGuides((current) => current.map(g => g.id === editingLocalGuideId ? { ...g, title: draftGuide.title.trim(), body: draftGuide.body.trim() } : g));
        setEditingLocalGuideId(null);
      } else {
        const id = `guide-${Date.now()}`;
        setGuides((current) => [...current, { id, title: draftGuide.title.trim(), body: draftGuide.body.trim() }]);
        setActiveGuideIds((current) => [...current, id]);
      }
    }
    setDraftGuide({ title: '', body: '' });
  };

  const removeGuide = async (id) => {
    if (supabase && user) {
      const { error } = await supabase.from('user_guides').delete().eq('id', id).eq('user_id', user.id);
      if (!error) {
        setGuides((current) => current.filter((guide) => guide.id !== id));
        const nextActive = activeGuideIds.filter((guideId) => guideId !== id);
        setActiveGuideIds(nextActive);
        await supabase.from('profiles').update({ active_guide_ids: nextActive }).eq('id', user.id);
        setStatus("지침서가 삭제되었습니다.");
      } else {
        setStatus("지침서 삭제 실패: " + error.message);
      }
    } else {
      setGuides((current) => current.filter((guide) => guide.id !== id));
      setActiveGuideIds((current) => current.filter((guideId) => guideId !== id));
    }
  };

  const setGeneratedText = (text) => {
    setResultParts(parseGeneratedText(text));
  };

  const updateResultPart = (key, value) => {
    setResultParts((current) => ({ ...current, [key]: value }));
  };

  const generateSample = async () => {
    const fallbackText = makeFallback(form, guideText);
    const parsedParts = parseGeneratedText(fallbackText);
    setResultParts(parsedParts);
    setStatus(t.statusSampleGenerated);
    await saveHistory(parsedParts);
  };

  const generate = async () => {
    const prompt = buildInstructionPrompt(form, guideText);
    setIsGenerating(true);
    setStatus(t.statusGenerating);
    try {
      const isGlobalOpenAI = settings.provider === 'openai' && (globalOpenAIKey || import.meta.env.VITE_OPENAI_API_KEY);
      if (!settings.apiKey.trim() && !isGlobalOpenAI) {
        const fallbackText = makeFallback(form, guideText);
        const parsedParts = parseGeneratedText(fallbackText);
        setResultParts(parsedParts);
        setStatus(t.statusSampleGenerated);
        await saveHistory(parsedParts);
        return;
      }
      const nextResult = settings.provider === 'openai'
        ? await callOpenAI(settings, prompt, globalOpenAIKey)
        : settings.provider === 'gemini'
          ? await callGemini(settings, prompt)
          : await callClaude(settings, prompt);
      const textToSave = nextResult.trim() || makeFallback(form, guideText);
      const parsedParts = parseGeneratedText(textToSave);
      setResultParts(parsedParts);
      setStatus(`${provider.name} ${t.statusGenerated}`);
      await saveHistory(parsedParts);
    } catch (error) {
      const fallbackText = makeFallback(form, guideText);
      const parsedParts = parseGeneratedText(fallbackText);
      parsedParts.notes = parsedParts.notes 
        ? `${parsedParts.notes}\n\n[API 통신 오류]\n${error.message}`
        : `[API 통신 오류]\n${error.message}`;
      setResultParts(parsedParts);
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

  const signOut = () => {
    if (!supabase) return;
    setIsAuthMenuOpen(false);
    setConfirmDialog({
      isOpen: true,
      title: '로그아웃',
      message: '정말 로그아웃 하시겠습니까?',
      onConfirm: async () => {
        await supabase.auth.signOut();
        setStatus(t.statusLogout);
      }
    });
  };

  const handlePostAnnouncement = async () => {
    if (!isAdmin || !draftAnnouncement.title || !draftAnnouncement.content) return;
    
    if (editingAnnouncementId) {
      const { data, error } = await supabase.from('announcements')
        .update({ title: draftAnnouncement.title, content: draftAnnouncement.content })
        .eq('id', editingAnnouncementId)
        .select();
        
      if (!error && data) {
        setAnnouncements(announcements.map(a => a.id === editingAnnouncementId ? data[0] : a));
        setDraftAnnouncement({ title: '', content: '' });
        setEditingAnnouncementId(null);
        setStatus('공지사항이 수정되었습니다.');
      }
    } else {
      const { data, error } = await supabase.from('announcements').insert({
        title: draftAnnouncement.title,
        content: draftAnnouncement.content
      }).select();
      if (!error && data) {
        setAnnouncements([data[0], ...announcements]);
        setDraftAnnouncement({ title: '', content: '' });
        setStatus(t.postAnnouncement);
      }
    }
  };

  const handleEditAnnouncement = (ann) => {
    setDraftAnnouncement({ title: ann.title, content: ann.content });
    setEditingAnnouncementId(ann.id);
  };

  const handleWithdraw = () => {
    if (!supabase || !user) return;
    setIsAuthMenuOpen(false);
    setConfirmDialog({
      isOpen: true,
      title: '계정 삭제',
      message: '정말 탈퇴하시겠습니까? 모든 정보가 삭제되며 복구할 수 없습니다.',
      onConfirm: async () => {
        const { error } = await supabase.rpc('delete_user');
        if (error) {
          setStatus(`탈퇴 실패: ${error.message}`);
        } else {
          await supabase.auth.signOut();
          setStatus('회원 탈퇴가 완료되었습니다.');
        }
      }
    });
  };

  const handleDeleteAnnouncement = (id) => {
    if (!isAdmin) return;
    setConfirmDialog({
      isOpen: true,
      title: '공지사항 삭제',
      message: '정말 이 공지사항을 삭제하시겠습니까?',
      onConfirm: async () => {
        const { error } = await supabase.from('announcements').delete().eq('id', id);
        if (!error) {
          setAnnouncements(announcements.filter(a => a.id !== id));
          setStatus(t.statusHistoryDeleted);
        }
      }
    });
  };

  const handlePostSystemGuide = async () => {
    if (!isAdmin || !draftGuide.title || !draftGuide.body) return;
    
    if (editingGuideId) {
      const { data, error } = await supabase.from('system_guides')
        .update({ title: draftGuide.title, body: draftGuide.body })
        .eq('id', editingGuideId)
        .select();
      if (!error && data) {
        setSystemGuides(systemGuides.map(g => g.id === editingGuideId ? data[0] : g));
        setDraftGuide({ title: '', body: '' });
        setEditingGuideId(null);
        setStatus('지침서가 수정되었습니다.');
      }
    } else {
      const { data, error } = await supabase.from('system_guides').insert({
        title: draftGuide.title,
        body: draftGuide.body
      }).select();
      if (!error && data) {
        setSystemGuides([data[0], ...systemGuides]);
        setDraftGuide({ title: '', body: '' });
        setStatus('지침서가 등록되었습니다.');
      }
    }
  };

  const handleDeleteSystemGuide = (id) => {
    if (!isAdmin) return;
    setConfirmDialog({
      isOpen: true,
      title: '지침서 삭제',
      message: '정말 이 지침서를 삭제하시겠습니까?',
      onConfirm: async () => {
        const { error } = await supabase.from('system_guides').delete().eq('id', id);
        if (!error) {
          setSystemGuides(systemGuides.filter(g => g.id !== id));
          setActiveGuideIds(activeGuideIds.filter(gid => gid !== id));
          setStatus(t.statusHistoryDeleted);
        }
      }
    });
  };

  const handleSaveAdminOpenAIKey = async () => {
    if (!supabase) return;
    if (!adminOpenAIKey.trim()) {
      const { error } = await supabase.from('system_settings').delete().eq('key', 'openai_api_key');
      if (!error) {
        setGlobalOpenAIKey('');
        setStatus('전역 OpenAI API 키가 삭제되었습니다.');
      } else {
        setStatus('키 삭제 실패: ' + error.message);
      }
      return;
    }
    
    const { error } = await supabase.from('system_settings')
      .upsert({ key: 'openai_api_key', value: adminOpenAIKey.trim() }, { onConflict: 'key' });
      
    if (!error) {
      setGlobalOpenAIKey(adminOpenAIKey.trim());
      setStatus('전역 OpenAI API 키가 저장되었습니다.');
    } else {
      setStatus('키 저장 실패: ' + error.message);
    }
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

  const saveHistory = async (explicitResultParts = null) => {
    const parts = explicitResultParts || resultParts;
    const payload = {
      title: parts.title?.trim() || form.title || 'Untitled',
      prompt: parts.prompt,
      lyrics: parts.lyrics,
      notes: parts.notes,
      form: {
        ...form,
        negativePrompt: parts.negativePrompt
      },
    };

    if (!supabase || !user) {
      const localItem = {
        ...payload,
        id: `local-${Date.now()}`,
        created_at: new Date().toISOString(),
      };
      const nextHistory = [localItem, ...readJson(STORAGE_KEYS.localHistory, [])].slice(0, 50);
      writeJson(STORAGE_KEYS.localHistory, nextHistory);
      setHistory(nextHistory);
      if (!supabase) {
        setStatus(t.statusHistoryLocalSaved);
      } else {
        setStatus(`${t.statusHistoryLocalSaved} (${t.statusHistoryCloudSaveReq})`);
      }
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

  const openHistoryItem = (item, mode = 'all') => {
    if (mode === 'all') {
      setResultParts({
        prompt: item.prompt || '',
        negativePrompt: item.negativePrompt || item.form?.negativePrompt || '',
        title: item.title || '',
        lyrics: item.lyrics || '',
        notes: item.notes || '',
        raw: '',
      });
      if (item.form) setForm((current) => ({ ...current, ...item.form }));
    } else if (mode === 'style') {
      if (item.form) {
        setForm(current => ({
          ...current,
          styleDesc: item.form.styleDesc || [item.form.genre, item.form.mood].filter(Boolean).join(', ') || current.styleDesc,
          language: item.form.language || current.language,
          vocalGender: item.form.vocalGender || current.vocalGender,
          vocalFeaturing: item.form.vocalFeaturing || current.vocalFeaturing || '없음',
          vocal: item.form.vocal || current.vocal,
          vocalGroup: item.form.vocalGroup || current.vocalGroup,
          tempo: item.form.tempo || current.tempo,
          songType: item.form.songType || current.songType || 'vocal',
          bgmType: item.form.bgmType || current.bgmType || '영화음악',
          musicLength: item.form.musicLength || current.musicLength || '1분'
        }));
      }
      setResultParts(current => ({
        ...current,
        prompt: item.prompt || '',
        negativePrompt: item.negativePrompt || item.form?.negativePrompt || ''
      }));
    } else if (mode === 'lyrics') {
      if (item.form) {
        setForm(current => ({
          ...current,
          targetTool: item.form.targetTool || current.targetTool,
          title: item.form.title || current.title,
          extra: item.form.extra || current.extra
        }));
      }
      setResultParts(current => ({
        ...current,
        title: item.title || '',
        lyrics: item.lyrics || '',
        notes: item.notes || ''
      }));
    }
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
              {isAdmin && (
                <button onClick={() => setCurrentTab('admin')} className={`text-sm font-semibold transition-colors ${currentTab === 'admin' ? 'text-[#FF3366]' : 'text-[#A1A1AA] hover:text-[#EDEDED]'}`}>{t.admin}</button>
              )}
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
            <div className="relative">
              <button 
                onClick={handleOpenAnnouncements}
                className="relative text-[#A1A1AA] hover:text-white transition-colors"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                {hasUnreadAnnouncements && (
                  <span className="absolute top-0 right-0.5 h-1.5 w-1.5 rounded-full bg-[#FF3366] shadow-[0_0_5px_#FF3366]"></span>
                )}
              </button>
            </div>

            {/* User Profile / Login Dropdown */}
            <div className="relative" ref={authDropdownRef}>
              {user ? (
                <button 
                  onClick={() => setIsAuthMenuOpen(!isAuthMenuOpen)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#FF3366] to-[#9213ec] text-sm font-bold text-white shadow-lg ring-2 ring-[#0A0A0A] ring-offset-1 ring-offset-[#2E2E2E] hover:ring-[#FF3366]/50 transition-all"
                >
                  {(user.email || 'U')[0].toUpperCase()}
                </button>
              ) : (
                <button 
                  onClick={() => setIsAuthMenuOpen(!isAuthMenuOpen)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1A1A1A] border border-[#2E2E2E] text-sm text-[#A1A1AA] hover:text-white hover:border-[#FF3366] transition-all"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                </button>
              )}

              {/* Auth Dropdown Menu */}
              {isAuthMenuOpen && (
                <div className="absolute right-0 mt-3 w-72 rounded-2xl border border-[#2E2E2E] bg-[#0A0A0A]/95 p-3 shadow-2xl shadow-black/50 backdrop-blur-xl z-50 ring-1 ring-white/5">
                  {user ? (
                    <div className="flex flex-col">
                      <div className="flex items-center gap-3 border-b border-[#2E2E2E]/50 pb-4 mb-2 px-2 pt-1">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#FF3366] to-[#9213ec] shadow-inner ring-1 ring-white/10">
                          <span className="text-lg font-bold text-white shadow-sm">{(user.email || 'U')[0].toUpperCase()}</span>
                        </div>
                        <div className="flex flex-col overflow-hidden">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            <span className="text-[9px] text-emerald-500 font-bold tracking-wider">ONLINE</span>
                          </div>
                          <p className="text-sm font-medium text-[#EDEDED] truncate" title={user.email || 'User'}>{user.email || 'User'}</p>
                          {isAdmin && (
                            <span className="inline-flex w-fit mt-1 text-[9px] bg-gradient-to-r from-[#FF3366]/20 to-[#9213ec]/20 border border-[#FF3366]/30 text-[#FF3366] px-1.5 py-0.5 rounded font-bold tracking-wider">
                              ADMINISTRATOR
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex flex-col gap-1">
                        <button 
                          onClick={() => signOut()} 
                          className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm font-medium text-[#A1A1AA] hover:text-white hover:bg-[#2E2E2E]/50 rounded-xl transition-all group"
                        >
                          <svg className="w-4 h-4 text-[#71717A] group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                          로그아웃
                        </button>
                        
                        <button 
                          onClick={() => handleWithdraw()} 
                          className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm font-medium text-[#71717A] hover:text-[#FF3366] hover:bg-[#FF3366]/10 rounded-xl transition-all group"
                        >
                          <svg className="w-4 h-4 text-[#71717A] group-hover:text-[#FF3366] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          계정 삭제
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <div className="flex gap-2 border-b border-[#2E2E2E] pb-2">
                        <button onClick={() => setAuthMode('login')} className={`flex-1 pb-1 text-sm font-semibold border-b-2 transition-colors ${authMode === 'login' ? 'border-[#FF3366] text-white' : 'border-transparent text-[#71717A] hover:text-[#A1A1AA]'}`}>로그인</button>
                        <button onClick={() => setAuthMode('signup')} className={`flex-1 pb-1 text-sm font-semibold border-b-2 transition-colors ${authMode === 'signup' ? 'border-[#FF3366] text-white' : 'border-transparent text-[#71717A] hover:text-[#A1A1AA]'}`}>회원가입</button>
                      </div>
                      <input type="email" placeholder="이메일" className="input text-sm !py-2" value={authForm.email} onChange={(e) => setAuthForm({...authForm, email: e.target.value})} />
                      <input type="password" placeholder="비밀번호" className="input text-sm !py-2" value={authForm.password} onChange={(e) => setAuthForm({...authForm, password: e.target.value})} />
                      
                      {authMode === 'login' ? (
                        <button onClick={() => { signIn(); setIsAuthMenuOpen(false); }} className="primary-btn w-full !py-2 text-sm font-semibold">로그인</button>
                      ) : (
                        <button onClick={() => { signUp(); setIsAuthMenuOpen(false); }} className="primary-btn w-full !py-2 text-sm font-semibold">회원가입</button>
                      )}
                      
                      <div className="relative flex items-center py-2">
                        <div className="flex-grow border-t border-[#2E2E2E]"></div>
                        <span className="flex-shrink-0 mx-3 text-[#71717A] text-[10px]">OR</span>
                        <div className="flex-grow border-t border-[#2E2E2E]"></div>
                      </div>
                      
                      <button onClick={() => { signInWithGoogle(); setIsAuthMenuOpen(false); }} className="google-btn w-full text-sm !py-2 shadow-md">
                        <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /><path fill="none" d="M1 1h22v22H1z" /></svg>
                        Google 로그인
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Announcements Modal for Users */}
      {isAnnouncementsModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setIsAnnouncementsModalOpen(false)}>
          <div className="w-full max-w-lg rounded-2xl border border-[#2E2E2E] bg-[#121212] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[#2E2E2E] p-4 bg-[#0A0A0A]">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#FF3366] text-white text-xs font-bold">!</span>
                공지사항
              </h3>
              <button onClick={() => setIsAnnouncementsModalOpen(false)} className="text-[#A1A1AA] hover:text-white">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-col gap-4 p-5 overflow-y-auto custom-scrollbar flex-1">
              {announcements.length === 0 ? (
                <div className="text-center text-[#71717A] py-10">등록된 공지사항이 없습니다.</div>
              ) : (
                announcements.map((ann) => (
                  <div key={ann.id} className="border-b border-[#2E2E2E] pb-4 mb-4 last:border-0 last:pb-0 last:mb-0">
                    <h4 className="text-sm font-bold text-[#EDEDED] mb-2">{ann.title}</h4>
                    <p className="text-sm text-[#A1A1AA] whitespace-pre-wrap leading-relaxed">{ann.content}</p>
                    <div className="mt-2 text-[10px] text-[#71717A]">{new Date(ann.created_at).toLocaleString()}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirm Dialog Modal */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 transition-all" onClick={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}>
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-gradient-to-b from-[#1A1A1A] to-[#121212] shadow-2xl overflow-hidden flex flex-col transform transition-all scale-100" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-xl font-extrabold text-white mb-2 tracking-tight">{confirmDialog.title}</h3>
              <p className="text-[#A1A1AA] text-sm leading-relaxed">{confirmDialog.message}</p>
            </div>
            <div className="flex items-center gap-3 p-4 bg-[#0A0A0A]/50 border-t border-white/5">
              <button 
                onClick={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
                className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-sm text-[#EDEDED] bg-white/5 hover:bg-white/10 transition-colors focus:outline-none"
              >
                취소
              </button>
              <button 
                onClick={() => { confirmDialog.onConfirm(); setConfirmDialog({ ...confirmDialog, isOpen: false }); }}
                className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-[#FF3366] to-[#FF5588] hover:from-[#E62E5C] hover:to-[#FF3366] shadow-[0_0_15px_rgba(255,51,102,0.3)] transition-all focus:outline-none"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}


      {hasUnreadAnnouncements && (
        <div className="bg-[#FF3366]/10 border-b border-[#FF3366]/20 py-2 px-5">
          <div className="mx-auto max-w-[1600px] flex items-center gap-3">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#FF3366] text-white text-[10px] font-bold">!</span>
            <div className="flex-1 overflow-hidden relative h-5">
              <div className="absolute whitespace-nowrap animate-marquee text-sm text-[#EDEDED] font-medium">
                {announcements.map((a, i) => (
                  <span key={a.id} className="mr-12">
                    <strong className="text-[#FF3366] mr-2">[{t.announcements}]</strong>
                    {a.title}: {a.content}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

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
            {settings.provider === 'openai' ? (
              <>
                <label className="field-label mt-4">{provider.keyLabel}</label>
                <input 
                  className="input opacity-50 cursor-not-allowed" 
                  type="password" 
                  value="************************" 
                  disabled 
                />
                <p className="text-[11px] text-[#A1A1AA] mt-1.5 ml-1">✓ 기본 시스템에 연동되어 별도의 API 키가 필요하지 않습니다.</p>
              </>
            ) : (
              <>
                <label className="field-label mt-4">{provider.keyLabel}</label>
                <input className="input" type="password" value={settings.apiKey} onChange={(event) => setSettings({ ...settings, apiKey: event.target.value })} placeholder={t.apiKeyPlaceholder} />
              </>
            )}
          </Panel>





          <Panel title={t.panelGuides}>
            <div className="space-y-2.5 max-h-60 overflow-auto pr-2 custom-scrollbar">
              {guides.map((guide) => (
                <div key={guide.id} className="rounded-xl border border-[#2E2E2E] bg-[#121212]/80 p-3.5 transition-all hover:border-[#4A4A4A] hover:bg-[#1A1A1A]">
                  <div className="flex justify-between items-start gap-2">
                    <label className="flex cursor-pointer items-start gap-3 text-sm font-semibold text-[#EDEDED] flex-1">
                      <div className="relative flex items-center pt-0.5">
                        <input type="checkbox" className="peer h-4 w-4 appearance-none rounded border border-[#4A4A4A] bg-[#121212] checked:border-[#FF3366] checked:bg-[#FF3366] transition-all" checked={activeGuideIds.includes(guide.id)} onChange={async (event) => {
                          const nextActive = event.target.checked 
                            ? [...activeGuideIds, guide.id] 
                            : activeGuideIds.filter((id) => id !== guide.id);
                          setActiveGuideIds(nextActive);
                          if (supabase && user) {
                            await supabase.from('profiles').update({ active_guide_ids: nextActive }).eq('id', user.id);
                          }
                        }} />
                        <svg className="absolute left-1/2 top-1/2 mt-[1px] h-3 w-3 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 transition-opacity peer-checked:opacity-100 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      </div>
                      <span className="leading-snug">{guide.title}</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <button className="text-[11px] font-bold tracking-wide text-[#71717A] hover:text-[#EDEDED] transition-colors" onClick={() => {
                        setEditingLocalGuideId(guide.id);
                        setDraftGuide({ title: guide.title, body: guide.body });
                      }}>수정</button>
                      <button className="text-[11px] font-bold uppercase tracking-wide text-[#71717A] hover:text-[#FF3366] transition-colors" onClick={() => removeGuide(guide.id)}>{t.remove}</button>
                    </div>
                  </div>
                  <p className="mt-2.5 line-clamp-3 text-xs leading-relaxed text-[#A1A1AA] pl-7">{guide.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-3 border-t border-[#2E2E2E] pt-4">
              {/* Document Upload Area */}
              <div className="flex flex-col gap-1.5">
                <label className="field-label flex justify-between items-center">
                  <span>{t.uploadGuideline}</span>
                  {isParsing && <span className="text-xs text-[#FF3366] animate-pulse">{t.parsingFile}</span>}
                </label>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="group relative flex flex-col items-center justify-center border border-dashed border-[#3D242D] bg-[#1D1216]/40 hover:border-[#FF2D55] hover:bg-[#25171C]/50 rounded-xl p-4 cursor-pointer transition-all duration-200"
                >
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
                    accept=".pdf,.txt" 
                    className="hidden" 
                  />
                  <svg className="w-5 h-5 text-[#9B828A] group-hover:text-[#FF2D55] mb-1.5 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <span className="text-xs text-[#9B828A] group-hover:text-[#EAE0E3] transition-colors">{t.uploadPlaceholder}</span>
                </div>
              </div>

              <input className="input text-sm" value={draftGuide.title} onChange={(event) => setDraftGuide({ ...draftGuide, title: event.target.value })} placeholder={t.newGuideTitlePlaceholder} disabled={isParsing} />
              <textarea className="input min-h-[80px] text-sm" value={draftGuide.body} onChange={(event) => setDraftGuide({ ...draftGuide, body: event.target.value })} placeholder={t.newGuideBodyPlaceholder} disabled={isParsing} />
              
              <div className="flex gap-2">
                {editingLocalGuideId && (
                  <button className="secondary-btn w-1/3" onClick={() => { setEditingLocalGuideId(null); setDraftGuide({ title: '', body: '' }); }} disabled={isParsing}>취소</button>
                )}
                <button className="secondary-btn flex-1" onClick={addGuide} disabled={isParsing}>{editingLocalGuideId ? '수정 저장' : t.registerGuide}</button>
              </div>
            </div>
          </Panel>
        </section>

        {/* Middle Column: Input Form */}
        <section className="flex flex-col">
          <Panel title={t.panelInput} className="flex-grow flex flex-col">
            <div className="grid gap-5 md:grid-cols-2">
              <TextInput label={t.songTitle} value={form.title} onChange={(value) => updateForm('title', value)} placeholder={t.songTitlePlaceholder} />
              <TextInput label={t.targetTool} value={form.targetTool} onChange={(value) => updateForm('targetTool', value)} placeholder={t.targetToolPlaceholder} />
              <div className="md:col-span-2">
                <ButtonGroupInput label={t.songType} value={form.songType || 'vocal'} options={getOptions(uiLanguage).songType} onChange={(value) => updateForm('songType', value)} />
              </div>
              <div className="md:col-span-2">
                <TextInput label={t.styleDesc} value={form.styleDesc} onChange={(value) => updateForm('styleDesc', value)} placeholder={t.styleDescPlaceholder} />
              </div>
              
              {form.songType !== 'instrumental' && (
                <>
                  <ButtonGroupInput label={t.lyricsLanguage} value={form.language} options={getOptions(uiLanguage).language} onChange={(value) => updateForm('language', value)} />
                  <ButtonGroupInput label={t.vocalGender} value={form.vocalGender || '여성'} options={getOptions(uiLanguage).vocalGender} onChange={(value) => updateForm('vocalGender', value)} />
                  <ButtonGroupInput label={t.vocalFeaturing} value={form.vocalFeaturing || '없음'} options={getOptions(uiLanguage).vocalFeaturing} onChange={(value) => updateForm('vocalFeaturing', value)} />
                  <TextInput label={t.vocalStyle} value={form.vocal} onChange={(value) => updateForm('vocal', value)} placeholder={t.vocalStylePlaceholder} />
                  <SelectInput label={t.vocalGroup} value={form.vocalGroup} options={getOptions(uiLanguage).vocalGroup} onChange={(value) => updateForm('vocalGroup', value)} />
                </>
              )}

              {form.songType === 'instrumental' && (
                <>
                  <SelectInput label={t.bgmType} value={form.bgmType || '영화음악'} options={getOptions(uiLanguage).bgmType} onChange={(value) => updateForm('bgmType', value)} />
                  <ButtonGroupInput label={t.musicLength} value={form.musicLength || '1분'} options={getOptions(uiLanguage).musicLength} onChange={(value) => updateForm('musicLength', value)} />
                </>
              )}

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
            </div>
            
            <div className="mt-6 flex-grow flex flex-col gap-5">
              <div className="flex flex-col flex-grow">
                <label className="field-label flex items-center justify-between">
                  <span>{t.extraRequests}</span>
                  <span className="text-[10px] font-normal text-[#71717A]">{t.extraSub}</span>
                </label>
                <textarea className="input flex-grow min-h-[140px] resize-none" value={form.extra} onChange={(event) => updateForm('extra', event.target.value)} placeholder={t.extraPlaceholder} />
              </div>

              <div className="flex flex-col">
                <label className="field-label flex items-center justify-between">
                  <span>{t.excludeElements}</span>
                  <span className="text-[10px] font-normal text-[#71717A]">{t.excludePlaceholder}</span>
                </label>
                <textarea className="input min-h-[60px] resize-none" value={form.exclude} onChange={(event) => updateForm('exclude', event.target.value)} placeholder={t.excludePlaceholder} />
              </div>
            </div>

            <div className="mt-8 flex gap-3 pt-5 border-t border-[#2E2E2E]">
              <button className="primary-btn flex-1 py-4 text-base shadow-lg shadow-[#FF3366]/20 relative overflow-hidden group" onClick={generate} disabled={isGenerating}>
                <span className="relative z-10 font-black tracking-wide">{isGenerating ? t.generating : t.generateBtn}</span>
                {!isGenerating && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-[100%] group-hover:animate-[shimmer_1.5s_infinite]"></div>}
              </button>
              <button className="secondary-btn w-32 font-bold" onClick={generateSample}>{t.generateSampleBtn}</button>
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
                label={t.negativePromptLabel}
                value={resultParts.negativePrompt}
                minHeight="h-20"
                placeholder={t.negativePromptPlaceholder}
                onChange={(value) => updateResultPart('negativePrompt', value)}
                onCopy={() => copyText(t.copyNegativePrompt, resultParts.negativePrompt)}
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
      ) : currentTab === 'library' ? (
        <LibraryView history={history} t={t} openHistoryItem={(item, mode) => { openHistoryItem(item, mode); setCurrentTab('studio'); }} deleteHistoryItem={deleteHistoryItem} />
      ) : currentTab === 'admin' && isAdmin ? (
        <div className="mx-auto max-w-[1200px] px-5 py-8">
          <h2 className="text-2xl font-bold mb-8">{t.admin}</h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Panel title={t.manageGuides}>
              <div className="flex flex-col gap-4">
                <div className="rounded-xl border border-[#2E2E2E] bg-[#121212] p-4">
                  <h4 className="text-sm font-semibold text-[#EDEDED] mb-3">{editingGuideId ? '지침서 수정' : '새 지침서 작성'}</h4>
                  <input
                    type="text"
                    placeholder={t.newGuideTitlePlaceholder}
                    className="w-full mb-3 rounded-lg bg-[#0A0A0A] p-3 text-sm text-[#EDEDED] outline-none border border-[#3E3E3E] focus:border-[#FF3366]"
                    value={draftGuide.title}
                    onChange={(e) => setDraftGuide({ ...draftGuide, title: e.target.value })}
                  />
                  <textarea
                    placeholder={t.newGuideBodyPlaceholder}
                    className="h-32 w-full resize-none rounded-lg bg-[#0A0A0A] p-3 text-sm text-[#EDEDED] outline-none border border-[#3E3E3E] focus:border-[#FF3366]"
                    value={draftGuide.body}
                    onChange={(e) => setDraftGuide({ ...draftGuide, body: e.target.value })}
                  />
                  
                  <div className="flex justify-end gap-2 mt-3">
                    {editingGuideId && (
                      <button 
                        onClick={() => {
                          setEditingGuideId(null);
                          setDraftGuide({ title: '', body: '' });
                        }} 
                        className="secondary-btn !py-2 !px-4 text-sm font-semibold"
                      >
                        취소
                      </button>
                    )}
                    <button onClick={handlePostSystemGuide} className="primary-btn !py-2 !px-4 text-sm font-semibold shadow-md">
                      {editingGuideId ? '수정 저장' : t.addGuide}
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                  {systemGuides.map((guide) => (
                    <div key={guide.id} className="rounded-xl bg-[#0A0A0A] border border-[#2E2E2E] p-4 flex flex-col gap-2 relative group">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-white">{guide.title}</span>
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={() => {
                              setEditingGuideId(guide.id);
                              setDraftGuide({ title: guide.title, body: guide.body });
                            }} 
                            className="text-xs text-[#71717A] hover:text-[#EDEDED] transition-colors"
                          >
                            수정
                          </button>
                          <button onClick={() => handleDeleteSystemGuide(guide.id)} className="text-xs text-[#71717A] hover:text-[#FF3366] transition-colors">{t.delete}</button>
                        </div>
                      </div>
                      <p className="text-xs text-[#A1A1AA] line-clamp-2">{guide.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>

            <Panel title={t.announcements}>
              <div className="flex flex-col gap-4">
                <div className="rounded-xl border border-[#2E2E2E] bg-[#121212] p-4">
                  <h4 className="text-sm font-semibold text-[#EDEDED] mb-3">{editingAnnouncementId ? '공지사항 수정' : '새 공지사항 작성'}</h4>
                  <input
                    type="text"
                    placeholder="제목"
                    className="w-full mb-3 rounded-lg bg-[#0A0A0A] p-3 text-sm text-[#EDEDED] outline-none border border-[#3E3E3E] focus:border-[#FF3366]"
                    value={draftAnnouncement.title}
                    onChange={(e) => setDraftAnnouncement({ ...draftAnnouncement, title: e.target.value })}
                  />
                  <textarea
                    placeholder="공지사항 내용"
                    className="h-32 w-full mb-3 resize-none rounded-lg bg-[#0A0A0A] p-3 text-sm text-[#EDEDED] outline-none border border-[#3E3E3E] focus:border-[#FF3366]"
                    value={draftAnnouncement.content}
                    onChange={(e) => setDraftAnnouncement({ ...draftAnnouncement, content: e.target.value })}
                  />
                  <div className="flex justify-end gap-2">
                    {editingAnnouncementId && (
                      <button 
                        onClick={() => { setEditingAnnouncementId(null); setDraftAnnouncement({title: '', content: ''}); }} 
                        className="secondary-btn !py-2 !px-4 text-sm font-semibold"
                      >
                        취소
                      </button>
                    )}
                    <button onClick={handlePostAnnouncement} className="primary-btn !py-2 !px-4 text-sm font-semibold shadow-md">
                      {editingAnnouncementId ? '수정 저장' : t.addAnnouncement}
                    </button>
                  </div>
                </div>

                <div className="mt-2 flex flex-col gap-3 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                  {announcements.map((ann) => (
                    <div key={ann.id} className="rounded-xl bg-[#0A0A0A] border border-[#2E2E2E] p-4 flex flex-col gap-3 relative group transition-colors hover:border-[#4A4A4A]">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <span className="text-sm font-bold text-[#EDEDED] block mb-1">{ann.title}</span>
                          <span className="text-[10px] text-[#71717A]">{new Date(ann.created_at).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleEditAnnouncement(ann)} className="text-xs text-[#A1A1AA] hover:text-white transition-colors bg-[#2E2E2E] px-2 py-1 rounded">수정</button>
                          <button onClick={() => handleDeleteAnnouncement(ann.id)} className="text-xs text-[#A1A1AA] hover:text-[#FF3366] transition-colors bg-[#2E2E2E] hover:bg-[#FF3366]/20 px-2 py-1 rounded">{t.delete}</button>
                        </div>
                      </div>
                      <p className="text-xs text-[#A1A1AA] line-clamp-3 bg-[#121212] p-2 rounded-lg border border-[#2E2E2E]/50 whitespace-pre-wrap">{ann.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>

            <Panel title={t.manageMembers || "Member Management"}>
              <div className="flex flex-col gap-4">
                <p className="text-sm text-[#A1A1AA] mb-2">Manage user roles and permissions.</p>
                <div className="mt-2 flex flex-col gap-3 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                  {adminUsers.map((member) => (
                    <div key={member.id} className="rounded-xl bg-[#0A0A0A] border border-[#2E2E2E] p-4 flex flex-col gap-2 relative group">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-[#EDEDED]">{member.email}</span>
                        <div className="flex items-center gap-3">
                          <span className={`text-xs px-2 py-1 rounded-md font-bold ${member.is_admin ? 'bg-[#FF3366]/20 text-[#FF3366]' : 'bg-[#2E2E2E] text-[#A1A1AA]'}`}>
                            {member.is_admin ? 'ADMIN' : 'USER'}
                          </span>
                          {member.id !== user?.id && (
                            <button 
                              onClick={() => toggleAdminRole(member.id, member.is_admin)} 
                              className="text-xs text-[#71717A] hover:text-[#FF3366] transition-colors underline"
                            >
                              {member.is_admin ? 'Demote' : 'Promote'}
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-[10px] text-[#5C454D]">Joined: {new Date(member.created_at).toLocaleDateString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>

            <Panel title="Global OpenAI API Key">
              <div className="flex flex-col gap-4">
                <p className="text-sm text-[#A1A1AA] mb-2">전역으로 사용할 OpenAI API 키를 설정합니다. 여기에 키를 입력하면 모든 사용자가 기본으로 이 키를 사용하게 됩니다.</p>
                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder="sk-..."
                    className="flex-1 rounded-lg bg-[#0A0A0A] p-3 text-sm text-[#EDEDED] outline-none border border-[#3E3E3E] focus:border-[#FF3366]"
                    value={adminOpenAIKey}
                    onChange={(e) => setAdminOpenAIKey(e.target.value)}
                  />
                  <button 
                    onClick={() => {
                      if (adminOpenAIKey) {
                        navigator.clipboard.writeText(adminOpenAIKey);
                        alert('API 키가 클립보드에 복사되었습니다.');
                      }
                    }}
                    className="px-4 rounded-lg bg-[#1A1A1A] text-[#A1A1AA] hover:text-white hover:bg-[#2A2A2A] transition-colors border border-[#3E3E3E] flex items-center justify-center gap-2"
                    title="API 키 복사"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    <span className="text-sm font-medium">복사</span>
                  </button>
                </div>
                <div className="flex justify-end gap-2">
                  {globalOpenAIKey && (
                    <button 
                      onClick={() => {
                        setAdminOpenAIKey('');
                      }} 
                      className="secondary-btn !py-2 !px-4 text-sm font-semibold"
                    >
                      초기화 및 삭제
                    </button>
                  )}
                  <button onClick={handleSaveAdminOpenAIKey} className="primary-btn !py-2 !px-4 text-sm font-semibold shadow-md">저장하기</button>
                </div>
              </div>
            </Panel>
          </div>
        </div>
      ) : null}
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
        {options.map((option) => {
          const optVal = typeof option === 'string' ? option : option.value;
          const optLabel = typeof option === 'string' ? option : option.label;
          return <option key={optVal} value={optVal}>{optLabel}</option>;
        })}
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
        <div className="flex gap-1 mt-3 w-full">
          {presets.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => onChange(preset.value)}
              className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-lg transition-all ${numericValue === preset.value ? 'bg-gradient-to-r from-[#FF3366] to-[#9213ec] text-white shadow-md shadow-[#FF3366]/20' : 'bg-[#1A1A1A] text-[#A1A1AA] hover:bg-[#2A2A2A] hover:text-[#EDEDED] border border-[#2E2E2E] hover:border-[#4A4A4A]'}`}
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
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    onCopy();
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className={wrapperClassName}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <label className="field-label mb-0">{label}</label>
        <button 
          className={`copy-btn flex items-center justify-center p-1.5 transition-all duration-300 ${isCopied ? 'text-[#FF3366] bg-[#FF3366]/10 rounded' : ''}`} 
          onClick={handleCopy} 
          disabled={!value.trim()} 
          title={isCopied ? "복사완료!" : tooltip}
        >
          {isCopied ? (
            <span className="flex items-center gap-1 text-[10px] font-bold">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              COPIED
            </span>
          ) : (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
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
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState(null);
  const itemsPerPage = 15;

  const filteredHistory = useMemo(() => {
    if (!searchTerm.trim()) return history;
    const lower = searchTerm.toLowerCase();
    return history.filter(item => 
      (item.title || t.untitledProject).toLowerCase().includes(lower) ||
      (item.prompt || '').toLowerCase().includes(lower) ||
      (item.form?.styleDesc || item.form?.genre || '').toLowerCase().includes(lower)
    );
  }, [history, searchTerm, t.untitledProject]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage) || 1;
  const currentItems = filteredHistory.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-8">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-[#EDEDED] flex items-center gap-2 shrink-0">
          <span className="inline-block h-6 w-1.5 rounded-full bg-[#FF3366]"></span>
          {t.library}
          <span className="ml-2 text-sm font-medium text-[#A1A1AA] bg-[#1A1A1A] border border-[#2E2E2E] px-2.5 py-0.5 rounded-full">
            {filteredHistory.length}
          </span>
        </h1>
        
        <div className="relative w-full sm:w-72">
          <input 
            type="text" 
            className="input pl-10 h-[42px] text-sm w-full" 
            placeholder={t.searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#71717A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>
      
      {filteredHistory.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#2E2E2E] bg-[#1A1A1A] py-20 text-center">
          <svg className="mb-4 h-12 w-12 text-[#4A4A4A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <p className="text-lg font-medium text-[#A1A1AA]">
            {history.length === 0 ? t.libraryEmpty : '검색 결과가 없습니다.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="overflow-x-auto rounded-xl border border-[#2E2E2E] bg-[#1A1A1A] shadow-lg shadow-black/20">
            <table className="w-full text-left text-sm text-[#A1A1AA]">
              <thead className="border-b border-[#2E2E2E] bg-[#121212]/80 text-xs uppercase tracking-wider text-[#71717A]">
                <tr>
                  <th className="px-5 py-4 font-bold w-12 text-center">{t.thNumber}</th>
                  <th className="px-5 py-4 font-bold">{t.thDate}</th>
                  <th className="px-5 py-4 font-bold w-[45%]">{t.thTitle}</th>
                  <th className="px-5 py-4 font-bold">{t.styleDesc}</th>
                  <th className="px-5 py-4 font-bold">{t.thLanguage}</th>
                  <th className="px-5 py-4 font-bold text-right">{t.thActions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2E2E2E]">
                {currentItems.map((item, index) => {
                  const absoluteIndex = filteredHistory.length - ((currentPage - 1) * itemsPerPage + index);
                  return (
                  <tr key={item.id} className="transition-colors hover:bg-[#121212]/40 group">
                    <td className="px-5 py-4 whitespace-nowrap text-center text-[#71717A] font-medium">
                      {absoluteIndex}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-[#D4D4D8]">
                      {new Date(item.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4">
                      <button 
                        onClick={() => setSelectedItem(item)} 
                        className="text-base font-bold text-[#EDEDED] transition-colors group-hover:text-[#FF3366] text-left block w-full truncate"
                        title={item.title || t.untitledProject}
                      >
                        {item.title || t.untitledProject}
                      </button>
                      {item.prompt && (
                        <p className="mt-1.5 text-xs text-[#71717A] line-clamp-1 group-hover:text-[#A1A1AA] transition-colors">{item.prompt}</p>
                      )}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      {(item.form?.styleDesc || item.form?.genre) && (
                        <span className="rounded-md bg-[#2E2E2E] px-2.5 py-1 text-xs font-medium text-[#EDEDED] border border-[#4A4A4A] truncate max-w-[140px] inline-block align-middle">
                          {item.form?.styleDesc || item.form?.genre}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      {item.form?.language && (
                        <span className="rounded-md bg-[#2E2E2E] px-2.5 py-1 text-xs font-medium text-[#EDEDED] border border-[#4A4A4A] inline-block align-middle">
                          {item.form.language}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-right">
                      <button 
                        onClick={() => deleteHistoryItem(item.id)} 
                        className="text-[#A1A1AA] transition-all hover:text-red-500 font-medium px-3 py-1.5 rounded-lg hover:bg-red-500/10 border border-transparent hover:border-red-500/20"
                      >
                        {t.delete}
                      </button>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
          
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-2">
              <p className="text-sm text-[#71717A]">
                {t.pageInfo.replace('{current}', currentPage).replace('{total}', totalPages)}
              </p>
              <div className="flex gap-2">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="secondary-btn !py-2 !px-4 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t.prevPage}
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`h-8 w-8 rounded-lg text-sm font-bold transition-all ${
                        currentPage === page 
                          ? 'bg-[#FF3366] text-white' 
                          : 'text-[#A1A1AA] hover:bg-[#2A2A2A] hover:text-[#EDEDED]'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="secondary-btn !py-2 !px-4 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t.nextPage}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6" onClick={() => setSelectedItem(null)}>
          <div className="w-full max-w-5xl rounded-2xl border border-[#2E2E2E] bg-[#121212] shadow-2xl flex flex-col max-h-[95vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[#2E2E2E] px-6 py-5 sm:px-8">
              <h2 className="text-2xl font-bold text-[#EDEDED] truncate">{selectedItem.title || t.untitledProject}</h2>
              <button onClick={() => setSelectedItem(null)} className="text-[#A1A1AA] hover:text-white transition-colors bg-[#1A1A1A] p-2 rounded-full hover:bg-[#2A2A2A]">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="flex flex-col h-full">
                  <h3 className="text-sm font-semibold text-[#A1A1AA] mb-3 uppercase tracking-wider">{t.copyPrompt}</h3>
                  <div className="rounded-xl bg-[#1A1A1A] p-5 border border-[#2E2E2E] whitespace-pre-wrap text-sm leading-relaxed text-[#D4D4D8] flex-1 max-h-[350px] overflow-y-auto custom-scrollbar">
                    {selectedItem.prompt || '내용 없음'}
                  </div>
                </div>
                <div className="flex flex-col h-full">
                  <h3 className="text-sm font-semibold text-[#A1A1AA] mb-3 uppercase tracking-wider">{t.copyLyrics}</h3>
                  <div className="rounded-xl bg-[#1A1A1A] p-5 border border-[#2E2E2E] whitespace-pre-wrap text-sm leading-relaxed text-[#D4D4D8] flex-1 max-h-[350px] overflow-y-auto custom-scrollbar">
                    {selectedItem.lyrics || '내용 없음'}
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-[#1A1A1A]/50 p-5 rounded-xl border border-[#2E2E2E]/50">
                <div className="col-span-1 sm:col-span-2 lg:col-span-3">
                  <h3 className="text-xs font-semibold text-[#71717A] mb-2 uppercase">{t.styleDesc}</h3>
                  <p className="text-sm text-[#EDEDED] bg-[#222] px-4 py-3 rounded-lg border border-[#333] break-words">{selectedItem.form?.styleDesc || [selectedItem.form?.genre, selectedItem.form?.mood].filter(Boolean).join(', ') || '-'}</p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-[#71717A] mb-2 uppercase">{t.vocalStyle}</h3>
                  <p className="text-sm text-[#EDEDED] bg-[#222] px-4 py-3 rounded-lg border border-[#333] break-words">
                    {selectedItem.form?.vocal || '-'}
                    {selectedItem.form?.vocalFeaturing && selectedItem.form?.vocalFeaturing !== '없음' ? ` (Ft. ${selectedItem.form.vocalFeaturing})` : ''}
                  </p>
                </div>
              </div>

              {selectedItem.notes && (
                <div className="bg-[#1A1A1A]/50 p-5 rounded-xl border border-[#2E2E2E]/50">
                  <h3 className="text-xs font-semibold text-[#71717A] mb-2 uppercase">AI 메모</h3>
                  <div className="text-sm text-[#EDEDED] bg-[#222] px-4 py-3 rounded-lg border border-[#333] break-words whitespace-pre-wrap max-h-[150px] overflow-y-auto custom-scrollbar">
                    {selectedItem.notes}
                  </div>
                </div>
              )}
            </div>
            
            <div className="border-t border-[#2E2E2E] p-5 sm:px-8 flex flex-wrap gap-4 justify-end bg-[#151515] rounded-b-2xl">
              <button 
                onClick={() => { openHistoryItem(selectedItem, 'style'); setSelectedItem(null); }}
                className="px-5 py-2.5 text-sm font-medium text-[#D4D4D8] bg-[#2A2A2A] hover:bg-[#3A3A3A] hover:text-white rounded-xl transition-all border border-[#3E3E3E] shadow-sm"
              >
                스타일 프롬프트만 재사용
              </button>
              <button 
                onClick={() => { openHistoryItem(selectedItem, 'lyrics'); setSelectedItem(null); }}
                className="px-5 py-2.5 text-sm font-medium text-[#D4D4D8] bg-[#2A2A2A] hover:bg-[#3A3A3A] hover:text-white rounded-xl transition-all border border-[#3E3E3E] shadow-sm"
              >
                가사만 재사용
              </button>
              <button 
                onClick={() => { openHistoryItem(selectedItem, 'all'); setSelectedItem(null); }}
                className="px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-[#FF3366] to-[#9213ec] hover:opacity-90 rounded-xl transition-all shadow-lg shadow-[#FF3366]/25 transform hover:scale-[1.02]"
              >
                전체 재사용
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
