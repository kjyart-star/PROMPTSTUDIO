'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { X, Heart, ListMusic, Music, Info, Share2, MoreHorizontal, Plus, Search, Check, Disc3 } from 'lucide-react';
import { usePlayerStore } from '@/stores/playerStore';
import { createClient } from '@/lib/supabase/client';
import type { Track } from '@/types/music';
import { parsePlaylistDescription, serializePlaylistDescription } from '@/lib/utils';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';

export function NowPlayingPanel() {
  const {
    currentTrack,
    isPlaying,
    queue,
    queueIndex,
    isNowPlayingOpen,
    setNowPlayingOpen
  } = usePlayerStore();

  const [lang, setLang] = useState('KO');
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);

  const [showDropdown, setShowDropdown] = useState(false);
  const [showSubmenu, setShowSubmenu] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [userPlaylists, setUserPlaylists] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Custom alert/prompt states
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [promptModal, setPromptModal] = useState<{
    isOpen: boolean;
    title: string;
    placeholder: string;
    onConfirm: (val: string) => void;
  } | null>(null);
  const [promptInputValue, setPromptInputValue] = useState('');

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 2500);
  };

  // Reset searchQuery on dropdown close
  useEffect(() => {
    if (!showDropdown) {
      setSearchQuery('');
      setShowSubmenu(false);
    }
  }, [showDropdown]);


  // Sync language
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedLang = localStorage.getItem('language') || 'KO';
    setLang(storedLang.toUpperCase());

    const handleLangChange = (e: any) => {
      setLang(e.detail.toUpperCase());
    };
    window.addEventListener('languageChange', handleLangChange);
    return () => window.removeEventListener('languageChange', handleLangChange);
  }, []);

  // Fetch liked state from Supabase when currentTrack changes
  useEffect(() => {
    if (!currentTrack) return;
    
    // Reset status
    setIsLiked(false);
    setLikeCount(currentTrack.like_count || 0);

    const checkLikedStatus = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('song_history')
        .select('liked, form')
        .eq('id', currentTrack.id)
        .maybeSingle();

      if (!error && data) {
        setIsLiked(!!data.liked);
        if (data.form?.like_count !== undefined) {
          setLikeCount(Number(data.form.like_count));
        }
      }
    };

    checkLikedStatus();
  }, [currentTrack?.id]);

  // Click outside dropdown handler
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
        setShowSubmenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        setShowDropdown(false)
        setShowSubmenu(false)
      }
    }
    window.addEventListener('pageshow', handlePageShow)
    return () => window.removeEventListener('pageshow', handlePageShow)
  }, [])

  if (!isNowPlayingOpen) return null;

  // Fallback default track if none is active
  const DEFAULT_TRACK: Track = {
    id: 'dummy-1',
    album_id: 'dummy-album-1',
    track_number: 1,
    title: 'Electric Dreams',
    file_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    duration_sec: 222,
    file_size: null,
    waveform_data: null,
    bpm: null,
    song_key: null,
    prompt_meta: null,
    like_count: 3421,
    play_count: 12000,
    status: 'published',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    lyrics: 'Neon lights reflecting on the glass\nSpeeding through the future, moving fast\nDigital dreams and electric hearts\nThis is where the real life starts',
    style_prompt: 'cyberpunk synthwave high energy female vocal future bass retro 80s',
    lyricist: 'Acorn Joey',
    composer: 'Acorn Joey',
    arranger: 'GenerativeAI',
    album: {
      id: 'dummy-album-1',
      slug: 'neonecho',
      artist_id: 'neonecho',
      title: 'Electric Dreams (Single)',
      release_type: 'single',
      cover_url: '/images/vanguard_cover.png',
      release_date: new Date().toISOString(),
      genres: ['Synthwave'],
      moods: ['Energetic'],
      description: 'Retro futuristic sounds',
      status: 'published',
      generation_tool: 'Suno AI',
      total_plays: 12000,
      total_likes: 3421,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      artist: {
        id: 'neonecho',
        slug: 'neonecho',
        name: 'Neon Echo',
        bio: 'Neon Echo is an AI-native project exploring high-energy electronic soundscapes, nostalgic synth frequencies, and futuristic melodies.',
        avatar_url: '/images/vanguard_cover.png',
        banner_url: null,
        links: null,
        is_ai_generated: true,
        owner_user_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    }
  };

  const track = currentTrack || DEFAULT_TRACK;
  const nextTrack = queueIndex >= 0 && queueIndex < queue.length - 1 ? queue[queueIndex + 1] : null;

  const handleLikeClick = async () => {
    if (!track.id || track.id === 'dummy-1') return;

    try {
      // Optimitic update
      const prevLiked = isLiked;
      setIsLiked(!prevLiked);
      setLikeCount((prev) => (prevLiked ? Math.max(0, prev - 1) : prev + 1));

      const res = await fetch('/api/likes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ track_id: track.id })
      });

      if (!res.ok) {
        // Rollback on error
        setIsLiked(prevLiked);
        setLikeCount((prev) => (prevLiked ? prev + 1 : Math.max(0, prev - 1)));
      } else {
        const data = await res.json();
        setIsLiked(!!data.liked);
        setLikeCount(Number(data.like_count));
        
        // Dispatch custom event to sync like lists on main components
        window.dispatchEvent(new CustomEvent('likeStateChanged', {
          detail: { trackId: track.id, liked: !!data.liked, likeCount: data.like_count }
        }));
      }
    } catch (e) {
      console.error('Error toggling like:', e);
    }
  };





  const fetchPlaylists = async () => {
    try {
      const res = await fetch('/api/playlists');
      if (res.ok) {
        const data = await res.json();
        const filtered = data.filter((pl: any) => {
          const info = parsePlaylistDescription(pl.description);
          return info.type === 'playlist';
        });
        setUserPlaylists(filtered);
      }
    } catch (e) {
      console.error('Error fetching playlists in NowPlayingPanel:', e);
    }
  };

  const addTrackToPlaylist = async (playlistId: string) => {
    if (!track || !track.id || track.id === 'dummy-1') return;
    
    try {
      const supabase = createClient();
      
      const { error } = await supabase
        .from('song_history')
        .update({ playlist_id: playlistId })
        .eq('id', track.id);
        
      if (error) {
        console.error('Error adding track to playlist:', error);
        showToast(lang === 'KO' ? '플레이리스트에 곡을 추가하는 데 실패했습니다.' : 'Failed to add track to playlist.', 'error');
      } else {
        showToast(lang === 'KO' ? '플레이리스트에 곡이 추가되었습니다.' : 'Track added to playlist successfully.', 'success');
        setShowDropdown(false);
        setShowSubmenu(false);
        window.dispatchEvent(new CustomEvent('playlistTrackChanged'));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const createPlaylistAndAddTrack = async () => {
    if (!track || !track.id || track.id === 'dummy-1') return;
    
    setPromptInputValue('');
    setPromptModal({
      isOpen: true,
      title: lang === 'KO' ? '새 플레이리스트 생성' : 'Create New Playlist',
      placeholder: lang === 'KO' ? '새 플레이리스트 이름을 입력하세요' : 'Enter new playlist name',
      onConfirm: async (titleVal) => {
        if (!titleVal || !titleVal.trim()) return;

        try {
          const supabase = createClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            showToast(lang === 'KO' ? '로그인이 필요합니다.' : 'Login required.', 'error');
            return;
          }

          const description = serializePlaylistDescription('playlist', '');
          const { data: playlist, error: playlistError } = await supabase
            .from('user_playlists')
            .insert({
              user_id: user.id,
              title: titleVal.trim(),
              cover_url: '/default-album.png',
              description: description,
              genre: 'Pop',
              is_published: false
            })
            .select()
            .single();

          if (playlistError || !playlist) {
            console.error('Error creating playlist:', playlistError);
            showToast(lang === 'KO' ? '플레이리스트 생성에 실패했습니다.' : 'Failed to create playlist.', 'error');
            return;
          }

          const { error: trackError } = await supabase
            .from('song_history')
            .update({ playlist_id: playlist.id })
            .eq('id', track.id);

          if (trackError) {
            console.error('Error adding track to new playlist:', trackError);
            showToast(lang === 'KO' ? '플레이리스트는 생성되었으나 곡 추가에 실패했습니다.' : 'Playlist created, but failed to add track.', 'error');
          } else {
            showToast(lang === 'KO' ? '새 플레이리스트가 생성되고 곡이 추가되었습니다.' : 'New playlist created and track added successfully.', 'success');
            setShowDropdown(false);
            setShowSubmenu(false);
            fetchPlaylists();
            window.dispatchEvent(new CustomEvent('playlistTrackChanged'));
          }
        } catch (e) {
          console.error(e);
        }
      }
    });
  };

  const addToQueue = (trackToQueue: Track) => {
    const store = usePlayerStore.getState();
    const isAlreadyInQueue = store.queue.some(t => t.id === trackToQueue.id);
    if (isAlreadyInQueue) {
      showToast(lang === 'KO' ? '이미 대기열에 있는 곡입니다.' : 'Already in queue.', 'info');
      return;
    }
    usePlayerStore.setState({
      queue: [...store.queue, trackToQueue]
    });
    showToast(lang === 'KO' ? '재생목록 대기열에 추가되었습니다.' : 'Added to play queue.', 'success');
  };

  return (
    <>
      <aside 
        className="fixed right-0 top-0 h-[calc(100vh-96px)] w-[360px] z-40 bg-background border-l border-outline-variant/10 flex flex-col shadow-2xl overflow-visible animate-slide-in-right"
        style={{
          boxShadow: '-10px 0 30px rgba(0,0,0,0.5)'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#282828] bg-background/65 sticky top-0 z-10 backdrop-blur-md relative">
          <h2 className="text-sm font-bold text-on-surface truncate pr-4">
            {track.album?.title || (lang === 'KO' ? '정보' : 'Details')}
          </h2>
          <div className="flex items-center gap-2">
            {/* More options button wrapper with hover activation */}
            <div 
              className="relative"
            >
              <button 
                onClick={() => {
                  setShowDropdown(!showDropdown);
                  if (!showDropdown) {
                    fetchPlaylists();
                  }
                }}
                className={`text-on-surface-variant hover:text-on-surface p-1.5 rounded-full hover:bg-white/[0.04] transition-all cursor-pointer flex items-center justify-center ${showDropdown ? 'text-primary bg-white/[0.04]' : ''}`}
                title={lang === 'KO' ? '더 보기' : 'More options'}
              >
                <MoreHorizontal className="w-5 h-5" />
              </button>

              {/* Dropdown Menu */}
              {showDropdown && (
                <div 
                  ref={dropdownRef}
                  className="absolute right-0 top-full mt-2 w-56 bg-[#282828] border border-zinc-800 rounded-lg shadow-2xl z-50 p-1 flex flex-col text-xs font-bold text-zinc-200 select-none animate-in fade-in slide-in-from-top-2 duration-100"
                >
                  {/* 플레이리스트에 추가하기 (Trigger sub-menu on hover) */}
                  <div 
                    className="relative"
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowSubmenu(!showSubmenu);
                        if (!showSubmenu) fetchPlaylists();
                      }}
                      className={`w-full text-left px-3 py-2.5 rounded hover:bg-white/10 hover:text-white flex items-center justify-between cursor-pointer ${showSubmenu ? 'bg-white/10 text-white' : ''}`}
                    >
                      <span className="flex items-center gap-2">
                        <Plus className="w-4 h-4" />
                        {lang === 'KO' ? '플레이리스트에 추가하기' : 'Add to playlist'}
                      </span>
                      <span className="text-zinc-400 font-mono text-[10px]">▶</span>
                    </button>

                    {/* Submenu: Playlist List (Absolute Position next to the main dropdown) */}
                    {showSubmenu && (
                      <div 
                        className="absolute right-[224px] top-0 w-56 bg-[#282828] border border-zinc-800 rounded-lg shadow-2xl z-50 p-1.5 flex flex-col gap-1 text-xs font-bold text-zinc-200"
                      >
                        {/* Search playlist */}
                        <div className="relative px-1 py-1">
                          <input
                            type="text"
                            placeholder={lang === 'KO' ? '플레이리스트 찾기' : 'Search playlist'}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onClick={(e) => e.stopPropagation()} // Prevent closing
                            className="w-full bg-[#3e3e3e] text-white border-none rounded px-2.5 py-1.5 pl-7 text-[11px] placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-3.5" />
                        </div>

                        <div className="border-b border-zinc-800 my-0.5"></div>

                        {/* 새 플레이리스트 생성 버튼 */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            createPlaylistAndAddTrack();
                          }}
                          className="w-full text-left px-3 py-2 rounded hover:bg-white/10 hover:text-white flex items-center gap-2 cursor-pointer text-[#e3fe06]"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          {lang === 'KO' ? '새 플레이리스트' : 'New playlist'}
                        </button>

                        <div className="border-b border-zinc-800 my-0.5"></div>

                        {/* Playlist scroll list */}
                        <div className="max-h-48 overflow-y-auto custom-scrollbar flex flex-col gap-0.5 pr-0.5">
                          {userPlaylists
                            .filter(pl => pl.title.toLowerCase().includes(searchQuery.toLowerCase()))
                            .map(pl => (
                              <button
                                key={pl.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  addTrackToPlaylist(pl.id);
                                }}
                                className="w-full text-left px-3 py-2 rounded hover:bg-white/10 hover:text-white truncate cursor-pointer flex items-center justify-between text-zinc-200"
                              >
                                <span className="truncate">{pl.title}</span>
                                {track.album_id === pl.id && (
                                  <Check className="w-3.5 h-3.5 text-primary shrink-0 ml-1.5" />
                                )}
                              </button>
                            ))}
                          {userPlaylists.filter(pl => pl.title.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                            <div className="text-center py-3 text-zinc-500 text-[10px]">
                              {lang === 'KO' ? '검색 결과가 없습니다' : 'No playlists found'}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 좋아요 표시한 곡에 추가 / 삭제 */}
                  <button
                    onClick={() => {
                      handleLikeClick();
                      setShowDropdown(false);
                    }}
                    className="w-full text-left px-3 py-2.5 rounded hover:bg-white/10 hover:text-white flex items-center gap-2 cursor-pointer text-zinc-200"
                  >
                    {isLiked ? (
                      <>
                        <Check className="w-4 h-4 text-primary" />
                        <span>{lang === 'KO' ? '좋아요 표시한 곡에서 삭제하기' : 'Remove from Liked Songs'}</span>
                      </>
                    ) : (
                      <>
                        <Heart className="w-4 h-4" />
                        <span>{lang === 'KO' ? '좋아요 표시한 곡에 추가하기' : 'Add to Liked Songs'}</span>
                      </>
                    )}
                  </button>

                  {/* 재생목록에 추가하기 */}
                  <button
                    onClick={() => {
                      addToQueue(track);
                      setShowDropdown(false);
                    }}
                    className="w-full text-left px-3 py-2.5 rounded hover:bg-white/10 hover:text-white flex items-center gap-2 cursor-pointer text-zinc-200"
                  >
                    <ListMusic className="w-4 h-4" />
                    <span>{lang === 'KO' ? '재생목록에 추가하기' : 'Add to queue'}</span>
                  </button>

                  <div className="border-b border-zinc-800 my-0.5 mx-2"></div>

                  {/* 앨범 보러가기 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDropdown(false);
                      const slug = track.album?.slug || track.album_id;
                      if (slug && slug !== 'loose') {
                        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
                        if (isUUID) {
                          if (typeof window !== 'undefined') window.location.href = `/profile?tab=albums&playlistId=${slug}`
                        } else {
                          const artistSlug = track.album?.artist?.slug || (track as any).artist?.slug || 'suno-ai';
                          if (typeof window !== 'undefined') window.location.href = `/albums/${slug}?artist=${artistSlug}`
                        }
                      } else {
                        setShowConfirm(true);
                      }
                      setShowDropdown(false);
                    }}
                    className="w-full text-left px-3 py-2.5 rounded hover:bg-white/10 hover:text-white flex items-center gap-2 cursor-pointer text-zinc-200"
                  >
                    <Disc3 className="w-4 h-4" />
                    <span>{lang === 'KO' ? '앨범 보러가기' : 'Go to album'}</span>
                  </button>

                  {/* 크레딧 보기 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      alert(lang === 'KO' ? '크레딧 기능은 준비중입니다.' : 'Credits feature coming soon.')
                      setShowDropdown(false);
                    }}
                    className="w-full text-left px-3 py-2.5 rounded hover:bg-white/10 hover:text-white flex items-center gap-2 cursor-pointer text-zinc-200"
                  >
                    <Info className="w-4 h-4" />
                    <span>{lang === 'KO' ? '크레딧 보기' : 'Show credits'}</span>
                  </button>

                  {/* 공유 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const url = typeof window !== 'undefined' ? window.location.href : '';
                      navigator.clipboard.writeText(`${url} (Track: ${track.title})`);
                      alert(lang === 'KO' ? '주소가 복사되었습니다.' : 'Link copied to clipboard.');
                      setShowDropdown(false);
                    }}
                    className="w-full text-left px-3 py-2.5 rounded hover:bg-white/10 hover:text-white flex items-center gap-2 cursor-pointer text-zinc-200"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>{lang === 'KO' ? '공유 (주소 복사)' : 'Share'}</span>
                  </button>
                </div>
              )}
            </div>

            <button 
              onClick={() => setNowPlayingOpen(false)}
              className="text-on-surface-variant hover:text-on-surface p-1.5 rounded-full hover:bg-white/[0.04] transition-all cursor-pointer flex items-center justify-center"
              title={lang === 'KO' ? '닫기' : 'Close'}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>


        {/* Scrollable Container */}
        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
          
          {/* Full-width Cover Art with Gradient Bottom Overlay */}
          <div className="relative w-full aspect-square bg-surface-container-low shrink-0">
            <img 
              src={track.album?.cover_url || '/default-album.png'} 
              alt={track.title}
              className="w-full h-full object-cover"
            />
            {/* Bottom Gradient Fade */}
            <div className="absolute inset-x-0 bottom-[-2px] h-1/2 bg-gradient-to-t from-background via-background/60 to-transparent pointer-events-none" />
          </div>

          {/* Padded Content Area */}
          <div className="px-5 pb-8 pt-4 flex flex-col gap-6">
            {/* Title & Heart Button Row */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {/* Original Track Thumbnail */}
                {track.image_url && (
                  <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-zinc-800 bg-zinc-950 shadow-md">
                    <img 
                      src={track.image_url} 
                      alt="Original Track Cover" 
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = "/default-album.png";
                      }}
                    />
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className="text-xl font-extrabold text-on-surface tracking-tight hover:underline cursor-pointer truncate">
                    {track.title}
                  </h3>
                  <Link
                    href={`/artists/${track.album?.artist?.slug || 'suno-ai'}`}
                    onClick={() => setNowPlayingOpen(false)}
                    className="block text-sm font-bold text-on-surface-variant/80 hover:text-on-surface hover:underline truncate mt-0.5"
                  >
                    {track.album?.artist?.name || 'Suno AI'}
                  </Link>
                </div>
              </div>
              <button 
                onClick={handleLikeClick}
                className={`p-2 rounded-full hover:bg-white/[0.04] transition-all shrink-0 cursor-pointer ${
                  isLiked ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <Heart className={`w-6 h-6 ${isLiked ? 'fill-current' : ''}`} />
              </button>
            </div>

          {/* Lyrics Section */}
          <div className="rounded-2xl p-5 bg-[#121214] border border-outline-variant/5 flex flex-col gap-3 relative overflow-hidden shadow-lg group">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black tracking-widest text-[#e3fe06] uppercase">
                {lang === 'KO' ? '가사' : 'Lyrics'}
              </h4>
            </div>
            <div className="max-h-64 overflow-y-auto custom-scrollbar text-sm font-bold leading-relaxed text-zinc-300 pr-1 select-text whitespace-pre-wrap">
              {track.lyrics ? (
                track.lyrics
              ) : (
                <span className="text-xs text-on-surface-variant/60 font-semibold italic">
                  {lang === 'KO' ? '등록된 가사가 없습니다.' : 'No lyrics available for this track.'}
                </span>
              )}
            </div>
          </div>



          {/* Artist Biography Card ("아티스트 상세정보") */}
          <div className="rounded-2xl overflow-hidden border border-outline-variant/10 bg-[#121214] shadow-lg relative group flex flex-col">
            {/* Artist Card Header Visual */}
            <Link 
              href={`/artists/${track.album?.artist?.slug || 'suno-ai'}`}
              onClick={() => setNowPlayingOpen(false)}
              className="h-28 w-full relative overflow-hidden bg-gradient-to-b from-[#e3fe06]/10 to-transparent block hover:opacity-90 transition-opacity"
            >
              <img 
                src={track.album?.cover_url || '/default-album.png'} 
                alt={track.album?.artist?.name || 'Suno AI'}
                className="w-full h-full object-cover opacity-20 blur-[6px] scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#121214] via-transparent to-transparent" />
              <span className="absolute top-4 left-4 text-[9px] font-black tracking-wider text-[#e3fe06] bg-[#e3fe06]/10 px-2 py-0.5 rounded border border-[#e3fe06]/20">
                {lang === 'KO' ? '아티스트 상세정보' : 'ARTIST DETAIL'}
              </span>
            </Link>

            <div className="p-5 -mt-6 relative z-10 flex flex-col gap-3">
              <Link 
                href={`/artists/${track.album?.artist?.slug || 'suno-ai'}`}
                onClick={() => setNowPlayingOpen(false)}
                className="flex items-center gap-3 group/artist hover:opacity-80 transition-opacity"
              >
                <div className="w-12 h-12 rounded-full overflow-hidden border border-outline-variant/20 shrink-0 bg-surface-container-high">
                  <img 
                    src={track.album?.artist?.avatar_url || track.album?.cover_url || '/default-album.png'} 
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <h4 className="font-extrabold text-sm text-on-surface truncate group-hover/artist:underline">
                    {track.album?.artist?.name || 'Suno AI'}
                  </h4>
                  <p className="text-[10px] font-extrabold text-on-surface-variant mt-0.5">
                    {lang === 'KO' ? `리스너 ${likeCount * 7 + 12}명` : `${likeCount * 7 + 12} Monthly Listeners`}
                  </p>
                </div>
              </Link>

              <p className="text-xs text-on-surface-variant leading-relaxed font-medium line-clamp-3">
                {track.album?.artist?.bio || (lang === 'KO' ? 
                  '쿠키뮤직에서 생성된 선도적인 AI 아티스트입니다. 다양한 장르의 세련된 비트와 멜로디를 제공합니다.' :
                  'A leading AI Artist generated on CookieMusic, creating unique vibes across multiple genres.')}
              </p>

              <button 
                onClick={() => setIsFollowing(!isFollowing)}
                className={`w-full py-2 rounded-xl text-xs font-black transition-all border cursor-pointer ${
                  isFollowing 
                    ? 'bg-transparent border-outline-variant/30 text-on-surface hover:border-on-surface' 
                    : 'bg-on-surface text-surface border-transparent hover:scale-[1.02] active:scale-[0.98]'
                }`}
              >
                {isFollowing ? (lang === 'KO' ? '팔로잉' : 'Following') : (lang === 'KO' ? '팔로우하기' : 'Follow')}
              </button>
            </div>
          </div>

          {/* Credits Card ("크레딧") */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
              <h4 className="text-xs font-black tracking-widest text-[#e3fe06] uppercase">
                {lang === 'KO' ? '크레딧' : 'Credits'}
              </h4>
            </div>
            
            <div className="flex flex-col gap-2">
              {/* Main Artist */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.02] border border-outline-variant/5 hover:bg-white/[0.04] transition-all">
                <Link 
                  href={`/artists/${track.album?.artist?.slug || 'suno-ai'}`}
                  onClick={() => setNowPlayingOpen(false)}
                  className="min-w-0 flex-1 hover:opacity-85"
                >
                  <p className="text-xs font-bold text-on-surface truncate hover:underline">
                    {track.album?.artist?.name || 'Suno AI'}
                  </p>
                  <p className="text-[10px] font-bold text-on-surface-variant/75 mt-0.5">
                    {lang === 'KO' ? '메인 아티스트' : 'Main Artist'}
                  </p>
                </Link>
                <button 
                  onClick={() => setIsFollowing(!isFollowing)}
                  className="text-[10px] font-extrabold text-[#e3fe06] hover:underline px-2.5 py-1 rounded bg-[#e3fe06]/5 border border-[#e3fe06]/15 hover:bg-[#e3fe06]/10 shrink-0 transition-all cursor-pointer"
                >
                  {isFollowing ? (lang === 'KO' ? '팔로잉' : 'Following') : (lang === 'KO' ? '팔로우하기' : 'Follow')}
                </button>
              </div>

              {/* Lyricist */}
              {track.lyricist && (
                <div className="flex flex-col p-3.5 rounded-xl bg-white/[0.02] border border-outline-variant/5 hover:bg-white/[0.04] transition-all">
                  <p className="text-xs font-bold text-on-surface truncate">{track.lyricist}</p>
                  <p className="text-[10px] font-bold text-on-surface-variant/75 mt-0.5">
                    {lang === 'KO' ? '작사' : 'Lyricist'}
                  </p>
                </div>
              )}

              {/* Composer */}
              {track.composer && (
                <div className="flex flex-col p-3.5 rounded-xl bg-white/[0.02] border border-outline-variant/5 hover:bg-white/[0.04] transition-all">
                  <p className="text-xs font-bold text-on-surface truncate">{track.composer}</p>
                  <p className="text-[10px] font-bold text-on-surface-variant/75 mt-0.5">
                    {lang === 'KO' ? '작곡' : 'Composer'}
                  </p>
                </div>
              )}

              {/* Arranger */}
              {track.arranger && (
                <div className="flex flex-col p-3.5 rounded-xl bg-white/[0.02] border border-outline-variant/5 hover:bg-white/[0.04] transition-all">
                  <p className="text-xs font-bold text-on-surface truncate">{track.arranger}</p>
                  <p className="text-[10px] font-bold text-on-surface-variant/75 mt-0.5">
                    {lang === 'KO' ? '편곡' : 'Arranger'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Next Up Section ("다음 재생 항목") */}
          {nextTrack && (
            <div className="flex flex-col gap-3 mt-2">
              <div className="flex items-center justify-between px-1">
                <h4 className="text-xs font-black tracking-widest text-[#e3fe06] uppercase">
                  {lang === 'KO' ? '다음 재생 항목' : 'Next Up'}
                </h4>
                <span className="text-[10px] font-extrabold text-[#e3fe06] cursor-pointer hover:underline flex items-center gap-1">
                  <ListMusic className="w-3.5 h-3.5" />
                  {lang === 'KO' ? '재생목록 열기' : 'Queue'}
                </span>
              </div>
              
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-outline-variant/5 hover:bg-white/[0.04] transition-all">
                <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 shadow bg-surface-container-low border border-outline-variant/10">
                  <img 
                    src={nextTrack.album?.cover_url || '/default-album.png'} 
                    alt="" 
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-on-surface truncate">{nextTrack.title}</p>
                  <Link
                    href={`/artists/${nextTrack.album?.artist?.slug || 'suno-ai'}`}
                    onClick={() => setNowPlayingOpen(false)}
                    className="block text-[10px] font-semibold text-on-surface-variant/80 hover:text-on-surface hover:underline truncate mt-0.5"
                  >
                    {nextTrack.album?.artist?.name || 'Suno AI'}
                  </Link>
                </div>
              </div>
            </div>
          )}

          </div>
        </div>
      </aside>

      {/* Custom Toast Notification */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 bg-[#18181a]/95 backdrop-blur-md px-5 py-3.5 rounded-xl border border-zinc-800 shadow-[0_8px_30px_rgb(0,0,0,0.6)] animate-in fade-in slide-in-from-top-4 duration-300">
          {toast.type === 'success' && (
            <div className="bg-[#e3fe06]/10 p-1.5 rounded-lg border border-[#e3fe06]/20">
              <Check className="w-4 h-4 text-[#e3fe06]" />
            </div>
          )}
          {toast.type === 'error' && (
            <div className="bg-red-500/10 p-1.5 rounded-lg border border-red-500/20">
              <X className="w-4 h-4 text-red-500" />
            </div>
          )}
          {toast.type === 'info' && (
            <div className="bg-blue-500/10 p-1.5 rounded-lg border border-blue-500/20">
              <Info className="w-4 h-4 text-blue-500" />
            </div>
          )}
          <span className="text-sm font-bold text-zinc-100">{toast.message}</span>
        </div>
      )}

      {/* Custom Prompt Modal */}
      {promptModal?.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            onClick={() => setPromptModal(null)}
          />
          
          {/* Modal Container */}
          <div className="relative w-[380px] bg-[#18181a] border border-zinc-800 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden animate-in fade-in zoom-in-95 duration-200 p-6 flex flex-col gap-5 z-10">
            {/* Accent line */}
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-[#e3fe06] to-[#baff00]" />
            
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-zinc-100 tracking-wider uppercase">
                {promptModal.title}
              </h3>
              <button 
                onClick={() => setPromptModal(null)}
                className="text-zinc-500 hover:text-zinc-300 p-1 rounded-lg hover:bg-white/5 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex flex-col gap-2">
              <input
                type="text"
                autoFocus
                placeholder={promptModal.placeholder}
                value={promptInputValue}
                onChange={(e) => setPromptInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    promptModal.onConfirm(promptInputValue);
                    setPromptModal(null);
                  } else if (e.key === 'Escape') {
                    setPromptModal(null);
                  }
                }}
                className="w-full bg-[#242426] text-white border border-zinc-800 rounded-xl px-4 py-3 text-xs placeholder-zinc-500 focus:outline-none focus:border-[#e3fe06] transition-all"
              />
            </div>
            
            <div className="flex items-center justify-end gap-2.5 mt-2">
              <button
                onClick={() => setPromptModal(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-all cursor-pointer"
              >
                {lang === 'KO' ? '취소' : 'Cancel'}
              </button>
              <button
                onClick={() => {
                  promptModal.onConfirm(promptInputValue);
                  setPromptModal(null);
                }}
                className="bg-[#e3fe06] hover:bg-[#baff00] active:scale-95 text-black px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer shadow-md"
              >
                {lang === 'KO' ? '생성' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      <ConfirmDialog
        isOpen={showConfirm}
        title={lang === 'KO' ? '채널로 이동' : 'Go to Channel'}
        message={lang === 'KO' ? '해당 음원은 연결된 앨범이 없습니다.\n제작자 채널로 이동하시겠습니까?' : "This track does not have an associated album.\nGo to the creator's channel?"}
        onConfirm={() => {
          const artistSlug = track.album?.artist?.slug || (track as any).artist?.slug || 'suno-ai';
          if (typeof window !== 'undefined') {
            window.location.href = `/artists/${artistSlug}`;
          }
          setShowConfirm(false);
        }}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  );
}
