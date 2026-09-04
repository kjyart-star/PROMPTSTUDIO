'use client'

import { useEffect, useMemo, useState, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { ChevronDown, FileText, Music, Sparkles, Wand2, X, Settings, ArrowRight, Play, Pause, FolderPlus, Check, Type, Mic, Info, Image as ImageIcon, Volume2, Globe, Clock, Download, MoreVertical, Disc, Loader2, Heart, Trash2, LogIn, LogOut, Upload, Plus, Bell, Shield, RefreshCw, Layers, Copy, Users, Library, HardDrive, Grid3X3, LayoutGrid, Rows3, type LucideIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { usePlayerStore } from '@/stores/playerStore'
import { parsePlaylistDescription } from '@/lib/utils'
import { GENRES } from '@/lib/constants'
import { GENRE_TRANSLATIONS } from '@/lib/constants/genres'
import { CoverClient } from './CoverClient'
import { GenerateClient } from './GenerateClient'
import { MasteringClient } from './MasteringClient'
import { GenreModal } from './GenreModal'
import { StudioHeader } from './StudioHeader'
import { StudioHero } from './StudioHero'
import { StudioWorkspace } from './StudioWorkspace'
import { withBase } from '@/lib/basePath'

const durationCache: Record<string, number> = {}

function AudioDuration({ url, className = '' }: { url: string; className?: string }) {
  const [durationStr, setDurationStr] = useState<string>('-:-')

  useEffect(() => {
    if (!url) return

    if (durationCache[url] !== undefined) {
      const secs = durationCache[url]
      const mins = Math.floor(secs / 60)
      const remainingSecs = Math.floor(secs % 60)
      setDurationStr(`${mins}:${remainingSecs.toString().padStart(2, '0')}`)
      return
    }

    const audio = new Audio()
    audio.src = url
    audio.preload = 'metadata'

    const handleLoadedMetadata = () => {
      const secs = audio.duration
      if (!isNaN(secs) && isFinite(secs)) {
        durationCache[url] = secs
        const mins = Math.floor(secs / 60)
        const remainingSecs = Math.floor(secs % 60)
        setDurationStr(`${mins}:${remainingSecs.toString().padStart(2, '0')}`)
      }
    }

    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.load()

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.src = ''
    }
  }, [url])

  return <span className={className}>{durationStr}</span>
}

// AI 제공자 및 모델 설정
const PROVIDERS = {
  openai: {
    name: 'GPT',
    models: ['gpt-4o-mini', 'gpt-4o', 'o3-mini'],
    keyLabel: 'OpenAI API Key',
  },
}

const MODEL_CREDIT_COSTS: Record<string, number> = {
  'gpt-4o-mini': 1,
  'o3-mini': 3,
  'gpt-4o': 5,
}

const getModelCreditCost = (model: string): number => {
  return MODEL_CREDIT_COSTS[model] || 2
}

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
]

