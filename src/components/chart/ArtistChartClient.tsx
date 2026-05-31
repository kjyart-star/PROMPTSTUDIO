'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Artist } from '@/types/music'
import { Trophy, ArrowLeft, Users, Plus, Check } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface ArtistChartClientProps {
  initialArtists: Artist[]
  currentUserId: string | null
}

const formatCount = (count: number) => {
  if (!count) return '0'
  if (count >= 1000000) {
    return (count / 1000000).toFixed(1).replace(/\.0$/, '') + 'M'
  }
  if (count >= 1000) {
    return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
  }
  return count.toLocaleString()
}

export function ArtistChartClient({
  initialArtists,
  currentUserId
}: ArtistChartClientProps) {
  const router = useRouter()
  const [artists, setArtists] = useState<Artist[]>(initialArtists)
  const [followedIds, setFollowedIds] = useState<string[]>([])
  const supabase = createClient()

  // Load followed artists on mount
  useEffect(() => {
    try {
      const savedFollows = localStorage.getItem('profile-followed-artists')
      if (savedFollows) {
        const parsed = JSON.parse(savedFollows)
        setFollowedIds(parsed.map((item: any) => item.id))
      }
    } catch (e) {
      console.error(e)
    }
  }, [])

  const handleFollowToggle = async (artist: Artist) => {
    try {
      const isFollowed = followedIds.includes(artist.id)
      const nextFollowed = !isFollowed

      // Update local storage followed artists
      const savedFollowsRaw = localStorage.getItem('profile-followed-artists')
      let parsedFollows = savedFollowsRaw ? JSON.parse(savedFollowsRaw) : []

      if (nextFollowed) {
        parsedFollows.push({
          id: artist.id,
          name: artist.name,
          slug: artist.slug || '',
          avatar_url: artist.avatar_url || '',
          bio: artist.bio || ''
        })
        setFollowedIds(prev => [...prev, artist.id])
      } else {
        parsedFollows = parsedFollows.filter((item: any) => item.id !== artist.id)
        setFollowedIds(prev => prev.filter(id => id !== artist.id))
      }
      localStorage.setItem('profile-followed-artists', JSON.stringify(parsedFollows))

      // Update target artist's follower count in UI state
      setArtists(prev => prev.map(a => {
        if (a.id === artist.id) {
          const currentFollowers = a.followers || 0
          return {
            ...a,
            followers: nextFollowed ? currentFollowers + 1 : Math.max(0, currentFollowers - 1)
          }
        }
        return a
      }))

      // Update current user following count in metadata
      if (currentUserId) {
        const extraKey = `profile-extra-${currentUserId}`
        const myExtraRaw = localStorage.getItem(extraKey)
        let myExtra = myExtraRaw ? JSON.parse(myExtraRaw) : {}
        let currentFollowing = myExtra.following !== undefined ? Number(myExtra.following) : 0
        myExtra.following = nextFollowed ? currentFollowing + 1 : Math.max(0, currentFollowing - 1)
        localStorage.setItem(extraKey, JSON.stringify(myExtra))
      }
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-[32px] py-10 space-y-8 font-sans">
      
      {/* Header and navigation */}
      <section className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-outline-variant/10 pb-6">
        <div className="flex items-center gap-4 text-left">
          <button 
            onClick={() => router.push('/')}
            className="w-10 h-10 rounded-full bg-surface-container-high hover:bg-surface-container-highest flex items-center justify-center text-on-surface transition-all active:scale-95 cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5 text-on-surface" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-on-surface flex items-center gap-2 uppercase tracking-wide">
              <Trophy className="w-6 h-6 text-primary shrink-0" />
              {uiLanguage === 'KO' ? 'BEATZ 랭킹차트' : 'BEATZ Ranking Chart'}
            </h1>
            {periodDate && (
              <p className="text-[10px] text-on-surface-variant/80 font-mono">
                {uiLanguage === 'KO' ? '마지막 업데이트 기준일:' : 'Last updated:'} {periodDate}
              </p>
            )}
          </div>
        </div>

        {/* Tab Controls (Music vs Artist Chart) */}
        <div className="flex bg-surface-container-low border border-outline-variant/20 p-1 rounded-xl">
          <Link
            href="/charts"
            className="px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 text-on-surface-variant hover:text-on-surface cursor-pointer"
          >
            {uiLanguage === 'KO' ? '음원 차트' : 'Track Chart'}
          </Link>
          <button
            className="px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 bg-primary text-[#080d08] shadow shadow-primary/10 cursor-pointer"
          >
            {uiLanguage === 'KO' ? '아티스트 차트' : 'Artist Chart'}
          </button>
        </div>
      </section>

      {/* Ranking List Table */}
      <section className="space-y-4">
        <div className="bg-surface-container-low border border-outline-variant/10 rounded-2xl overflow-hidden shadow-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-outline-variant/10 bg-surface-container-lowest/80 text-[10px] font-bold text-on-surface-variant/80 uppercase tracking-wider">
                <th className="py-4.5 px-6 w-20 text-center">{uiLanguage === 'KO' ? '순위' : 'Rank'}</th>
                <th className="py-4.5 px-4">{uiLanguage === 'KO' ? '아티스트 정보' : 'Artist Info'}</th>
                <th className="py-4.5 px-6">{uiLanguage === 'KO' ? '소개' : 'Bio'}</th>
                <th className="py-4.5 px-6 w-28 text-right">{uiLanguage === 'KO' ? '팔로워 수' : 'Followers'}</th>
                <th className="py-4.5 px-6 w-32 text-center">{uiLanguage === 'KO' ? '팔로우' : 'Follow'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03] text-xs">
              {artists.length > 0 ? (
                artists.map((artist, idx) => {
                  const isCurrent = currentUserId === artist.id
                  const isFollowed = followedIds.includes(artist.id)
                  const followerCount = artist.followers || 0

                  return (
                    <tr key={artist.id} className="hover:bg-white/[0.02] transition-all group">
                      {/* Rank */}
                      <td className="py-5 px-6 text-center w-20">
                        <span className="font-mono font-black text-sm text-on-surface">
                          {idx + 1}
                        </span>
                      </td>

                      {/* Artist Info */}
                      <td className="py-5 px-4">
                        <Link 
                          href={`/artists/${artist.slug}`} 
                          className="flex items-center gap-3.5 group/artist cursor-pointer"
                        >
                          <div className="w-12 h-12 rounded-full overflow-hidden bg-surface-container-lowest border border-outline-variant/10 flex items-center justify-center shrink-0">
                            {artist.avatar_url ? (
                              <img src={artist.avatar_url} alt="" className="w-full h-full object-cover group-hover/artist:scale-105 transition-transform" />
                            ) : (
                              <Users className="w-5 h-5 text-on-surface-variant/40" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold block text-sm text-on-surface group-hover/artist:text-primary transition-colors text-left">
                              {artist.name}
                            </span>
                            <span className="text-[10px] text-primary/70 font-mono block mt-0.5 font-bold text-left">
                              @{artist.slug}
                            </span>
                          </div>
                        </Link>
                      </td>

                      {/* Bio */}
                      <td className="py-5 px-6 max-w-xs md:max-w-md">
                        <p className="text-on-surface-variant/90 font-medium truncate text-left">
                          {artist.bio || (artist.is_user ? 'AI Creator' : 'AI Generated Artist')}
                        </p>
                      </td>

                      {/* Followers */}
                      <td className="py-5 px-6 text-right font-mono text-on-surface font-bold text-sm">
                        {formatCount(followerCount)}
                      </td>

                      {/* Follow Button */}
                      <td className="py-5 px-6 text-center w-32">
                        {isCurrent ? (
                          <span className="text-[10px] font-bold text-zinc-500 bg-white/5 border border-white/10 px-2.5 py-1.5 rounded-full select-none">
                            {uiLanguage === 'KO' ? '본인 채널' : 'My Channel'}
                          </span>
                        ) : (
                          <button
                            onClick={() => handleFollowToggle(artist)}
                            className={`px-4 py-1.5 rounded-full text-[10px] font-bold transition-all flex items-center justify-center gap-1 mx-auto cursor-pointer border ${
                              isFollowed
                                ? 'bg-primary text-black border-primary'
                                : 'bg-transparent text-white border-zinc-700 hover:border-white'
                            }`}
                          >
                            {isFollowed ? (
                              <>
                                <Check className="w-3 h-3" />
                                <span>{uiLanguage === 'KO' ? '팔로잉' : 'Following'}</span>
                              </>
                            ) : (
                              <>
                                <Plus className="w-3 h-3" />
                                <span>{uiLanguage === 'KO' ? '팔로우' : 'Follow'}</span>
                              </>
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-on-surface-variant/60">
                    <p className="font-medium text-sm text-on-surface-variant">{uiLanguage === 'KO' ? '집계된 차트 데이터가 없습니다.' : 'No chart data available.'}</p>
                    {isAdmin && (
                      <p className="text-xs text-zinc-650 mt-1">{uiLanguage === 'KO' ? '차트 관련 집계 배치가 실행되어야 합니다.' : 'Requires scheduler batch.'}</p>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  )
}
