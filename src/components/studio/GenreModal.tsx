'use client'

import { useState, useMemo } from 'react'
import { GENRE_CATEGORIES, GENRE_TRANSLATIONS } from '@/lib/constants/genres'
import { X, Search } from 'lucide-react'

interface GenreModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (genre: string) => void
  title: string
  selectedGenre: string
  uiLanguage?: string
}

export function GenreModal({ isOpen, onClose, onSelect, title, selectedGenre, uiLanguage = 'KO' }: GenreModalProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return GENRE_CATEGORIES

    const lowerQuery = searchQuery.toLowerCase()
    return GENRE_CATEGORIES.map(category => {
      return {
        ...category,
        genres: category.genres.filter(g => {
          const koName = g
          const enName = GENRE_TRANSLATIONS[g] || g
          return koName.toLowerCase().includes(lowerQuery) || enName.toLowerCase().includes(lowerQuery)
        })
      }
    }).filter(category => category.genres.length > 0)
  }, [searchQuery])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-4xl max-h-[85vh] bg-[#0d1311] border border-outline-variant/20 rounded-2xl shadow-2xl flex flex-col relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-outline-variant/10">
          <div>
            <h3 className="text-[#e3fe06] text-[10px] font-bold uppercase tracking-widest mb-1">GENRE LIBRARY</h3>
            <h2 className="text-xl font-bold text-white">{title}</h2>
          </div>
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-surface-container-low border border-outline-variant/20 hover:bg-surface-container hover:border-outline-variant/40 text-on-surface-variant hover:text-white rounded-lg font-bold text-sm transition-all"
          >
            {uiLanguage === 'KO' ? '닫기' : 'Close'}
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-4 border-b border-outline-variant/10 bg-surface-container-lowest/30">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
            <input 
              type="text"
              placeholder={uiLanguage === 'KO' ? "장르 검색" : "Search genres"}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl py-3.5 pl-12 pr-4 text-white placeholder-zinc-500 focus:outline-none focus:border-[#e3fe06]/50 focus:ring-1 focus:ring-[#e3fe06]/30 transition-all"
            />
          </div>
        </div>

        {/* Categories & Genres */}
        <div className="flex-1 overflow-y-auto p-6 pt-4 space-y-6 custom-scrollbar">
          {filteredCategories.length === 0 ? (
            <div className="text-center py-10 text-zinc-500">
              {uiLanguage === 'KO' ? '검색 결과가 없습니다.' : 'No results found.'}
            </div>
          ) : (
            filteredCategories.map((category, idx) => (
              <div key={idx} className="bg-surface-container-lowest border border-outline-variant/10 rounded-xl p-5">
                <h4 className="text-white font-bold text-sm mb-4">{category.name}</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
                  {category.genres.map((genre) => (
                    <button
                      key={genre}
                      onClick={() => onSelect(genre)}
                      className={`py-2.5 px-3 text-xs font-bold rounded-lg border transition-all text-left truncate ${
                        selectedGenre === genre
                          ? 'bg-[#e3fe06]/10 border-[#e3fe06]/50 text-[#e3fe06] shadow-[0_0_10px_rgba(227,254,6,0.1)]'
                          : 'bg-surface-container border-outline-variant/10 text-zinc-400 hover:bg-surface-container-high hover:border-outline-variant/30 hover:text-zinc-200'
                      }`}
                    >
                      {uiLanguage === 'KO' ? genre : (GENRE_TRANSLATIONS[genre] || genre)}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
