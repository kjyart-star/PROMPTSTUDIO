const fs = require('fs');
const file = '/Users/jin/Documents/자동화 에이전트개발/프롬프트작성기/suno-prompt/src/App.jsx';
let content = fs.readFileSync(file, 'utf8');

const translationsCode = `
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
    historyEmptyCloud: '로그인 후 저장한 프로젝트가\\n여기에 표시됩니다.',
    historyEmptyLocal: '프로젝트를 저장하면\\n여기에 보관됩니다.',
    
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
    copyAllBtn: '클립보드 전체 복사',
    clearResultBtn: '결과 지우기',
    copyTooltip: '복사하기',
    copyPrompt: '프롬프트',
    copyTitle: '제목',
    copyLyrics: '가사',
    copyNotes: '메모',
    copyAll: '전체 결과'
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
    historyEmptyCloud: 'Projects saved after login\\nwill appear here.',
    historyEmptyLocal: 'Saved projects will\\nappear here.',
    
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
    copyAll: 'All Results'
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
`;

// Insert translation object
content = content.replace(
  `const LANGUAGE_OPTIONS = ['한국어', '영어', '일본어'];\nconst VOCAL_GROUP_OPTIONS = ['솔로', '중창', '합창', '그룹'];\nconst VOCAL_GENDER_OPTIONS = ['여성', '남성', '혼성/기타'];`,
  translationsCode
);

// Add uiLanguage state to App
content = content.replace(
  "const [form, setForm] = useState(INITIAL_FORM);",
  "const [uiLanguage, setUiLanguage] = useState('KO');\n  const t = TRANSLATIONS[uiLanguage];\n  const [form, setForm] = useState(INITIAL_FORM);"
);

// Remove default status string
content = content.replace(
  "const [status, setStatus] = useState('대기 중');",
  "const [status, setStatus] = useState('대기 중'); // Will be localized dynamically"
);
content = content.replace(
  "const provider = PROVIDERS[settings.provider];",
  `const provider = PROVIDERS[settings.provider];\n  useEffect(() => {\n    if (status === '대기 중' || status === 'Waiting') setStatus(t.statusWaiting);\n  }, [uiLanguage]);`
);


// status text replacements inside App functions
content = content.replace("setStatus('AI 생성 중')", "setStatus(t.statusGenerating)");
content = content.replace("setStatus('API 키가 없어 샘플 생성 결과를 만들었습니다')", "setStatus(t.statusSampleGenerated)");
content = content.replace("setStatus(`${provider.name} 생성 완료`)", "setStatus(`${provider.name} ${t.statusGenerated}`)");
content = content.replace("setStatus('API 오류로 샘플 결과를 대신 표시했습니다')", "setStatus(t.statusError)");
content = content.replace("setStatus(`${label} 복사 완료`)", "setStatus(`${label} ${t.statusCopied}`)");
content = content.replace("setStatus('결과를 비웠습니다')", "setStatus(t.statusCleared)");

