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

const LANGUAGE_OPTIONS = ['한국어', '영어', '일본어'];
const VOCAL_GROUP_OPTIONS = ['솔로', '중창', '합창', '그룹'];

const INITIAL_FORM = {
  title: '비 오는 밤의 드라이브',
  theme: '헤어진 뒤에도 잊히지 않는 밤길의 감정',
  genre: 'Korean city pop, synth pop',
  mood: 'nostalgic, rainy, warm, cinematic',
  language: '한국어',
  vocal: 'soft male vocal, airy harmony',
  vocalGroup: '솔로',
  tempo: 'mid tempo, 92 BPM',
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
    form.vocal,
    `${form.vocalGroup} vocal arrangement`,
    form.tempo,
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
- 보컬/톤: ${form.vocal}
- 보컬 구성: ${form.vocalGroup}
- 템포: ${form.tempo}
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
  const [showSql, setShowSql] = useState(false);
  const [status, setStatus] = useState('대기 중');
  const [isGenerating, setIsGenerating] = useState(false);

  const provider = PROVIDERS[settings.provider];
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
    setStatus('AI 생성 중');
    try {
      if (!settings.apiKey.trim()) {
        setGeneratedText(makeFallback(form, guideText));
        setStatus('API 키가 없어 샘플 생성 결과를 만들었습니다');
        return;
      }
      const nextResult = settings.provider === 'openai'
        ? await callOpenAI(settings, prompt)
        : settings.provider === 'gemini'
          ? await callGemini(settings, prompt)
          : await callClaude(settings, prompt);
      setGeneratedText(nextResult.trim() || makeFallback(form, guideText));
      setStatus(`${provider.name} 생성 완료`);
    } catch (error) {
      setGeneratedText(`${makeFallback(form, guideText)}\n\nAPI ERROR\n${error.message}`);
      setStatus('API 오류로 샘플 결과를 대신 표시했습니다');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyText = async (label, text) => {
    await navigator.clipboard.writeText(text);
    setStatus(`${label} 복사 완료`);
  };

  const clearResult = () => {
    setResultParts(EMPTY_RESULT);
    setStatus('결과를 비웠습니다');
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
      setStatus('Supabase URL과 anon key를 먼저 입력하세요');
      return;
    }
    const { error } = await supabase.auth.signInWithPassword(authForm);
    if (error) {
      setStatus(`로그인 실패: ${error.message}`);
      return;
    }
    setStatus('로그인 완료');
  };

  const signUp = async () => {
    if (!supabase) {
      setStatus('Supabase URL과 anon key를 먼저 입력하세요');
      return;
    }
    const { error } = await supabase.auth.signUp(authForm);
    if (error) {
      setStatus(`회원가입 실패: ${error.message}`);
      return;
    }
    setStatus('회원가입 완료. 이메일 확인 설정이 켜져 있으면 메일 인증 후 로그인됩니다');
  };

  const signInWithGoogle = async () => {
    if (!supabase) {
      setStatus('현재 로컬 저장 모드입니다. Google 로그인은 Supabase 연결 후 사용할 수 있습니다');
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) {
      setStatus(`Google 로그인 실패: ${error.message}`);
    }
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setStatus('로그아웃 완료');
  };

  const loadHistory = async () => {
    if (!supabase) {
      setHistory(readJson(STORAGE_KEYS.localHistory, []));
      setStatus('로컬 히스토리를 불러왔습니다');
      return;
    }
    if (!user) {
      setStatus('클라우드 히스토리는 로그인 후 조회할 수 있습니다');
      return;
    }
    const { data, error } = await supabase
      .from('song_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      setStatus(`히스토리 조회 실패: ${error.message}`);
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
      setStatus('로컬 히스토리에 저장했습니다');
      return;
    }

    if (!user) {
      setStatus('클라우드 저장은 로그인 후 사용할 수 있습니다');
      return;
    }

    const cloudPayload = {
      ...payload,
      user_id: user.id,
    };

    const { error } = await supabase.from('song_history').insert(cloudPayload);
    if (error) {
      setStatus(`저장 실패: ${error.message}`);
      return;
    }
    setStatus('히스토리에 저장했습니다');
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
    setStatus('히스토리에서 불러왔습니다');
  };

  const deleteHistoryItem = async (id) => {
    if (!supabase) {
      const nextHistory = readJson(STORAGE_KEYS.localHistory, []).filter((item) => item.id !== id);
      writeJson(STORAGE_KEYS.localHistory, nextHistory);
      setHistory(nextHistory);
      setStatus('로컬 히스토리 항목을 삭제했습니다');
      return;
    }
    if (!user) return;
    const { error } = await supabase.from('song_history').delete().eq('id', id);
    if (error) {
      setStatus(`삭제 실패: ${error.message}`);
      return;
    }
    setStatus('히스토리 항목을 삭제했습니다');
    loadHistory();
  };

  return (
    <main className="min-h-screen bg-[#f7f3ea] text-[#171717]">
      <div className="border-b border-[#d8d0c0] bg-[#fffaf0]">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b23a48]">Prompt Studio</p>
            <h1 className="mt-1 text-3xl font-bold text-[#171717] md:text-4xl">음악 생성 프롬프트 & 가사 작성 툴</h1>
          </div>
          <div className="rounded-md border border-[#d8d0c0] bg-white px-4 py-3 text-sm text-[#4b4338]">{status}</div>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-5 px-5 py-5 lg:grid-cols-[360px_1fr_380px]">
        <section className="space-y-4">
          <Panel title="AI 설정">
            <label className="field-label">제공자</label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(PROVIDERS).map(([id, item]) => (
                <button key={id} className={`seg-btn ${settings.provider === id ? 'seg-btn-active' : ''}`} onClick={() => updateProvider(id)}>
                  {item.name}
                </button>
              ))}
            </div>
            <label className="field-label mt-4">모델</label>
            <select className="input" value={settings.model} onChange={(event) => setSettings({ ...settings, model: event.target.value })}>
              {provider.models.map((model) => <option key={model}>{model}</option>)}
            </select>
            <label className="field-label mt-4">{provider.keyLabel}</label>
            <input className="input" type="password" value={settings.apiKey} onChange={(event) => setSettings({ ...settings, apiKey: event.target.value })} placeholder="브라우저에만 저장됩니다" />
          </Panel>

          <Panel title="로그인 · 저장">
            <div className="mb-3 rounded-md border border-[#d8d0c0] bg-[#fffdf8] p-3 text-sm leading-6 text-[#62594b]">
              현재 모드: <strong className="text-[#2a241c]">{isCloudMode ? 'Supabase 클라우드' : '로컬 저장'}</strong>
              <br />
              서비스 운영 시에는 `.env.local` 또는 배포 환경변수에 Supabase 값을 넣고, 사용자는 Google 버튼만 누르게 합니다.
              {supabaseCallbackUrl && (
                <>
                  <br />
                  Google OAuth Callback: <span className="break-all font-mono text-xs text-[#2a241c]">{supabaseCallbackUrl}</span>
                </>
              )}
            </div>
            <label className="field-label">대시보드/프로젝트 주소</label>
            <input
              className="input"
              value={supabaseConfig.dashboardUrl || ''}
              onChange={(event) => setSupabaseConfig({ ...supabaseConfig, dashboardUrl: event.target.value })}
              placeholder="https://supabase.com/dashboard/project/... 또는 https://xxxx.supabase.co"
            />
            <button className="secondary-btn mt-2 w-full" onClick={applySupabaseAddress}>주소 자동 적용</button>
            <label className="field-label mt-3">Supabase URL</label>
            <input className="input" value={supabaseConfig.url} onChange={(event) => setSupabaseConfig({ ...supabaseConfig, url: event.target.value })} placeholder="https://xxxx.supabase.co" />
            <label className="field-label mt-3">Supabase anon key</label>
            <input className="input" type="password" value={supabaseConfig.anonKey} onChange={(event) => setSupabaseConfig({ ...supabaseConfig, anonKey: event.target.value })} placeholder="public anon key" />

            <div className="mt-3 grid grid-cols-2 gap-2">
              <input className="input" value={authForm.email} onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })} placeholder="email" />
              <input className="input" type="password" value={authForm.password} onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })} placeholder="password" />
            </div>

            {user ? (
              <div className="mt-3 rounded-md border border-[#d8d0c0] bg-[#fffdf8] p-3 text-sm text-[#4b4338]">
                <div className="truncate font-bold">{user.email}</div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button className="secondary-btn" onClick={loadHistory}>새로고침</button>
                  <button className="secondary-btn" onClick={signOut}>로그아웃</button>
                </div>
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                <button className="google-btn w-full" onClick={signInWithGoogle}>Google로 가입/로그인</button>
                <div className="grid grid-cols-2 gap-2">
                  <button className="primary-btn" onClick={signIn}>이메일 로그인</button>
                  <button className="secondary-btn" onClick={signUp}>이메일 회원가입</button>
                </div>
              </div>
            )}

            <button className="mt-3 text-xs font-bold text-[#b23a48]" onClick={() => setShowSql((current) => !current)}>
              {showSql ? 'DB SQL 숨기기' : 'DB SQL 보기'}
            </button>
            {showSql && (
              <textarea className="input mt-2 min-h-56 font-mono text-xs leading-5" readOnly value={SUPABASE_SQL} />
            )}
          </Panel>

          <Panel title="저장 히스토리">
            <div className="mb-3 grid grid-cols-2 gap-2">
              <button className="primary-btn" onClick={saveHistory} disabled={!composeGeneratedText(resultParts)}>현재 곡 저장</button>
              <button className="secondary-btn" onClick={loadHistory} disabled={isCloudMode && !user}>조회</button>
            </div>
            <div className="max-h-80 space-y-2 overflow-auto pr-1">
              {history.length ? history.map((item) => (
                <div key={item.id} className="rounded-md border border-[#ddd4c3] bg-[#fffdf8] p-3">
                  <button className="block w-full text-left text-sm font-bold text-[#2a241c]" onClick={() => openHistoryItem(item)}>
                    {item.title || 'Untitled'}
                  </button>
                  <div className="mt-1 text-xs text-[#62594b]">{new Date(item.created_at).toLocaleString()}</div>
                  <div className="mt-2 flex gap-2">
                    <button className="copy-btn" onClick={() => openHistoryItem(item)}>열기</button>
                    <button className="copy-btn" onClick={() => deleteHistoryItem(item.id)}>삭제</button>
                  </div>
                </div>
              )) : (
                <p className="text-sm leading-6 text-[#62594b]">
                  {isCloudMode ? '로그인 후 저장한 가사를 여기에서 다시 볼 수 있습니다.' : '저장하면 이 브라우저의 로컬 히스토리에 바로 쌓입니다.'}
                </p>
              )}
            </div>
          </Panel>

          <Panel title="지침서">
            <div className="space-y-2">
              {guides.map((guide) => (
                <div key={guide.id} className="rounded-md border border-[#ddd4c3] bg-[#fffdf8] p-3">
                  <label className="flex items-start gap-2 text-sm font-semibold">
                    <input type="checkbox" checked={activeGuideIds.includes(guide.id)} onChange={(event) => {
                      setActiveGuideIds((current) => event.target.checked ? [...current, guide.id] : current.filter((id) => id !== guide.id));
                    }} />
                    <span>{guide.title}</span>
                  </label>
                  <p className="mt-2 line-clamp-3 text-xs leading-5 text-[#62594b]">{guide.body}</p>
                  <button className="mt-2 text-xs font-semibold text-[#b23a48]" onClick={() => removeGuide(guide.id)}>삭제</button>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-2 border-t border-[#ddd4c3] pt-4">
              <input className="input" value={draftGuide.title} onChange={(event) => setDraftGuide({ ...draftGuide, title: event.target.value })} placeholder="새 지침서 제목" />
              <textarea className="input min-h-28" value={draftGuide.body} onChange={(event) => setDraftGuide({ ...draftGuide, body: event.target.value })} placeholder="작사 규칙, 금지어, 브랜드 톤, 구조 등을 입력" />
              <button className="primary-btn w-full" onClick={addGuide}>지침서 등록</button>
            </div>
          </Panel>
        </section>

        <section>
          <Panel title="곡 정보 입력">
            <div className="grid gap-3 md:grid-cols-2">
              <TextInput label="곡 제목" value={form.title} onChange={(value) => updateForm('title', value)} />
              <TextInput label="대상 툴" value={form.targetTool} onChange={(value) => updateForm('targetTool', value)} />
              <TextInput label="장르" value={form.genre} onChange={(value) => updateForm('genre', value)} />
              <TextInput label="분위기" value={form.mood} onChange={(value) => updateForm('mood', value)} />
              <SelectInput label="가사 언어" value={form.language} options={LANGUAGE_OPTIONS} onChange={(value) => updateForm('language', value)} />
              <TextInput label="보컬/톤" value={form.vocal} onChange={(value) => updateForm('vocal', value)} />
              <SelectInput label="보컬 구성" value={form.vocalGroup} options={VOCAL_GROUP_OPTIONS} onChange={(value) => updateForm('vocalGroup', value)} />
              <TextInput label="템포" value={form.tempo} onChange={(value) => updateForm('tempo', value)} />
              <TextInput label="구조" value={form.structure} onChange={(value) => updateForm('structure', value)} />
            </div>
            <label className="field-label mt-3">주제</label>
            <textarea className="input min-h-24" value={form.theme} onChange={(event) => updateForm('theme', event.target.value)} />
            <label className="field-label mt-3">추가 요청</label>
            <textarea className="input min-h-24" value={form.extra} onChange={(event) => updateForm('extra', event.target.value)} />
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="primary-btn" onClick={generate} disabled={isGenerating}>{isGenerating ? '생성 중...' : '프롬프트와 가사 생성'}</button>
              <button className="secondary-btn" onClick={() => setGeneratedText(makeFallback(form, guideText))}>샘플 생성</button>
            </div>
          </Panel>
        </section>

        <section>
          <Panel title="결과">
            <ResultField
              label="프롬프트"
              value={resultParts.prompt}
              minHeight="min-h-28"
              placeholder="Suno 스타일 프롬프트가 여기에 표시됩니다."
              onChange={(value) => updateResultPart('prompt', value)}
              onCopy={() => copyText('프롬프트', resultParts.prompt)}
            />
            <ResultField
              label="제목"
              value={resultParts.title}
              minHeight="min-h-12"
              placeholder="곡 제목"
              onChange={(value) => updateResultPart('title', value)}
              onCopy={() => copyText('제목', resultParts.title)}
            />
            <ResultField
              label="가사 편집"
              value={resultParts.lyrics}
              minHeight="min-h-[340px]"
              placeholder="섹션 태그가 포함된 가사가 여기에 표시됩니다. 직접 수정할 수 있습니다."
              onChange={(value) => updateResultPart('lyrics', value)}
              onCopy={() => copyText('가사', resultParts.lyrics)}
            />
            <ResultField
              label="메모"
              value={resultParts.notes}
              minHeight="min-h-24"
              placeholder="제작 메모 또는 API 오류가 표시됩니다."
              onChange={(value) => updateResultPart('notes', value)}
              onCopy={() => copyText('메모', resultParts.notes)}
            />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button className="secondary-btn" onClick={() => copyText('전체 결과', composeGeneratedText(resultParts))} disabled={!composeGeneratedText(resultParts)}>전체 복사</button>
              <button className="secondary-btn" onClick={clearResult}>비우기</button>
            </div>
          </Panel>
        </section>
      </div>
    </main>
  );
}

function Panel({ title, children }) {
  return (
    <div className="rounded-lg border border-[#d8d0c0] bg-white p-4 shadow-sm">
      <h2 className="mb-4 text-lg font-bold text-[#2a241c]">{title}</h2>
      {children}
    </div>
  );
}

function TextInput({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <input className="input" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SelectInput({ label, value, options, onChange }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <select className="input" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function ResultField({ label, value, placeholder, minHeight, onChange, onCopy }) {
  return (
    <div className="mb-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <label className="field-label mb-0">{label}</label>
        <button className="copy-btn" onClick={onCopy} disabled={!value.trim()}>복사</button>
      </div>
      <textarea
        className={`input ${minHeight} font-mono text-sm leading-6`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

export default App;
