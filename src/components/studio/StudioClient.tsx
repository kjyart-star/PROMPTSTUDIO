'use client'

import { useEffect, useMemo, useState, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronDown, FileText, Music, Sparkles, Wand2, X, Settings, ArrowRight, Play, Pause, FolderPlus, Check, Type, Mic, Info, Image as ImageIcon, Volume2, Globe, Clock, Download, MoreVertical, Disc, Loader2, Heart, Trash2, LogIn, LogOut, Upload, Plus, Bell, Shield, RefreshCw, Layers, Copy, Users, Library } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { usePlayerStore } from '@/stores/playerStore'
import { parsePlaylistDescription } from '@/lib/utils'
import { GENRES } from '@/lib/constants'
import { GENRE_TRANSLATIONS } from '@/lib/constants/genres'
import { CoverClient } from './CoverClient'
import { GenerateClient } from './GenerateClient'
import { MasteringClient } from './MasteringClient'
import { GenreModal } from './GenreModal'
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
  vocalAge: '청소년',
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
}

export function StudioClient({ user }: StudioClientProps) {
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
  const [selectedItem, setSelectedItem] = useState<any>(null)
  
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

  const supabase = createClient()
  const options = useMemo(() => getOptions(uiLanguage), [uiLanguage])

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

  // 로컬 스토리지 데이터 로드 (언어 및 기본 설정만)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const storedLang = localStorage.getItem('language') || navigator.language || ''
    setUiLanguage(storedLang.toLowerCase().startsWith('ko') ? 'KO' : storedLang.toLowerCase().startsWith('ja') ? 'JA' : 'EN')

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

  const [history, setHistory] = useState<any[]>([])
  const [playlists, setPlaylists] = useState<any[]>([])

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

      // 2. Fetch active guide IDs
      if (currentUser) {
        const activeRes = await fetch('/api/profile/active-guides')
        if (activeRes.ok) {
          const activeData = await activeRes.json()
          if (Array.isArray(activeData)) {
            const allAvailableIds = userGuides.map(g => g.id)
            const activeDbIds = activeData.filter(id => allAvailableIds.includes(id))
            setActiveGuideIds(activeDbIds)
            return
          }
        }
      }

      // Fallback for non-logged in or API failure
      const savedActive = readJson(STORAGE_KEYS.activeGuides, null)
      if (savedActive && Array.isArray(savedActive)) {
        const allAvailableIds = userGuides.map(g => g.id)
        const activeLocalIds = savedActive.filter(id => allAvailableIds.includes(id))
        setActiveGuideIds(activeLocalIds)
      } else {
        setActiveGuideIds([])
      }
    } catch (e) {
      console.error('Error fetching guidelines:', e)
      setGuides([])
      setActiveGuideIds([])
    }
  }

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

  const copyText = async (label: string, text: string) => {
    await navigator.clipboard.writeText(text)
    setStatus(`${label} ${t.statusCopied}`)
  }

  const clearResult = () => {
    setResultParts(EMPTY_RESULT)
    setCurrentHistoryId(null)
    setStatus(t.statusCleared)
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
        } else {
          const err = await res.json()
          console.error('Error saving history on server:', err)
          setStatus(uiLanguage === 'KO' ? `서버 저장 실패: ${err.error}` : uiLanguage === 'JA' ? `サーバー保存に失敗しました: ${err.error}` : `Server save failed: ${err.error}`)
        }
      } catch (e: any) {
        console.error('Error saving history on server:', e)
        setStatus(uiLanguage === 'KO' ? '서버 저장 실패 (네트워크 오류)' : uiLanguage === 'JA' ? 'サーバーの保存に失敗しました (ネットワークエラー)' : 'Server save failed (Network error)')
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
    if (!user) {
      alert("음악 생성 기능은 로그인 후 이용 가능합니다.")
      return
    }
    
    let historyId = currentHistoryId
    if (!historyId) {
       historyId = await saveHistory(resultParts)
    }
    
    if (!historyId) {
      alert("기록 저장 실패로 생성을 진행할 수 없습니다.")
      return
    }

    // Switch tab to suno and set history ID internally
    setCurrentHistoryId(historyId)
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
        const res = await fetch(`/api/song-history?id=${id}`, {
          method: 'DELETE'
        })

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
    <div className="bg-background text-on-surface min-h-screen font-sans">
      {/* Studio / Library Tab Control */}
      <div className="border-b border-outline-variant/10 bg-background/80 p-4 sticky top-16 z-30 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setCurrentTab('studio')}
              className={`px-5 py-2.5 text-xs font-bold rounded-full transition-all duration-300 cursor-pointer scale-100 hover:scale-[1.02] active:scale-[0.98] ${
                currentTab === 'studio'
                  ? 'bg-primary text-[#080d08] shadow-lg shadow-primary/10 border border-primary/20'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-white/[0.03]'
              }`}
            >
              {uiLanguage === 'KO' ? '음악 프롬프트' : uiLanguage === 'JA' ? '音楽プロンプト' : 'Music Prompt'}
            </button>
            <button
              onClick={() => setCurrentTab('library')}
              className={`px-5 py-2.5 text-xs font-bold rounded-full transition-all duration-300 cursor-pointer scale-100 hover:scale-[1.02] active:scale-[0.98] ${
                currentTab === 'library'
                  ? 'bg-primary text-[#080d08] shadow-lg shadow-primary/10 border border-primary/20'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-white/[0.03]'
              }`}
            >
              {uiLanguage === 'KO' ? '보관함' : uiLanguage === 'JA' ? 'ライブラリ' : 'Library'}
            </button>
            <button
              onClick={() => setCurrentTab('cover')}
              className={`px-5 py-2.5 text-xs font-bold rounded-full transition-all duration-300 cursor-pointer scale-100 hover:scale-[1.02] active:scale-[0.98] ${
                currentTab === 'cover'
                  ? 'bg-primary text-[#080d08] shadow-lg shadow-primary/10 border border-primary/20'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-white/[0.03]'
              }`}
            >
              {uiLanguage === 'KO' ? 'AI 커버 스튜디오' : uiLanguage === 'JA' ? 'AIカバースタジオ' : 'AI Cover Studio'}
            </button>
            <button
              onClick={() => setCurrentTab('suno')}
              className={`px-5 py-2.5 text-xs font-bold rounded-full transition-all duration-300 cursor-pointer scale-100 hover:scale-[1.02] active:scale-[0.98] ${
                currentTab === 'suno'
                  ? 'bg-primary text-[#080d08] shadow-lg shadow-primary/10 border border-primary/20'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-white/[0.03]'
              }`}
            >
              {uiLanguage === 'KO' ? '음악 생성' : uiLanguage === 'JA' ? '音楽スタジオ' : 'Music Studio'}
            </button>
            <button
              onClick={() => setCurrentTab('mastering')}
              className={`px-5 py-2.5 text-xs font-bold rounded-full transition-all duration-300 cursor-pointer scale-100 hover:scale-[1.02] active:scale-[0.98] ${
                currentTab === 'mastering'
                  ? 'bg-primary text-[#080d08] shadow-lg shadow-primary/10 border border-primary/20'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-white/[0.03]'
              }`}
            >
              {uiLanguage === 'KO' ? '마스터링' : uiLanguage === 'JA' ? 'マスタリング' : 'Mastering'}
            </button>
          </div>

        </div>
      </div>

      {currentTab === 'studio' ? (
        <div className="max-w-[1480px] mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-4 gap-8">
      
      {/* 1열: AI 설정 & 지침서 */}
      <div className="space-y-6">
        
        {/* AI 설정 */}
        <section className="bg-surface-container-low border border-outline-variant/10 p-5 rounded-2xl space-y-4 shadow-xl shadow-black/30">
          <h2 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b border-outline-variant/10 pb-3 text-on-surface">
            <Settings className="w-4 h-4 text-primary" />
            {t.panelAiConfig}
          </h2>
          
          <div className="space-y-3.5">
            {/* 모델 선택 */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/80">{t.model}</label>
              <div className="relative">
                <select
                  value={settings.model}
                  onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                  className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl p-2.5 text-xs font-bold appearance-none text-on-surface cursor-pointer focus:outline-none focus:border-primary/70 focus:ring-1 focus:ring-[#e3fe06]/20 transition-all duration-300"
                >
                  {provider.models.map((model) => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 absolute right-3 top-3 pointer-events-none text-zinc-555" />
              </div>
            </div>
          </div>
        </section>

        {/* 지침서 (가이드) */}
        <section className="bg-surface-container-low border border-outline-variant/10 p-5 rounded-2xl space-y-4 shadow-xl shadow-black/30">
          <h2 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b border-outline-variant/10 pb-3 text-on-surface">
            <FileText className="w-4 h-4 text-primary" />
            {t.panelGuides}
          </h2>

          {/* 지침서 목록 */}
          <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
            {guides.map((guide) => (
              <div
                key={guide.id}
                className={`p-3 rounded-xl border transition-all duration-200 flex items-start justify-between gap-2 group ${
                  activeGuideIds.includes(guide.id)
                    ? 'bg-primary/10 border-primary/35 text-primary'
                    : 'bg-surface-container-lowest/60 border-outline-variant/10 text-on-surface-variant hover:border-white/[0.1]'
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
                    {guide.title}
                  </div>
                  <p className="text-[10px] text-on-surface-variant/80 mt-1 line-clamp-2 leading-relaxed">{guide.body}</p>
                </button>
                
                <button
                  onClick={() => removeGuide(guide.id)}
                  className="text-on-surface-variant/40 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all duration-200 p-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* 지침서 수동 등록 */}
          <div className="space-y-2 border-t border-outline-variant/10 pt-3">
            <input
              type="text"
              placeholder={t.newGuideTitlePlaceholder}
              value={draftGuide.title}
              onChange={(e) => setDraftGuide({ ...draftGuide, title: e.target.value })}
              className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl p-2.5 text-xs text-on-surface placeholder-zinc-700 focus:outline-none focus:border-primary/70 transition-all"
            />
            <textarea
              placeholder={t.newGuideBodyPlaceholder}
              rows={2}
              value={draftGuide.body}
              onChange={(e) => setDraftGuide({ ...draftGuide, body: e.target.value })}
              className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl p-2.5 text-xs text-on-surface placeholder-zinc-700 resize-none focus:outline-none focus:border-primary/70 transition-all custom-scrollbar"
            />
            <button
              onClick={addGuide}
              className="w-full py-2.5 bg-surface-container-lowest border border-outline-variant/20 hover:border-white/[0.15] hover:bg-white/[0.02] text-on-surface text-xs font-bold rounded-xl transition-all duration-200 cursor-pointer"
            >
              {t.registerGuide}
            </button>
          </div>

          {/* 파일 업로드 */}
          <div className="border-t border-outline-variant/10 pt-3 space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/80">{t.uploadGuideline}</span>
            <div className="relative border border-dashed border-white/[0.1] hover:border-primary/50 bg-white/[0.01] hover:bg-primary/[0.02] rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-all duration-300">
              <input
                type="file"
                ref={fileInputRef}
                accept=".pdf,.txt"
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer z-10"
              />
              <Upload className="w-5 h-5 text-on-surface-variant/40 mb-1.5" />
              <span className="text-[10px] text-on-surface-variant/60 text-center leading-relaxed">
                {isParsing ? t.parsingFile : t.uploadPlaceholder}
              </span>
            </div>
          </div>
        </section>

      </div>

      {/* 2~3열: 곡 정보 입력 */}
      <div className="lg:col-span-2 space-y-6">
        <section className="bg-surface-container-low border border-outline-variant/10 p-6 rounded-2xl space-y-6 shadow-xl shadow-black/30 h-full flex flex-col">
          <h2 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b border-outline-variant/10 pb-3 text-on-surface">
            <Disc className="w-4 h-4 text-primary" />
            {t.panelInput}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* 곡 제목 */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/80">{t.songTitle}</label>
              <input
                type="text"
                placeholder={t.songTitlePlaceholder}
                value={form.title}
                onChange={(e) => updateForm('title', e.target.value)}
                className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl p-2.5 text-xs text-on-surface placeholder-zinc-700 font-bold focus:outline-none focus:border-primary/70 focus:ring-1 focus:ring-[#e3fe06]/20 transition-all duration-300"
              />
            </div>

            {/* 대상 툴 */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/80">{t.targetTool}</label>
              <div className="grid grid-cols-3 gap-1 bg-surface-container-lowest p-1 rounded-xl border border-outline-variant/20">
                <button
                  onClick={() => updateForm('targetTool', 'Suno')}
                  className={`py-2.5 text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer ${
                    form.targetTool.toLowerCase() === 'suno'
                      ? 'bg-primary text-[#080d08] shadow-md shadow-primary/10'
                      : 'text-on-surface-variant/60 hover:text-on-surface-variant'
                  }`}
                >
                  Suno
                </button>
                <button
                  onClick={() => alert('Udio 맞춤형 프롬프트 생성 기능은 곧 지원될 예정입니다!')}
                  className="py-2.5 text-xs font-bold rounded-lg transition-all duration-200 text-on-surface-variant/40 cursor-not-allowed relative"
                >
                  Udio
                  <span className="absolute -top-1 -right-1 bg-red-500/10 border border-red-500/30 text-red-400 text-[8px] px-1 py-0.5 rounded-md leading-none">예정</span>
                </button>
                <button
                  onClick={() => alert('MusicFX 맞춤형 프롬프트 생성 기능은 곧 지원될 예정입니다!')}
                  className="py-2.5 text-xs font-bold rounded-lg transition-all duration-200 text-on-surface-variant/40 cursor-not-allowed relative"
                >
                  MusicFX
                  <span className="absolute -top-1 -right-1 bg-red-500/10 border border-red-500/30 text-red-400 text-[8px] px-1 py-0.5 rounded-md leading-none">예정</span>
                </button>
              </div>
            </div>

            {/* 곡 유형 */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/80">{t.songType}</label>
              <div className="grid grid-cols-2 gap-1 bg-surface-container-lowest p-1 rounded-xl border border-outline-variant/20">
                {options.songType.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => updateForm('songType', o.value)}
                    className={`py-2.5 text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer ${
                      form.songType === o.value
                        ? 'bg-primary text-[#080d08] shadow-md shadow-primary/10'
                        : 'text-on-surface-variant/60 hover:text-on-surface-variant'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 장르 설정 (Genre Blending) */}
            <div className="space-y-4 md:col-span-2 border border-outline-variant/30 rounded-xl p-3 bg-surface-container-lowest/50">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/80">{uiLanguage === 'KO' ? '장르 1' : uiLanguage === 'JA' ? 'ジャンル 1' : 'Genre 1'}</label>
                  <button
                    onClick={() => { setGenreModalTarget('genre1'); setIsGenreModalOpen(true); }}
                    className="w-full text-left bg-surface-container-lowest border border-outline-variant/20 rounded-xl p-3 text-xs font-bold text-on-surface focus:outline-none focus:border-primary/70 focus:ring-1 focus:ring-[#e3fe06]/20 transition-all flex justify-between items-center"
                  >
                    <span className="truncate">{form.genre1 ? (uiLanguage === 'KO' ? form.genre1 : (GENRE_TRANSLATIONS[form.genre1] || form.genre1)) : (uiLanguage === 'KO' ? '장르 선택' : uiLanguage === 'JA' ? 'ジャンルを選択' : 'Select Genre')}</span>
                    <ChevronDown className="w-4 h-4 text-zinc-555 flex-shrink-0" />
                  </button>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/80">{uiLanguage === 'KO' ? '장르 2' : uiLanguage === 'JA' ? 'ジャンル 2' : 'Genre 2'}</label>
                  <button
                    onClick={() => { setGenreModalTarget('genre2'); setIsGenreModalOpen(true); }}
                    className="w-full text-left bg-surface-container-lowest border border-outline-variant/20 rounded-xl p-3 text-xs font-bold text-on-surface focus:outline-none focus:border-primary/70 focus:ring-1 focus:ring-[#e3fe06]/20 transition-all flex justify-between items-center"
                  >
                    <span className="truncate">{form.genre2 ? (uiLanguage === 'KO' ? form.genre2 : (GENRE_TRANSLATIONS[form.genre2] || form.genre2)) : (uiLanguage === 'KO' ? '없음' : uiLanguage === 'JA' ? 'なし' : 'None')}</span>
                    <ChevronDown className="w-4 h-4 text-zinc-555 flex-shrink-0" />
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/80">{uiLanguage === 'KO' ? '장르 비중' : uiLanguage === 'JA' ? 'ジャンル比率' : 'Genre Ratio'}</label>
                  <span className="text-xs font-bold text-[#e3fe06]">{form.genreRatio} : {100 - form.genreRatio}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="10"
                  value={form.genreRatio}
                  onChange={(e) => updateForm('genreRatio', parseInt(e.target.value))}
                  className="w-full accent-[#e3fe06]"
                />
              </div>
            </div>

            {/* 스타일 설명 (Style Description) */}
            <div className="space-y-1.5 md:col-span-2 bg-[#121614]/80 p-3 rounded-xl border border-[#233533]/50">
              <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/80">
                {uiLanguage === 'KO' ? '스타일 설명 (STYLE DESCRIPTION)' : uiLanguage === 'JA' ? 'スタイルの説明' : 'STYLE DESCRIPTION'}
              </label>
              <input
                type="text"
                placeholder={uiLanguage === 'KO' ? '예: Korean city pop, synth pop, nostalgic, rainy, warm, cinematic' : uiLanguage === 'JA' ? '例: シティポップ、シンセポップ、ノスタルジック、雨、温かい、シネマティック' : 'e.g., city pop, synth pop, nostalgic, rainy, warm, cinematic'}
                value={form.styleDesc}
                onChange={(e) => updateForm('styleDesc', e.target.value)}
                className="w-full bg-[#0a0f0d] border border-outline-variant/20 rounded-xl p-3.5 text-xs text-on-surface focus:outline-none focus:border-[#3fd4b6]/70 focus:ring-1 focus:ring-[#3fd4b6]/20 transition-all duration-300"
              />
            </div>

            {/* 곡 전개 구조 */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/80">{uiLanguage === 'KO' ? '곡 전개 구조 (Song Structure)' : uiLanguage === 'JA' ? '曲の構成' : 'Song Structure'}</label>
              <div className="relative">
                <select
                  value={form.songStructure}
                  onChange={(e) => updateForm('songStructure', e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl p-2.5 text-xs font-bold appearance-none text-on-surface cursor-pointer focus:outline-none focus:border-primary/70 focus:ring-1 focus:ring-[#e3fe06]/20 transition-all"
                >
                  {options.songStructure.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 absolute right-3 top-3 pointer-events-none text-zinc-555" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 md:col-span-2">
              {/* 목표 음악 길이 */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/80">{t.musicLength || '음악 길이 (Music Length)'}</label>
                <div className="relative">
                  <select
                    value={form.musicLength}
                    onChange={(e) => updateForm('musicLength', e.target.value)}
                    className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl p-2.5 text-xs font-bold appearance-none text-on-surface cursor-pointer focus:outline-none focus:border-primary/70 focus:ring-1 focus:ring-[#e3fe06]/20 transition-all"
                  >
                    {options.musicLength.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 absolute right-3 top-3 pointer-events-none text-zinc-555" />
                </div>
              </div>
            </div>

            {/* 4x4 Grid for Vocal Properties removed from here, moving down to vocal specific block */}

            {form.songType === 'vocal' ? (
              <>
                {/* 보컬 2x2 Grid */}
                <div className="grid grid-cols-2 gap-4 md:col-span-2">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/80">{uiLanguage === 'KO' ? '가사 분량' : uiLanguage === 'JA' ? '歌詞の密度' : 'Lyrics Density'}</label>
                    <div className="relative">
                      <select
                        value={form.lyricDensity}
                        onChange={(e) => updateForm('lyricDensity', e.target.value)}
                        className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl p-2.5 text-xs font-bold appearance-none text-on-surface cursor-pointer focus:outline-none focus:border-primary/70 focus:ring-1 focus:ring-[#e3fe06]/20 transition-all"
                      >
                        {options.lyricDensity.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      <ChevronDown className="w-4 h-4 absolute right-3 top-3 pointer-events-none text-zinc-555" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/80">{uiLanguage === 'KO' ? '보이스 톤' : uiLanguage === 'JA' ? 'ボーカルのトーン' : 'Vocal Tone'}</label>
                    <div className="relative">
                      <select
                        value={form.vocalTone}
                        onChange={(e) => updateForm('vocalTone', e.target.value)}
                        className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl p-2.5 text-xs font-bold appearance-none text-on-surface cursor-pointer focus:outline-none focus:border-primary/70 focus:ring-1 focus:ring-[#e3fe06]/20 transition-all"
                      >
                        {options.vocalTone.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      <ChevronDown className="w-4 h-4 absolute right-3 top-3 pointer-events-none text-zinc-555" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/80">{uiLanguage === 'KO' ? '보컬 나이' : uiLanguage === 'JA' ? 'ボーカルの年齢' : 'Vocal Age'}</label>
                    <div className="relative">
                      <select
                        value={form.vocalAge}
                        onChange={(e) => updateForm('vocalAge', e.target.value)}
                        className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl p-2.5 text-xs font-bold appearance-none text-on-surface cursor-pointer focus:outline-none focus:border-primary/70 focus:ring-1 focus:ring-[#e3fe06]/20 transition-all"
                      >
                        {options.vocalAge.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      <ChevronDown className="w-4 h-4 absolute right-3 top-3 pointer-events-none text-zinc-555" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/80">{uiLanguage === 'KO' ? '보컬 젠더/구성' : uiLanguage === 'JA' ? 'ボーカルの性別/編成' : 'Vocal Gender/Format'}</label>
                    <div className="relative">
                      <select
                        value={form.vocalGenderGroup}
                        onChange={(e) => updateForm('vocalGenderGroup', e.target.value)}
                        className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl p-2.5 text-xs font-bold appearance-none text-on-surface cursor-pointer focus:outline-none focus:border-primary/70 focus:ring-1 focus:ring-[#e3fe06]/20 transition-all"
                      >
                        {options.vocalGenderGroup.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      <ChevronDown className="w-4 h-4 absolute right-3 top-3 pointer-events-none text-zinc-555" />
                    </div>
                  </div>
                </div>

                {/* 다국어 혼합 (Language Blending) */}
                <div className="space-y-4 md:col-span-2 border border-outline-variant/30 rounded-xl p-3 bg-surface-container-lowest/50">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/80">{uiLanguage === 'KO' ? '언어 1' : uiLanguage === 'JA' ? '言語 1' : 'Language 1'}</label>
                      <div className="relative">
                        <select
                          value={form.language1}
                          onChange={(e) => updateForm('language1', e.target.value)}
                          className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl p-2.5 text-xs font-bold appearance-none text-on-surface cursor-pointer focus:outline-none focus:border-primary/70 focus:ring-1 focus:ring-[#e3fe06]/20 transition-all"
                        >
                          {options.language1.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                        <ChevronDown className="w-4 h-4 absolute right-3 top-3 pointer-events-none text-zinc-555" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/80">{uiLanguage === 'KO' ? '언어 2' : uiLanguage === 'JA' ? '言語 2' : 'Language 2'}</label>
                      <div className="relative">
                        <select
                          value={form.language2}
                          onChange={(e) => updateForm('language2', e.target.value)}
                          className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl p-2.5 text-xs font-bold appearance-none text-on-surface cursor-pointer focus:outline-none focus:border-primary/70 focus:ring-1 focus:ring-[#e3fe06]/20 transition-all"
                        >
                          {options.language2.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                        <ChevronDown className="w-4 h-4 absolute right-3 top-3 pointer-events-none text-zinc-555" />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/80">{uiLanguage === 'KO' ? '언어 비중' : uiLanguage === 'JA' ? '言語比率' : 'Language Ratio'}</label>
                      <span className="text-xs font-bold text-[#e3fe06]">{form.languageRatio} : {100 - form.languageRatio}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="10"
                      value={form.languageRatio}
                      onChange={(e) => updateForm('languageRatio', parseInt(e.target.value))}
                      className="w-full accent-[#e3fe06]"
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* BGM 용도 */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/80">{t.bgmType}</label>
                  <div className="relative">
                    <select
                      value={form.bgmType}
                      onChange={(e) => updateForm('bgmType', e.target.value)}
                      className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl p-2.5 text-xs font-bold appearance-none text-on-surface cursor-pointer focus:outline-none focus:border-primary/70 focus:ring-1 focus:ring-[#e3fe06]/20 transition-all"
                    >
                      {options.bgmType.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 absolute right-3 top-3 pointer-events-none text-zinc-555" />
                  </div>
                </div>
              </>
            )}

            {/* 템포 */}
            <div className="space-y-1.5 md:col-span-2">
              <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/80">
                <span>{t.tempo}</span>
                <span className="text-primary font-mono font-extrabold">{form.tempo} BPM</span>
              </div>
              <input
                type="range"
                min={60}
                max={200}
                value={form.tempo}
                onChange={(e) => updateForm('tempo', parseInt(e.target.value))}
                className="w-full h-1.5 bg-surface-container-lowest accent-[#e3fe06] hover:accent-[#e3fe06] rounded-lg cursor-pointer transition-all duration-305"
              />
              <div className="grid grid-cols-5 gap-1 pt-1 text-[10px] text-zinc-555">
                <button type="button" onClick={() => updateForm('tempo', 70)} className="hover:text-on-surface-variant cursor-pointer text-left">{t.tempoVerySlow}</button>
                <button type="button" onClick={() => updateForm('tempo', 95)} className="hover:text-on-surface-variant cursor-pointer text-left">{t.tempoSlow}</button>
                <button type="button" onClick={() => updateForm('tempo', 120)} className="hover:text-on-surface text-center font-bold text-on-surface-variant cursor-pointer">{t.tempoNormal}</button>
                <button type="button" onClick={() => updateForm('tempo', 145)} className="hover:text-on-surface-variant cursor-pointer text-right">{t.tempoFast}</button>
                <button type="button" onClick={() => updateForm('tempo', 180)} className="hover:text-on-surface-variant cursor-pointer text-right">{t.tempoVeryFast}</button>
              </div>
            </div>

            {/* 추가 요청 */}
            <div className="space-y-1.5 md:col-span-2">
              <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/80">
                <span>{t.extraRequests}</span>
                <span className="text-[10px] text-zinc-600 font-normal normal-case">{t.extraSub}</span>
              </div>
              <textarea
                placeholder={t.extraPlaceholder}
                rows={3}
                value={form.extra}
                onChange={(e) => updateForm('extra', e.target.value)}
                className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl p-2.5 text-xs text-on-surface placeholder-zinc-700 resize-none focus:outline-none focus:border-primary/70 focus:ring-1 focus:ring-[#e3fe06]/20 transition-all duration-300 custom-scrollbar"
              />
            </div>

            {/* 제외 요소 */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/80">{t.excludeElements}</label>
              <input
                type="text"
                placeholder={t.excludePlaceholder}
                value={form.exclude}
                onChange={(e) => updateForm('exclude', e.target.value)}
                className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl p-2.5 text-xs text-on-surface placeholder-zinc-700 focus:outline-none focus:border-primary/70 focus:ring-1 focus:ring-[#e3fe06]/20 transition-all duration-300"
              />
            </div>
          </div>

          {/* 액션 버튼 */}
          <div className="flex gap-3 pt-4 border-t border-outline-variant/10 mt-auto">
            <button
              onClick={generate}
              disabled={isGenerating}
              className="flex-1 py-4 bg-primary hover:bg-[#e3fe06] active:scale-[0.98] text-[#080d08] font-extrabold text-xs tracking-wider rounded-xl transition-all duration-300 shadow-lg shadow-primary/10 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isGenerating ? t.generating : (uiLanguage === 'KO' ? `GENERATE PROMPT & LYRICS (${modelCost} 크레딧)` : uiLanguage === 'JA' ? `プロンプト & 歌詞を生成 (${modelCost} クレジット)` : `GENERATE PROMPT & LYRICS (${modelCost} Credits)`)}
            </button>
            <button
              onClick={generateSample}
              className="px-6 py-4 bg-surface-container-lowest border border-outline-variant/20 hover:border-white/[0.15] hover:bg-white/[0.02] text-on-surface hover:text-white font-bold text-xs rounded-xl transition-all duration-200 cursor-pointer"
            >
              {uiLanguage === 'KO' ? '샘플 생성' : uiLanguage === 'JA' ? 'サンプル出力' : 'Generate Sample'}
            </button>
          </div>
        </section>
      </div>

      {/* 4열: 생성 결과 */}
      <div className="space-y-6">
        <section className="bg-surface-container-low border border-outline-variant/10 p-5 rounded-2xl shadow-xl shadow-black/30 relative flex flex-col h-full">
          <h2 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b border-outline-variant/10 pb-3 text-on-surface mb-4">
            <FileText className="w-4 h-4 text-primary" />
            {t.panelOutput}
          </h2>
 
          <div className="space-y-4 flex-1">
            {/* 스타일 프롬프트 */}
            <div className="space-y-1.5 relative group/item">
              <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/80">
                <span>{t.promptLabel}</span>
                <button
                  onClick={() => copyText(t.copyPrompt, resultParts.prompt)}
                  className="transition-all duration-200 text-on-surface-variant/85 hover:text-primary cursor-pointer p-1 rounded hover:bg-white/[0.03]"
                  title={t.copyTooltip}
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
              <textarea
                readOnly
                placeholder={t.promptPlaceholder}
                value={resultParts.prompt}
                className="w-full bg-surface-container-lowest border border-outline-variant/10 rounded-xl p-2.5 text-xs text-on-surface resize-none focus:outline-none placeholder-zinc-750 custom-scrollbar h-[110px]"
              />
            </div>
 
            {/* 제외 프롬프트 */}
            <div className="space-y-1.5 relative group/item">
              <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/80">
                <span>{t.negativePromptLabel}</span>
                <button
                  onClick={() => copyText(t.copyNegativePrompt, resultParts.negativePrompt)}
                  className="transition-all duration-200 text-on-surface-variant/85 hover:text-primary cursor-pointer p-1 rounded hover:bg-white/[0.03]"
                  title={t.copyTooltip}
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
              <textarea
                readOnly
                placeholder={t.negativePromptPlaceholder}
                value={resultParts.negativePrompt}
                className="w-full bg-surface-container-lowest border border-outline-variant/10 rounded-xl p-2.5 text-xs text-on-surface resize-none focus:outline-none placeholder-zinc-750 custom-scrollbar h-[80px]"
              />
            </div>
 
            {/* 곡 제목 */}
            <div className="space-y-1.5 relative group/item">
              <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/80">
                <span>{t.titleLabel}</span>
                <button
                  onClick={() => copyText(t.copyTitle, resultParts.title)}
                  className="transition-all duration-200 text-on-surface-variant/85 hover:text-primary cursor-pointer p-1 rounded hover:bg-white/[0.03]"
                  title={t.copyTooltip}
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
              <input
                type="text"
                readOnly
                placeholder={t.titlePlaceholder}
                value={resultParts.title}
                className="w-full bg-surface-container-lowest border border-outline-variant/10 rounded-xl p-2.5 text-xs text-on-surface font-bold focus:outline-none placeholder-zinc-750"
              />
            </div>
 
            {/* 가사 편집기 */}
            <div className="space-y-1.5 relative group/item">
              <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/80">
                <span>{t.lyricsLabel}</span>
                <button
                  onClick={() => copyText(t.copyLyrics, resultParts.lyrics)}
                  className="transition-all duration-200 text-on-surface-variant/85 hover:text-primary cursor-pointer p-1 rounded hover:bg-white/[0.03]"
                  title={t.copyTooltip}
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
              <textarea
                readOnly
                placeholder={t.lyricsPlaceholder}
                value={resultParts.lyrics}
                className="w-full bg-surface-container-lowest border border-outline-variant/10 rounded-xl p-2.5 text-xs text-on-surface resize-none focus:outline-none placeholder-zinc-750 custom-scrollbar h-[380px]"
              />
            </div>
 
            {/* DURATION PLAN */}
            <div className="space-y-1.5 relative group/item mt-4">
              <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/80">
                <span>{uiLanguage === 'KO' ? '곡 구조 설계 (마디수/BPM)' : uiLanguage === 'JA' ? '構成 & BPM計画' : 'Structure & BPM Plan'}</span>
                <button
                  onClick={() => copyText(uiLanguage === 'KO' ? '설계 복사' : uiLanguage === 'JA' ? '計画をコピー' : 'Copy Plan', resultParts.structurePlan)}
                  className="transition-all duration-200 text-on-surface-variant/85 hover:text-primary cursor-pointer p-1 rounded hover:bg-white/[0.03]"
                  title={t.copyTooltip}
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
              <textarea
                readOnly
                placeholder={uiLanguage === 'KO' ? '생성 시 곡의 총 마디 수와 BPM 배분표가 여기에 표시됩니다.' : uiLanguage === 'JA' ? '曲の長さとBPM計画がここに表示されます。' : 'Structure and BPM plan will be shown here.'}
                value={resultParts.structurePlan}
                className="w-full bg-surface-container-lowest border border-outline-variant/10 rounded-xl p-2.5 text-xs text-on-surface resize-none focus:outline-none placeholder-zinc-750 custom-scrollbar h-[120px]"
              />
            </div>

            {/* AI 메모 (SUGGESTIONS) */}
            <div className="space-y-1.5 relative group/item">
              <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/80">
                <span>{t.notesLabel}</span>
                <button
                  onClick={() => copyText(t.copyNotes, resultParts.notes)}
                  className="transition-all duration-200 text-on-surface-variant/85 hover:text-primary cursor-pointer p-1 rounded hover:bg-white/[0.03]"
                  title={t.copyTooltip}
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
              <textarea
                readOnly
                placeholder={t.notesPlaceholder}
                value={resultParts.notes}
                className="w-full bg-surface-container-lowest border border-outline-variant/10 rounded-xl p-2.5 text-xs text-on-surface resize-none focus:outline-none placeholder-zinc-750 custom-scrollbar h-[110px]"
              />
            </div>
          </div>
 
          {/* 하단 액션 버튼 */}
          <div className="flex gap-3 pt-4 border-t border-outline-variant/10 mt-auto">
            <button
              onClick={() => copyText(t.copyAll, composeGeneratedText(resultParts))}
              className="flex-1 py-3.5 bg-primary/5 hover:bg-primary/10 active:scale-[0.98] border border-primary/20 hover:border-primary/45 text-primary font-extrabold text-[11px] rounded-xl transition-all duration-300 flex flex-col items-center justify-center gap-1 cursor-pointer text-center leading-tight"
            >
              <Copy className="w-4 h-4 mb-0.5" />
              {uiLanguage === 'KO' ? (
                <>
                  <span>클립보드에</span>
                  <span>전체 복사</span>
                </>
              ) : (
                <>
                  <span>Copy All to</span>
                  <span>Clipboard</span>
                </>
              )}
            </button>
            <button
              onClick={clearResult}
              className="flex-1 py-3.5 bg-surface-container-lowest hover:bg-white/[0.02] border border-outline-variant/20 hover:border-white/[0.15] text-on-surface hover:text-white font-extrabold text-[11px] rounded-xl transition-all duration-205 flex flex-col items-center justify-center gap-1 cursor-pointer text-center leading-tight"
            >
              <Trash2 className="w-4 h-4 mb-0.5" />
              {uiLanguage === 'KO' ? (
                <>
                  <span>결과</span>
                  <span>지우기</span>
                </>
              ) : (
                <>
                  <span>Clear</span>
                  <span>Result</span>
                </>
              )}
            </button>
          </div>

          {/* Suno Audio Player UI */}
          <div className="mt-4 border-t border-outline-variant/10 pt-4">
            <button 
              onClick={navigateToGenerate}
              disabled={!resultParts.prompt}
              className="w-full py-3 bg-surface-container-lowest hover:bg-white/[0.05] border border-primary/30 hover:border-primary/60 text-primary font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Music className="w-4 h-4" />
              음악 생성 스튜디오로 이동 ➡️
            </button>
          </div>
        </section>
      </div>
    </div>
      ) : currentTab === 'library' ? (
        <LibraryView
          history={history}
          t={t}
          uiLanguage={uiLanguage}
          openHistoryItem={openHistoryItem}
          deleteHistoryItem={deleteHistoryItem}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          selectedItem={selectedItem}
          setSelectedItem={setSelectedItem}
          setCurrentTab={setCurrentTab}
          playlists={playlists}
          onRefreshHistory={fetchSongHistory}
          user={user}
          profile={profile}
        />
      ) : currentTab === 'cover' ? (
        <CoverClient user={user} />
      ) : currentTab === 'suno' ? (
        <GenerateClient 
          user={user} 
          historyId={currentHistoryId}
          initialPrompt={resultParts.lyrics}
          initialStyle={resultParts.prompt}
          initialTitle={resultParts.title}
          initialNegativePrompt={resultParts.negativePrompt}
        />
      ) : currentTab === 'mastering' ? (
        <MasteringClient />
      ) : null}

      <GenreModal
        isOpen={isGenreModalOpen}
        onClose={() => setIsGenreModalOpen(false)}
        title={genreModalTarget === 'genre1' ? (uiLanguage === 'KO' ? '장르 1 선택' : uiLanguage === 'JA' ? 'ジャンル 1 を選択' : 'Select Genre 1') : (uiLanguage === 'KO' ? '장르 2 선택' : uiLanguage === 'JA' ? 'ジャンル 2 を選択' : 'Select Genre 2')}
        selectedGenre={genreModalTarget === 'genre1' ? form.genre1 : form.genre2}
        onSelect={(genre) => {
          updateForm(genreModalTarget, genre)
          setIsGenreModalOpen(false)
        }}
        uiLanguage={uiLanguage}
      />
    </div>
  )
}

interface LibraryViewProps {
  history: any[]
  t: any
  uiLanguage: string
  openHistoryItem: (item: any, mode?: 'all' | 'style' | 'lyrics') => void
  deleteHistoryItem: (id: string) => void
  searchTerm: string
  setSearchTerm: (term: string) => void
  currentPage: number
  setCurrentPage: (page: number | ((p: number) => number)) => void
  selectedItem: any
  setSelectedItem: (item: any) => void
  setCurrentTab: (tab: 'studio' | 'library') => void
  playlists: any[]
  onRefreshHistory: () => Promise<void>
  user?: any
  profile?: any
}

function LibraryView({
  history,
  t,
  uiLanguage,
  openHistoryItem,
  deleteHistoryItem,
  searchTerm,
  setSearchTerm,
  currentPage,
  setCurrentPage,
  selectedItem,
  setSelectedItem,
  setCurrentTab,
  playlists,
  onRefreshHistory,
  user,
  profile
}: LibraryViewProps) {
  const itemsPerPage = 15 // 15 items per page
  const [deletedIds, setDeletedIds] = useState<string[]>(() => readJson(STORAGE_KEYS.deletedDummyItems, []))
  const [copiedPrompt, setCopiedPrompt] = useState(false)
  const [copiedLyrics, setCopiedLyrics] = useState(false)

  const handleCopyPrompt = (text: string) => {
    navigator.clipboard.writeText(text || '')
    setCopiedPrompt(true)
    setTimeout(() => setCopiedPrompt(false), 1500)
  }

  const handleCopyLyrics = (text: string) => {
    navigator.clipboard.writeText(text || '')
    setCopiedLyrics(true)
    setTimeout(() => setCopiedLyrics(false), 1500)
  }

  // usePlayerStore hook
  const { currentTrack, isPlaying, playTrack, togglePlay } = usePlayerStore()
  const supabase = createClient()

  const [channels, setChannels] = useState<any[]>([])

  const fetchChannels = async () => {
    if (!user) return
    try {
      const { data } = await supabase.from('artists').select('*').eq('owner_user_id', user.id).eq('is_user', false)
      if (data) setChannels(data)
    } catch (e) { console.error(e) }
  }

  useEffect(() => {
    fetchChannels()
  }, [user])

  const assignSongToChannel = async (historyId: string, channelId: string | null) => {
    try {
      const { error } = await supabase.from('song_history').update({ channel_id: channelId }).eq('id', historyId)
      if (error) {
        alert(uiLanguage === 'KO' ? '채널 연결 변경 실패' : uiLanguage === 'JA' ? 'チャンネルの変更に失敗しました' : 'Failed to change channel connection')
        console.error(error)
      } else {
        await onRefreshHistory()
        alert(channelId 
          ? (uiLanguage === 'KO' ? '음원이 채널에 연결되었습니다.' : uiLanguage === 'JA' ? '曲がチャンネルに割り当てられました。' : 'Song assigned to channel.')
          : (uiLanguage === 'KO' ? '채널 연결이 해제되었습니다.' : uiLanguage === 'JA' ? 'チャンネルの接続が解除されました。' : 'Channel connection disconnected.'))
      }
    } catch (e) { console.error(e) }
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



  // Local state for dropdown playlist selector active item
  const [activePlaylistMenuId, setActivePlaylistMenuId] = useState<string | null>(null)

  // Local state for dummy playlist id tracking
  const [dummyPlaylistIds, setDummyPlaylistIds] = useState<Record<string, string | null>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('dummy_playlist_ids')
        return stored ? JSON.parse(stored) : {}
      } catch {
        return {}
      }
    }
    return {}
  })

  const setDummyPlaylistId = (itemId: string, playlistId: string | null) => {
    const updated = { ...dummyPlaylistIds, [itemId]: playlistId }
    setDummyPlaylistIds(updated)
    if (typeof window !== 'undefined') {
      localStorage.setItem('dummy_playlist_ids', JSON.stringify(updated))
    }
  }

  // Local state for dummy liked tracking
  const [dummyLikes, setDummyLikes] = useState<Record<string, boolean>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('dummy_likes')
        return stored ? JSON.parse(stored) : {}
      } catch {
        return {}
      }
    }
    return {}
  })

  const setDummyLike = (itemId: string, liked: boolean) => {
    const updated = { ...dummyLikes, [itemId]: liked }
    setDummyLikes(updated)
    if (typeof window !== 'undefined') {
      localStorage.setItem('dummy_likes', JSON.stringify(updated))
    }
  }

  // Playlist filter state: 'all' | 'liked' | string (playlist_id)
  const [selectedPlaylistFilter, setSelectedPlaylistFilter] = useState<string>('all')

  const handleLikeToggle = async (item: any) => {
    const nextLiked = !item.liked
    if (item.id.startsWith('dummy')) {
      setDummyLike(item.id, nextLiked)
    } else {
      try {
        const res = await fetch(`/api/song-history/${item.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ liked: nextLiked })
        })
        if (res.ok) {
          await onRefreshHistory()
        }
      } catch (err) {
        console.error(err)
      }
    }
  }

  // Local state for publishing and genres on mockup items
  const [dummyPublishState, setDummyPublishState] = useState<Record<string, boolean>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('dummy_publish_state')
        return stored ? JSON.parse(stored) : {}
      } catch {
        return {}
      }
    }
    return {}
  })

  const [dummyGenres, setDummyGenres] = useState<Record<string, string>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('dummy_genres')
        return stored ? JSON.parse(stored) : {}
      } catch {
        return {}
      }
    }
    return {}
  })

  const updateDummyPublish = (itemId: string, isPublished: boolean, genre?: string) => {
    const nextPublish = { ...dummyPublishState, [itemId]: isPublished }
    setDummyPublishState(nextPublish)
    if (typeof window !== 'undefined') {
      localStorage.setItem('dummy_publish_state', JSON.stringify(nextPublish))
    }

    if (genre) {
      const nextGenres = { ...dummyGenres, [itemId]: genre }
      setDummyGenres(nextGenres)
      if (typeof window !== 'undefined') {
        localStorage.setItem('dummy_genres', JSON.stringify(nextGenres))
      }
    }
  }

  const [publishConfirmItem, setPublishConfirmItem] = useState<any | null>(null)
  const [selectedPublishGenre, setSelectedPublishGenre] = useState<string>('')

  const handlePublishToggle = async (item: any) => {
    if (item.is_published) {
      // Toggle to Private
      if (item.id.startsWith('dummy')) {
        updateDummyPublish(item.id, false)
      } else {
        try {
          const res = await fetch(`/api/song-history/${item.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_published: false })
          })
          if (res.ok) {
            await onRefreshHistory()
          }
        } catch (err) {
          console.error(err)
        }
      }
    } else {
      // Toggle to Public (Open genre select modal)
      setSelectedPublishGenre(item.genre || '')
      setPublishConfirmItem(item)
    }
  }

  const confirmPublish = async () => {
    if (!publishConfirmItem) return
    if (!selectedPublishGenre) return

    const item = publishConfirmItem
    if (item.id.startsWith('dummy')) {
      updateDummyPublish(item.id, true, selectedPublishGenre)
    } else {
      try {
        const res = await fetch(`/api/song-history/${item.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_published: true, genre: selectedPublishGenre })
        })
        if (res.ok) {
          await onRefreshHistory()
        }
      } catch (err) {
        console.error(err)
      }
    }

    setPublishConfirmItem(null)
    setSelectedPublishGenre('')
  }

  // Handle play/pause toggles
  const handlePlayToggle = (item: any) => {
    const audioUrl = item.audio_url || item.file_url
    if (!audioUrl) return

    const trackToPlay = {
      id: item.id,
      album_id: item.playlist_id || 'library',
      track_number: 1,
      title: item.title || t.untitledProject,
      duration_sec: 180,
      file_url: audioUrl,
      file_size: null,
      waveform_data: null,
      lyrics: item.lyrics || null,
      style_prompt: item.prompt || item.promptText || null,
      image_url: item.image_url || withBase('/default-album.png'),
      bpm: null,
      song_key: null,
      prompt_meta: null,
      play_count: 0,
      like_count: 0,
      status: 'published' as const,
      created_at: item.created_at,
      updated_at: item.created_at,
      album: {
        id: item.playlist_id || 'library',
        slug: 'library',
        artist_id: profile?.id || user?.id || 'user',
        title: uiLanguage === 'KO' ? '라이브러리' : uiLanguage === 'JA' ? 'ライブラリ' : 'Library',
        release_type: 'single' as const,
        cover_url: item.image_url || withBase('/default-album.png'),
        release_date: null,
        genres: [],
        moods: [],
        description: null,
        status: 'published' as const,
        generation_tool: 'Suno',
        total_plays: 0,
        total_likes: 0,
        created_at: item.created_at,
        updated_at: item.created_at,
        artist: {
          id: profile?.id || user?.id || 'user',
          name: profile?.display_name || user?.email?.split('@')[0] || 'AI Artist',
          slug: user?.email?.split('@')[0] || 'user',
          avatar_url: profile?.avatar_url || withBase('/default-album.png'),
          bio: 'AI Artist'
        }
      }
    }

    if (currentTrack?.id === item.id) {
      togglePlay()
    } else {
      playTrack(trackToPlay as any)
    }
  }

  // Format date to '2026. 5. 27.'
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr)
      const y = date.getFullYear()
      const m = date.getMonth() + 1
      const d = date.getDate()
      return `${y}. ${m}. ${d}.`
    } catch {
      return dateStr
    }
  }

  // Combined real history from database + mockup-identical dummy items
  const combinedHistory = useMemo(() => {
    const realHistoryWithFields = history.map((item) => ({
      ...item,
      promptText: item.prompt || item.form?.styleDesc || '',
      langText: item.form?.language || '한국어',
    }))

    const fullMockupLyrics = `[Verse 1]
젖은 유리창 위로 네 이름이 번져
신호등 불빛마다 마음이 멈춰 서
돌아갈 길은 없다는 걸 알면서도
나는 같은 거리를 다시 지나가

[Pre-Chorus]
라디오 끝에 남은 작은 숨처럼
아직도 넌 내 밤을 흔들어

[Chorus]
Rain on the midnight road
너를 잊는 법을 몰라
흐려진 불빛 사이로
우리의 계절이 또 지나가
Rain on the midnight road
끝내 말하지 못한 말
빗소리 안에 묻어둘게
오늘도 널 지나쳐 가

[Verse 2]
텅 빈 조수석 위로 새벽이 내려
익숙한 골목마다 추억이 켜져
괜찮아질 거라는 흔한 말 대신
가만히 속도를 낮춰 숨을 쉬어

[Bridge]
언젠가 이 노래가 끝나면
나도 웃으며 널 놓을 수 있을까

[Final Chorus]
Rain on the midnight road
너를 잊는 법을 배워
희미한 불빛 너머로
새로운 아침이 날 부르나 봐`;

    // Construct 15 dummy items matching the mockup titles and styles
    const dummyItems = [
      {
        id: 'dummy-1',
        title: '비 오는 밤의 드라이브',
        prompt: 'Korean city pop, synth pop, nostalgic, rainy, warm, cinematic, female vocal, soft vocal, airy harmony, tempo 120 bpm',
        lyrics: fullMockupLyrics,
        created_at: '2026-05-27T06:21:00Z',
        form: {
          styleDesc: 'Korean city pop, synth pop, nostalgic, rainy, warm, cinematic, female vocal, soft vocal, airy harmony, tempo 120 bpm',
          language: '한국어',
          targetTool: 'Suno',
          songType: 'vocal'
        }
      },
      {
        id: 'dummy-2',
        title: '비 오는 밤의 드라이브',
        prompt: 'Korean city pop, synth pop, nostalgic, rainy, warm, cinematic, female vocal, soft vocal, airy harmony, tempo 120 bpm',
        lyrics: fullMockupLyrics,
        created_at: '2026-05-27T06:18:00Z',
        form: {
          styleDesc: 'Korean city pop, synth pop, nostalgic, rainy, warm, cinematic, female vocal, soft vocal, airy harmony, tempo 120 bpm',
          language: '한국어',
          targetTool: 'Suno',
          songType: 'vocal'
        }
      },
      {
        id: 'dummy-3',
        title: '비 오는 밤의 드라이브',
        prompt: 'Korean city pop, synth pop, nostalgic, rainy, warm, cinematic, female vocal, soft vocal, airy harmony, tempo 120 bpm',
        lyrics: fullMockupLyrics,
        created_at: '2026-05-27T06:10:00Z',
        form: {
          styleDesc: 'Korean city pop, synth pop, nostalgic, rainy, warm, cinematic, female vocal, soft vocal, airy harmony, tempo 120 bpm',
          language: '한국어',
          targetTool: 'Suno',
          songType: 'vocal'
        }
      },
      {
        id: 'dummy-4',
        title: '비 오는 밤의 드라이브',
        prompt: 'Korean city pop, synth pop, nostalgic, rainy, warm, cinematic, female vocal, soft vocal, airy harmony, tempo 120 bpm',
        lyrics: fullMockupLyrics,
        created_at: '2026-05-27T05:55:00Z',
        form: {
          styleDesc: 'Korean city pop, synth pop, nostalgic, rainy, warm, cinematic, female vocal, soft vocal, airy harmony, tempo 120 bpm',
          language: '한국어',
          targetTool: 'Suno',
          songType: 'vocal'
        }
      },
      {
        id: 'dummy-5',
        title: '비 오는 밤의 드라이브',
        prompt: 'Korean city pop, synth pop, nostalgic, rainy, warm, cinematic, female vocal, soft vocal, airy harmony, tempo 120 bpm',
        lyrics: fullMockupLyrics,
        created_at: '2026-05-27T05:30:00Z',
        form: {
          styleDesc: 'Korean city pop, synth pop, nostalgic, rainy, warm, cinematic, female vocal, soft vocal, airy harmony, tempo 120 bpm',
          language: '한국어',
          targetTool: 'Suno',
          songType: 'vocal'
        }
      },
      {
        id: 'dummy-6',
        title: '비 오는 밤의 드라이브',
        prompt: 'Korean city pop, synth pop, nostalgic, rainy, warm, cinematic, female vocal, soft vocal, airy harmony, tempo 120 bpm',
        lyrics: fullMockupLyrics,
        created_at: '2026-05-27T05:00:00Z',
        form: {
          styleDesc: 'Korean city pop, synth pop, nostalgic, rainy, warm, cinematic, female vocal, soft vocal, airy harmony, tempo 120 bpm',
          language: '한국어',
          targetTool: 'Suno',
          songType: 'vocal'
        }
      },
      {
        id: 'dummy-7',
        title: '비 오는 밤의 드라이브',
        prompt: 'Korean city pop, synth pop, nostalgic, rainy, warm, cinematic, female vocal, soft vocal, airy harmony, tempo 120 bpm',
        lyrics: fullMockupLyrics,
        created_at: '2026-05-27T04:22:00Z',
        form: {
          styleDesc: 'Korean city pop, synth pop, nostalgic, rainy, warm, cinematic, female vocal, soft vocal, airy harmony, tempo 120 bpm',
          language: '한국어',
          targetTool: 'Suno',
          songType: 'vocal'
        }
      },
      {
        id: 'dummy-8',
        title: '이밤이 지나도',
        prompt: '90s Korean hip hop, energetic swing jazz groove, funky rhythm guitars, rapid-fire rap, male vocals, tempo 95 bpm',
        lyrics: '[Verse 1]\n이밤이 지나도 아직 난 여기에\n네가 남겨둔 온기 속에 갇혀서\n\n[Chorus]\n이밤이 지나면 모두 지워질까\n그리운 너의 목소리도 너의 미소도',
        created_at: '2026-05-12T21:40:00Z',
        form: {
          styleDesc: '90s Korean hip hop, energetic swing jazz groove, funky rhythm guitars, rapid-fire rap, male vocals, tempo 95 bpm',
          language: '한국어',
          targetTool: 'Suno',
          songType: 'vocal'
        }
      },
      {
        id: 'dummy-9',
        title: '이밤이 지나도',
        prompt: '90s Korean hip hop duo, fast tempo 150 bpm, swing jazz style, funky rhythm guitar, scratching sound',
        lyrics: '[Verse 1]\n이밤이 지나도 아직 난 여기에\n네가 남겨둔 온기 속에 갇혀서\n\n[Chorus]\n이밤이 지나면 모두 지워질까\n그리운 너의 목소리도 너의 미소도',
        created_at: '2026-05-12T20:15:00Z',
        form: {
          styleDesc: '90s Korean hip hop duo, fast tempo 150 bpm, swing jazz style, funky rhythm guitar, scratching sound',
          language: '한국어',
          targetTool: 'Suno',
          songType: 'vocal'
        }
      },
      {
        id: 'dummy-10',
        title: '식은커피한잔',
        prompt: '90s Korean hip hop duo, fast tempo 150 bpm, swing jazz style, funky rhythm guitar, scratching sound',
        lyrics: '[Verse 1]\n식어버린 커피 한 잔에 담긴 너의 말\n돌이킬 수 없는 우리 시간들의 끝\n\n[Chorus]\n식은 커피처럼 차갑게 식어버린\n우리 사랑의 온도',
        created_at: '2026-05-12T19:30:00Z',
        form: {
          styleDesc: '90s Korean hip hop duo, fast tempo 150 bpm, swing jazz style, funky rhythm guitar, scratching sound',
          language: '한국어',
          targetTool: 'Suno',
          songType: 'vocal'
        }
      },
      {
        id: 'dummy-11',
        title: '식은커피한잔',
        prompt: 'hip hop duo, funky, rock, modern hip hop, hybrid, idol, rap, catchy hooks, smooth, male vocal',
        lyrics: '[Verse 1]\n식어버린 커피 한 잔에 담긴 너의 말\n돌이킬 수 없는 우리 시간들의 끝\n\n[Chorus]\n식은 커피처럼 차갑게 식어버린\n우리 사랑의 온도',
        created_at: '2026-05-12T18:50:00Z',
        form: {
          styleDesc: 'hip hop duo, funky, rock, modern hip hop, hybrid, idol, rap, catchy hooks, smooth, male vocal',
          language: '한국어',
          targetTool: 'Suno',
          songType: 'vocal'
        }
      },
      {
        id: 'dummy-12',
        title: '비 오는 밤의 드라이브',
        prompt: 'hip hop duo, funky, rock, modern hip hop, hybrid style, dynamic vocal harmonies, high quality',
        lyrics: fullMockupLyrics,
        created_at: '2026-05-12T17:10:00Z',
        form: {
          styleDesc: 'hip hop duo, funky, rock, modern hip hop, hybrid style, dynamic vocal harmonies, high quality',
          language: '한국어',
          targetTool: 'Suno',
          songType: 'vocal'
        }
      },
      {
        id: 'dummy-13',
        title: '비 오는 밤의 드라이브',
        prompt: 'hip-hop duo, funky, rock, modern hip-hop, hybrid, idol, rap',
        lyrics: fullMockupLyrics,
        created_at: '2026-05-12T16:20:00Z',
        form: {
          styleDesc: 'hip-hop duo, funky, rock, modern hip-hop, hybrid, idol, rap',
          language: '한국어',
          targetTool: 'Suno',
          songType: 'vocal'
        }
      },
      {
        id: 'dummy-14',
        title: 'Drive on a Rainy Night',
        prompt: 'Korean city pop, synth pop, hip hop duo, funky, rock, modern hip hop, hybrid, idol, rap, catchy hooks, smooth vocal',
        lyrics: 'Walking down the neon lights\nEverything is shining bright\nRain is falling on my face\nI am lost in this cool place',
        created_at: '2026-05-12T15:10:00Z',
        form: {
          styleDesc: 'Korean city pop, synth pop, hip hop duo, funky, rock, modern hip hop, hybrid, idol, rap, catchy hooks, smooth vocal',
          language: '한국어',
          targetTool: 'Suno',
          songType: 'vocal'
        }
      },
      {
        id: 'dummy-15',
        title: '비 오는 밤의 드라이브',
        prompt: 'hip-hop duo, funky, rock, modern hip-hop, hybrid, idol, rap, tempo 115 bpm, female vocal',
        lyrics: fullMockupLyrics,
        created_at: '2026-05-12T14:00:00Z',
        form: {
          styleDesc: 'hip-hop duo, funky, rock, modern hip-hop, hybrid, idol, rap, tempo 115 bpm, female vocal',
          language: '한국어',
          targetTool: 'Suno',
          songType: 'vocal'
        }
      }
    ].map((item, idx) => {
      const audioIdx = (idx % 15) + 1
      const imgIdx = idx % 5
      const testImages = [
        'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&auto=format&fit=crop&q=60',
        'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&auto=format&fit=crop&q=60',
        'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=300&auto=format&fit=crop&q=60',
        'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&auto=format&fit=crop&q=60',
        'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=300&auto=format&fit=crop&q=60'
      ]
      return {
        ...item,
        audio_url: `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${audioIdx}.mp3`,
        image_url: testImages[imgIdx],
        promptText: item.prompt,
        langText: item.form.language,
      }
    })

    const dummyItemsPage2 = dummyItems.map((item, idx) => ({
      ...item,
      id: `dummy-page2-${idx}`,
      audio_url: item.audio_url,
      image_url: item.image_url,
      created_at: new Date(new Date(item.created_at).getTime() - 15 * 24 * 60 * 60 * 1000).toISOString()
    }))

    const unfiltered = [...realHistoryWithFields, ...dummyItems, ...dummyItemsPage2]
    return unfiltered.map(item => {
      let updatedItem = { ...item }
      if (item.id.startsWith('dummy')) {
        if (dummyPlaylistIds[item.id] !== undefined) {
          updatedItem.playlist_id = dummyPlaylistIds[item.id]
        }
        if (dummyLikes[item.id] !== undefined) {
          updatedItem.liked = dummyLikes[item.id]
        } else {
          updatedItem.liked = false
        }
        // 더미 공개 여부 및 장르 맵핑
        updatedItem.is_published = !!dummyPublishState[item.id]
        updatedItem.genre = dummyGenres[item.id] || ''
      } else {
        updatedItem.liked = !!item.liked
        // real item: mapping published and genre
        updatedItem.is_published = !!item.is_published
        updatedItem.genre = item.genre || ''
      }
      return updatedItem
    }).filter(item => !deletedIds.includes(item.id))
  }, [history, deletedIds, dummyPlaylistIds, dummyLikes, dummyPublishState, dummyGenres])

  const filteredHistory = useMemo(() => {
    let result = combinedHistory

    // 1. Playlist Filter
    if (selectedPlaylistFilter === 'liked') {
      result = result.filter(item => !!item.liked)
    } else if (selectedPlaylistFilter !== 'all') {
      result = result.filter(item => item.playlist_id === selectedPlaylistFilter)
    }

    // 2. Search Term Filter
    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase()
      result = result.filter(item => 
        (item.title || t.untitledProject).toLowerCase().includes(lower) ||
        (item.promptText || '').toLowerCase().includes(lower)
      )
    }

    return result
  }, [combinedHistory, searchTerm, t.untitledProject, selectedPlaylistFilter])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, selectedPlaylistFilter])

  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage) || 1
  const currentItems = useMemo(() => {
    return filteredHistory.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
  }, [filteredHistory, currentPage, itemsPerPage])


  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const handleDelete = (id: string) => {
    setDeleteConfirmId(id)
  }

  const confirmDelete = async () => {
    if (!deleteConfirmId) return
    const id = deleteConfirmId
    
    if (!id.startsWith('dummy')) {
      await deleteHistoryItem(id)
    } else {
      const currentDummyIds = readJson(STORAGE_KEYS.deletedDummyItems, [])
      writeJson(STORAGE_KEYS.deletedDummyItems, Array.from(new Set([...currentDummyIds, id])))
    }
    setDeletedIds(prev => [...prev, id])
    setDeleteConfirmId(null)
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 font-sans space-y-6 text-on-surface">
      {/* Top Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl sm:text-2xl font-black text-on-surface flex items-center gap-2 uppercase tracking-wide">
            <Library className="w-6 h-6 text-primary shrink-0" />
            {uiLanguage === 'KO' ? '보관함' : uiLanguage === 'JA' ? 'ライブラリ' : 'Library'}
          </h1>
          <span className="px-3 py-1 rounded-full bg-[#18181c] border border-zinc-800 text-xs font-bold text-zinc-400">
            {filteredHistory.length}
          </span>
        </div>

        <div className="relative w-full sm:w-80">
          <input 
            type="text" 
            className="w-full bg-[#111612] border border-zinc-800 rounded-full pl-10 pr-4 py-2.5 text-xs text-on-surface-variant placeholder-zinc-700 focus:outline-none focus:border-zinc-700 transition-all duration-300" 
            placeholder={uiLanguage === 'KO' ? '제목, 스타일 설명 검색...' : uiLanguage === 'JA' ? 'タイトル、スタイルの説明を検索...' : 'Search title, style description...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Playlist Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button
          onClick={() => setSelectedPlaylistFilter('all')}
          className={`px-4 py-2 text-xs font-bold rounded-full transition-all cursor-pointer whitespace-nowrap border ${
            selectedPlaylistFilter === 'all'
              ? 'bg-primary text-[#080d08] border-primary shadow-md shadow-primary/10'
              : 'bg-[#18181c] text-zinc-400 border-zinc-800 hover:text-white hover:border-zinc-700'
          }`}
        >
          {uiLanguage === 'KO' ? '전체' : uiLanguage === 'JA' ? 'すべて' : 'All'}
        </button>
        <button
          onClick={() => setSelectedPlaylistFilter('liked')}
          className={`px-4 py-2 text-xs font-bold rounded-full transition-all cursor-pointer whitespace-nowrap border flex items-center gap-1.5 ${
            selectedPlaylistFilter === 'liked'
              ? 'bg-[#FF2D55] text-white border-[#FF2D55] shadow-md shadow-red-500/15'
              : 'bg-[#18181c] text-zinc-400 border-zinc-800 hover:text-white hover:border-zinc-700'
          }`}
        >
          <Heart className={`w-3.5 h-3.5 ${selectedPlaylistFilter === 'liked' ? 'fill-current text-white' : 'text-[#FF2D55] fill-current'}`} />
          <span>{uiLanguage === 'KO' ? '좋아요 표시한 음악' : uiLanguage === 'JA' ? 'お気に入りの曲' : 'Liked Songs'}</span>
        </button>
        {[
          ...playlists.filter(p => parsePlaylistDescription(p.description).type === 'album'),
          ...playlists.filter(p => parsePlaylistDescription(p.description).type === 'playlist')
        ].map((playlist) => (
          <button
            key={playlist.id}
            onClick={() => setSelectedPlaylistFilter(playlist.id)}
            className={`px-4 py-2 text-xs font-bold rounded-full transition-all cursor-pointer whitespace-nowrap border ${
              selectedPlaylistFilter === playlist.id
                ? 'bg-primary text-[#080d08] border-primary shadow-md shadow-primary/10'
                : 'bg-[#18181c] text-zinc-400 border-zinc-800 hover:text-white hover:border-zinc-700'
            }`}
          >
            {playlist.title}
          </button>
        ))}
      </div>

      {/* Main Full-Width Table */}
      {filteredHistory.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-outline-variant/20 bg-white/[0.01] py-20 text-center">
          <Music className="mb-4 h-12 w-12 text-zinc-700" />
          <p className="text-sm font-medium text-on-surface-variant">
            {uiLanguage === 'KO' ? '보관된 음원이나 프롬프트가 없습니다.' : uiLanguage === 'JA' ? '保存された曲やプロンプトが見つかりません。' : 'No saved tracks or prompts.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="overflow-x-auto bg-transparent">
            <table className="w-full text-left text-xs text-zinc-400 border-collapse">
              <thead>
                <tr className="border-t border-b border-zinc-800 text-[11px] font-extrabold uppercase tracking-wider text-zinc-500">
                  <th className="px-6 py-4.5 w-14 text-center">{uiLanguage === 'KO' ? '번호' : uiLanguage === 'JA' ? '番号' : 'No.'}</th>
                  <th className="px-6 py-4.5 w-24">{uiLanguage === 'KO' ? '작성일' : uiLanguage === 'JA' ? '作成日' : 'Created At'}</th>
                  <th className="px-6 py-4.5">{uiLanguage === 'KO' ? '제목' : uiLanguage === 'JA' ? 'タイトル' : 'Title'}</th>
                  <th className="px-6 py-4.5 w-32">{uiLanguage === 'KO' ? '스타일 설명 (STYLE DESCRIPTION)' : uiLanguage === 'JA' ? 'スタイルの説明 (STYLE DESCRIPTION)' : 'STYLE DESCRIPTION'}</th>
                  <th className="px-6 py-4.5 w-20">{uiLanguage === 'KO' ? '언어' : uiLanguage === 'JA' ? '言語' : 'Language'}</th>
                  <th className="px-6 py-4.5 w-20 text-center">{uiLanguage === 'KO' ? '재생 시간' : uiLanguage === 'JA' ? '再生時間' : 'Duration'}</th>
                  <th className="px-6 py-4.5 w-20 text-center">{uiLanguage === 'KO' ? '좋아요' : uiLanguage === 'JA' ? 'いいね' : 'Like'}</th>
                  <th className="px-6 py-4.5 w-24 text-center">{uiLanguage === 'KO' ? '공개 여부' : uiLanguage === 'JA' ? '公開' : 'Public/Private'}</th>
                  <th className="px-6 py-4.5 w-32 text-center">{uiLanguage === 'KO' ? '관리' : uiLanguage === 'JA' ? '管理' : 'Manage'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900/50">
                {currentItems.map((item, index) => {
                  const absoluteIndex = filteredHistory.length - ((currentPage - 1) * itemsPerPage + index)
                  
                  const styleDescText = item.promptText || ''
                  const displayStyle = styleDescText.length > 10 
                    ? styleDescText.slice(0, 8) + '...' 
                    : styleDescText || '-'
                    
                  const cleanLang = item.langText 
                    ? (item.langText.includes(' ') ? item.langText.split(' ')[0] : item.langText) 
                    : '-'

                   const isProcessing = item.status === 'processing'
                  const hasAudio = !!(item.audio_url || item.file_url) && !isProcessing
                  const isCurrentPlaying = currentTrack?.id === item.id && isPlaying && !isProcessing

                  return (
                    <tr 
                      key={item.id} 
                      className="transition-all duration-200 hover:bg-white/[0.01] group/row cursor-pointer border-b border-zinc-800/30 last:border-0"
                      onClick={() => setSelectedItem(item)}
                    >
                      {/* 번호 */}
                      <td className="px-6 py-5 whitespace-nowrap text-center text-zinc-500 font-mono font-bold text-xs">
                        {absoluteIndex}
                      </td>

                      {/* 작성일 */}
                      <td className="px-6 py-5 whitespace-nowrap text-zinc-400 font-mono font-bold text-[11px]">
                        {formatDate(item.created_at)}
                      </td>

                      {/* 제목 (커버 이미지 및 재생 오버레이 통합) */}
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-4">
                          <div 
                            className="relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 group/cover cursor-pointer bg-zinc-900 border border-zinc-800/50"
                            onClick={(e) => {
                              if (hasAudio) {
                                e.stopPropagation()
                                handlePlayToggle(item)
                              }
                            }}
                          >
                            <img 
                              src={item.image_url || withBase('/default-album.png')} 
                              alt="Cover" 
                              className="w-full h-full object-cover"
                            />
                            {isProcessing ? (
                              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                <Loader2 className="w-6 h-6 text-primary animate-spin" />
                              </div>
                            ) : hasAudio ? (
                              <div className={`absolute inset-0 bg-black/50 flex items-center justify-center transition-all duration-200 ${
                                isCurrentPlaying ? 'opacity-100' : 'opacity-0 group-hover/cover:opacity-100'
                              }`}>
                                {isCurrentPlaying ? (
                                  <div className="flex items-end justify-center gap-[4px] h-6 w-6">
                                    <div className="w-[5px] h-full bg-primary rounded-sm animate-eq-1 shadow-[0_0_8px_rgba(227,254,6,0.5)]"></div>
                                    <div className="w-[5px] h-full bg-primary rounded-sm animate-eq-2 shadow-[0_0_8px_rgba(227,254,6,0.5)]"></div>
                                    <div className="w-[5px] h-full bg-primary rounded-sm animate-eq-3 shadow-[0_0_8px_rgba(227,254,6,0.5)]"></div>
                                  </div>
                                ) : (
                                  <Play className="w-6 h-6 text-primary fill-primary ml-0.5" />
                                )}
                              </div>
                            ) : null}
                          </div>

                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="block text-sm font-bold text-white group-hover/row:text-primary transition-colors truncate">
                                {item.title || t.untitledProject}
                              </span>
                              {isProcessing && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
                                  {uiLanguage === 'KO' ? '생성 중' : uiLanguage === 'JA' ? '生成中' : 'Generating'}
                                </span>
                              )}
                            </div>
                            <span className="block text-[11px] text-zinc-500 font-medium line-clamp-1 leading-normal max-w-xs truncate">
                              {styleDescText.length > 20 ? styleDescText.slice(0, 18) + '...' : styleDescText}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 스타일 설명 */}
                      <td className="px-6 py-5 whitespace-nowrap">
                        <span className="inline-block px-3 py-1.5 rounded-lg bg-[#242429] border border-zinc-800 text-[10px] font-bold text-zinc-300 tracking-wide">
                          {displayStyle}
                        </span>
                      </td>

                      {/* 언어 */}
                      <td className="px-6 py-5 whitespace-nowrap">
                        <span className="inline-block px-3 py-1.5 rounded-lg bg-[#242429] border border-zinc-800 text-[10px] font-bold text-zinc-300 tracking-wide font-sans">
                          {cleanLang}
                        </span>
                      </td>

                      {/* 재생 시간 */}
                      <td className="px-6 py-5 whitespace-nowrap text-center text-zinc-400 font-mono font-bold text-[11px]" onClick={(e) => e.stopPropagation()}>
                        {isProcessing ? (
                          <span>-:-</span>
                        ) : item.audio_url || item.file_url ? (
                          <AudioDuration url={item.audio_url || item.file_url} />
                        ) : (
                          <span>-:-</span>
                        )}
                      </td>

                      {/* 좋아요 */}
                      <td className="px-6 py-5 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleLikeToggle(item)}
                          className="p-1.5 rounded hover:bg-white/[0.05] transition-colors cursor-pointer group/heart"
                          title={uiLanguage === 'KO' ? '좋아요' : uiLanguage === 'JA' ? 'いいね' : 'Like'}
                        >
                          <Heart 
                            className={`w-4 h-4 transition-transform active:scale-125 ${
                              item.liked 
                                ? 'text-primary fill-current' 
                                : 'text-zinc-500 hover:text-primary group-hover/heart:scale-105'
                            }`} 
                          />
                        </button>
                      </td>

                      {/* 공개 여부 */}
                      <td className="px-6 py-5 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handlePublishToggle(item)}
                          className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all cursor-pointer border ${
                            item.is_published
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                              : 'bg-zinc-800/40 text-zinc-400 border-zinc-800/80 hover:text-white hover:border-zinc-700'
                          }`}
                        >
                          {item.is_published 
                            ? (uiLanguage === 'KO' ? `공개 (${item.genre || '기타'})` : uiLanguage === 'JA' ? `公開 (${item.genre || 'その他'})` : `Public (${item.genre || 'Other'})`)
                            : (uiLanguage === 'KO' ? '비공개' : uiLanguage === 'JA' ? '非公開' : 'Private')
                          }
                        </button>
                      </td>

                      {/* 관리 (삭제 및 플레이리스트 추가) */}
                      <td className="px-6 py-5 whitespace-nowrap text-center relative" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-3">
                          <button
                            onClick={() => handleDownloadTrack(item.audio_url || item.file_url, item.title, item.image_url)}
                            className="text-zinc-500 hover:text-primary p-1.5 rounded hover:bg-white/[0.05] transition-colors cursor-pointer"
                            title={uiLanguage === 'KO' ? '다운로드' : uiLanguage === 'JA' ? 'ダウンロード' : 'Download'}
                          >
                            <Download className="w-4 h-4" />
                          </button>

                          <div className="relative text-zinc-500 hover:text-primary p-1.5 rounded hover:bg-white/[0.05] transition-colors cursor-pointer" title={uiLanguage === 'KO' ? '채널 연결' : uiLanguage === 'JA' ? 'チャンネルに割り当て' : 'Connect Channel'}>
                            <Users className="w-4 h-4" />
                            <select 
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              value={item.channel_id || ''}
                              onChange={(e) => assignSongToChannel(item.id, e.target.value || null)}
                              disabled={item.id.startsWith('dummy')}
                            >
                              <option value="">{uiLanguage === 'KO' ? '메인 프로필 (채널 없음)' : uiLanguage === 'JA' ? 'メインプロフィール (チャンネルなし)' : 'Main Profile (No Channel)'}</option>
                              {channels.map(ch => (
                                <option key={ch.id} value={ch.id}>{ch.name}</option>
                              ))}
                            </select>
                          </div>

                          <button
                            onClick={() => setActivePlaylistMenuId(activePlaylistMenuId === item.id ? null : item.id)}
                            className="text-zinc-500 hover:text-white p-1.5 rounded hover:bg-white/[0.05] transition-colors cursor-pointer"
                            title={uiLanguage === 'KO' ? '플레이리스트에 추가' : uiLanguage === 'JA' ? 'プレイリストに追加' : 'Add to Playlist'}
                          >
                            <FolderPlus className="w-4 h-4" />
                          </button>
                          
                          <button 
                            onClick={() => handleDelete(item.id)} 
                            className="text-zinc-500 hover:text-[#FF2D55] font-bold text-xs transition-colors cursor-pointer"
                          >
                            {uiLanguage === 'KO' ? '삭제' : uiLanguage === 'JA' ? '削除する' : 'Delete'}
                          </button>
                        </div>

                        {/* Playlist Dropdown Popover */}
                        {activePlaylistMenuId === item.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setActivePlaylistMenuId(null)} />
                            <div className="absolute right-6 mt-2 w-48 bg-[#18181c] border border-zinc-800 rounded-xl shadow-2xl p-2 z-50 text-left">
                              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-2.5 py-1.5 border-b border-zinc-900">
                                {uiLanguage === 'KO' ? '플레이리스트 선택' : uiLanguage === 'JA' ? 'プレイリストを選択' : 'Select Playlist'}
                              </p>
                              <div className="max-h-40 overflow-y-auto py-1 space-y-0.5 custom-scrollbar">
                                {/* 해제 버튼 */}
                                <button
                                  onClick={async () => {
                                    setActivePlaylistMenuId(null)
                                    if (item.id.startsWith('dummy')) {
                                      setDummyPlaylistId(item.id, null)
                                    } else {
                                      try {
                                        const res = await fetch(`/api/song-history/${item.id}`, {
                                          method: 'PUT',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ playlist_id: null })
                                        })
                                        if (res.ok) {
                                          await onRefreshHistory()
                                        }
                                      } catch (err) {
                                        console.error(err)
                                      }
                                    }
                                  }}
                                  className="w-full text-left px-2.5 py-1.5 hover:bg-white/[0.03] text-zinc-400 hover:text-white rounded-lg transition-colors flex items-center justify-between text-[11px] font-bold cursor-pointer"
                                >
                                  <span>{uiLanguage === 'KO' ? '플레이리스트 해제' : uiLanguage === 'JA' ? 'プレイリストから削除' : 'Remove from Playlist'}</span>
                                  {!item.playlist_id && <Check className="w-3.5 h-3.5 text-primary" />}
                                </button>

                                {/* 좋아요 표시한 음악 퀵토글 */}
                                <button
                                  onClick={async () => {
                                    setActivePlaylistMenuId(null)
                                    await handleLikeToggle(item)
                                  }}
                                  className="w-full text-left px-2.5 py-1.5 hover:bg-white/[0.03] text-zinc-400 hover:text-white rounded-lg transition-colors flex items-center justify-between text-[11px] font-bold cursor-pointer"
                                >
                                  <span className="flex items-center gap-1.5">
                                    <Heart className="w-3.5 h-3.5 text-primary fill-current" />
                                    <span>{uiLanguage === 'KO' ? '좋아요 표시한 음악' : uiLanguage === 'JA' ? 'お気に入りの曲' : 'Liked Songs'}</span>
                                  </span>
                                  {item.liked && <Check className="w-3.5 h-3.5 text-primary" />}
                                </button>

                                {/* Albums Section */}
                                {playlists.filter(p => parsePlaylistDescription(p.description).type === 'album').length > 0 && (
                                  <div className="px-2 py-1 text-[8px] font-black tracking-widest text-[#e3fe06] uppercase bg-white/[0.01] border-y border-white/[0.03] select-none my-1">
                                    {uiLanguage === 'KO' ? '내 앨범' : uiLanguage === 'JA' ? 'アルバム' : 'Albums'}
                                  </div>
                                )}
                                {playlists.filter(p => parsePlaylistDescription(p.description).type === 'album').map((playlist) => {
                                  const isSelected = item.playlist_id === playlist.id
                                  return (
                                    <button
                                      key={playlist.id}
                                      onClick={async () => {
                                        setActivePlaylistMenuId(null)
                                        if (item.id.startsWith('dummy')) {
                                          setDummyPlaylistId(item.id, playlist.id)
                                        } else {
                                          try {
                                            const res = await fetch(`/api/song-history/${item.id}`, {
                                              method: 'PUT',
                                              headers: { 'Content-Type': 'application/json' },
                                              body: JSON.stringify({ playlist_id: playlist.id })
                                            })
                                            if (res.ok) {
                                              await onRefreshHistory()
                                            }
                                          } catch (err) {
                                            console.error(err)
                                          }
                                        }
                                      }}
                                      className="w-full text-left px-2.5 py-1.5 hover:bg-white/[0.03] text-zinc-400 hover:text-white rounded-lg transition-colors flex items-center justify-between text-[11px] font-bold cursor-pointer"
                                    >
                                      <span className="truncate max-w-[120px]">{playlist.title}</span>
                                      {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
                                    </button>
                                  )
                                })}

                                {/* Playlists Section */}
                                {playlists.filter(p => parsePlaylistDescription(p.description).type === 'playlist').length > 0 && (
                                  <div className="px-2 py-1 text-[8px] font-black tracking-widest text-zinc-400 uppercase bg-white/[0.01] border-y border-white/[0.03] select-none my-1">
                                    {uiLanguage === 'KO' ? '나만의 플레이리스트' : uiLanguage === 'JA' ? 'プレイリスト' : 'Playlists'}
                                  </div>
                                )}
                                {playlists.filter(p => parsePlaylistDescription(p.description).type === 'playlist').map((playlist) => {
                                  const isSelected = item.playlist_id === playlist.id
                                  return (
                                    <button
                                      key={playlist.id}
                                      onClick={async () => {
                                        setActivePlaylistMenuId(null)
                                        if (item.id.startsWith('dummy')) {
                                          setDummyPlaylistId(item.id, playlist.id)
                                        } else {
                                          try {
                                            const res = await fetch(`/api/song-history/${item.id}`, {
                                              method: 'PUT',
                                              headers: { 'Content-Type': 'application/json' },
                                              body: JSON.stringify({ playlist_id: playlist.id })
                                            })
                                            if (res.ok) {
                                              await onRefreshHistory()
                                            }
                                          } catch (err) {
                                            console.error(err)
                                          }
                                        }
                                      }}
                                      className="w-full text-left px-2.5 py-1.5 hover:bg-white/[0.03] text-zinc-400 hover:text-white rounded-lg transition-colors flex items-center justify-between text-[11px] font-bold cursor-pointer"
                                    >
                                      <span className="truncate max-w-[120px]">{playlist.title}</span>
                                      {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
                                    </button>
                                  )
                                })}
                                {playlists.length === 0 && (
                                  <p className="text-[10px] text-zinc-600 px-2.5 py-2 text-center">
                                    {uiLanguage === 'KO' ? '생성된 플레이리스트 없음' : uiLanguage === 'JA' ? 'プレイリストなし' : 'No playlists created'}
                                  </p>
                                )}
                              </div>
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-2 pt-2">
              <p className="text-xs text-zinc-500 font-bold">
                {uiLanguage === 'KO' 
                  ? `페이지 ${currentPage} / ${totalPages}` 
                  : uiLanguage === 'JA' ? `${currentPage} / ${totalPages} ページ` : `Page ${currentPage} of ${totalPages}`}
              </p>
              <div className="flex gap-1.5">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-[#1a1a1f] hover:bg-zinc-855 border border-zinc-800 rounded-xl text-xs font-bold text-zinc-400 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all"
                >
                  {uiLanguage === 'KO' ? '이전' : uiLanguage === 'JA' ? '前へ' : 'Prev'}
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`h-8 w-8 rounded-full text-xs font-bold transition-all duration-200 cursor-pointer ${
                        currentPage === page 
                          ? 'bg-[#FF2D55] text-white shadow-md shadow-red-500/10' 
                          : 'text-zinc-400 hover:bg-white/[0.03] hover:text-white'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-[#1a1a1f] hover:bg-zinc-855 border border-zinc-800 rounded-xl text-xs font-bold text-zinc-400 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all"
                >
                  {uiLanguage === 'KO' ? '다음' : uiLanguage === 'JA' ? '次へ' : 'Next'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {selectedItem && (
        <div className="fixed inset-0 z-[100] flex items-start pt-12 md:pt-20 justify-center bg-black/85 backdrop-blur-sm px-4 pb-4 sm:px-6 sm:pb-6" onClick={() => setSelectedItem(null)}>
          <div className="w-full max-w-5xl rounded-2xl border border-outline-variant/20 bg-surface-container-low/95 backdrop-blur-xl shadow-2xl shadow-black/80 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-outline-variant/10 px-6 py-5 sm:px-8 bg-[#0e130f] rounded-t-2xl">
              <div className="flex items-center gap-4 min-w-0">
                <img 
                  src={selectedItem.image_url || withBase('/default-album.png')} 
                  alt="Cover" 
                  className="w-12 h-12 rounded-lg object-cover bg-zinc-900 border border-zinc-800/50 flex-shrink-0"
                />
                <h2 className="text-xl sm:text-2xl font-bold text-on-surface truncate">{selectedItem.title || t.untitledProject}</h2>
              </div>
              <button onClick={() => setSelectedItem(null)} className="text-zinc-400 hover:text-white transition-colors bg-surface-container-lowest/60 hover:bg-surface-container-lowest p-2 rounded-full w-9 h-9 flex items-center justify-center cursor-pointer">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 custom-scrollbar bg-surface-container-low">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="flex flex-col">
                  <div className="flex justify-between items-center mb-1.5">
                    <h3 className="text-[11px] font-bold text-primary uppercase tracking-wider">{uiLanguage === 'KO' ? '프롬프트' : uiLanguage === 'JA' ? 'プロンプト' : 'Prompt'}</h3>
                    <button
                      onClick={() => handleCopyPrompt(selectedItem.prompt || '')}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                        copiedPrompt 
                          ? 'text-primary border-primary/40 bg-primary/5' 
                          : 'text-zinc-400 hover:text-white bg-white/[0.03] hover:bg-white/[0.08] border-zinc-800'
                      }`}
                    >
                      {copiedPrompt ? (uiLanguage === 'KO' ? '복사 완료' : uiLanguage === 'JA' ? 'コピー完了' : 'Copied') : (uiLanguage === 'KO' ? '복사' : uiLanguage === 'JA' ? 'コピー' : 'Copy')}
                    </button>
                  </div>
                  <div className="rounded-xl bg-surface-container-lowest p-4 border border-outline-variant/10 whitespace-pre-wrap text-xs leading-relaxed text-on-surface h-[500px] overflow-y-auto custom-scrollbar">
                    {selectedItem.prompt || (uiLanguage === 'KO' ? '내용 없음' : uiLanguage === 'JA' ? '内容なし' : 'No content')}
                  </div>
                </div>
                <div className="flex flex-col">
                  <div className="flex justify-between items-center mb-1.5">
                    <h3 className="text-[11px] font-bold text-primary uppercase tracking-wider">{uiLanguage === 'KO' ? '가사' : uiLanguage === 'JA' ? '歌詞' : 'Lyrics'}</h3>
                    <button
                      onClick={() => handleCopyLyrics(selectedItem.lyrics || '')}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                        copiedLyrics 
                          ? 'text-primary border-primary/40 bg-primary/5' 
                          : 'text-zinc-400 hover:text-white bg-white/[0.03] hover:bg-white/[0.08] border-zinc-800'
                      }`}
                    >
                      {copiedLyrics ? (uiLanguage === 'KO' ? '복사 완료' : uiLanguage === 'JA' ? 'コピー完了' : 'Copied') : (uiLanguage === 'KO' ? '복사' : uiLanguage === 'JA' ? 'コピー' : 'Copy')}
                    </button>
                  </div>
                  <div className="rounded-xl bg-surface-container-lowest p-4 border border-outline-variant/10 whitespace-pre-wrap text-xs leading-relaxed text-on-surface h-[500px] overflow-y-auto custom-scrollbar">
                    {selectedItem.lyrics || (uiLanguage === 'KO' ? '내용 없음' : uiLanguage === 'JA' ? '内容なし' : 'No content')}
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="col-span-1 lg:col-span-3 flex flex-col">
                  <h3 className="text-[11px] font-bold text-primary uppercase tracking-wider mb-1.5">{uiLanguage === 'KO' ? '스타일 설명 (STYLE DESCRIPTION)' : uiLanguage === 'JA' ? 'スタイルの説明 (STYLE DESCRIPTION)' : 'STYLE DESCRIPTION'}</h3>
                  <p className="text-xs text-on-surface bg-surface-container-lowest/60 px-4 py-3 rounded-xl border border-outline-variant/10 break-words font-medium">
                    {selectedItem.form?.styleDesc || [selectedItem.form?.genre, selectedItem.form?.mood].filter(Boolean).join(', ') || '-'}
                  </p>
                </div>
                <div className="col-span-1 flex flex-col">
                  <h3 className="text-[11px] font-bold text-primary uppercase tracking-wider mb-1.5">{uiLanguage === 'KO' ? '보컬 톤/스타일 (VOCAL STYLE)' : uiLanguage === 'JA' ? 'ボーカルトーン/スタイル (VOCAL STYLE)' : 'VOCAL STYLE'}</h3>
                  <p className="text-xs text-on-surface bg-surface-container-lowest/60 px-4 py-3 rounded-xl border border-outline-variant/10 break-words font-medium">
                    {selectedItem.form?.vocal || '-'}
                    {selectedItem.form?.vocalFeaturing && selectedItem.form?.vocalFeaturing !== '없음' ? ` (Ft. ${selectedItem.form.vocalFeaturing})` : ''}
                  </p>
                </div>
              </div>

              {/* AI 메모 */}
              <div className="flex flex-col">
                <h3 className="text-[11px] font-bold text-primary uppercase tracking-wider mb-1.5">{uiLanguage === 'KO' ? 'AI 메모' : uiLanguage === 'JA' ? 'AI メモ' : 'AI Memo'}</h3>
                <div className="rounded-xl bg-surface-container-lowest/60 p-4 border border-outline-variant/10 text-xs text-on-surface leading-relaxed font-sans whitespace-pre-line">
                  {selectedItem.notes || [
                    `- 대상 툴: ${selectedItem.form?.targetTool || selectedItem.targetTool || 'Suno'}`,
                    `- 가사 언어: ${selectedItem.form?.language || selectedItem.langText || '한국어'}`,
                    `- 보컬 구성: ${selectedItem.form?.vocalGroup === 'vocal' || selectedItem.form?.vocalGroup === 'solo' ? '솔로' : (selectedItem.form?.vocalGroup || '솔로')}`,
                    `- 반영 지침: 등록 지침 포함`
                  ].join('\n')}
                </div>
              </div>
            </div>
            
            <div className="border-t border-outline-variant/10 p-5 sm:px-8 flex flex-wrap gap-3 justify-end bg-surface-container-lowest/30 rounded-b-2xl">
              <button 
                onClick={() => { openHistoryItem(selectedItem, 'style'); setSelectedItem(null); setCurrentTab('studio'); }}
                className="px-4 py-2 text-xs font-bold text-on-surface-variant bg-white/[0.03] hover:bg-white/[0.08] hover:text-white rounded-xl transition-all border border-outline-variant/20 cursor-pointer"
              >
                {uiLanguage === 'KO' ? '스타일 프롬프트만 재사용' : uiLanguage === 'JA' ? 'スタイルプロンプトのみ再利用' : 'Reuse style prompt only'}
              </button>
              <button 
                onClick={() => { openHistoryItem(selectedItem, 'lyrics'); setSelectedItem(null); setCurrentTab('studio'); }}
                className="px-4 py-2 text-xs font-bold text-on-surface-variant bg-white/[0.03] hover:bg-white/[0.08] hover:text-white rounded-xl transition-all border border-outline-variant/20 cursor-pointer"
              >
                {uiLanguage === 'KO' ? '가사만 재사용' : uiLanguage === 'JA' ? '歌詞のみ再利用' : 'Reuse lyrics only'}
              </button>
              <button 
                onClick={() => { openHistoryItem(selectedItem, 'all'); setSelectedItem(null); setCurrentTab('studio'); }}
                className="px-5 py-2.5 text-xs font-extrabold text-[#080d08] bg-primary hover:bg-[#e3fe06] active:scale-[0.98] rounded-xl transition-all shadow-lg shadow-primary/10 cursor-pointer"
              >
                {uiLanguage === 'KO' ? '전체 재사용' : uiLanguage === 'JA' ? 'すべて再利用' : 'Reuse all'}
              </button>
            </div>
          </div>
        </div>
      )}

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
                onClick={confirmDelete}
                className="px-5 py-2.5 text-xs font-extrabold text-white bg-[#FF2D55] hover:bg-red-500 active:scale-[0.98] rounded-xl transition-all shadow-lg shadow-red-500/20 cursor-pointer"
              >
                {uiLanguage === 'KO' ? '삭제' : uiLanguage === 'JA' ? '削除する' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {publishConfirmItem && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 sm:p-6" onClick={() => setPublishConfirmItem(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-outline-variant/20 bg-surface-container-low/95 backdrop-blur-xl shadow-2xl shadow-black/80 flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white">
                  {uiLanguage === 'KO' ? '음원 퍼블리싱' : uiLanguage === 'JA' ? '音楽を公開' : 'Publish Track'}
                </h3>
                <p className="text-xs text-zinc-400">
                  {uiLanguage === 'KO' 
                    ? `'${publishConfirmItem.title || t.untitledProject}' 곡을 퍼블리싱하여 내 채널에 공개하시겠습니까?`
                    : uiLanguage === 'JA' ? `本当に公開しますか: ` : `Are you sure you want to publish '${publishConfirmItem.title || t.untitledProject}'?`
                  }
                </p>
              </div>

              <div className="space-y-1.5 text-xs text-left">
                <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                  {uiLanguage === 'KO' ? '장르 카테고리 (필수)' : uiLanguage === 'JA' ? 'ジャンルカテゴリー (必須)' : 'Genre Category (Required)'}
                </label>
                <select
                  value={selectedPublishGenre}
                  onChange={(e) => setSelectedPublishGenre(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-primary/50 transition-colors"
                >
                  <option value="">{uiLanguage === 'KO' ? '장르 선택' : uiLanguage === 'JA' ? 'ジャンルを選択' : 'Select Genre'}</option>
                  {GENRES.map(g => (
                    <option key={g.name} value={g.name}>
                      {g.name} {uiLanguage === 'KO' && g.korean ? `(${g.korean})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="border-t border-outline-variant/10 p-4 bg-surface-container-lowest/30 flex gap-3 justify-end">
               <button 
                 onClick={() => setPublishConfirmItem(null)}
                 className="px-4 py-2 text-xs font-bold text-on-surface-variant bg-white/[0.03] hover:bg-white/[0.08] hover:text-white rounded-xl transition-all border border-outline-variant/20 cursor-pointer"
               >
                 {uiLanguage === 'KO' ? '취소' : uiLanguage === 'JA' ? 'キャンセル' : 'Cancel'}
               </button>
               <button 
                 onClick={confirmPublish}
                 disabled={!selectedPublishGenre}
                 className="px-5 py-2.5 text-xs font-extrabold text-[#080d08] bg-primary hover:bg-[#e3fe06] disabled:opacity-50 active:scale-[0.98] rounded-xl transition-all shadow-lg shadow-primary/10 cursor-pointer"
               >
                 {uiLanguage === 'KO' ? '퍼블리싱' : uiLanguage === 'JA' ? '公開する' : 'Publish'}
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default StudioClient
