'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Upload, Play, Pause, Download, Trash2, Sliders, Check, Settings2, FileAudio, RotateCcw, X } from 'lucide-react'
import { audioBufferToWav, estimateTruePeak } from '@/lib/audioUtils'

interface Track {
  id: string
  file: File
  name: string
  status: 'pending' | 'processing' | 'done' | 'error'
  progress: number
  originalBuffer?: AudioBuffer
  processedBuffer?: AudioBuffer
  processedBlob?: Blob
  processedUrl?: string
}

export function MasteringClient() {
  const [tracks, setTracks] = useState<Track[]>([])
  const [preset, setPreset] = useState('streaming')
  const [clarity, setClarity] = useState(55)
  const [warmth, setWarmth] = useState(48)
  const [width, setWidth] = useState(35)
  const [trimSilence, setTrimSilence] = useState(true)
  const [albumMatch, setAlbumMatch] = useState(true)
  const [truePeakGuard, setTruePeakGuard] = useState(true)
  const [isProcessingAll, setIsProcessingAll] = useState(false)
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null)

  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    return () => {
      if (audioContextRef.current?.state !== 'closed') {
        audioContextRef.current?.close()
      }
    }
  }, [])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files)
      if (tracks.length + newFiles.length > 30) {
        alert('최대 30곡까지만 업로드 가능합니다.')
        return
      }
      
      const newTracks: Track[] = newFiles.map(file => ({
        id: Math.random().toString(36).substr(2, 9),
        file,
        name: file.name,
        status: 'pending',
        progress: 0
      }))
      
      setTracks(prev => [...prev, ...newTracks])
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newFiles = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('audio/'))
      if (tracks.length + newFiles.length > 30) {
        alert('최대 30곡까지만 업로드 가능합니다.')
        return
      }
      
      const newTracks: Track[] = newFiles.map(file => ({
        id: Math.random().toString(36).substr(2, 9),
        file,
        name: file.name,
        status: 'pending',
        progress: 0
      }))
      
      setTracks(prev => [...prev, ...newTracks])
    }
  }

  const removeTrack = (id: string) => {
    setTracks(prev => prev.filter(t => t.id !== id))
    if (currentlyPlayingId === id) stopPlayback()
  }

  const clearAll = () => {
    setTracks([])
    stopPlayback()
  }

  const stopPlayback = () => {
    if (sourceNodeRef.current) {
      sourceNodeRef.current.stop()
      sourceNodeRef.current.disconnect()
      sourceNodeRef.current = null
    }
    setCurrentlyPlayingId(null)
  }

  const playPreview = async (track: Track, type: 'original' | 'processed') => {
    if (!audioContextRef.current) return
    
    if (currentlyPlayingId === track.id) {
      stopPlayback()
      return
    }

    stopPlayback()

    let buffer = type === 'processed' ? track.processedBuffer : track.originalBuffer
    
    if (!buffer && type === 'original') {
      const arrayBuffer = await track.file.arrayBuffer()
      buffer = await audioContextRef.current.decodeAudioData(arrayBuffer)
      setTracks(prev => prev.map(t => t.id === track.id ? { ...t, originalBuffer: buffer } : t))
    }

    if (buffer) {
      const source = audioContextRef.current.createBufferSource()
      source.buffer = buffer
      source.connect(audioContextRef.current.destination)
      source.start(0)
      sourceNodeRef.current = source
      setCurrentlyPlayingId(track.id)
      source.onended = () => {
        if (sourceNodeRef.current === source) {
          setCurrentlyPlayingId(null)
        }
      }
    }
  }

  const processAudio = async (track: Track): Promise<Track> => {
    if (!audioContextRef.current) return track

    try {
      let buffer = track.originalBuffer
      if (!buffer) {
        const arrayBuffer = await track.file.arrayBuffer()
        buffer = await audioContextRef.current.decodeAudioData(arrayBuffer)
      }

      // TODO: Implement actual offline processing based on preset and sliders
      // For now, just copy the buffer to simulate processing
      const offlineCtx = new OfflineAudioContext(buffer.numberOfChannels, buffer.length, buffer.sampleRate)
      const source = offlineCtx.createBufferSource()
      source.buffer = buffer
      
      // Simulate applying effects (EQ, Compressor)
      const highShelf = offlineCtx.createBiquadFilter()
      highShelf.type = 'highshelf'
      highShelf.frequency.value = 8000
      highShelf.gain.value = (clarity - 50) / 10

      const lowShelf = offlineCtx.createBiquadFilter()
      lowShelf.type = 'lowshelf'
      lowShelf.frequency.value = 150
      lowShelf.gain.value = (warmth - 50) / 10

      const compressor = offlineCtx.createDynamicsCompressor()
      compressor.threshold.value = preset === 'loud' ? -20 : -14
      compressor.ratio.value = preset === 'loud' ? 4 : 2
      
      source.connect(lowShelf)
      lowShelf.connect(highShelf)
      highShelf.connect(compressor)
      compressor.connect(offlineCtx.destination)
      
      source.start()
      
      const processedBuffer = await offlineCtx.startRendering()
      const wavBlob = audioBufferToWav(processedBuffer)
      const processedUrl = URL.createObjectURL(wavBlob)

      return {
        ...track,
        originalBuffer: buffer,
        processedBuffer,
        processedBlob: wavBlob,
        processedUrl,
        status: 'done',
        progress: 100
      }
    } catch (e) {
      console.error(e)
      return { ...track, status: 'error' }
    }
  }

  const processAll = async () => {
    setIsProcessingAll(true)
    for (let i = 0; i < tracks.length; i++) {
      if (tracks[i].status !== 'done') {
        setTracks(prev => prev.map((t, idx) => idx === i ? { ...t, status: 'processing', progress: 50 } : t))
        const processedTrack = await processAudio(tracks[i])
        setTracks(prev => prev.map((t, idx) => idx === i ? processedTrack : t))
      }
    }
    setIsProcessingAll(false)
  }

  const downloadAll = () => {
    tracks.forEach(track => {
      if (track.processedUrl) {
        const a = document.createElement('a')
        a.href = track.processedUrl
        a.download = `Mastered_${track.name.replace(/\.[^/.]+$/, "")}.wav`
        a.click()
      }
    })
  }

  return (
    <div className="w-full max-w-[1400px] mx-auto p-4 md:p-8 animate-in fade-in zoom-in-95 duration-500 text-white">
      <div className="mb-8">
        <h1 className="text-3xl font-black tracking-tight flex items-center gap-3 mb-2">
          <Settings2 className="w-8 h-8 text-primary" />
          Audio Batch Master
        </h1>
        <p className="text-zinc-400">최대 30곡을 한 번에 분석하고 마스터링하는 로컬 브라우저 툴입니다.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Controls Panel */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <div 
            className="border-2 border-dashed border-outline-variant/30 rounded-3xl p-8 flex flex-col items-center justify-center text-center bg-surface-container-low hover:bg-surface-container transition-colors cursor-pointer min-h-[200px]"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="audio/*" 
              multiple 
              onChange={handleFileChange}
            />
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mb-4">
              <Upload className="w-6 h-6 text-primary" />
            </div>
            <p className="font-bold mb-1">클릭하거나 파일을 드래그하여 업로드</p>
            <p className="text-xs text-zinc-500">WAV, MP3, FLAC 등 (최대 30곡)</p>
          </div>

          <div className="bg-[#121214] border border-outline-variant/10 rounded-3xl p-6 flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-zinc-400">마스터링 프리셋</label>
              <select 
                value={preset}
                onChange={(e) => setPreset(e.target.value)}
                className="bg-black border border-outline-variant/20 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary text-white"
              >
                <option value="streaming">스트리밍 균형형 (-14 LUFS 기준)</option>
                <option value="loud">모던 라우드 (-10 LUFS 기준)</option>
                <option value="clean">클린 다이내믹 (-16 LUFS 기준)</option>
                <option value="podcast">보이스 중심 (-15 LUFS 기준)</option>
              </select>
            </div>

            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-zinc-400">톤 선명도 (Clarity)</span>
                  <span className="text-primary">{clarity}%</span>
                </div>
                <input type="range" min="0" max="100" value={clarity} onChange={(e) => setClarity(Number(e.target.value))} className="accent-primary" />
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-zinc-400">저역 무게감 (Warmth)</span>
                  <span className="text-primary">{warmth}%</span>
                </div>
                <input type="range" min="0" max="100" value={warmth} onChange={(e) => setWarmth(Number(e.target.value))} className="accent-primary" />
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-zinc-400">스테레오 폭 (Width)</span>
                  <span className="text-primary">{width}%</span>
                </div>
                <input type="range" min="0" max="100" value={width} onChange={(e) => setWidth(Number(e.target.value))} className="accent-primary" />
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-4 border-t border-outline-variant/10">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={trimSilence} onChange={(e) => setTrimSilence(e.target.checked)} className="accent-primary w-4 h-4" />
                <span className="text-sm font-medium">앞뒤 무음 자동 정리</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={albumMatch} onChange={(e) => setAlbumMatch(e.target.checked)} className="accent-primary w-4 h-4" />
                <span className="text-sm font-medium">앨범 단위 볼륨/톤 통일</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={truePeakGuard} onChange={(e) => setTruePeakGuard(e.target.checked)} className="accent-primary w-4 h-4" />
                <span className="text-sm font-medium">True Peak 가드 적용</span>
              </label>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button 
                onClick={processAll}
                disabled={isProcessingAll || tracks.length === 0}
                className="w-full bg-primary text-black font-extrabold py-3.5 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50 transition-all hover:brightness-110"
              >
                {isProcessingAll ? <RotateCcw className="w-5 h-5 animate-spin" /> : <Sliders className="w-5 h-5" />}
                전체 마스터링 시작
              </button>
              
              <div className="flex gap-2">
                <button 
                  onClick={downloadAll}
                  disabled={!tracks.some(t => t.status === 'done')}
                  className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50 transition-all text-xs"
                >
                  <Download className="w-4 h-4" />
                  전체 다운로드
                </button>
                <button 
                  onClick={clearAll}
                  disabled={tracks.length === 0 || isProcessingAll}
                  className="bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold px-4 py-3 rounded-2xl flex items-center justify-center disabled:opacity-50 transition-all"
                  title="목록 비우기"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Queue Panel */}
        <div className="lg:col-span-2 bg-[#121214] border border-outline-variant/10 rounded-3xl p-6 flex flex-col h-full min-h-[600px]">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-outline-variant/10">
            <div>
              <p className="text-xs font-bold text-primary mb-1 uppercase tracking-wider">Batch Queue</p>
              <h2 className="text-xl font-bold">업로드한 곡 목록</h2>
            </div>
            <div className="px-3 py-1.5 rounded-full bg-black border border-outline-variant/20 text-sm font-bold">
              {tracks.length} / 30
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar flex flex-col gap-3">
            {tracks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-4 opacity-50">
                <FileAudio className="w-16 h-16" />
                <p>아직 추가된 곡이 없습니다.</p>
              </div>
            ) : (
              tracks.map((track) => (
                <div key={track.id} className="flex flex-col gap-3 p-4 rounded-2xl bg-black border border-outline-variant/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${track.status === 'done' ? 'bg-green-500' : track.status === 'processing' ? 'bg-primary animate-pulse' : track.status === 'error' ? 'bg-red-500' : 'bg-zinc-600'}`} />
                      <span className="font-bold text-sm truncate">{track.name}</span>
                    </div>
                    <button onClick={() => removeTrack(track.id)} className="text-zinc-500 hover:text-red-400 p-1">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {track.status === 'processing' && (
                    <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-primary h-full rounded-full transition-all duration-300" style={{ width: `${track.progress}%` }} />
                    </div>
                  )}

                  <div className="flex items-center gap-2 mt-1">
                    <button 
                      onClick={() => playPreview(track, 'original')}
                      className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-bold flex items-center gap-1.5 transition-colors"
                    >
                      {currentlyPlayingId === track.id && sourceNodeRef.current?.buffer === track.originalBuffer ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                      원본 듣기
                    </button>
                    <button 
                      onClick={() => playPreview(track, 'processed')}
                      disabled={track.status !== 'done'}
                      className="px-3 py-1.5 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 text-xs font-bold flex items-center gap-1.5 disabled:opacity-30 transition-colors"
                    >
                      {currentlyPlayingId === track.id && sourceNodeRef.current?.buffer === track.processedBuffer ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                      미리 듣기
                    </button>
                    {track.status === 'done' && track.processedUrl && (
                      <a 
                        href={track.processedUrl}
                        download={`Mastered_${track.name.replace(/\.[^/.]+$/, "")}.wav`}
                        className="ml-auto px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
                      >
                        <Download className="w-3 h-3" />
                        WAV 다운로드
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