// 언어 팩
const TRANSLATIONS = {
  KO: {
    studio: 'Studio',
    library: '라이브러리',
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
    generateBtn: 'GENERATE PROMPT & LYRICS (2 크레딧)',
    generateSampleBtn: '샘플 생성 (2 크레딧)',
    
    panelOutput: '생성 결과 (Output)',
    promptLabel: 'SUNO 스타일 프롬프트',
    promptPlaceholder: '여기에 음악 스타일 프롬프트가 생성됩니다.',
    titleLabel: '곡 제목',
    titlePlaceholder: '곡 제목',
    lyricsLabel: '가사 편집기',
    lyricsPlaceholder: '섹션 태그가 포함된 가사가 여기에 표시됩니다. 직접 수정하여 최종 완성하세요.',
    notesLabel: 'AI 메모 (Suggestions)',
    notesPlaceholder: '제작 메모 또는 AI의 추가 제안이 표시됩니다.',
    negativePromptLabel: '제외 프롬프트 (NEGATIVE PROMPT)',
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
    statusGenerated: 'Complete',
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
    generateBtn: 'GENERATE PROMPT & LYRICS (2 Credits)',
    generateSampleBtn: 'Sample Output (2 Credits)',
    
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
}

const getOptions = (lang: string) => {
  if (lang === 'EN') {
    return {
      language: [{ value: '한국어', label: 'Korean' }, { value: '영어', label: 'English' }, { value: '일본어', label: 'Japanese' }],
    vocalGroup: [{ value: '솔로', label: 'Solo' }, { value: '듀엣', label: 'Duet' }, { value: '듀오', label: 'Duo' }, { value: '중창', label: 'Vocal Ensemble' }, { value: '합창', label: 'Choir' }, { value: '그룹', label: 'Group' }],
      vocalGender: [{ value: '여성', label: 'Female' }, { value: '남성', label: 'Male' }, { value: '혼성/기타', label: 'Mixed/Other' }],
      vocalFeaturing: [{ value: '없음', label: 'None' }, { value: '남성 피쳐링', label: 'Male Ft.' }, { value: '여성 피쳐링', label: 'Female Ft.' }],
      songType: [{ value: 'vocal', label: 'Vocal Song' }, { value: 'instrumental', label: 'Instrumental / BGM' }],
      bgmType: [{ value: '영화음악', label: 'Film Score' }, { value: '홍보음악', label: 'Promotional' }, { value: '광고음악', label: 'Commercial' }, { value: '애니메이션', label: 'Animation' }, { value: '게임음악', label: 'Game Music' }, { value: '유튜브/기타', label: 'YouTube/Other' }],
      musicLength: [{ value: '1분', label: '1m' }, { value: '2분', label: '2m' }, { value: '3분', label: '3m' }, { value: '4분', label: '4m' }, { value: '5분', label: '5m' }],
      lyricDensity: [{ value: '적음', label: 'Low' }, { value: '보통', label: 'Medium' }, { value: '많음', label: 'High' }],
      songStructure: [{ value: '랜덤', label: 'Random (AI)' }, { value: '대중적인 팝', label: 'Standard Pop' }, { value: '숏폼/훅 중심', label: 'Hook-heavy (Shorts)' }, { value: '빌드업/드롭', label: 'Build-up & Drop' }, { value: '기승전결', label: 'Narrative (Epic)' }],
      genre1: [{ value: '케이팝', label: 'K-Pop' }, { value: '팝', label: 'Pop' }, { value: '힙합', label: 'Hip Hop' }, { value: '알앤비', label: 'R&B' }, { value: '록', label: 'Rock' }, { value: '일렉트로닉', label: 'Electronic' }, { value: '재즈', label: 'Jazz' }, { value: '어쿠스틱', label: 'Acoustic' }, { value: '시티팝', label: 'City Pop' }, { value: '기타', label: 'Other' }],
      genre2: [{ value: '없음', label: 'None' }, { value: '케이팝', label: 'K-Pop' }, { value: '팝', label: 'Pop' }, { value: '힙합', label: 'Hip Hop' }, { value: '알앤비', label: 'R&B' }, { value: '록', label: 'Rock' }, { value: '일렉트로닉', label: 'Electronic' }, { value: '재즈', label: 'Jazz' }, { value: '어쿠스틱', label: 'Acoustic' }, { value: '시티팝', label: 'City Pop' }, { value: '기타', label: 'Other' }],
      vocalTone: [
        { value: '없음', label: 'None' },
        { value: '밝고 쾌활한', label: 'Bright & Cheerful' },
        { value: '감정적으로 솔직한', label: 'Emotionally Honest' },
        { value: '수줍은', label: 'Shy' },
        { value: '장난기 넘치는', label: 'Playful' },
        { value: '시크하고 쿨한', label: 'Chic & Cool' },
        { value: '몽환적이고 부드러운', label: 'Dreamy & Soft' },
        { value: '따뜻하고 포근한', label: 'Warm & Cozy' },
        { value: '우아하고 차분한', label: 'Elegant & Calm' },
        { value: '허스키한', label: 'Husky' },
        { value: '에너지 넘치고 파워풀한', label: 'Energetic & Powerful' },
        { value: '맑고 깨끗한', label: 'Clear & Pure' },
        { value: '섬세하고 속삭이는', label: 'Delicate & Whispering' },
        { value: '깊고 성숙한', label: 'Deep & Mature' },
        { value: '담백하고 자연스러운', label: 'Plain & Natural' }
      ],
      vocalAge: [{ value: '어린이', label: 'Child' }, { value: '청소년', label: 'Teenager' }, { value: '청년', label: 'Young Adult' }, { value: '중장년', label: 'Middle-aged' }],
      vocalGenderGroup: [{ value: '여자', label: 'Female' }, { value: '남자', label: 'Male' }, { value: '혼성', label: 'Mixed' }, { value: '듀엣', label: 'Duet' }, { value: '그룹', label: 'Group' }],
      language1: [{ value: '한국어', label: 'Korean' }, { value: '영어', label: 'English' }, { value: '일본어', label: 'Japanese' }],
      language2: [{ value: '없음', label: 'None' }, { value: '한국어', label: 'Korean' }, { value: '영어', label: 'English' }, { value: '일본어', label: 'Japanese' }],
    }
  }
  return {
    language: [{ value: '한국어', label: '한국어' }, { value: '영어', label: '영어' }, { value: '일본어', label: '일본어' }],
    vocalGroup: [{ value: '솔로', label: '솔로' }, { value: '듀엣', label: '듀엣 (Duet)' }, { value: '듀오', label: '듀오 (Duo)' }, { value: '중창', label: '중창' }, { value: '합창', label: '합창' }, { value: '그룹', label: '그룹' }],
    vocalGender: [{ value: '여성', label: '여성' }, { value: '남성', label: '남성' }, { value: '혼성/기타', label: '혼성/기타' }],
    vocalFeaturing: [{ value: '없음', label: '없음' }, { value: '남성 피쳐링', label: '남자 피쳐링' }, { value: '여성 피쳐링', label: '여자 피쳐링' }],
    songType: [{ value: 'vocal', label: '가사 있는 곡' }, { value: 'instrumental', label: '가사 없는 연주곡 (BGM)' }],
    bgmType: [{ value: '영화음악', label: '영화음악' }, { value: '홍보음악', label: '홍보음악' }, { value: '광고음악', label: '광고음악' }, { value: '애니메이션', label: '애니메이션' }, { value: '게임음악', label: '게임음악' }, { value: '유튜브/기타', label: '유튜브/기타' }],
    musicLength: [{ value: '1분', label: '1분' }, { value: '2분', label: '2분' }, { value: '3분', label: '3분' }, { value: '4분', label: '4분' }, { value: '5분', label: '5분' }],
    lyricDensity: [{ value: '적음', label: '적음 (Low)' }, { value: '보통', label: '보통 (Medium)' }, { value: '많음', label: '많음 (High)' }],
    songStructure: [{ value: '랜덤', label: '랜덤 (AI 추천)' }, { value: '대중적인 팝', label: '대중적인 팝 (Verse-Chorus)' }, { value: '숏폼/훅 중심', label: '숏폼/훅 중심 (Hook-heavy)' }, { value: '빌드업/드롭', label: '빌드업 & 드롭 (EDM)' }, { value: '기승전결', label: '기승전결 서사형' }],
    genre1: [{ value: '케이팝', label: '케이팝' }, { value: '팝', label: '팝' }, { value: '힙합', label: '힙합' }, { value: '알앤비', label: '알앤비' }, { value: '록', label: '록' }, { value: '일렉트로닉', label: '일렉트로닉' }, { value: '재즈', label: '재즈' }, { value: '어쿠스틱', label: '어쿠스틱' }, { value: '시티팝', label: '시티팝' }, { value: '기타', label: '기타' }],
    genre2: [{ value: '없음', label: '없음' }, { value: '케이팝', label: '케이팝' }, { value: '팝', label: '팝' }, { value: '힙합', label: '힙합' }, { value: '알앤비', label: '알앤비' }, { value: '록', label: '록' }, { value: '일렉트로닉', label: '일렉트로닉' }, { value: '재즈', label: '재즈' }, { value: '어쿠스틱', label: '어쿠스틱' }, { value: '시티팝', label: '시티팝' }, { value: '기타', label: '기타' }],
    vocalTone: [
      { value: '없음', label: '없음' },
      { value: '밝고 쾌활한', label: '밝고 쾌활한' },
      { value: '감정적으로 솔직한', label: '감정적으로 솔직한' },
      { value: '수줍은', label: '수줍은' },
      { value: '장난기 넘치는', label: '장난기 넘치는' },
      { value: '시크하고 쿨한', label: '시크하고 쿨한' },
      { value: '몽환적이고 부드러운', label: '몽환적이고 부드러운' },
      { value: '따뜻하고 포근한', label: '따뜻하고 포근한' },
      { value: '우아하고 차분한', label: '우아하고 차분한' },
      { value: '허스키한', label: '허스키한' },
      { value: '에너지 넘치고 파워풀한', label: '에너지 넘치고 파워풀한' },
      { value: '맑고 깨끗한', label: '맑고 깨끗한' },
      { value: '섬세하고 속삭이는', label: '섬세하고 속삭이는' },
      { value: '깊고 성숙한', label: '깊고 성숙한' },
      { value: '담백하고 자연스러운', label: '담백하고 자연스러운' }
    ],
    vocalAge: [{ value: '어린이', label: '어린이' }, { value: '청소년', label: '청소년' }, { value: '청년', label: '청년' }, { value: '중장년', label: '중장년' }],
    vocalGenderGroup: [{ value: '여자', label: '여자' }, { value: '남자', label: '남자' }, { value: '혼성', label: '혼성' }, { value: '듀엣', label: '듀엣' }, { value: '그룹', label: '그룹' }],
    language1: [{ value: '한국어', label: '한국어' }, { value: '영어', label: '영어' }, { value: '일본어', label: '일본어' }],
    language2: [{ value: '없음', label: '없음' }, { value: '한국어', label: '한국어' }, { value: '영어', label: '영어' }, { value: '일본어', label: '일본어' }],
  }
}

const INITIAL_FORM = {
  title: '',
  styleDesc: '',
  language: '한국어',
  vocalGender: '여성',
  vocalFeaturing: '없음',
  vocal: 'soft vocal, airy harmony',
  vocalGroup: '솔로',
  songType: 'vocal',
  bgmType: '영화음악',
  musicLength: '3분',
  lyricDensity: '보통',
  songStructure: '대중적인 팝',
  genre1: '케이팝',
  genre2: '없음',
  genreRatio: 70,
  language1: '한국어',
  language2: '없음',
  languageRatio: 70,
  vocalTone: '밝고 쾌활한',
  vocalAge: '10대',
  vocalGenderGroup: '여자',
  tempo: 120,
  targetTool: 'Suno',
  extra: '',
  exclude: '',
}

const STORAGE_KEYS = {
  settings: 'songprompt-ai-settings-v1',
  guides: 'songprompt-guides-v1',
  activeGuides: 'songprompt-active-guides-v1',
  supabase: 'songprompt-supabase-v1',
  localHistory: 'songprompt-local-history-v1',
  deletedDummyItems: 'songprompt-deleted-dummy-v1',
  libraryViewSize: 'songprompt-library-view-size-v1',
}

// 보관함 보기 크기 (작게 · 중간 · 크게)
type LibraryViewSize = 'small' | 'medium' | 'large'

const LIBRARY_VIEW_SIZES: LibraryViewSize[] = ['small', 'medium', 'large']

const LIBRARY_VIEW_LABELS: Record<LibraryViewSize, { KO: string; JA: string; EN: string }> = {
  small: { KO: '작게', JA: '小さく', EN: 'Small' },
  medium: { KO: '중간', JA: '標準', EN: 'Medium' },
  large: { KO: '크게', JA: '大きく', EN: 'Large' },
}

const LIBRARY_VIEW_ICONS: Record<LibraryViewSize, LucideIcon> = {
  small: Grid3X3,
  medium: LayoutGrid,
  large: Rows3,
}

const LIBRARY_GRID_CLASS: Record<LibraryViewSize, string> = {
  small: 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2.5',
  medium: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4',
  large: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5',
}

const readJson = (key: string, fallback: any) => {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

const writeJson = (key: string, value: any) => {
  if (typeof window === 'undefined') return
  localStorage.setItem(key, JSON.stringify(value))
}

const cleanStylePrompt = (prompt: string) => {
  if (!prompt) return ''
  let cleaned = prompt
    .replace(/한국어/g, 'Korean')
    .replace(/영어/g, 'English')
    .replace(/일본어/g, 'Japanese')
    .replace(/솔로/g, 'solo')
    .replace(/듀엣/g, 'duet')
    .replace(/듀오/g, 'duo')
    .replace(/그룹/g, 'group')
    .replace(/여성/g, 'female')
    .replace(/남성/g, 'male')
    .replace(/혼성/g, 'mixed')
    .replace(/피쳐링/g, 'featuring')

  const keywords = cleaned.split(',').map(k => k.trim())
  const filteredKeywords = keywords.map(k => {
    if (/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(k)) {
      return k.replace(/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/g, '').trim()
    }
    return k
  }).filter(Boolean)

  return filteredKeywords.join(', ')
}

const makeFallback = (form: any, guideText: string) => {
  const GENDER_MAP: Record<string, string> = {
    '여성': 'female vocal',
    '남성': 'male vocal',
    '혼성/기타': 'mixed vocals',
  }

  const FEAT_MAP: Record<string, string> = {
    '없음': '',
    '남성 피쳐링': 'featuring male vocal',
    '여성 피쳐링': 'featuring female vocal',
  }

  const GROUP_MAP: Record<string, string> = {
    '솔로': 'solo',
    '듀엣': 'duet',
    '듀오': 'duo',
    '중창': 'vocal ensemble',
    '합창': 'choir',
    '그룹': 'group',
  }

  const LANG_MAP: Record<string, string> = {
    '한국어': 'Korean',
    '영어': 'English',
    '일본어': 'Japanese',
  }

  if (form.songType === 'instrumental') {
    const prompt = [
      form.styleDesc,
      'instrumental',
      form.bgmType ? `${form.bgmType} style` : '',
      form.tempo ? `${form.tempo} BPM` : '',
      'polished production',
      form.extra
    ].filter(Boolean).join(', ')
    const negativePrompt = form.exclude || 'noise, bad quality, vocal, voice, singing, speaking'

    return `STYLE PROMPT\n${prompt}\n\nNEGATIVE PROMPT\n${negativePrompt}\n\nTITLE\n${form.title || 'Untitled BGM'}\n\nLYRICS\n[Instrumental]\n\nNOTES\n- 대상 툴: ${form.targetTool}\n- 길이: ${form.musicLength}\n- 용도: ${form.bgmType}\n- 반영 지침: ${guideText ? '등록 지침 포함' : '기본 작법'}`
  }

  const cleanVocal = (form.vocal || '')
    .replace(/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/g, '')
    .trim()
    .replace(/^,|,$/g, '')
    .trim()

  const prompt = [
    form.styleDesc,
    form.genre1 !== '없음' ? form.genre1 : '',
    form.genre2 !== '없음' ? form.genre2 : '',
    GENDER_MAP[form.vocalGender] || form.vocalGender,
    FEAT_MAP[form.vocalFeaturing] || '',
    form.vocalTone !== '없음' ? form.vocalTone : '',
    cleanVocal,
    GROUP_MAP[form.vocalGroup] ? `${GROUP_MAP[form.vocalGroup]} vocal arrangement` : `${form.vocalGroup} vocal arrangement`,
    form.tempo ? `${form.tempo} BPM` : '',
    LANG_MAP[form.language] ? `${LANG_MAP[form.language]} lyrics` : `${form.language} lyrics`,
    'catchy chorus',
    'polished production',
  ]
    .filter(Boolean)
    .join(', ')
    .replace(/,\s*,/g, ',')
    .trim()

  const negativePrompt = form.exclude || 'lo-fi, bad vocals, poor recording, out of tune'

  return `STYLE PROMPT\n${prompt}\n\nNEGATIVE PROMPT\n${negativePrompt}\n\nTITLE\n${form.title || 'Untitled'}\n\nLYRICS\n[Verse 1]\n젖은 유리창 위로 네 이름이 번져\n신호등 불빛마다 마음이 멈춰 서\n돌아갈 길은 없다는 걸 알면서도\n나는 같은 거리를 다시 지나가\n\n[Pre-Chorus]\n라디오 끝에 남은 작은 숨처럼\n아직도 넌 내 밤을 흔들어\n\n[Chorus]\nRain on the midnight road\n너를 잊는 법을 몰라\n흐려진 불빛 사이로\n우리의 계절이 또 지나가\nRain on the midnight road\n끝내 말하지 못한 말\n빗소리 안에 묻어둘게\n오늘도 널 지나쳐 가\n\n[Verse 2]\n텅 빈 조수석 위로 새벽이 내려\n익숙한 골목마다 추억이 켜져\n괜찮아질 거라는 흔한 말 대신\n가만히 속도를 낮춰 숨을 쉬어\n\n[Bridge]\n언젠가 이 노래가 끝나면\n나도 웃으며 널 놓을 수 있을까\n\n[Final Chorus]\nRain on the midnight road\n너를 잊는 법을 배워\n희미한 불빛 너머로\n새로운 아침이 날 부르나 봐\n\nNOTES\n- 대상 툴: ${form.targetTool}\n- 가사 언어: ${form.language}\n- 보컬 구성: ${form.vocalGroup}\n- 반영 지침: ${guideText ? '등록 지침 포함' : '기본 작법'}`
}

const EMPTY_RESULT = {
  structurePlan: '',
  prompt: '',
  negativePrompt: '',
  title: '',
  lyrics: '',
  notes: '',
  raw: '',
}

const parseGeneratedText = (text: string) => {
  const source = text.trim()
  if (!source) return EMPTY_RESULT

  const sectionNames = ['SONG STRUCTURE & DURATION PLAN', 'STYLE PROMPT', 'NEGATIVE PROMPT', 'TITLE', 'LYRICS', 'NOTES', 'API ERROR']
  const pattern = new RegExp(`^[\\s#\\*\\-]*(${sectionNames.join('|')})[\\s:\\*\\-]*$`, 'gim')
  const matches = [...source.matchAll(pattern)]
  const sections: Record<string, string> = {}

  matches.forEach((match, index) => {
    const name = match[1].toUpperCase()
    const start = (match.index ?? 0) + match[0].length
    const end = matches[index + 1]?.index ?? source.length
    sections[name] = source.slice(start, end).trim()
  })

  if (!matches.length) {
    return { ...EMPTY_RESULT, lyrics: source, raw: source }
  }

  return {
    structurePlan: sections['SONG STRUCTURE & DURATION PLAN'] || '',
    prompt: cleanStylePrompt(sections['STYLE PROMPT'] || ''),
    negativePrompt: cleanStylePrompt(sections['NEGATIVE PROMPT'] || ''),
    title: sections.TITLE || '',
    lyrics: sections.LYRICS || '',
    notes: [sections.NOTES, sections['API ERROR'] && `API ERROR\n${sections['API ERROR']}`].filter(Boolean).join('\n\n'),
    raw: source,
  }
}

const composeGeneratedText = (resultParts: any) => [
  ['SONG STRUCTURE & DURATION PLAN', resultParts.structurePlan],
  ['STYLE PROMPT', resultParts.prompt],
  ['NEGATIVE PROMPT', resultParts.negativePrompt],
  ['TITLE', resultParts.title],
  ['LYRICS', resultParts.lyrics],
  ['NOTES', resultParts.notes],
]
  .filter(([, value]) => value && value.trim())
  .map(([label, value]) => `${label}\n${value.trim()}`)
  .join('\n\n')

const buildInstructionPrompt = (form: any, guideText: string) => {
  const GENDER_MAP: Record<string, string> = {
    '여성': 'female vocal',
    '남성': 'male vocal',
    '혼성/기타': 'mixed vocals',
  }

  const FEAT_MAP: Record<string, string> = {
    '없음': '',
    '남성 피쳐링': 'featuring male vocal',
    '여성 피쳐링': 'featuring female vocal',
  }

  const GROUP_MAP: Record<string, string> = {
    '솔로': 'solo',
    '듀엣': 'duet',
    '듀오': 'duo',
    '중창': 'vocal ensemble',
    '합창': 'choir',
    '그룹': 'group',
  }

  const LANG_MAP: Record<string, string> = {
    '한국어': 'Korean',
    '영어': 'English',
    '일본어': 'Japanese',
  }

  const engLang = LANG_MAP[form.language] || form.language
  const engGender = GENDER_MAP[form.vocalGender] || form.vocalGender
  const engFeat = FEAT_MAP[form.vocalFeaturing] || form.vocalFeaturing
  const engGroup = GROUP_MAP[form.vocalGroup] || form.vocalGroup

  const checkRapKeywords = (text: string) => {
    if (!text) return false
    const lower = text.toLowerCase()
    return (
      lower.includes('랩') ||
      lower.includes('힙합') ||
      lower.includes('rap') ||
      lower.includes('hip') ||
      lower.includes('trap') ||
      lower.includes('트랩') ||
      lower.includes('boom-bap') ||
      lower.includes('boom bap') ||
      lower.includes('붐뱁') ||
      lower.includes('drill') ||
      lower.includes('드릴') ||
      lower.includes('grime') ||
      lower.includes('그라임') ||
      lower.includes('mumble') ||
      lower.includes('멈블') ||
      lower.includes('flow') ||
      lower.includes('플로우') ||
      lower.includes('rhyme') ||
      lower.includes('라임')
    )
  }

  const isRap = 
    checkRapKeywords(form.styleDesc) ||
    checkRapKeywords(form.genre1) ||
    checkRapKeywords(form.genre2) ||
    checkRapKeywords(form.extra) ||
    checkRapKeywords(guideText)

  const system = `너는 음악 생성 AI용 프롬프트와 가사를 만드는 최고 수준의 전문 작사가이자 프로듀서다.

${isRap ? `⚠️ [RAP/HIP-HOP EXTRA MANDATORY DIRECTION - CRITICAL]
이 곡은 랩/힙합(Rap/Hip-Hop) 음악입니다. 아래의 랩 전문 작법 규칙을 100% 절대적으로 적용하여 가사를 작성하십시오:
- 일반 가사 구조 대신, 랩 플로우(rhythmic flow), 라임(rhyme), 비트 드롭(bass drop), 더블링(doubling), 추임새(ad-libs)에 최적화된 구절로만 가사를 작성해야 합니다.
- 멜로디 라인을 완전히 배제하고, 짧고 리듬감이 살아있는 호흡(글자 수가 한 행에 너무 길지 않게 조절)으로 가사 행들을 구성하세요.
- 섹션 태그에 대괄호와 파이프를 결합한 스태킹 형식을 반드시 적극 사용하세요. 각 섹션마다 비트의 분위기, 랩의 속도, 플로우 스타일을 상세히 지시해야 합니다.
  (예: [Rap Verse 1 | fast rhythmic rap flow | heavy trap drums | aggressive delivery], [Chorus | melodic rap hook | stacked harmonies | bass drop])
- 가사 중 랩 플로우의 엇박이나 그루브를 표현할 수 있도록 의성어나 짧은 외마디 비명, 더블링 가이드를 적극 포함시키세요 (예: (Yeah), (Ayy), (Whoo) 등).
` : ''}

[사용자 정의 및 공용 지침서 (1순위 절대 준수 - CRITICAL PRIORITY)]
${guideText ? `아래 내용은 설정된 지침서 규정입니다. 이 내용은 AI 생성 프로세스 전체를 지배하는 **최우선 준수사항**입니다. 프롬프트 및 가사 생성 시 어떠한 예외도 없이 **절대적으로 준수**하고 모든 우선순위의 1순위로 적용하십시오:

${guideText}` : '등록된 추가 지침 없음'}

[우선순위 원칙 (PRIORITY RULES)]
모든 내용 생성 시 다음의 우선순위를 기본으로 가장 강력하게 적용해야 합니다:
1순위: [사용자 정의 및 공용 지침서]의 내용 (장르, 구조, 톤앤매너 등 고유 규칙)
2순위: 스타일 설명 (음악 장르, 리듬, 악기 등 사운드의 핵심 지향점)
3순위: 곡 제목 (가사의 주제, 분위기 및 전체 스토리의 감성 뼈대)
다른 어떤 설정(보컬, 템포 등)보다 [사용자 정의 및 공용 지침서]와 [스타일 설명]이 프롬프트의 음악 장르와 사운드 특성, 가사 형식을 지배하도록 작성해야 합니다.

[CRITICAL RULES]
1. "STYLE PROMPT" 및 "NEGATIVE PROMPT" 섹션은 **반드시 100% 영어 쉼표 구분 키워드(English comma-separated keywords)로만** 작성해야 합니다.
   - [보컬 영문화 매핑]: 사용자가 한글로 감성이나 보컬 톤을 입력했더라도(예: '한국어', '밝고 쾌활한 여성', '따뜻한 중년 남성'), 이를 반드시 'bright casual girl', 'warm mature male vocal' 등 Suno가 가장 잘 인식하는 영문 보컬 키워드로 완벽히 번역하여 추가해야 합니다.
   - 키워드들은 절대 문장이 되지 않도록 단어/구 형태로 쉼표로만 구분되어야 합니다.
2. "LYRICS", "TITLE", "NOTES" 섹션은 사용자가 지정한 [언어: ${form.language}]에 맞추어 작성해야 합니다.
3. [장르 및 사운드 블렌딩]: 두 개 이상의 장르나 복잡한 분위기가 섞일 경우, 단순 나열하지 말고 주 장르(Primary) 70%, 부 장르(Secondary) 30%의 비중을 설정하여 사운드가 지저분해지지 않고 명확한 방향성을 띠도록 키워드를 섞으세요.
4. [태그 스태킹 & 감정 레이어링 (Tag Stacking & Emotion Layering)]
   - 가사([LYRICS])의 대괄호 섹션 정의 시, 단순히 [Verse 1]이나 [Chorus]만 적지 마세요.
   - 지침서 및 음악 스타일에 근거하여 대괄호 안에 파이프(|) 기호를 사용해 랩 플로우, 보컬 창법, 비트 드롭, 악기 변화를 결합하는 스태킹을 **모든 장르**에 필수적으로 적용하세요.
   - 예: \`[Verse 1 | soft breathy vocal | acoustic guitar intro]\`, \`[Chorus | powerful emotional belt | thick synth pad & heavy bass]\`, \`[Bridge | whispers | piano only]\`.
5. 음악이 촌스럽거나 뻔하게 들리지 않도록, 최고 수준의 전문적인 프로듀싱 키워드와 세련된 사운드 질감을 적극적으로 추가하세요.
6. 출력 형식의 순서와 이름을 정확히 지키세요.

출력 형식은 반드시 아래 순서를 따른다.
SONG STRUCTURE & DURATION PLAN
AI가 분석한 최적의 BPM과 사용자 목표 길이를 바탕으로, 초정밀 길이(시간) 설계표를 먼저 작성합니다. 
(예시) 
- 목표 길이: 3분 (180초)
- 추천 BPM: 96 BPM
- 총 마디 수 계산: 3분 = 72마디 (Bars)
- 섹션 분배: Intro(4) - Verse 1(16) - Pre-Chorus(8) - Chorus(16) - Verse 2(8) - Chorus(16) - Outro(4)
이 계산을 바탕으로 아래 LYRICS의 분량(줄 수)을 정확히 통제하세요.

STYLE PROMPT
사용자가 제공한 정보(스타일, 템포, 보컬 등)를 바탕으로, 단순히 번역하는 것을 넘어 곡에 가장 잘 어울리는 구체적인 악기(instruments), 리듬/그루브(rhythm/groove), 특정 템포(예: tempo ${form.tempo} bpm), 프로듀싱 스타일(production style) 등을 포함한 15~20개의 고품질 영어 키워드를 쉼표(,)로 구분하여 나열하세요. 문장이 아닌 키워드 나열 형식이어야 합니다.
예시: k-hip hop, swing jazz groove, funky rhythm guitars, orchestral strings stabs, energetic brass hits, bouncy bassline, vinyl scratches, syncopated drums, tempo ${form.tempo} bpm, urban night mood, polished production
${form.songType === 'instrumental' ? '(반드시 맨 처음에 "instrumental, no vocal," 을 포함할 것)' : ''}

NEGATIVE PROMPT
제외할 요소를 영어 쉼표 구분 키워드로 나열.

TITLE
곡 제목

LYRICS
${form.songType === 'instrumental' ? '[Instrumental] 만 작성하고 다른 텍스트는 작성하지 마세요.' : '섹션 태그가 포함된 완성 가사 (위 STRUCTURE PLAN의 마디 수 배분에 맞춰 분량 조절)'}

NOTES
짧은 제작 메모 3개`

  const user = `목표: ${form.targetTool}에 바로 복사하여 붙여넣을 수 있는 극도로 정교하고 트렌디한 스타일 프롬프트${form.songType === 'instrumental' ? '' : '와 완성형 가사'}를 생성한다.

곡 정보:
- 제목: ${form.title}
- 장르 블렌딩: 주 장르 [${form.genre1}] ${form.genreRatio}% / 부 장르 [${form.genre2}] ${100 - form.genreRatio}%
- 추가 스타일 설명: ${form.styleDesc}
- 곡 유형: ${form.songType === 'instrumental' ? '가사 없는 연주곡/BGM (Instrumental)' : '보컬 곡'}
- 목표 음악 길이: ${form.musicLength}
- 곡 전개 구조: ${form.songStructure}
${form.songType === 'instrumental' ? 
`- 용도: ${form.bgmType || '영화음악'}` 
: 
`- 언어 블렌딩: 주 언어 [${form.language1 || form.language}] ${form.languageRatio}% / 부 언어 [${form.language2 || '없음'}] ${100 - form.languageRatio}%
- 가사 분량(밀도): ${form.lyricDensity}
- 보컬 성별 및 구성: ${form.vocalGenderGroup || form.vocalGender}
- 보컬 나이대: ${form.vocalAge}
- 보이스 톤: ${form.vocalTone}
- 추가 보컬 설명: ${form.vocal}`}
- 템포: ${form.tempo} BPM
- 추가 요청: ${form.extra}
- 제외 요소 (Negative Prompt): ${form.exclude || (form.songType === 'instrumental' ? 'vocal, voice, singing, speaking, words' : 'lo-fi, bad vocals')}`

  return { system, user }
}



interface StudioClientProps {
  user?: any
  /** [임시 게이트] AI 프롬프트 생성 UI 노출 여부. 해제 방법은 src/lib/auth/aiGate.ts 참고 */
  canUseAi?: boolean
}

export function StudioClient({ user, canUseAi = false }: StudioClientProps) {
  const [uiLanguage, setUiLanguage] = useState('KO')
  // TRANSLATIONS only defines KO/EN; fall back to EN for any other language
  // (e.g. 'JA') so the page never crashes on an undefined translation table.
  const t = TRANSLATIONS[uiLanguage as 'KO' | 'EN'] ?? TRANSLATIONS.EN

  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')

  const [currentTab, setCurrentTab] = useState<'studio' | 'library' | 'cover' | 'suno' | 'mastering'>('studio')

  useEffect(() => {
    if (
      tabParam === 'library' ||
      tabParam === 'studio' ||
      tabParam === 'cover' ||
      tabParam === 'suno' ||
      tabParam === 'mastering'
    ) {
      setCurrentTab(tabParam)
    }
  }, [tabParam])

  useEffect(() => {
    const title = searchParams.get('title')
    const style = searchParams.get('style')
    const prompt = searchParams.get('prompt')
    if (title || style || prompt) {
      setForm(prev => ({
        ...prev,
        title: title || prev.title,
        styleDesc: style || prev.styleDesc,
        extra: prompt ? `Remix prompt: ${prompt}` : prev.extra
      }))
      setCurrentTab('studio')
    }
  }, [searchParams])

  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  
  const [form, setForm] = useState(INITIAL_FORM)
  const [settings, setSettings] = useState({
    provider: 'openai',
    model: PROVIDERS.openai.models[0],
    apiKey: '',
  })
  
  const [guides, setGuides] = useState<any[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [activeGuideIds, setActiveGuideIds] = useState<string[]>(['suno-clear', 'hook-first'])
  const [draftGuide, setDraftGuide] = useState({ title: '', body: '' })
  const [resultParts, setResultParts] = useState(EMPTY_RESULT)
  const [status, setStatus] = useState('대기 중')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isParsing, setIsParsing] = useState(false)

  const [isGenreModalOpen, setIsGenreModalOpen] = useState(false)
  const [genreModalTarget, setGenreModalTarget] = useState<'genre1' | 'genre2'>('genre1')
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Suno API States
  const [currentHistoryId, setCurrentHistoryId] = useState<string | null>(null)
  const [history, setHistory] = useState<any[]>([])
  const [playlists, setPlaylists] = useState<any[]>([])
  const [userCredits, setUserCredits] = useState<number>(120)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [libraryViewSize, setLibraryViewSize] = useState<LibraryViewSize>('medium')

  const confirmDelete = async () => {
    if (!deleteConfirmId) return
    await deleteHistoryItem(deleteConfirmId)
    setDeleteConfirmId(null)
  }

  const { currentTrack, isPlaying, playTrack, togglePlay } = usePlayerStore()

  const playHistoryTrack = (item: any) => {
    if (!item) return
    const audioUrl = item.audio_url || item.stream_url || item.url
    if (!audioUrl) return
    if (currentTrack?.id === item.id) {
      togglePlay()
      return
    }
    // 하단 플레이어는 file_url 을 읽는다 — audio_url 로 넘기면 재생되지 않는다
    const cover = item.image_url || withBase('/default-album.png')
    const trackToPlay = {
      id: item.id,
      title: item.title || 'Untitled Track',
      file_url: audioUrl,
      duration_sec: 180,
      album_id: 'studio-generated',
      image_url: cover,
      album: {
        id: 'studio-generated',
        title: 'Studio Generation',
        cover_url: cover,
        artist: {
          name: item.artist || profile?.display_name || user?.email?.split('@')[0] || 'AI Studio',
          slug: user?.email?.split('@')[0] || 'ai-generator',
          avatar_url: profile?.avatar_url || withBase('/default-album.png'),
          bio: 'AI Artist'
        }
      }
    }
    playTrack(trackToPlay as any, [trackToPlay] as any[])
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    const updateCredits = () => {
      const saved = localStorage.getItem('user-credits')
      if (saved !== null) {
        setUserCredits(parseFloat(saved))
      } else {
        localStorage.setItem('user-credits', '120')
        setUserCredits(120)
      }
    }
    updateCredits()
    const interval = setInterval(updateCredits, 2000)
    return () => clearInterval(interval)
  }, [])

  const supabase = createClient()
  const options = useMemo(() => getOptions(uiLanguage), [uiLanguage])

  // Load guidelines (both system and user guidelines)
  const fetchGuidelines = async (currentUser: any) => {
    try {
      // 1. Fetch user guides if logged in
      let userGuides: any[] = []
      if (currentUser) {
        const userRes = await fetch('/api/user-guides')
        if (userRes.ok) {
          userGuides = await userRes.json()
        }
      }
      setGuides(userGuides)
      if (currentUser) {
        const activeRes = await fetch('/api/profile/active-guides')
        if (activeRes.ok) {
          const data = await activeRes.json()
          if (data && data.active_guide_ids) {
            const allAvailableIds = userGuides.map((g: any) => g.id)
            const validSavedIds = data.active_guide_ids.filter((id: string) => allAvailableIds.includes(id))
            setActiveGuideIds(validSavedIds)
          }
        }
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleDownloadTrack = async (url: string, filename: string, imageUrl?: string) => {
    if (!url) return
    try {
      let downloadUrl = url;
      if (downloadUrl && !downloadUrl.startsWith('http') && !downloadUrl.startsWith('dummy-') && !downloadUrl.startsWith('sample-') && !downloadUrl.startsWith('hook-') && !downloadUrl.startsWith('featured-')) {
        try {
          const { data, error } = await supabase.storage
            .from('tracks')
            .createSignedUrl(downloadUrl, 3600)
          if (!error && data) {
            downloadUrl = data.signedUrl;
          }
        } catch (err) {
          console.error(err)
        }
      }
      let proxyUrl = `/api/download?url=${encodeURIComponent(downloadUrl)}&filename=${encodeURIComponent(filename)}`
      if (imageUrl) {
        proxyUrl += `&image=${encodeURIComponent(imageUrl)}`
      }
      const a = document.createElement('a')
      a.href = proxyUrl
      a.download = `${filename}.mp3`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (e) {
      console.error(e)
      window.open(url, '_blank')
    }
  }

  const changeLibraryViewSize = (size: LibraryViewSize) => {
    setLibraryViewSize(size)
    try {
      writeJson(STORAGE_KEYS.libraryViewSize, size)
    } catch {
      // 저장 실패해도 이번 세션 동안은 선택이 유지된다
    }
  }

  // 로컬 스토리지 데이터 로드 (언어 및 기본 설정만)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const storedLang = localStorage.getItem('language') || navigator.language || ''
    setUiLanguage(storedLang.toLowerCase().startsWith('ko') ? 'KO' : storedLang.toLowerCase().startsWith('ja') ? 'JA' : 'EN')

    // 보관함 보기 크기 복원 (없거나 못 읽으면 '중간')
    const savedViewSize = readJson(STORAGE_KEYS.libraryViewSize, null)
    if (LIBRARY_VIEW_SIZES.includes(savedViewSize)) setLibraryViewSize(savedViewSize)

    const savedSettings = readJson(STORAGE_KEYS.settings, null)
    if (savedSettings) {
      const sanitized = {
        ...savedSettings,
        provider: 'openai',
        model: PROVIDERS.openai.models.includes(savedSettings.model)
          ? savedSettings.model
          : PROVIDERS.openai.models[0]
      }
      setSettings(sanitized)
    }

    if (!user) {
      const localHistory = readJson(STORAGE_KEYS.localHistory, [])
      setHistory(localHistory)
    }

    fetchGuidelines(user)

    // Sync language from Header changes
    const handleLangChange = (e: Event) => {
      const customEvent = e as CustomEvent<string>
      if (customEvent.detail) {
        setUiLanguage(customEvent.detail)
      }
    }
    window.addEventListener('languageChange', handleLangChange)
    return () => {
      window.removeEventListener('languageChange', handleLangChange)
    }
  }, [user])

  const fetchSongHistory = async () => {
    if (!user) return
    try {
      const historyRes = await fetch('/api/song-history')
      if (historyRes.ok) {
        const rawData = await historyRes.json() || []
        const completedData = rawData.filter((item: any) => (item.audio_url || item.file_url) && item.form?.source !== 'upload')
        completedData.sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
        setHistory(completedData)
      }
    } catch (e) {
      console.error('Error fetching song history:', e)
    }
  }

  const fetchPlaylists = async () => {
    if (!user) return
    try {
      const res = await fetch('/api/playlists')
      if (res.ok) {
        const data = await res.json()
        setPlaylists(data || [])
      }
    } catch (err) {
      console.error('Failed to fetch playlists:', err)
    }
  }

  // Load custom data from server database when user is logged in
  useEffect(() => {
    const loadServerData = async () => {
      if (!user) return
      
      try {
        // 0. Fetch profile
        const profileRes = await fetch('/api/profile')
        if (profileRes.ok) {
          const profileData = await profileRes.json()
          setProfile(profileData)
        }

        // 1. Fetch song history
        await fetchSongHistory()

        // 2. Fetch playlists
        await fetchPlaylists()

        // 3. Fetch all guides & active statuses
        await fetchGuidelines(user)
      } catch (e) {
        console.error('Error loading server data:', e)
      }
    }

    if (user) {
      loadServerData()
    } else {
      setPlaylists([])
    }
  }, [user])

  // Poll status of all processing songs in the history to ensure they update automatically even if the user switches tabs
  useEffect(() => {
    if (!user || history.length === 0) return

    const processingItems = history.filter(item => item.status === 'processing' && item.suno_task_id)
    if (processingItems.length === 0) return

    const interval = setInterval(async () => {
      let updatedAny = false
      
      await Promise.all(
        processingItems.map(async (item) => {
          try {
            const res = await fetch(`/api/suno/status?taskId=${item.suno_task_id}&historyId=${item.id}`)
            if (res.ok) {
              const data = await res.json()
              if (data.status === 'completed' || data.status === 'failed') {
                updatedAny = true
              }
            }
          } catch (e) {
            console.error('Error polling status in StudioClient:', e)
          }
        })
      )

      if (updatedAny) {
        await fetchSongHistory()
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [history, user])

  // 설정 저장
  useEffect(() => {
    writeJson(STORAGE_KEYS.settings, settings)
  }, [settings])

  // Sync active tab and history ID to the URL query parameters
  useEffect(() => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    const urlTab = url.searchParams.get('tab')
    const urlHistoryId = url.searchParams.get('historyId')

    let changed = false
    if (urlTab !== currentTab) {
      url.searchParams.set('tab', currentTab)
      changed = true
    }

    if (currentTab === 'suno' && currentHistoryId) {
      if (urlHistoryId !== currentHistoryId) {
        url.searchParams.set('historyId', currentHistoryId)
        changed = true
      }
    } else {
      if (url.searchParams.has('historyId')) {
        url.searchParams.delete('historyId')
        changed = true
      }
    }

    if (changed) {
      window.history.replaceState({}, '', url.toString())
    }
  }, [currentTab, currentHistoryId])

  useEffect(() => {
    if (!user) {
      writeJson(STORAGE_KEYS.guides, guides)
    }
  }, [guides, user])

  useEffect(() => {
    if (!user) {
      writeJson(STORAGE_KEYS.activeGuides, activeGuideIds)
    }
  }, [activeGuideIds, user])

  // Sync active guidelines to the server when they change (only if logged in)
  useEffect(() => {
    const syncActiveGuides = async () => {
      if (!user) return
      try {
        await fetch('/api/profile/active-guides', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activeGuideIds })
        })
      } catch (e) {
        console.error('Error syncing active guidelines to server:', e)
      }
    }
    
    if (user) {
      syncActiveGuides()
    }
  }, [activeGuideIds, user])

  const guideText = useMemo(() => {
    const activeLocal = guides.filter((g) => activeGuideIds.includes(g.id))
    return activeLocal.map((g) => `## ${g.title}\n${g.body}`).join('\n\n')
  }, [guides, activeGuideIds])

  const updateForm = (key: string, value: any) => setForm((current) => ({ ...current, [key]: value }))

  const updateResultPart = (key: string, value: any) => {
    setResultParts((current) => ({ ...current, [key]: value }))
  }



  // 지침서 PDF/TXT 업로드 핸들러
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsParsing(true)
    try {
      let text = ''
      if (file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer()
        // 브라우저 런타임에서 pdfjs-dist dynamic import
        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`
        
        const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise
        let fullText = ''
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i)
          const content = await page.getTextContent()
          const pageText = content.items.map((item: any) => item.str).join(' ')
          fullText += pageText + '\n'
        }
        text = fullText
      } else if (file.type === 'text/plain') {
        text = await file.text()
      } else {
        alert(t.parsingError)
        setIsParsing(false)
        return
      }

      setDraftGuide({
        title: file.name.replace(/\.[^/.]+$/, ""),
        body: text.trim()
      })
    } catch (error) {
      console.error(error)
      alert(t.parsingError)
    } finally {
      setIsParsing(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const addGuide = async () => {
    if (!draftGuide.title.trim() || !draftGuide.body.trim()) return

    if (user) {
      try {
        const res = await fetch('/api/user-guides', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: draftGuide.title.trim(),
            body: draftGuide.body.trim()
          })
        })

        if (res.ok) {
          const newGuide = await res.json()
          setGuides(prev => [...prev, newGuide])
          setActiveGuideIds(prev => [...prev, newGuide.id])
          setDraftGuide({ title: '', body: '' })
          setStatus(uiLanguage === 'KO' ? '지침서를 서버에 등록했습니다' : uiLanguage === 'JA' ? 'サーバーにガイドラインを登録しました' : 'Registered guideline on server')
        } else {
          const err = await res.json()
          console.error('Error adding guide on server:', err)
          alert(uiLanguage === 'KO' ? `지침서 등록 실패: ${err.error}` : uiLanguage === 'JA' ? `ガイドの登録に失敗しました: ${err.error}` : `Failed to register guide: ${err.error}`)
        }
      } catch (e: any) {
        console.error('Error adding guide on server:', e)
        alert(uiLanguage === 'KO' ? '지침서 등록 실패 (네트워크 오류)' : uiLanguage === 'JA' ? 'ガイドラインの登録に失敗しました (ネットワークエラー)' : 'Failed to register guide (Network error)')
      }
    } else {
      const id = `guide-${Date.now()}`
      const newGuide = { id, title: draftGuide.title.trim(), body: draftGuide.body.trim() }
      const newGuides = [...guides, newGuide]
      setGuides(newGuides)
      writeJson(STORAGE_KEYS.guides, newGuides)
      setActiveGuideIds((current) => [...current, id])
      setDraftGuide({ title: '', body: '' })
      setStatus(uiLanguage === 'KO' ? '로컬 지침서에 저장했습니다' : uiLanguage === 'JA' ? 'ローカルガイドラインに保存しました' : 'Saved to local guideline')
    }
  }

  const removeGuide = async (id: string) => {
    if (user) {
      const isDefault = id === 'suno-clear' || id === 'hook-first'
      if (isDefault) {
        alert(uiLanguage === 'KO' ? '기본 제공 지침서는 삭제할 수 없습니다.' : uiLanguage === 'JA' ? 'デフォルトのガイドラインは削除できません。' : 'Default guidelines cannot be deleted.')
        return
      }

      try {
        const res = await fetch(`/api/user-guides?id=${id}`, {
          method: 'DELETE'
        })

        if (res.ok) {
          setGuides((current) => current.filter((guide) => guide.id !== id))
          setActiveGuideIds((current) => current.filter((guideId) => guideId !== id))
          setStatus(uiLanguage === 'KO' ? '지침서를 서버에서 삭제했습니다' : uiLanguage === 'JA' ? 'サーバーからガイドラインを削除しました' : 'Deleted guideline from server')
        } else {
          const err = await res.json()
          console.error('Error deleting guide on server:', err)
          alert(uiLanguage === 'KO' ? `지침서 삭제 실패: ${err.error}` : uiLanguage === 'JA' ? `ガイドの削除に失敗しました: ${err.error}` : `Failed to delete guide: ${err.error}`)
        }
      } catch (e: any) {
        console.error('Error deleting guide on server:', e)
        alert(uiLanguage === 'KO' ? '지침서 삭제 실패 (네트워크 오류)' : uiLanguage === 'JA' ? 'ガイドラインの削除に失敗しました (ネットワークエラー)' : 'Failed to delete guide (Network error)')
      }
    } else {
      const newGuides = guides.filter((guide) => guide.id !== id)
      setGuides(newGuides)
      writeJson(STORAGE_KEYS.guides, newGuides)
      setActiveGuideIds((current) => current.filter((guideId) => guideId !== id))
      setStatus(t.statusHistoryLocalDeleted)
    }
  }

  const generateSample = () => {

    const fallbackText = makeFallback(form, guideText)
    const parsedParts = parseGeneratedText(fallbackText)
    setResultParts(parsedParts)
    setStatus(t.statusSampleGenerated)
    saveHistory(parsedParts)
  }

  const generate = async () => {
    // Check credits
    const modelCost = getModelCreditCost(settings.model)
    const savedCredits = localStorage.getItem('user-credits')
    const currentCredits = savedCredits !== null ? parseFloat(savedCredits) : 120
    if (currentCredits < modelCost) {
      alert(uiLanguage === 'KO' ? `크레딧이 부족합니다. (필요: ${modelCost} 크레딧)` : uiLanguage === 'JA' ? `クレジットが不足しています。( ${modelCost} クレジット必要)` : `Insufficient credits. (Requires ${modelCost} credits)`)
      return
    }

    const promptObj = buildInstructionPrompt(form, guideText)
    setIsGenerating(true)
    setStatus(t.statusGenerating)
    try {
      if (!user) {
        generateSample()
        return
      }
      
      const response = await fetch('/api/generate-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          system: promptObj.system,
          user: promptObj.user,
          model: settings.model
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || (uiLanguage === 'KO' ? '프롬프트 생성 실패' : uiLanguage === 'JA' ? 'プロンプトの生成に失敗しました' : 'Failed to generate prompt'))
      }

      const data = await response.json()
      const nextResult = data.text || ''
      const textToSave = nextResult.trim() || makeFallback(form, guideText)
      const parsedParts = parseGeneratedText(textToSave)

      // Deduct credits and save transaction!
      const currentCredits = parseFloat(localStorage.getItem('user-credits') || '120')
      const nextCredits = Number((currentCredits - modelCost).toFixed(1))
      localStorage.setItem('user-credits', String(nextCredits))

      const savedTx = localStorage.getItem('user-transactions')
      let txList = []
      if (savedTx) {
        try {
          txList = JSON.parse(savedTx)
        } catch (e) {
          console.error(e)
        }
      }
      const newTx = {
        id: 'tx-' + Date.now(),
        date: new Date().toISOString().replace('T', ' ').slice(0, 16),
        type: 'use',
        desc: uiLanguage === 'KO' ? `가사 및 프롬프트 생성 (-${modelCost})` : uiLanguage === 'JA' ? `歌詞 & プロンプト生成 (-${modelCost})` : `Lyrics & Prompt Generation (-${modelCost})`,
        amount: `-${modelCost}`,
        status: 'Completed'
      }
      localStorage.setItem('user-transactions', JSON.stringify([newTx, ...txList]))

      setResultParts(parsedParts)
      setStatus(`${PROVIDERS.openai.name} ${t.statusGenerated}`)
      saveHistory(parsedParts)
    } catch (error: any) {
      const fallbackText = makeFallback(form, guideText)
      const parsedParts = parseGeneratedText(fallbackText)
      parsedParts.notes = parsedParts.notes 
        ? `${parsedParts.notes}\n\n[API 통신 오류]\n${error.message}`
        : `[API 통신 오류]\n${error.message}`
      setResultParts(parsedParts)
      setStatus(t.statusError)
    } finally {
      setIsGenerating(false)
    }
  }

  const copyToClipboard = async (text: string, type: 'all' | 'style' | 'lyrics' | 'meta' = 'all') => {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setStatus(uiLanguage === 'KO' ? '클립보드에 복사되었습니다!' : uiLanguage === 'JA' ? 'クリップボードにコピーしました！' : 'Copied to clipboard!')
    } catch (e) {
      console.error(e)
    }
  }

  const saveHistory = async (parts: typeof EMPTY_RESULT) => {
    const payload = {
      title: parts.title?.trim() || form.title || 'Untitled',
      prompt: parts.prompt,
      lyrics: parts.lyrics,
      notes: parts.notes,
      negativePrompt: parts.negativePrompt,
      form: { ...form },
    }

    if (user) {
      try {
        const res = await fetch('/api/song-history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: payload.title,
            prompt: payload.prompt,
            lyrics: payload.lyrics,
            notes: payload.notes,
            negative_prompt: payload.negativePrompt,
            form: payload.form
          })
        })

        if (res.ok) {
          const newHistoryItem = await res.json()
          setHistory(prev => [newHistoryItem, ...prev])
          setStatus(uiLanguage === 'KO' ? '서버 히스토리에 저장했습니다' : uiLanguage === 'JA' ? 'サーバー履歴に保存しました' : 'Saved to server history')
          setCurrentHistoryId(newHistoryItem.id)
          return newHistoryItem.id
        }
      } catch (e: any) {
        console.error('Error saving history on server:', e)
      }
    } else {
      const localPayload = {
        ...payload,
        id: `local-${Date.now()}`,
        created_at: new Date().toISOString(),
      }
      const nextHistory = [localPayload, ...history].slice(0, 50)
      writeJson(STORAGE_KEYS.localHistory, nextHistory)
      setHistory(nextHistory)
      setStatus(t.statusHistoryLocalSaved)
      setCurrentHistoryId(localPayload.id)
      return localPayload.id
    }
    return null
  }

  const navigateToGenerate = async () => {
    let historyId = currentHistoryId
    if (!historyId) {
      historyId = await saveHistory(resultParts)
    }
    if (historyId) setCurrentHistoryId(historyId)
    setCurrentTab('suno')
  }

  const openHistoryItem = (item: any, mode: 'all' | 'style' | 'lyrics' = 'all') => {
    setCurrentHistoryId(item.id)
    if (mode === 'all') {
      setResultParts({
        structurePlan: item.structurePlan || '',
        prompt: item.prompt || '',
        negativePrompt: item.negativePrompt || item.form?.negativePrompt || '',
        title: item.title || '',
        lyrics: item.lyrics || '',
        notes: item.notes || '',
        raw: '',
      })
      if (item.form) setForm((current) => ({ ...current, ...item.form }))
    } else if (mode === 'style') {
      if (item.form) {
        setForm((current) => ({
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
        }))
      }
      setResultParts((current) => ({
        ...current,
        prompt: item.prompt || '',
        negativePrompt: item.negativePrompt || item.form?.negativePrompt || ''
      }))
    } else if (mode === 'lyrics') {
      if (item.form) {
        setForm((current) => ({
          ...current,
          targetTool: item.form.targetTool || current.targetTool,
          title: item.form.title || current.title,
          extra: item.form.extra || current.extra
        }))
      }
      setResultParts((current) => ({
        ...current,
        title: item.title || '',
        lyrics: item.lyrics || '',
        notes: item.notes || ''
      }))
    }
    setStatus(t.statusHistoryOpened)
  }

  const deleteHistoryItem = async (id: string) => {
    if (user) {
      try {
        const res = await fetch(`/api/song-history?id=${id}`, { method: 'DELETE' })
        if (res.ok) {
          setHistory(prev => prev.filter(item => item.id !== id))
          setStatus(uiLanguage === 'KO' ? '서버 히스토리 항목을 삭제했습니다' : uiLanguage === 'JA' ? 'サーバー履歴アイテムを削除しました' : 'Deleted server history item')
        } else {
          const err = await res.json()
          console.error('Error deleting history on server:', err)
          setStatus(uiLanguage === 'KO' ? `서버 삭제 실패: ${err.error}` : uiLanguage === 'JA' ? `サーバー削除に失敗しました: ${err.error}` : `Server delete failed: ${err.error}`)
        }
      } catch (e: any) {
        console.error('Error deleting history on server:', e)
        setStatus(uiLanguage === 'KO' ? '서버 삭제 실패 (네트워크 오류)' : uiLanguage === 'JA' ? 'サーバー履歴の削除に失敗しました (ネットワークエラー)' : 'Failed to delete from server (Network error)')
      }
    } else {
      const nextHistory = history.filter((item) => item.id !== id)
      writeJson(STORAGE_KEYS.localHistory, nextHistory)
      setHistory(nextHistory)
      setStatus(t.statusHistoryLocalDeleted)
    }
  }

  const provider = PROVIDERS.openai
  const modelCost = getModelCreditCost(settings.model)

  return (
    /* 배경은 레이아웃의 바닥색을 비춘다 — 판은 StudioHeader 와 StudioWorkspace 가 그린다 */
    <div className="text-zinc-200 min-h-screen md:min-h-0 md:flex-1 font-sans flex flex-col overflow-hidden">
      {/* Studio Header */}
      <StudioHeader
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        uiLanguage={uiLanguage}
        userCredits={userCredits}
        user={user}
      />

      {/* Main Studio Multi-Pane Workspace */}
      <StudioWorkspace
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        uiLanguage={uiLanguage}
        userCredits={userCredits}
        user={user}
        history={history}
        childrenLeft={
          /* 판이 이제 플레이어 위에서 끝나므로 아래를 128px 씩 비워 둘 이유가 없다 */
          <div className="w-full p-6 pb-8">
            {currentTab === 'suno' && (
              <div className="max-w-[1700px] mx-auto w-full">
                <GenerateClient
                  user={user}
                  historyId={currentHistoryId}
                  initialPrompt={resultParts.lyrics}
                  initialStyle={resultParts.prompt}
                  initialTitle={resultParts.title}
                  initialNegativePrompt={resultParts.negativePrompt}
                />
              </div>
            )}

            {currentTab === 'cover' && (
              <div className="max-w-[1700px] mx-auto w-full">
                <CoverClient user={user} />
              </div>
            )}

            {currentTab === 'mastering' && (
              <div className="max-w-[1700px] mx-auto w-full">
                <MasteringClient />
              </div>
            )}

            {currentTab === 'library' && (
              <div className="max-w-[1700px] mx-auto w-full space-y-5 pb-10">
                <StudioHero
                  badge={
                    <>
                      <HardDrive className="w-3.5 h-3.5" />
                      <span>Media Library</span>
                    </>
                  }
                  title={
                    uiLanguage === 'KO' ? (
                      <>미디어 클립 <span className="text-primary drop-shadow-[0_0_15px_rgba(var(--cm-brand-rgb),0.4)]">보관함</span> ({history.length})</>
                    ) : uiLanguage === 'JA' ? (
                      <>メディアクリップ <span className="text-primary drop-shadow-[0_0_15px_rgba(var(--cm-brand-rgb),0.4)]">ライブラリ</span> ({history.length})</>
                    ) : (
                      <>MEDIA CLIP <span className="text-primary drop-shadow-[0_0_15px_rgba(var(--cm-brand-rgb),0.4)]">LIBRARY</span> ({history.length})</>
                    )
                  }
                  desc={
                    uiLanguage === 'KO'
                      ? '만들어 둔 AI 오디오 트랙과 프로젝트 에셋입니다. 카드를 누르면 재생되고, 지팡이 아이콘으로 그때 쓴 프롬프트를 되돌립니다.'
                      : uiLanguage === 'JA'
                      ? '生成したAIオーディオトラックとプロジェクトアセットです。カードを押すと再生され、杖アイコンで当時のプロンプトに戻せます。'
                      : 'Every AI audio track and project asset you have made. Click a card to play it, or use the wand icon to restore the prompt behind it.'
                  }
                  bg="/studio/hero-library.webp"
                >
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <div
                      role="group"
                      aria-label={uiLanguage === 'KO' ? '보기 크기' : uiLanguage === 'JA' ? '表示サイズ' : 'View size'}
                      className="flex items-center gap-0.5 p-0.5 rounded-xl bg-[#0f0f0f] border border-[#232323] shadow-sm"
                    >
                      {LIBRARY_VIEW_SIZES.map((size) => {
                        const Icon = LIBRARY_VIEW_ICONS[size]
                        const label = LIBRARY_VIEW_LABELS[size][uiLanguage === 'KO' ? 'KO' : uiLanguage === 'JA' ? 'JA' : 'EN']
                        const active = libraryViewSize === size
                        return (
                          <button
                            key={size}
                            type="button"
                            onClick={() => changeLibraryViewSize(size)}
                            aria-pressed={active}
                            aria-label={label}
                            title={label}
                            className={`px-2 sm:px-3 py-1.5 rounded-[10px] text-xs font-bold flex items-center gap-1.5 transition-all motion-reduce:transition-none cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${
                              active
                                ? 'bg-primary/15 text-primary border border-primary/40'
                                : 'border border-transparent text-zinc-400 hover:text-zinc-100 hover:bg-[#1a1a1a]'
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">{label}</span>
                          </button>
                        )
                      })}
                    </div>
                    <button
                      onClick={fetchSongHistory}
                      className="px-3.5 py-1.5 rounded-xl bg-[#161616] hover:bg-[#1e1e1e] border border-[#232323] text-xs font-bold flex items-center gap-1.5 text-zinc-300 hover:text-primary transition-all cursor-pointer shadow-sm"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>새로고침</span>
                    </button>
                  </div>
                </StudioHero>
                <div className={`grid ${LIBRARY_GRID_CLASS[libraryViewSize]}`}>
                  {history.map((item) => {
                    const isSmall = libraryViewSize === 'small'
                    const isLarge = libraryViewSize === 'large'
                    const btnClass = isSmall ? 'w-6 h-6' : isLarge ? 'w-9 h-9' : 'w-8 h-8'
                    const iconClass = isSmall ? 'w-3 h-3' : isLarge ? 'w-4 h-4' : 'w-3.5 h-3.5'
                    const actions = (
                      <>
                        <button
                          onClick={() => { openHistoryItem(item, 'all'); setCurrentTab('studio'); }}
                          title={uiLanguage === 'KO' ? '프롬프트로 되돌리기' : uiLanguage === 'JA' ? 'プロンプトに戻す' : 'Restore to prompt'}
                          className={`${btnClass} rounded-full bg-[#1a1a1a] border border-[#262626] text-zinc-400 hover:text-primary hover:border-primary/40 flex items-center justify-center transition-all motion-reduce:transition-none opacity-0 group-hover:opacity-100 focus-visible:opacity-100 shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60`}
                        >
                          <Wand2 className={iconClass} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(item.id)}
                          title={uiLanguage === 'KO' ? '삭제' : uiLanguage === 'JA' ? '削除' : 'Delete'}
                          className={`${btnClass} rounded-full bg-[#1a1a1a] border border-[#262626] text-zinc-400 hover:text-red-400 hover:border-red-500/40 flex items-center justify-center transition-all motion-reduce:transition-none opacity-0 group-hover:opacity-100 focus-visible:opacity-100 shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60`}
                        >
                          <Trash2 className={iconClass} />
                        </button>
                        <button
                          onClick={() => playHistoryTrack(item)}
                          title={uiLanguage === 'KO' ? '재생' : uiLanguage === 'JA' ? '再生' : 'Play'}
                          className={`${btnClass} rounded-full bg-primary text-black flex items-center justify-center transition-all motion-reduce:transition-none shadow-md shadow-black/40 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60`}
                        >
                          {currentTrack?.id === item.id && isPlaying
                            ? <Pause className={`${iconClass} fill-current text-black`} />
                            : <Play className={`${iconClass} ml-0.5 fill-current text-black`} />}
                        </button>
                      </>
                    )
                    return (
                      <div
                        key={item.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => playHistoryTrack(item)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            playHistoryTrack(item)
                          }
                        }}
                        className={`rounded-2xl bg-[#111111] hover:bg-[#181818] border border-[#1e1e1e] hover:border-primary/50 transition-all motion-reduce:transition-none cursor-pointer group shadow-lg shadow-black/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${
                          isSmall ? 'p-2 flex flex-col gap-2' : isLarge ? 'p-5 flex items-center gap-4' : 'p-3.5 flex items-center gap-3.5'
                        }`}
                      >
                        <div
                          className={`bg-[#0a0a0a] flex items-center justify-center shrink-0 overflow-hidden border border-[#1a1a1a] relative ${
                            isSmall ? 'w-full aspect-square rounded-xl' : isLarge ? 'w-20 h-20 rounded-2xl' : 'w-14 h-14 rounded-xl'
                          }`}
                        >
                          {item.image_url ? (
                            <img src={item.image_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Music className={`text-primary/60 ${isLarge ? 'w-8 h-8' : 'w-6 h-6'}`} />
                          )}
                          {isSmall && (
                            <div
                              className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 py-1 bg-black/70 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity motion-reduce:transition-none"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {actions}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 w-full">
                          <h4 className={`font-bold text-zinc-100 truncate group-hover:text-primary ${isSmall ? 'text-[11px]' : isLarge ? 'text-sm' : 'text-xs'}`}>{item.title || 'Untitled'}</h4>
                          {!isSmall && (
                            <p className={`text-zinc-500 truncate mt-0.5 font-mono ${isLarge ? 'text-xs' : 'text-[11px]'}`}>{item.style || item.style_desc || 'AI Track'}</p>
                          )}
                        </div>
                        {!isSmall && (
                          <div className={`flex items-center shrink-0 ${isLarge ? 'gap-2' : 'gap-1.5'}`} onClick={(e) => e.stopPropagation()}>
                            {actions}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {currentTab === 'studio' && (
              <div className="max-w-[1700px] mx-auto w-full grid grid-cols-1 xl:grid-cols-12 gap-5 pb-10">

                {/* 히어로 — 그리드 한 줄을 통째로 쓴다 */}
                <div className="xl:col-span-12">
                  <StudioHero
                    badge={
                      <>
                        <Wand2 className="w-3.5 h-3.5" />
                        <span>Lyrics &amp; Prompt Engine</span>
                      </>
                    }
                    title={
                      uiLanguage === 'KO' ? (
                        <>음악 <span className="text-primary drop-shadow-[0_0_15px_rgba(var(--cm-brand-rgb),0.4)]">프롬프트 스튜디오</span></>
                      ) : uiLanguage === 'JA' ? (
                        <>音楽 <span className="text-primary drop-shadow-[0_0_15px_rgba(var(--cm-brand-rgb),0.4)]">プロンプトスタジオ</span></>
                      ) : (
                        <>MUSIC <span className="text-primary drop-shadow-[0_0_15px_rgba(var(--cm-brand-rgb),0.4)]">PROMPT STUDIO</span></>
                      )
                    }
                    desc={
                      uiLanguage === 'KO'
                        ? '곡 제목과 장르·분위기를 정하고 지침서를 얹으면 섹션 태그가 들어간 가사와 스타일·제외 프롬프트를 함께 만듭니다.'
                        : uiLanguage === 'JA'
                        ? '曲名とジャンル・雰囲気を決めてガイドラインを重ねると、セクションタグ入りの歌詞とスタイル・除外プロンプトをまとめて作ります。'
                        : 'Set a title, genres and mood, layer on your guidelines, and get section-tagged lyrics with matching style and exclude prompts.'
                    }
                    bg="/studio/hero-prompt.webp"
                  />
                </div>

                {/* 1열: 좌측 패널 (AI 설정 & 지침서 가이드) - 3칸 */}
                <div className="xl:col-span-3 space-y-4 xl:flex xl:flex-col">
                  {/* AI 설정 ([임시 게이트] 해제 방법은 src/lib/auth/aiGate.ts 참고) */}
                  {canUseAi && (
                    <div className="bg-[#111111] border border-[#1e1e1e] p-4 rounded-2xl space-y-3 shadow-xl">
                      <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-primary">
                        <Settings className="w-3.5 h-3.5 text-primary" />
                        AI 설정
                      </h3>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500">모델</label>
                        <select
                          value={settings.model}
                          onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                          className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-2.5 text-xs font-semibold text-zinc-200 focus:outline-none focus:border-primary/60"
                        >
                          {provider.models.map((model) => (
                            <option key={model} value={model}>{model}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {/* 지침서 (가이드) */}
                  <div className="bg-[#111111] border border-[#1e1e1e] p-4 rounded-2xl space-y-3.5 shadow-xl">
                    <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-primary">
                      <FileText className="w-3.5 h-3.5 text-primary" />
                      지침서 (가이드)
                    </h3>

                    {/* 지침서 목록 */}
                    {guides.length > 0 && (
                      <div className="space-y-2 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
                        {guides.map((guide) => (
                          <div
                            key={guide.id}
                            className={`p-2.5 rounded-xl border transition-all flex items-start justify-between gap-2 group ${
                              activeGuideIds.includes(guide.id)
                                ? 'bg-primary/10 border-primary/40 text-primary'
                                : 'bg-[#0a0a0a]/60 border-[#1a1a1a] text-zinc-400 hover:border-zinc-700'
                            }`}
                          >
                            <button
                              onClick={() =>
                                setActiveGuideIds((prev) =>
                                  prev.includes(guide.id) ? prev.filter((id) => id !== guide.id) : [...prev, guide.id]
                                )
                              }
                              className="flex-1 text-left cursor-pointer"
                            >
                              <div className="flex items-center gap-1.5 font-bold text-xs">
                                <Check className={`w-3.5 h-3.5 transition-all ${activeGuideIds.includes(guide.id) ? 'opacity-100 text-primary' : 'opacity-20'}`} />
                                <span className="truncate">{guide.title}</span>
                              </div>
                              <p className="text-[10px] text-zinc-500 mt-0.5 line-clamp-2 leading-relaxed">{guide.body}</p>
                            </button>
                            <button
                              onClick={() => removeGuide(guide.id)}
                              className="text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all p-0.5 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 지침서 등록 폼 */}
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="새 지침서 제목"
                        value={draftGuide.title}
                        onChange={(e) => setDraftGuide({ ...draftGuide, title: e.target.value })}
                        className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-2.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-primary/60"
                      />
                      <textarea
                        placeholder="작사 규칙, 금지어, 브랜드 톤, 구조 등을 입력"
                        rows={2}
                        value={draftGuide.body}
                        onChange={(e) => setDraftGuide({ ...draftGuide, body: e.target.value })}
                        className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-2.5 text-xs text-zinc-200 placeholder-zinc-600 resize-none focus:outline-none focus:border-primary/60 custom-scrollbar"
                      />
                      <button
                        onClick={addGuide}
                        className="w-full py-2.5 bg-[#161616] hover:bg-[#1e1e1e] border border-[#232323] text-zinc-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
                      >
                        지침서 등록하기
                      </button>
                    </div>

                    {/* 문서 업로드 (PDF/TXT) — 왼쪽 칼럼이 가운데보다 짧아 아래가 비어 보이던 자리라,
                        이 영역이 남는 높이를 가져가 칸을 채운다(대표 지시 2026-09-05). */}
                    <div className="pt-2 space-y-1.5 border-t border-[#1a1a1a] xl:flex-1 xl:flex xl:flex-col xl:min-h-0">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">문서 업로드 (PDF/TXT)</span>
                      <div className="relative border border-dashed border-[#232323] hover:border-primary/50 bg-[#0a0a0a]/60 rounded-xl p-4 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all xl:flex-1 xl:min-h-[160px]">
                        <input
                          type="file"
                          ref={fileInputRef}
                          accept=".pdf,.txt"
                          onChange={handleFileUpload}
                          className="absolute inset-0 opacity-0 cursor-pointer z-10"
                        />
                        <Upload className="w-4 h-4 text-zinc-500 mb-1" />
                        <span className="text-[10px] text-zinc-500 text-center">
                          {isParsing ? '문서 읽는 중...' : '드래그하거나 클릭하여 파일 선택'}
                        </span>
                        <span className="text-[10px] text-zinc-600 text-center leading-relaxed max-w-[22ch]">
                          {uiLanguage === 'KO'
                            ? '작사 규칙이나 참고 자료를 올리면 프롬프트에 반영됩니다'
                            : uiLanguage === 'JA'
                              ? '作詞ルールや参考資料をアップロードするとプロンプトに反映されます'
                              : 'Upload lyric rules or references to fold them into the prompt'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2열: 중앙 패널 (곡 정보 및 프롬프트 설정) - 5칸 */}
                <div className="xl:col-span-5 space-y-4">
                  <div className="bg-[#111111] border border-[#1e1e1e] p-5 rounded-2xl space-y-4 shadow-xl">
                    <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-primary">
                      <Disc className="w-3.5 h-3.5 text-primary" />
                      곡 정보 및 프롬프트 설정
                    </h3>

                    {/* 1. 곡 제목 & 대상 툴 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-400">곡 제목 (TITLE)</label>
                        <input
                          type="text"
                          placeholder="예: Neon City Lights"
                          value={form.title}
                          onChange={(e) => updateForm('title', e.target.value)}
                          className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-2.5 text-xs font-bold text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-primary/60"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-400">대상 툴 (TARGET AI)</label>
                        <div className="grid grid-cols-3 gap-1 bg-[#0a0a0a] p-1 rounded-xl border border-[#1a1a1a]">
                          <button
                            type="button"
                            onClick={() => updateForm('targetTool', 'Suno')}
                            className={`py-2 text-xs font-extrabold rounded-lg transition-all ${form.targetTool.toLowerCase() === 'suno' ? 'bg-primary text-black shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                          >
                            Suno
                          </button>
                          <button
                            type="button"
                            disabled
                            className="py-2 text-xs font-semibold rounded-lg text-zinc-500 relative flex items-center justify-center gap-1 cursor-not-allowed"
                          >
                            <span>Udio</span>
                            <span className="text-[8px] bg-red-950/80 text-red-400 border border-red-800/40 px-1 rounded">예정</span>
                          </button>
                          <button
                            type="button"
                            disabled
                            className="py-2 text-xs font-semibold rounded-lg text-zinc-500 relative flex items-center justify-center gap-1 cursor-not-allowed"
                          >
                            <span>MusicFX</span>
                            <span className="text-[8px] bg-red-950/80 text-red-400 border border-red-800/40 px-1 rounded">예정</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* 2. 곡 형태 */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-400">곡 유형 (SONG TYPE)</label>
                      <div className="grid grid-cols-2 gap-1.5 bg-[#0a0a0a] p-1 rounded-xl border border-[#1a1a1a]">
                        <button
                          type="button"
                          onClick={() => updateForm('songType', 'vocal')}
                          className={`py-2.5 text-xs font-extrabold rounded-lg transition-all ${form.songType === 'vocal' ? 'bg-primary text-black shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                        >
                          가사 있는 곡
                        </button>
                        <button
                          type="button"
                          onClick={() => updateForm('songType', 'instrumental')}
                          className={`py-2.5 text-xs font-extrabold rounded-lg transition-all ${form.songType === 'instrumental' ? 'bg-primary text-black shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                        >
                          가사 없는 연주곡 (BGM)
                        </button>
                      </div>
                    </div>

                    {/* 3. 장르 1 & 장르 2 */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-400">장르 1</label>
                        <button
                          type="button"
                          onClick={() => { setGenreModalTarget('genre1'); setIsGenreModalOpen(true); }}
                          className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-2.5 text-xs text-left text-zinc-200 flex items-center justify-between hover:border-zinc-500 cursor-pointer"
                        >
                          <span className="truncate">{form.genre1 || '케이팝'}</span>
                          <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
                        </button>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-400">장르 2</label>
                        <button
                          type="button"
                          onClick={() => { setGenreModalTarget('genre2'); setIsGenreModalOpen(true); }}
                          className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-2.5 text-xs text-left text-zinc-200 flex items-center justify-between hover:border-zinc-500 cursor-pointer"
                        >
                          <span className="truncate">{form.genre2 || '없음'}</span>
                          <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
                        </button>
                      </div>
                    </div>

                    {/* 장르 비중 슬라이더 */}
                    <div className="space-y-1.5 bg-[#0a0a0a] p-3 rounded-xl border border-[#1a1a1a]">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[10px] font-bold text-zinc-400">장르 비중</span>
                        <span className="font-mono font-bold text-primary text-xs">{form.genreRatio || 70} : {100 - (form.genreRatio || 70)}</span>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="90"
                        step="5"
                        value={form.genreRatio || 70}
                        onChange={(e) => updateForm('genreRatio', parseInt(e.target.value))}
                        className="w-full h-1.5 bg-zinc-800 accent-primary rounded-lg cursor-pointer"
                      />
                    </div>

                    {/* 4. 스타일 설명 */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-400">스타일 설명 (STYLE DESCRIPTION)</label>
                      <textarea
                        rows={2}
                        placeholder="예: Korean city pop, synth pop, nostalgic, rainy, warm, cinematic"
                        value={form.styleDesc}
                        onChange={(e) => updateForm('styleDesc', e.target.value)}
                        className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-2.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-primary/60 resize-none custom-scrollbar"
                      />
                    </div>

                    {/* 5. 곡 전개 구조 */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-400">곡 전개 구조 (SONG STRUCTURE)</label>
                      <select
                        value={form.songStructure || '대중적인 팝 (Verse-Chorus)'}
                        onChange={(e) => updateForm('songStructure', e.target.value)}
                        className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-2.5 text-xs text-zinc-200 focus:outline-none focus:border-primary/60"
                      >
                        <option value="대중적인 팝 (Verse-Chorus)">대중적인 팝 (Verse-Chorus)</option>
                        <option value="EDM / 댄스 구조 (Build-up & Drop)">EDM / 댄스 구조 (Build-up & Drop)</option>
                        <option value="발라드 기승전결 (Intro-Verse-Chorus-Bridge-Outro)">발라드 기승전결 (Intro-Verse-Chorus-Bridge-Outro)</option>
                        <option value="힙합/랩 그루브 (Hook & Verse)">힙합/랩 그루브 (Hook & Verse)</option>
                        <option value="자유로운 전개 (Freeform)">자유로운 전개 (Freeform)</option>
                      </select>
                    </div>

                    {/* 6. 음악 길이 */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-400">음악 길이 (LENGTH)</label>
                      <select
                        value={form.musicLength || '3분'}
                        onChange={(e) => updateForm('musicLength', e.target.value)}
                        className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-2.5 text-xs text-zinc-200 focus:outline-none focus:border-primary/60"
                      >
                        <option value="1분">1분</option>
                        <option value="2분">2분</option>
                        <option value="3분">3분</option>
                        <option value="4분">4분</option>
                        <option value="5분">5분</option>
                      </select>
                    </div>

                    {/* 보컬 곡 옵션들 */}
                    {form.songType !== 'instrumental' && (
                      <div className="space-y-3 pt-1">
                        {/* 가사 분량 & 보이스 톤 */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-400">가사 분량</label>
                            <select
                              value={form.lyricDensity || '보통 (Medium)'}
                              onChange={(e) => updateForm('lyricDensity', e.target.value)}
                              className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-2.5 text-xs text-zinc-200 focus:outline-none focus:border-primary/60"
                            >
                              <option value="적음 (Short)">적음 (Short)</option>
                              <option value="보통 (Medium)">보통 (Medium)</option>
                              <option value="많음 (Dense)">많음 (Dense)</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-400">보이스 톤</label>
                            <select
                              value={form.vocalTone || '밝고 쾌활한'}
                              onChange={(e) => updateForm('vocalTone', e.target.value)}
                              className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-2.5 text-xs text-zinc-200 focus:outline-none focus:border-primary/60"
                            >
                              <option value="밝고 쾌활한">밝고 쾌활한</option>
                              <option value="부드럽고 감미로운">부드럽고 감미로운</option>
                              <option value="허스키하고 소울풀한">허스키하고 소울풀한</option>
                              <option value="파워풀한">파워풀한</option>
                              <option value="몽환적 / 위스퍼">몽환적 / 위스퍼</option>
                            </select>
                          </div>
                        </div>

                        {/* 보컬 나이 & 보컬 젠더/구성 */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-400">보컬 나이</label>
                            <select
                              value={form.vocalAge || '10대'}
                              onChange={(e) => updateForm('vocalAge', e.target.value)}
                              className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-2.5 text-xs text-zinc-200 focus:outline-none focus:border-primary/60"
                            >
                              <option value="10대">10대</option>
                              <option value="20대 청년">20대 청년</option>
                              <option value="30-40대 성인">30-40대 성인</option>
                              <option value="중후한 노년">중후한 노년</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-400">보컬 젠더/구성</label>
                            <select
                              value={form.vocalGenderGroup || '여자'}
                              onChange={(e) => updateForm('vocalGenderGroup', e.target.value)}
                              className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-2.5 text-xs text-zinc-200 focus:outline-none focus:border-primary/60"
                            >
                              <option value="여자">여자</option>
                              <option value="남자">남자</option>
                              <option value="혼성 듀엣">혼성 듀엣</option>
                              <option value="여성 그룹">여성 그룹</option>
                              <option value="남성 그룹">남성 그룹</option>
                              <option value="합창">합창</option>
                            </select>
                          </div>
                        </div>

                        {/* 언어 1 & 언어 2 */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-400">언어 1</label>
                            <select
                              value={form.language1 || '한국어'}
                              onChange={(e) => updateForm('language1', e.target.value)}
                              className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-2.5 text-xs text-zinc-200 focus:outline-none focus:border-primary/60"
                            >
                              <option value="한국어">한국어</option>
                              <option value="영어">영어</option>
                              <option value="일본어">일본어</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-400">언어 2</label>
                            <select
                              value={form.language2 || '없음'}
                              onChange={(e) => updateForm('language2', e.target.value)}
                              className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-2.5 text-xs text-zinc-200 focus:outline-none focus:border-primary/60"
                            >
                              <option value="없음">없음</option>
                              <option value="영어">영어</option>
                              <option value="한국어">한국어</option>
                              <option value="일본어">일본어</option>
                            </select>
                          </div>
                        </div>

                        {/* 언어 비중 슬라이더 */}
                        <div className="space-y-1.5 bg-[#0a0a0a] p-3 rounded-xl border border-[#1a1a1a]">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-[10px] font-bold text-zinc-400">언어 비중</span>
                            <span className="font-mono font-bold text-primary text-xs">{form.languageRatio || 70} : {100 - (form.languageRatio || 70)}</span>
                          </div>
                          <input
                            type="range"
                            min="10"
                            max="90"
                            step="5"
                            value={form.languageRatio || 70}
                            onChange={(e) => updateForm('languageRatio', parseInt(e.target.value))}
                            className="w-full h-1.5 bg-zinc-800 accent-primary rounded-lg cursor-pointer"
                          />
                        </div>
                      </div>
                    )}

                    {/* 7. 템포 (BPM/TEMPO) */}
                    <div className="space-y-2 bg-[#0a0a0a] p-3.5 rounded-xl border border-[#1a1a1a]">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-zinc-400">템포 (BPM/TEMPO)</span>
                        <span className="font-mono font-black text-primary text-xs">{form.tempo || 120} BPM</span>
                      </div>
                      <input
                        type="range"
                        min="60"
                        max="180"
                        step="1"
                        value={form.tempo || 120}
                        onChange={(e) => updateForm('tempo', parseInt(e.target.value))}
                        className="w-full h-1.5 bg-zinc-800 accent-primary rounded-lg cursor-pointer"
                      />
                      <div className="flex justify-between text-[9px] text-zinc-500 font-semibold px-0.5">
                        <span>아주 느리게</span>
                        <span>느리게</span>
                        <span>보통</span>
                        <span>빠르게</span>
                        <span>아주 빠르게</span>
                      </div>
                    </div>

                    {/* 8. 추가 요청 & 제외 요소 */}
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-zinc-400">추가 요청 (EXTRA REQUESTS)</label>
                          <span className="text-[9px] text-zinc-600">특정 악기, 특수 효과 등</span>
                        </div>
                        <input
                          type="text"
                          placeholder="예: 코러스에 일렉기타 솔로 추가, 리버브 이펙트 강조"
                          value={form.extra}
                          onChange={(e) => updateForm('extra', e.target.value)}
                          className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-2.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-primary/60"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-400">제외 요소 (NEGATIVE PROMPT)</label>
                        <input
                          type="text"
                          placeholder="예: lo-fi, noise, bad vocals (선택 사항)"
                          value={form.exclude}
                          onChange={(e) => updateForm('exclude', e.target.value)}
                          className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-2.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-primary/60"
                        />
                      </div>
                    </div>

                    {/* 9. 하단 액션 버튼들 (참고 이미지와 100% 동일) */}
                    {/* [임시 게이트] 해제 방법은 src/lib/auth/aiGate.ts 참고 */}
                    {!canUseAi && (
                      <div className="pt-2">
                        <div className="px-4 py-3.5 rounded-xl border border-[#232323] bg-[#0f0f0f] text-center text-[11px] font-semibold text-zinc-500">
                          AI 생성 기능은 준비 중입니다.
                        </div>
                      </div>
                    )}
                    {canUseAi && (
                    <div className="pt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={generate}
                        disabled={isGenerating}
                        className="flex-1 py-3.5 bg-primary hover:bg-[#f5237f] active:scale-[0.99] text-black text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-yellow-950/40 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        <Sparkles className="w-4 h-4 fill-current text-black" />
                        <span>{isGenerating ? 'AI 생성 중...' : `GENERATE PROMPT & LYRICS (${modelCost} 크레딧)`}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setForm({
                            ...form,
                            title: 'Neon City Lights',
                            genre1: '케이팝',
                            genre2: '시티팝',
                            genreRatio: 70,
                            styleDesc: 'Korean city pop, synth pop, nostalgic, rainy, warm, cinematic, 80s analog synth',
                            songStructure: '대중적인 팝 (Verse-Chorus)',
                            musicLength: '3분',
                            lyricDensity: '보통 (Medium)',
                            vocalTone: '밝고 쾌활한',
                            vocalAge: '20대 청년',
                            vocalGenderGroup: '여자',
                            language1: '한국어',
                            language2: '영어',
                            languageRatio: 80,
                            tempo: 120,
                            extra: '후렴구에 그루비한 슬랩 베이스와 시티팝 브라스 강조',
                            exclude: 'lo-fi, noise, harsh distortion'
                          })
                          setResultParts({
                            structurePlan: '- 목표 길이: 3분 (180초)\n- 추천 BPM: 120 BPM\n- 총 마디 수: 90 Bars\n- 섹션: Intro(8) - Verse 1(16) - Pre-Chorus(8) - Chorus(16) - Verse 2(16) - Chorus(16) - Outro(10)',
                            prompt: 'k-city pop, 80s synth pop, groovy slap bass, warm analog synthesizer, bright female vocal, brass hits, urban night mood, 120 bpm, polished mix',
                            negativePrompt: 'lo-fi, noise, harsh distortion, muddy bass',
                            title: 'Neon City Lights (네온 시티 라이츠)',
                            lyrics: '[Intro | dreamy synth pad & groovy bassline]\n\n[Verse 1 | bright female vocal]\n비 내린 거리 위로 번지는 네온 사인\n우산 끝을 타고 흐르는 멜로디라인\n라디오에선 익숙한 시티팝 소리\n멈춰 선 이 순간 너를 떠올려\n\n[Pre-Chorus | building drums & brass stabs]\n점점 더 선명해지는 밤하늘의 불빛\n우리의 시간을 향해 달려가고 있어\n\n[Chorus | energetic & catchy hook]\nNeon City Lights, 밤을 밝혀줘\n흘러가는 음악 속에 우리 둘의 기억을\n끝없이 빛나는 이 도시 속에서\n너와 나 다시 만날 수 있게\n\n[Outro | fading synth & guitar riff]\nUnder the neon lights... Yeah...',
                            notes: '1. 80년대 신스 사운드와 세련된 슬랩 베이스를 결합한 전형적인 K-시티팝 구조입니다.\n2. [Chorus] 부분에서 신스 브라스와 보컬 코러스가 풍성하게 어우러집니다.',
                            raw: ''
                          })
                          setStatus('샘플 프롬프트와 가사가 로드되었습니다!')
                        }}
                        className="py-3.5 px-4 bg-[#161616] hover:bg-[#1e1e1e] border border-[#232323] text-zinc-300 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap"
                      >
                        샘플 생성
                      </button>
                    </div>
                    )}
                  </div>
                </div>

                {/* 3열: 우측 패널 (생성 결과 OUTPUT) - 가운데 패널과 아래쪽 높이 일치 */}
                <div className="xl:col-span-4 h-full flex flex-col">
                  <div className="bg-[#111111] border border-[#1e1e1e] p-5 rounded-2xl shadow-xl flex-1 flex flex-col justify-between space-y-3.5">
                    <div className="space-y-3 flex-1 flex flex-col">
                      <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-primary">
                        <FileText className="w-3.5 h-3.5 text-primary" />
                        생성 결과 (OUTPUT)
                      </h3>

                      {/* 1. SUNO 스타일 프롬프트 */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-zinc-400">SUNO 스타일 프롬프트</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(resultParts.prompt, 'style')}
                            className="text-zinc-500 hover:text-primary p-1 transition-all cursor-pointer"
                            title="복사"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <textarea
                          rows={3}
                          value={resultParts.prompt}
                          onChange={(e) => setResultParts(prev => ({ ...prev, prompt: e.target.value }))}
                          placeholder="여기에 음악 스타일 프롬프트가 생성됩니다."
                          className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-2.5 text-xs text-zinc-200 font-mono placeholder-zinc-700 focus:outline-none focus:border-primary/60 resize-none custom-scrollbar"
                        />
                      </div>

                      {/* 2. 제외 프롬프트 (NEGATIVE PROMPT) */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-zinc-400">제외 프롬프트 (NEGATIVE PROMPT)</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(resultParts.negativePrompt, 'meta')}
                            className="text-zinc-500 hover:text-primary p-1 transition-all cursor-pointer"
                            title="복사"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <textarea
                          rows={2}
                          value={resultParts.negativePrompt}
                          onChange={(e) => setResultParts(prev => ({ ...prev, negativePrompt: e.target.value }))}
                          placeholder="제외할 스타일 프롬프트가 여기에 생성됩니다."
                          className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-2.5 text-xs text-zinc-200 font-mono placeholder-zinc-700 focus:outline-none focus:border-primary/60 resize-none custom-scrollbar"
                        />
                      </div>

                      {/* 3. 곡 제목 */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-zinc-400">곡 제목</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(resultParts.title, 'meta')}
                            className="text-zinc-500 hover:text-primary p-1 transition-all cursor-pointer"
                            title="복사"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <input
                          type="text"
                          value={resultParts.title}
                          onChange={(e) => setResultParts(prev => ({ ...prev, title: e.target.value }))}
                          placeholder="곡 제목"
                          className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-2.5 text-xs text-zinc-200 font-bold placeholder-zinc-700 focus:outline-none focus:border-primary/60"
                        />
                      </div>

                      {/* 4. 가사 편집기 (가운데 패널 높이에 맞춰 쾌적하게 확장) */}
                      <div className="space-y-1 flex-1 flex flex-col min-h-[220px]">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-zinc-400">가사 편집기</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(resultParts.lyrics, 'lyrics')}
                            className="text-zinc-500 hover:text-primary p-1 transition-all cursor-pointer"
                            title="복사"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <textarea
                          rows={11}
                          value={resultParts.lyrics}
                          onChange={(e) => setResultParts(prev => ({ ...prev, lyrics: e.target.value }))}
                          placeholder="섹션 태그가 포함된 가사가 여기에 표시됩니다. 직접 수정하며 최종 완성하세요."
                          className="w-full flex-1 bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-2.5 text-xs text-zinc-200 font-mono placeholder-zinc-700 focus:outline-none focus:border-primary/60 resize-none custom-scrollbar leading-relaxed"
                        />
                      </div>

                      {/* 5. 곡 구조 설계 (마디수/BPM) */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-zinc-400">곡 구조 설계 (마디수/BPM)</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(resultParts.structurePlan, 'meta')}
                            className="text-zinc-500 hover:text-primary p-1 transition-all cursor-pointer"
                            title="복사"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <textarea
                          rows={2}
                          value={resultParts.structurePlan}
                          onChange={(e) => setResultParts(prev => ({ ...prev, structurePlan: e.target.value }))}
                          placeholder="생성 시 곡의 총 마디 수와 BPM 배분표가 여기에 표시됩니다."
                          className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-2.5 text-xs text-zinc-200 font-mono placeholder-zinc-700 focus:outline-none focus:border-primary/60 resize-none custom-scrollbar"
                        />
                      </div>

                      {/* 6. AI 메모 (SUGGESTIONS) */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-zinc-400">AI 메모 (SUGGESTIONS)</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(resultParts.notes, 'meta')}
                            className="text-zinc-500 hover:text-primary p-1 transition-all cursor-pointer"
                            title="복사"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <textarea
                          rows={2}
                          value={resultParts.notes}
                          onChange={(e) => setResultParts(prev => ({ ...prev, notes: e.target.value }))}
                          placeholder="제작 메모 또는 AI의 추가 제안이 표시됩니다."
                          className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-2.5 text-xs text-zinc-200 font-mono placeholder-zinc-700 focus:outline-none focus:border-primary/60 resize-none custom-scrollbar"
                        />
                      </div>
                    </div>

                    {/* 하단 액션 버튼 영역 (가운데 패널 바닥선과 정렬) */}
                    <div className="space-y-2 pt-2 border-t border-[#1a1a1a]">
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const full = composeGeneratedText(resultParts)
                            if (full) copyToClipboard(full, 'all')
                          }}
                          className="py-3 px-3 rounded-xl bg-[#151515] hover:bg-[#1f1f1f] border border-[#232323] text-primary text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>클립보드에 전체 복사</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setResultParts(EMPTY_RESULT)
                            setStatus('생성 결과를 비웠습니다.')
                          }}
                          className="py-3 px-3 rounded-xl bg-[#151515] hover:bg-[#1f1f1f] border border-[#232323] text-zinc-400 hover:text-red-400 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>결과 지우기</span>
                        </button>
                      </div>

                      {/* 최하단 음악 생성 스튜디오로 이동 */}
                      <button
                        type="button"
                        onClick={navigateToGenerate}
                        className="w-full py-3 rounded-xl bg-[#0f0f0f] hover:bg-[#171717] border border-[#232323] hover:border-primary/40 text-zinc-300 hover:text-primary text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-black/40"
                      >
                        <Music className="w-4 h-4 text-primary" />
                        <span>음악 생성 스튜디오로 이동 ↗</span>
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>
        }
      />

      {/* 장르 선택 모달 */}
      <GenreModal
        isOpen={isGenreModalOpen}
        onClose={() => setIsGenreModalOpen(false)}
        title={genreModalTarget === 'genre1' ? (uiLanguage === 'KO' ? '장르 1 선택' : uiLanguage === 'JA' ? 'ジャンル 1 を選択' : 'Select Genre 1') : (uiLanguage === 'KO' ? '장르 2 선택' : uiLanguage === 'JA' ? 'ジャンル 2 を選択' : 'Select Genre 2')}
        selectedGenre={genreModalTarget === 'genre1' ? form.genre1 : form.genre2}
        onSelect={(genreName) => {
          updateForm(genreModalTarget, genreName)
          setIsGenreModalOpen(false)
        }}
        uiLanguage={uiLanguage}
      />

      {deleteConfirmId && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 sm:p-6" onClick={() => setDeleteConfirmId(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-outline-variant/20 bg-surface-container-low/95 backdrop-blur-xl shadow-2xl shadow-black/80 flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-lg font-bold text-white mb-2">
                {uiLanguage === 'KO' ? '삭제 확인' : uiLanguage === 'JA' ? '削除の確認' : 'Confirm Delete'}
              </h3>
              <p className="text-sm text-zinc-400">
                {uiLanguage === 'KO' ? '정말로 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.' : uiLanguage === 'JA' ? '本当に削除しますか？この操作は元に戻せません。' : 'Are you sure you want to delete? This action cannot be undone.'}
              </p>
            </div>
            <div className="border-t border-outline-variant/10 p-4 bg-surface-container-lowest/30 flex gap-3 justify-end">
              <button 
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 text-xs font-bold text-on-surface-variant bg-white/[0.03] hover:bg-white/[0.08] hover:text-white rounded-xl transition-all border border-outline-variant/20 cursor-pointer"
              >
                {uiLanguage === 'KO' ? '취소' : uiLanguage === 'JA' ? 'キャンセル' : 'Cancel'}
              </button>
              <button 
                onClick={() => { confirmDelete(); setDeleteConfirmId(null); }}
                className="px-5 py-2.5 text-xs font-extrabold text-white bg-[#FF2D55] hover:bg-red-500 active:scale-[0.98] rounded-xl transition-all shadow-lg shadow-red-500/20 cursor-pointer"
              >
                {uiLanguage === 'KO' ? '삭제' : uiLanguage === 'JA' ? '削除する' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default StudioClient
