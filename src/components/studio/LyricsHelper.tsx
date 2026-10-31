'use client'

type Lang = 'KO' | 'JA' | 'EN'

export const LYRICS_MAX = 5000
export const SECTION_TAGS = ['Intro', 'Verse', 'Pre-Chorus', 'Chorus', 'Bridge', 'Outro', 'Instrumental'] as const
export const STRUCTURE_TEMPLATE = '[Intro]\n\n[Verse 1]\n\n[Pre-Chorus]\n\n[Chorus]\n\n[Verse 2]\n\n[Chorus]\n\n[Bridge]\n\n[Chorus]\n\n[Outro]\n'

/** 커서 위치에 섹션 태그를 끼운다 — 앞뒤 줄바꿈을 맞춘다 */
export function insertSection(text: string, tag: string, pos: number): { text: string; pos: number } {
  const before = text.slice(0, pos)
  const after = text.slice(pos)
  const lead = before === '' || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n'
  const ins = `${lead}[${tag}]\n`
  return { text: before + ins + after, pos: before.length + ins.length }
}

const T = {
  tags: { KO: '섹션 태그', JA: 'セクションタグ', EN: 'Section tags' },
  template: { KO: '구조 템플릿 넣기', JA: '構成テンプレート', EN: 'Insert structure' },
  chars: { KO: '글자', JA: '文字', EN: 'chars' },
  over: { KO: '길이 제한을 넘었습니다', JA: '文字数の上限を超えています', EN: 'Over the limit' },
  confirmTpl: { KO: '지금 가사가 있습니다. 구조 템플릿을 뒤에 덧붙일까요?', JA: '既存の歌詞の後ろにテンプレートを追加しますか？', EN: 'Append the template after the current lyrics?' },
}

export default function LyricsHelper({
  uiLanguage, value, onChange, getCursor,
}: {
  uiLanguage: Lang
  value: string
  onChange: (next: string, cursor?: number) => void
  getCursor: () => number
}) {
  const l = uiLanguage
  const over = value.length > LYRICS_MAX
  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label={T.tags[l]}>
      {SECTION_TAGS.map((tag) => (
        <button
          key={tag}
          type="button"
          onClick={() => {
            const r = insertSection(value, tag, getCursor())
            onChange(r.text, r.pos)
          }}
          className="px-2 py-1 rounded-lg border border-[#262626] bg-[#161616] text-[11px] font-bold text-zinc-300 hover:text-primary hover:border-primary/40 cursor-pointer"
        >
          [{tag}]
        </button>
      ))}
      <button
        type="button"
        onClick={() => {
          if (value.trim() && !window.confirm(T.confirmTpl[l])) return
          onChange(value.trim() ? `${value.replace(/\s+$/, '')}\n\n${STRUCTURE_TEMPLATE}` : STRUCTURE_TEMPLATE)
        }}
        className="px-2 py-1 rounded-lg border border-primary/40 text-[11px] font-bold text-primary hover:bg-primary/10 cursor-pointer"
      >
        {T.template[l]}
      </button>
      <span className={`ml-auto text-[11px] font-mono ${over ? 'text-red-400' : 'text-zinc-500'}`}>
        {value.length.toLocaleString()} / {LYRICS_MAX.toLocaleString()} {T.chars[l]}{over ? ` · ${T.over[l]}` : ''}
      </span>
    </div>
  )
}