content = content.replace(/setStatus\('Supabase URL과 anon key를 먼저 입력하세요'\)/g, "setStatus(t.statusLoginRequired)");
content = content.replace(/setStatus\(\`로그인 실패: \$\{error\.message\}\`\)/g, "setStatus(`${t.statusLoginFail} ${error.message}`)");
content = content.replace(/setStatus\('로그인 완료'\)/g, "setStatus(t.statusLoginSuccess)");
content = content.replace(/setStatus\(\`회원가입 실패: \$\{error\.message\}\`\)/g, "setStatus(`${t.statusSignUpFail} ${error.message}`)");
content = content.replace(/setStatus\('회원가입 완료. 이메일 확인 설정이 켜져 있으면 메일 인증 후 로그인됩니다'\)/g, "setStatus(t.statusSignUpSuccess)");
content = content.replace(/setStatus\('현재 로컬 저장 모드입니다. Google 로그인은 Supabase 연결 후 사용할 수 있습니다'\)/g, "setStatus(t.statusGoogleLoginLocal)");
content = content.replace(/setStatus\(\`Google 로그인 실패: \$\{error\.message\}\`\)/g, "setStatus(`${t.statusGoogleLoginFail} ${error.message}`)");
content = content.replace(/setStatus\('로그아웃 완료'\)/g, "setStatus(t.statusLogout)");

content = content.replace(/setStatus\('로컬 히스토리를 불러왔습니다'\)/g, "setStatus(t.statusHistoryLocalLoaded)");
content = content.replace(/setStatus\('클라우드 히스토리는 로그인 후 조회할 수 있습니다'\)/g, "setStatus(t.statusHistoryCloudLoginReq)");
content = content.replace(/setStatus\(\`히스토리 조회 실패: \$\{error\.message\}\`\)/g, "setStatus(`${t.statusHistoryLoadFail} ${error.message}`)");
content = content.replace(/setStatus\('로컬 히스토리에 저장했습니다'\)/g, "setStatus(t.statusHistoryLocalSaved)");
content = content.replace(/setStatus\('클라우드 저장은 로그인 후 사용할 수 있습니다'\)/g, "setStatus(t.statusHistoryCloudSaveReq)");
content = content.replace(/setStatus\(\`저장 실패: \$\{error\.message\}\`\)/g, "setStatus(`${t.statusHistorySaveFail} ${error.message}`)");
content = content.replace(/setStatus\('히스토리에 저장했습니다'\)/g, "setStatus(t.statusHistorySaved)");
content = content.replace(/setStatus\('히스토리에서 불러왔습니다'\)/g, "setStatus(t.statusHistoryOpened)");
content = content.replace(/setStatus\('로컬 히스토리 항목을 삭제했습니다'\)/g, "setStatus(t.statusHistoryLocalDeleted)");
content = content.replace(/setStatus\(\`삭제 실패: \$\{error\.message\}\`\)/g, "setStatus(`${t.statusHistoryDeleteFail} ${error.message}`)");
content = content.replace(/setStatus\('히스토리 항목을 삭제했습니다'\)/g, "setStatus(t.statusHistoryDeleted)");

// UI texts
content = content.replace(/>Studio<\/a>/g, ">{t.studio}</a>");
content = content.replace(/>Library<\/a>/g, ">{t.library}</a>");
content = content.replace(/>Explore<\/a>/g, ">{t.explore}</a>");

content = content.replace(/onClick=\{\(\) => updateForm\('language', '한국어'\)\}/g, "onClick={() => setUiLanguage('KO')}");
content = content.replace(/onClick=\{\(\) => updateForm\('language', '영어'\)\}/g, "onClick={() => setUiLanguage('EN')}");
content = content.replace(/form\.language === '한국어'/g, "uiLanguage === 'KO'");
content = content.replace(/form\.language === '영어'/g, "uiLanguage === 'EN'");

content = content.replace(/title="AI 설정"/g, 'title={t.panelAiConfig}');
content = content.replace(/>제공자<\/label>/g, '>{t.provider}</label>');
content = content.replace(/>모델<\/label>/g, '>{t.model}</label>');
content = content.replace(/placeholder="브라우저에만 저장됩니다"/g, 'placeholder={t.apiKeyPlaceholder}');
content = content.replace(/title="로그인 · 저장"/g, 'title={t.panelLoginSave}');
content = content.replace(/>새로고침<\/button>/g, '>{t.refresh}</button>');
content = content.replace(/>로그아웃<\/button>/g, '>{t.logout}</button>');
content = content.replace(/>Google 계정으로 로그인<\/button>/g, '>{t.googleLogin}</button>');
content = content.replace(/>Or Email<\/span>/g, '>{t.orEmail}</span>');
content = content.replace(/placeholder="이메일 주소"/g, 'placeholder={t.emailPlaceholder}');
content = content.replace(/placeholder="비밀번호"/g, 'placeholder={t.passwordPlaceholder}');
content = content.replace(/>로그인<\/button>/g, '>{t.login}</button>');
content = content.replace(/>회원가입<\/button>/g, '>{t.signUp}</button>');

content = content.replace(/title="저장 히스토리"/g, 'title={t.panelHistory}');
content = content.replace(/>현재 곡 저장<\/button>/g, '>{t.saveCurrentSong}</button>');
content = content.replace(/>목록 갱신<\/button>/g, '>{t.refreshList}</button>');
content = content.replace(/\{item\.title \|\| 'Untitled Project'\}/g, '{item.title || t.untitledProject}');
content = content.replace(/>열기<\/button>/g, '>{t.open}</button>');
content = content.replace(/>삭제<\/button>/g, '>{t.delete}</button>');
content = content.replace(/isCloudMode \? '로그인 후 저장한 프로젝트가\\n여기에 표시됩니다\.' : '프로젝트를 저장하면\\n여기에 보관됩니다\.'/g, "isCloudMode ? t.historyEmptyCloud : t.historyEmptyLocal");

content = content.replace(/title="지침서 \(가이드\)"/g, 'title={t.panelGuides}');
content = content.replace(/>Remove<\/button>/g, '>{t.remove}</button>');
content = content.replace(/placeholder="새 지침서 제목"/g, 'placeholder={t.newGuideTitlePlaceholder}');
content = content.replace(/placeholder="작사 규칙, 금지어, 브랜드 톤, 구조 등을 입력"/g, 'placeholder={t.newGuideBodyPlaceholder}');
content = content.replace(/>지침서 등록하기<\/button>/g, '>{t.registerGuide}</button>');

content = content.replace(/title="곡 정보 및 프롬프트 설정"/g, 'title={t.panelInput}');
content = content.replace(/label="곡 제목 \(Title\)"/g, 'label={t.songTitle}');
content = content.replace(/placeholder="예: Neon City Lights"/g, 'placeholder={t.songTitlePlaceholder}');
content = content.replace(/label="대상 툴 \(Target AI\)"/g, 'label={t.targetTool}');
content = content.replace(/placeholder="예: Suno, Udio"/g, 'placeholder={t.targetToolPlaceholder}');
content = content.replace(/label="장르 \(Genre\)"/g, 'label={t.genre}');
content = content.replace(/placeholder="예: Synthwave, K-pop"/g, 'placeholder={t.genrePlaceholder}');
content = content.replace(/label="분위기 \(Mood\)"/g, 'label={t.mood}');
content = content.replace(/placeholder="예: 몽환적인, 에너제틱한"/g, 'placeholder={t.moodPlaceholder}');

content = content.replace(/label="가사 언어 \(Language\)" value=\{form\.language\} options=\{LANGUAGE_OPTIONS\}/g, "label={t.lyricsLanguage} value={form.language} options={getOptions(uiLanguage).language}");
content = content.replace(/label="보컬 성별 \(Gender\)" value=\{form\.vocalGender \|\| '여성'\} options=\{VOCAL_GENDER_OPTIONS\}/g, "label={t.vocalGender} value={form.vocalGender || '여성'} options={getOptions(uiLanguage).vocalGender}");
content = content.replace(/label="보컬 톤\/스타일 \(Vocal Style\)"/g, 'label={t.vocalStyle}');
content = content.replace(/placeholder="예: 허스키한, 맑은, 부드러운"/g, 'placeholder={t.vocalStylePlaceholder}');
content = content.replace(/label="보컬 구성 \(Vocal Group\)" value=\{form\.vocalGroup\} options=\{VOCAL_GROUP_OPTIONS\}/g, "label={t.vocalGroup} value={form.vocalGroup} options={getOptions(uiLanguage).vocalGroup}");
content = content.replace(/label="템포 \(BPM\/Tempo\)"/g, 'label={t.tempo}');
content = content.replace(/label="구조 \(Structure\)"/g, 'label={t.structure}');
content = content.replace(/placeholder="예: \\\[Intro\\\] - \\\[Verse 1\\\] - \\\[Chorus\\\] - \\\[Drop\\\] - \\\[Outro\\\]"/g, 'placeholder={t.structurePlaceholder}');

content = content.replace(/>주제 및 네러티브 \(Theme \& Narrative\)<\/span>/g, '>{t.theme}</span>');
content = content.replace(/>곡이 전달하고자 하는 이야기<\/span>/g, '>{t.themeSub}</span>');
content = content.replace(/placeholder="이 노래가 어떤 이야기를 담고 있는지 자세히 적어주세요\."/g, 'placeholder={t.themePlaceholder}');
content = content.replace(/>추가 요청 \(Extra Requests\)<\/span>/g, '>{t.extraRequests}</span>');
content = content.replace(/>특정 악기, 특수 효과 등<\/span>/g, '>{t.extraSub}</span>');
content = content.replace(/placeholder="예: 코러스에 일렉기타 솔로 추가, 리버브 이펙트 강조"/g, 'placeholder={t.extraPlaceholder}');

content = content.replace(/\{isGenerating \? 'AI가 프롬프트를 생성 중입니다\.\.\.' : 'GENERATE PROMPT \& LYRICS'\}/g, '{isGenerating ? t.generating : t.generateBtn}');
content = content.replace(/>샘플 생성<\/button>/g, '>{t.generateSampleBtn}</button>');

content = content.replace(/title="생성 결과 \(Output\)"/g, 'title={t.panelOutput}');
content = content.replace(/label="Suno 스타일 프롬프트"/g, 'label={t.promptLabel}');
content = content.replace(/placeholder="여기에 음악 스타일 프롬프트가 생성됩니다\."/g, 'placeholder={t.promptPlaceholder}');
content = content.replace(/copyText\('프롬프트', resultParts\.prompt\)/g, "copyText(t.copyPrompt, resultParts.prompt)");

content = content.replace(/label="곡 제목"/g, 'label={t.titleLabel}');
content = content.replace(/placeholder="곡 제목"/g, 'placeholder={t.titlePlaceholder}');
content = content.replace(/copyText\('제목', resultParts\.title\)/g, "copyText(t.copyTitle, resultParts.title)");

content = content.replace(/label="가사 편집기"/g, 'label={t.lyricsLabel}');
content = content.replace(/placeholder="섹션 태그가 포함된 가사가 여기에 표시됩니다\. 직접 수정하여 최종 완성하세요\."/g, 'placeholder={t.lyricsPlaceholder}');
content = content.replace(/copyText\('가사', resultParts\.lyrics\)/g, "copyText(t.copyLyrics, resultParts.lyrics)");

content = content.replace(/label="AI 메모 \(Suggestions\)"/g, 'label={t.notesLabel}');
content = content.replace(/placeholder="제작 메모 또는 AI의 추가 제안이 표시됩니다\."/g, 'placeholder={t.notesPlaceholder}');
content = content.replace(/copyText\('메모', resultParts\.notes\)/g, "copyText(t.copyNotes, resultParts.notes)");

content = content.replace(/copyText\('전체 결과', composeGeneratedText\(resultParts\)\)/g, "copyText(t.copyAll, composeGeneratedText(resultParts))");
content = content.replace(/클립보드 전체 복사/g, "{t.copyAllBtn}");
content = content.replace(/>결과 지우기<\/button>/g, ">{t.clearResultBtn}</button>");

// Also pass tooltip to ResultField and change SelectInput/ButtonGroupInput
content = content.replace(
  "function SelectInput({ label, value, options, onChange }) {",
  "function SelectInput({ label, value, options, onChange }) {"
);

content = content.replace(
  /\{options\.map\(\(option\) => <option key=\{option\} value=\{option\}>\{option\}<\/option>\)\}/g,
  "{options.map((option) => typeof option === 'string' ? <option key={option} value={option}>{option}</option> : <option key={option.value} value={option.value}>{option.label}</option>)}"
);

content = content.replace(
  /\{options\.map\(\(option\) => \(/g,
  "{options.map((option) => typeof option === 'string' ? {value: option, label: option} : option).map((option) => ("
);

content = content.replace(
  /value === option/g,
  "value === option.value"
);
content = content.replace(
  /onClick=\{\(\) => onChange\(option\)\}/g,
  "onClick={() => onChange(option.value)}"
);
content = content.replace(
  />\n\s*\{option\}\n\s*<\/button>/g,
  ">\n            {option.label}\n          </button>"
);
content = content.replace(
  /key=\{option\}/g,
  "key={option.value}"
);

// Add tooltip prop to ResultField
content = content.replace(
  /function ResultField\(\{ label, value, placeholder, minHeight, onChange, onCopy, wrapperClassName = "mb-4" \}\) \{/,
  'function ResultField({ label, value, placeholder, minHeight, onChange, onCopy, wrapperClassName = "mb-4", tooltip = "복사하기" }) {'
);

content = content.replace(
  /title="복사하기"/g,
  "title={tooltip}"
);

// We need to inject tooltip prop to the <ResultField ... /> calls
content = content.replace(/onCopy=\{\(\) => copyText\(t\.copyPrompt, resultParts\.prompt\)\}/, "onCopy={() => copyText(t.copyPrompt, resultParts.prompt)}\n                tooltip={t.copyTooltip}");
content = content.replace(/onCopy=\{\(\) => copyText\(t\.copyTitle, resultParts\.title\)\}/, "onCopy={() => copyText(t.copyTitle, resultParts.title)}\n                tooltip={t.copyTooltip}");
content = content.replace(/onCopy=\{\(\) => copyText\(t\.copyLyrics, resultParts\.lyrics\)\}/, "onCopy={() => copyText(t.copyLyrics, resultParts.lyrics)}\n                tooltip={t.copyTooltip}");
content = content.replace(/onCopy=\{\(\) => copyText\(t\.copyNotes, resultParts\.notes\)\}/, "onCopy={() => copyText(t.copyNotes, resultParts.notes)}\n                tooltip={t.copyTooltip}");


fs.writeFileSync(file, content);
console.log('Done!');
