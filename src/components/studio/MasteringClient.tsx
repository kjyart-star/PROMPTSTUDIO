'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Upload, Play, Pause, Download, Trash2, Sliders, Settings2, FileAudio, RotateCcw, X, Activity, Maximize2, Gauge, Check, RefreshCw, ListFilter } from 'lucide-react'
import { audioBufferToWav, estimateTruePeak, makeDistortionCurve, makeSoftClipCurve } from '@/lib/audioUtils'

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
  
  // Mastering Parameters
  const [activeTemplate, setActiveTemplate] = useState('streaming')
  const [preset, setPreset] = useState('streaming') // Used for compressor threshold target
  const [clarity, setClarity] = useState(50)
  const [warmth, setWarmth] = useState(50)
  const [saturation, setSaturation] = useState(0)
  const [width, setWidth] = useState(0)
  
  // Toggles
  const [extremeLoudness, setExtremeLoudness] = useState(false)
  const [truePeakGuard, setTruePeakGuard] = useState(true)

  const [isProcessingAll, setIsProcessingAll] = useState(false)
  
  // Playback State
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null)
  const [playingType, setPlayingType] = useState<'original' | 'processed' | null>(null)
  const [playbackTime, setPlaybackTime] = useState(0)
  const [duration, setDuration] = useState(0)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null)
  
  const startTimeRef = useRef<number>(0)
  const pauseTimeRef = useRef<number>(0)
  const animationRef = useRef<number>(0)
  const playRequestTokenRef = useRef<number>(0)

  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    return () => {
      if (audioContextRef.current?.state !== 'closed') {
        audioContextRef.current?.close()
      }
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files))
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
      addFiles(Array.from(e.dataTransfer.files))
    }
  }

  const addFiles = (files: File[]) => {
    const audioFiles = files.filter(file => file.type.startsWith('audio/'))
    if (tracks.length + audioFiles.length > 20) {
      alert('최대 20곡까지만 업로드 가능합니다.')
      return
    }
    const newTracks: Track[] = audioFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      name: file.name,
      status: 'pending',
      progress: 0
    }))
    setTracks(prev => [...prev, ...newTracks])
  }

  const removeTrack = (id: string) => {
    setTracks(prev => prev.filter(t => t.id !== id))
    if (currentlyPlayingId === id) stopPlayback()
  }

  const clearAll = () => {
    setTracks([])
    stopPlayback()
  }

  const startProgressTracker = () => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current)
    const update = () => {
      if (audioContextRef.current && sourceNodeRef.current) {
         const current = pauseTimeRef.current + (audioContextRef.current.currentTime - startTimeRef.current)
         setPlaybackTime(current)
         animationRef.current = requestAnimationFrame(update)
      }
    }
    animationRef.current = requestAnimationFrame(update)
  }

  const stopPlayback = () => {
    playRequestTokenRef.current = 0 // Cancel any pending play requests
    if (sourceNodeRef.current && audioContextRef.current) {
      pauseTimeRef.current += audioContextRef.current.currentTime - startTimeRef.current
      try {
        sourceNodeRef.current.stop()
        sourceNodeRef.current.disconnect()
      } catch (e) {}
      sourceNodeRef.current = null
    }
    setCurrentlyPlayingId(null)
    setPlayingType(null)
    if (animationRef.current) cancelAnimationFrame(animationRef.current)
  }

  const playPreview = async (track: Track, type: 'original' | 'processed', seekTime?: number) => {
    if (!audioContextRef.current) return
    const ctx = audioContextRef.current
    
    // Toggle pause if clicking the same active button
    if (currentlyPlayingId === track.id && playingType === type && seekTime === undefined) {
      stopPlayback()
      return
    }

    // Generate unique token for this play request
    const token = Date.now() + Math.random()
    playRequestTokenRef.current = token

    let buffer = type === 'processed' ? track.processedBuffer : track.originalBuffer
    
    if (!buffer && type === 'original') {
      const arrayBuffer = await track.file.arrayBuffer()
      buffer = await ctx.decodeAudioData(arrayBuffer)
      setTracks(prev => prev.map(t => t.id === track.id ? { ...t, originalBuffer: buffer } : t))
    }

    // Abort if another play request was made or stop was called while decoding
    if (playRequestTokenRef.current !== token) return
    if (!buffer) return

    let startOffset = 0
    if (seekTime !== undefined) {
      startOffset = seekTime
    } else if (currentlyPlayingId === track.id) {
      // Switching A/B mid-playback or resuming
      if (sourceNodeRef.current) {
        startOffset = pauseTimeRef.current + (ctx.currentTime - startTimeRef.current)
      } else {
        startOffset = pauseTimeRef.current
      }
    } else {
      // Different track entirely
      startOffset = 0
    }

    // Stop current playback before starting new one
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop()
        sourceNodeRef.current.disconnect()
      } catch (e) {}
      sourceNodeRef.current = null
    }

    if (startOffset >= buffer.duration) {
      startOffset = 0
    }

    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)
    source.start(0, startOffset)
    
    sourceNodeRef.current = source
    startTimeRef.current = ctx.currentTime
    pauseTimeRef.current = startOffset
    
    setCurrentlyPlayingId(track.id)
    setPlayingType(type)
    setDuration(buffer.duration)
    setPlaybackTime(startOffset)

    source.onended = () => {
      // Only reset if this is still the active source
      if (sourceNodeRef.current === source) {
         setCurrentlyPlayingId(null)
         setPlayingType(null)
         setPlaybackTime(0)
         pauseTimeRef.current = 0
         if (animationRef.current) cancelAnimationFrame(animationRef.current)
      }
    }

    startProgressTracker()
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = Number(e.target.value)
    setPlaybackTime(newTime)
    pauseTimeRef.current = newTime
    
    if (currentlyPlayingId && playingType) {
       const track = tracks.find(t => t.id === currentlyPlayingId)
       if (track) {
          playPreview(track, playingType, newTime)
       }
    }
  }

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00"
    const mins = Math.floor(time / 60)
    const secs = Math.floor(time % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleTemplateChange = (templateId: string) => {
    setActiveTemplate(templateId)
    switch (templateId) {
      case 'streaming': // Perfectly flat and safe
        setClarity(50); setWarmth(50); setSaturation(0); setWidth(0); setPreset('streaming'); setExtremeLoudness(false); setTruePeakGuard(true);
        break;
      case 'kpop': // Pop / K-Pop (Bright, tight, commercial loudness)
        setClarity(65); setWarmth(55); setSaturation(5); setWidth(15); setPreset('loud'); setExtremeLoudness(false); setTruePeakGuard(true);
        break;
      case 'punchy': // Hip-hop / EDM (Punchy)
        setClarity(60); setWarmth(65); setSaturation(15); setWidth(10); setPreset('loud'); setExtremeLoudness(true); setTruePeakGuard(true);
        break;
      case 'rock': // Rock / Metal (Aggressive, wide, warm low-mids)
        setClarity(55); setWarmth(60); setSaturation(25); setWidth(20); setPreset('loud'); setExtremeLoudness(false); setTruePeakGuard(true);
        break;
      case 'rnb': // R&B / Soul (Warm, intimate)
        setClarity(50); setWarmth(65); setSaturation(15); setWidth(5); setPreset('streaming'); setExtremeLoudness(false); setTruePeakGuard(true);
        break;
      case 'acoustic': // Classical / Acoustic (Wide & Transparent)
        setClarity(55); setWarmth(45); setSaturation(0); setWidth(30); setPreset('streaming'); setExtremeLoudness(false); setTruePeakGuard(true);
        break;
      case 'cinematic': // Cinematic / OST (Deep bass, very wide, dynamic)
        setClarity(60); setWarmth(70); setSaturation(10); setWidth(40); setPreset('streaming'); setExtremeLoudness(false); setTruePeakGuard(true);
        break;
      case 'vocal': // Gentle vocal presence
        setClarity(65); setWarmth(40); setSaturation(5); setWidth(0); setPreset('streaming'); setExtremeLoudness(false); setTruePeakGuard(true);
        break;
      case 'bass': // Gentle bass focus
        setClarity(40); setWarmth(70); setSaturation(10); setWidth(0); setPreset('loud'); setExtremeLoudness(false); setTruePeakGuard(true);
        break;
      case 'lofi': // Lo-Fi Chill (Warm, Narrow, Distorted)
        setClarity(30); setWarmth(75); setSaturation(40); setWidth(0); setPreset('streaming'); setExtremeLoudness(false); setTruePeakGuard(true);
        break;
      case 'vintage': // Warm analog feel
        setClarity(40); setWarmth(60); setSaturation(30); setWidth(0); setPreset('streaming'); setExtremeLoudness(false); setTruePeakGuard(true);
        break;
      case 'extreme': // Noticeable but not completely broken
        setClarity(55); setWarmth(55); setSaturation(20); setWidth(10); setPreset('loud'); setExtremeLoudness(true); setTruePeakGuard(true);
        break;
      case 'custom':
        break;
    }
  }

  const resetOptions = () => {
    setClarity(50)
    setWarmth(50)
    setSaturation(0)
    setWidth(0)
    setPreset('streaming')
    setExtremeLoudness(false)
    setTruePeakGuard(true)
    setActiveTemplate('streaming')
  }

  const handleSliderChange = (setter: any, value: number) => {
    setter(value)
    setActiveTemplate('custom')
  }

  const processAudio = async (track: Track): Promise<Track> => {
    if (!audioContextRef.current) return track

    let currentProgress = 0
    const progressInterval = setInterval(() => {
      currentProgress += (95 - currentProgress) * 0.15
      setTracks(prev => prev.map(t => t.id === track.id ? { ...t, progress: Math.floor(currentProgress) } : t))
    }, 200)

    try {
      let buffer = track.originalBuffer
      if (!buffer) {
        const arrayBuffer = await track.file.arrayBuffer()
        buffer = await audioContextRef.current.decodeAudioData(arrayBuffer)
      }

      // [Pro Optimization] Force 48kHz Target Sample Rate for consistent, high-precision rendering
      const targetSampleRate = 48000
      const duration = buffer.length / buffer.sampleRate
      const targetLength = Math.ceil(duration * targetSampleRate)

      const offlineCtx = new OfflineAudioContext(buffer.numberOfChannels, targetLength, targetSampleRate)
      const source = offlineCtx.createBufferSource()
      source.buffer = buffer
      
      // 1. Tube Saturation (WaveShaper) - Highly reduced to act as true harmonic exciter, not a fuzz pedal
      const shaper = offlineCtx.createWaveShaper()
      if (saturation > 0) {
        shaper.curve = makeDistortionCurve(saturation / 5) // max amount 20
        shaper.oversample = '4x'
      }

      // 2. EQ (Clarity & Warmth) - Mastering Grade EQ (+/- 3.3dB max)
      const highShelf = offlineCtx.createBiquadFilter()
      highShelf.type = 'highshelf'
      highShelf.frequency.value = 8000
      highShelf.gain.value = (clarity - 50) / 15 

      const lowShelf = offlineCtx.createBiquadFilter()
      lowShelf.type = 'lowshelf'
      lowShelf.frequency.value = 150
      lowShelf.gain.value = (warmth - 50) / 15 

      // 3. Stereo Width Simulation
      const hasWidth = buffer.numberOfChannels === 2 && width > 0
      let leftGain, rightGain, rightDelay, merger
      if (hasWidth) {
        const splitter = offlineCtx.createChannelSplitter(2)
        merger = offlineCtx.createChannelMerger(2)
        
        leftGain = offlineCtx.createGain()
        rightGain = offlineCtx.createGain()
        
        rightDelay = offlineCtx.createDelay(0.1)
        // Extremely small delay for subtle widening without destroying mono compatibility (0 to 1.5ms)
        rightDelay.delayTime.value = (width / 100) * 0.0015 
        
        splitter.connect(leftGain, 0)
        splitter.connect(rightDelay, 1)
        rightDelay.connect(rightGain)
        
        leftGain.connect(merger, 0, 0)
        rightGain.connect(merger, 0, 1)
        
        lowShelf.connect(splitter)
      } else {
        merger = lowShelf
      }

      // 4. Dynamics Compressor (Glue Compressor)
      const compressor = offlineCtx.createDynamicsCompressor()
      
      if (extremeLoudness) {
        compressor.threshold.value = -18
        compressor.ratio.value = 4
        compressor.knee.value = 2
        compressor.attack.value = 0.005
        compressor.release.value = 0.1
      } else {
        compressor.threshold.value = preset === 'loud' ? -12 : -8
        compressor.ratio.value = preset === 'loud' ? 2.5 : 1.5
        compressor.knee.value = 10
        compressor.attack.value = 0.01
        compressor.release.value = 0.25
      }
      
      const makeupGain = offlineCtx.createGain()
      // Zero added gain by default, rely on compressor to tame peaks. Suno tracks are already loud.
      makeupGain.gain.value = extremeLoudness ? 1.2 : 1.0 
      
      if (saturation > 0) {
        source.connect(shaper)
        shaper.connect(highShelf)
      } else {
        source.connect(highShelf)
      }
      
      highShelf.connect(lowShelf)
      
      if (hasWidth && merger) {
        merger.connect(compressor)
      } else {
        lowShelf.connect(compressor)
      }
      
      compressor.connect(makeupGain)
      
      // True Peak Guard (Fast Limiter + Soft Clipper)
      if (truePeakGuard) {
        const limiter = offlineCtx.createDynamicsCompressor()
        limiter.threshold.value = -0.5
        limiter.ratio.value = 20
        limiter.knee.value = 0
        limiter.attack.value = 0.001
        limiter.release.value = 0.05
        
        // [Pro Optimization] Math.tanh based Soft Clipper for musical saturation instead of harsh digital clipping
        const softClipper = offlineCtx.createWaveShaper()
        softClipper.curve = makeSoftClipCurve(1.5)
        softClipper.oversample = '4x'
        
        makeupGain.connect(limiter)
        limiter.connect(softClipper)
        softClipper.connect(offlineCtx.destination)
      } else {
        makeupGain.connect(offlineCtx.destination)
      }
      
      source.start()
      
      const processedBuffer = await offlineCtx.startRendering()
      const wavBlob = audioBufferToWav(processedBuffer)
      const processedUrl = URL.createObjectURL(wavBlob)

      clearInterval(progressInterval)

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
      clearInterval(progressInterval)
      return { ...track, status: 'error' }
    }
  }

  const processAll = async () => {
    setIsProcessingAll(true)
    
    // Set all tracks to processing
    setTracks(prev => prev.map(t => ({ ...t, status: 'processing', progress: 0 })))
    
    for (let i = 0; i < tracks.length; i++) {
      const processedTrack = await processAudio(tracks[i])
      setTracks(prev => prev.map(t => t.id === tracks[i].id ? processedTrack : t))
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
      <div className="mb-10 flex flex-col items-center text-center">
        <h1 className="text-4xl font-black tracking-tight flex items-center justify-center gap-4 mb-3 text-transparent bg-clip-text bg-gradient-to-r from-primary via-primary/80 to-blue-500">
          <Settings2 className="w-10 h-10 text-primary" />
          Pro Audio Mastering Console
        </h1>
        <p className="text-zinc-400 max-w-2xl text-lg">Web Audio API 기반 초고속 오프라인 렌더링. 진공관 새츄레이션과 스테레오 와이드너가 탑재된 프로페셔널 스튜디오 마스터링 툴입니다.</p>
      </div>

      <div className="flex flex-col gap-6">
        
        {/* Top: Queue & Dropzone */}
        <div className="bg-[#0a0a0c] border border-outline-variant/10 rounded-[2rem] p-6 shadow-2xl flex flex-col lg:flex-row gap-6 relative overflow-hidden">
          {/* Decorative BG */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/3" />
          
          {/* Dropzone */}
          <div 
            className="lg:w-1/3 border-2 border-dashed border-primary/30 rounded-3xl p-8 flex flex-col items-center justify-center text-center bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer min-h-[240px] relative z-10 group"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <input type="file" ref={fileInputRef} className="hidden" accept="audio/*" multiple onChange={handleFileChange} />
            <div className="w-16 h-16 rounded-2xl bg-black/50 border border-primary/20 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform shadow-xl shadow-primary/20">
              <Upload className="w-8 h-8 text-primary" />
            </div>
            <p className="font-extrabold mb-2 text-lg">파일을 드래그하여 드롭하세요</p>
            <p className="text-sm text-primary/70 font-medium">최대 20곡 일괄 업로드 (WAV, MP3)</p>
          </div>

          {/* Queue List */}
          <div className="lg:w-2/3 flex flex-col h-full relative z-10 bg-black/40 rounded-3xl border border-white/5 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Activity className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-bold">배치 큐 (Batch Queue)</h2>
              </div>
              <div className="px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-bold">
                {tracks.length} / 20 Tracks
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar flex flex-col gap-3 min-h-[160px] max-h-[300px]">
              {tracks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-3 opacity-50 py-10">
                  <FileAudio className="w-12 h-12" />
                  <p className="font-medium">대기열이 비어 있습니다.</p>
                </div>
              ) : (
                tracks.map((track) => (
                  <div key={track.id} className="flex flex-col gap-2 p-3.5 rounded-2xl bg-white/5 border border-white/10 group hover:bg-white/10 transition-colors relative">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-black shrink-0 relative overflow-hidden">
                        {track.status === 'done' ? <Check className="w-4 h-4 text-green-400" /> 
                         : track.status === 'processing' ? <RotateCcw className="w-4 h-4 text-primary animate-spin" />
                         : <div className="w-2 h-2 rounded-full bg-zinc-600" />}
                         
                        {track.status === 'processing' && (
                          <div className="absolute inset-0 bg-primary/20 animate-pulse" />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate">{track.name}</p>
                        {track.status === 'processing' && (
                          <div className="w-full mt-2">
                            <div className="flex justify-between items-center text-[10px] text-zinc-400 mb-1.5 font-mono">
                              <span className="animate-pulse">오프라인 렌더링 중...</span>
                              <span className="text-primary font-bold">{track.progress}%</span>
                            </div>
                            <div className="w-full bg-black rounded-full h-1.5 overflow-hidden border border-white/5">
                              <div className="bg-primary h-full rounded-full transition-all duration-200 ease-out" style={{ width: `${track.progress}%` }} />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 opacity-100 transition-opacity">
                        <button onClick={() => playPreview(track, 'original')} className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 transition-colors ${currentlyPlayingId === track.id && playingType === 'original' ? 'bg-primary text-black font-bold border-primary' : 'bg-black text-zinc-400 hover:bg-zinc-800 hover:text-white'}`} title="원본 듣기 (A/B 테스트)">
                          {currentlyPlayingId === track.id && playingType === 'original' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                          <span className="text-xs">원본</span>
                        </button>
                        <button onClick={() => playPreview(track, 'processed')} disabled={track.status !== 'done'} className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 transition-colors disabled:opacity-30 ${currentlyPlayingId === track.id && playingType === 'processed' ? 'bg-green-500 text-black font-bold border-green-500' : 'bg-[#0f1a15] text-green-500 hover:bg-[#162920]'}`} title="마스터 본 듣기 (A/B 테스트)">
                          {currentlyPlayingId === track.id && playingType === 'processed' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                          <span className="text-xs">마스터</span>
                        </button>
                        {track.status === 'done' && track.processedUrl && (
                          <a href={track.processedUrl} download={`Mastered_${track.name.replace(/\.[^/.]+$/, "")}.wav`} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-white" title="WAV 다운로드">
                            <Download className="w-4 h-4" />
                          </a>
                        )}
                        <button onClick={() => removeTrack(track.id)} className="p-2 rounded-xl text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="목록에서 삭제">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Progress Bar (Visible only when playing) */}
                    {currentlyPlayingId === track.id && (
                      <div className="w-full flex items-center gap-3 pt-2 pb-1 px-1">
                        <span className="text-[11px] font-medium text-primary w-10 text-right font-mono">{formatTime(playbackTime)}</span>
                        <input 
                          type="range" 
                          min="0" 
                          max={duration || 100} 
                          step="0.01"
                          value={playbackTime}
                          onChange={handleSeek}
                          className="flex-1 h-1.5 bg-black border border-white/10 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full cursor-pointer hover:[&::-webkit-slider-thumb]:bg-primary hover:[&::-webkit-slider-thumb]:scale-110 transition-all"
                        />
                        <span className="text-[11px] font-medium text-zinc-500 w-10 font-mono">{formatTime(duration)}</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Bottom: Mastering Rack Console */}
        <div className="bg-[#121214] border border-outline-variant/10 rounded-[2rem] p-6 lg:p-10 shadow-2xl relative">
          
          {/* Header & Templates */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 pb-6 border-b border-white/5 gap-6">
            <h2 className="text-2xl font-black flex items-center gap-3">
              <Sliders className="w-7 h-7 text-primary" />
              Mastering Rack Console
            </h2>

            <div className="flex flex-col xl:flex-row items-start xl:items-center gap-4">
              <div className="flex flex-wrap items-center bg-black/50 border border-white/10 rounded-xl p-2 max-w-[800px] gap-1.5">
                <div className="px-3 py-1 text-xs font-bold text-zinc-500 flex items-center gap-2 mr-2">
                  <ListFilter className="w-3 h-3" />
                  장르 프리셋
                </div>
                <button onClick={() => handleTemplateChange('streaming')} className={`px-3 py-1.5 text-xs font-bold transition-all rounded-lg ${activeTemplate === 'streaming' ? 'bg-primary text-black' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}>기본(균형)</button>
                <button onClick={() => handleTemplateChange('kpop')} className={`px-3 py-1.5 text-xs font-bold transition-all rounded-lg ${activeTemplate === 'kpop' ? 'bg-primary text-black' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}>팝/K-Pop</button>
                <button onClick={() => handleTemplateChange('punchy')} className={`px-3 py-1.5 text-xs font-bold transition-all rounded-lg ${activeTemplate === 'punchy' ? 'bg-primary text-black' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}>힙합/EDM</button>
                <button onClick={() => handleTemplateChange('rock')} className={`px-3 py-1.5 text-xs font-bold transition-all rounded-lg ${activeTemplate === 'rock' ? 'bg-primary text-black' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}>록/메탈</button>
                <button onClick={() => handleTemplateChange('rnb')} className={`px-3 py-1.5 text-xs font-bold transition-all rounded-lg ${activeTemplate === 'rnb' ? 'bg-primary text-black' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}>R&B/소울</button>
                <button onClick={() => handleTemplateChange('acoustic')} className={`px-3 py-1.5 text-xs font-bold transition-all rounded-lg ${activeTemplate === 'acoustic' ? 'bg-primary text-black' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}>어쿠스틱</button>
                <button onClick={() => handleTemplateChange('cinematic')} className={`px-3 py-1.5 text-xs font-bold transition-all rounded-lg ${activeTemplate === 'cinematic' ? 'bg-primary text-black' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}>시네마틱/OST</button>
                <button onClick={() => handleTemplateChange('vocal')} className={`px-3 py-1.5 text-xs font-bold transition-all rounded-lg ${activeTemplate === 'vocal' ? 'bg-primary text-black' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}>보컬 강조</button>
                <button onClick={() => handleTemplateChange('bass')} className={`px-3 py-1.5 text-xs font-bold transition-all rounded-lg ${activeTemplate === 'bass' ? 'bg-primary text-black' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}>저음 강화</button>
                <button onClick={() => handleTemplateChange('lofi')} className={`px-3 py-1.5 text-xs font-bold transition-all rounded-lg ${activeTemplate === 'lofi' ? 'bg-primary text-black' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}>로파이</button>
                <button onClick={() => handleTemplateChange('vintage')} className={`px-3 py-1.5 text-xs font-bold transition-all rounded-lg ${activeTemplate === 'vintage' ? 'bg-primary text-black' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}>아날로그</button>
                <button onClick={() => handleTemplateChange('extreme')} className={`px-3 py-1.5 text-xs font-bold transition-all rounded-lg ${activeTemplate === 'extreme' ? 'bg-red-500 text-black' : 'text-red-400/70 hover:text-red-400 hover:bg-red-500/10'}`}>익스트림</button>
              </div>

              <button 
                onClick={resetOptions}
                className="p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold flex items-center gap-2 text-sm transition-all shadow-md"
                title="설정 초기화"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex gap-3">
              <button onClick={downloadAll} disabled={!tracks.some(t => t.status === 'done')} className="whitespace-nowrap flex-shrink-0 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 font-bold flex items-center gap-2 text-sm disabled:opacity-30 transition-all">
                <Download className="w-4 h-4" /> 전체 다운로드
              </button>
              <button onClick={processAll} disabled={isProcessingAll || tracks.length === 0} className="whitespace-nowrap flex-shrink-0 px-6 py-2.5 rounded-xl bg-primary text-black font-extrabold flex items-center gap-2 hover:brightness-110 disabled:opacity-50 shadow-lg shadow-primary/20 transition-all">
                {isProcessingAll ? <RotateCcw className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-black" />}
                {isProcessingAll ? '마스터링 중...' : '마스터링 시작'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Module 1: Tonal Balance (EQ) */}
            <div className="bg-black/50 border border-white/5 rounded-3xl p-6 relative group overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-center gap-3 mb-8">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Sliders className="w-4 h-4 text-blue-400" />
                </div>
                <h3 className="font-bold text-lg text-blue-100">톤 밸런스 <span className="text-sm text-zinc-500 font-normal ml-1">(EQ)</span></h3>
              </div>
              
              <div className="space-y-8 relative z-10">
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between font-bold text-sm">
                    <span className="text-zinc-400">선명도 (High-Shelf)</span>
                    <span className={clarity > 50 ? 'text-blue-400' : clarity < 50 ? 'text-red-400' : 'text-zinc-500'}>{clarity > 50 ? '+' : ''}{clarity - 50} %</span>
                  </div>
                  <input type="range" min="0" max="100" value={clarity} onChange={(e) => handleSliderChange(setClarity, Number(e.target.value))} className="accent-blue-500 w-full" />
                </div>
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between font-bold text-sm">
                    <span className="text-zinc-400">저역 (Low-Shelf)</span>
                    <span className={warmth > 50 ? 'text-blue-400' : warmth < 50 ? 'text-red-400' : 'text-zinc-500'}>{warmth > 50 ? '+' : ''}{warmth - 50} %</span>
                  </div>
                  <input type="range" min="0" max="100" value={warmth} onChange={(e) => handleSliderChange(setWarmth, Number(e.target.value))} className="accent-blue-500 w-full" />
                </div>
              </div>
            </div>

            {/* Module 2: Saturation & Width */}
            <div className="bg-black/50 border border-white/5 rounded-3xl p-6 relative group overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-center gap-3 mb-8">
                <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                  <Maximize2 className="w-4 h-4 text-orange-400" />
                </div>
                <h3 className="font-bold text-lg text-orange-100">새츄레이션 & 공간감</h3>
              </div>
              
              <div className="space-y-8 relative z-10">
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between font-bold text-sm">
                    <span className="text-zinc-400">진공관 따뜻함 (Saturation)</span>
                    <span className={saturation > 0 ? 'text-orange-400' : 'text-zinc-500'}>{saturation} %</span>
                  </div>
                  <input type="range" min="0" max="100" value={saturation} onChange={(e) => handleSliderChange(setSaturation, Number(e.target.value))} className="accent-orange-500 w-full" />
                  <p className="text-[10px] text-zinc-500">아날로그 진공관 배음 증폭 (따뜻하고 묵직한 질감)</p>
                </div>
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between font-bold text-sm">
                    <span className="text-zinc-400">스테레오 확장 (Width)</span>
                    <span className={width > 0 ? 'text-orange-400' : 'text-zinc-500'}>{width} %</span>
                  </div>
                  <input type="range" min="0" max="100" value={width} onChange={(e) => handleSliderChange(setWidth, Number(e.target.value))} className="accent-orange-500 w-full" />
                  <p className="text-[10px] text-zinc-500">좌우 위상 확장으로 공간감 극대화</p>
                </div>
              </div>
            </div>

            {/* Module 3: Dynamics (Maximizer) */}
            <div className="bg-black/50 border border-white/5 rounded-3xl p-6 relative group overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                    <Gauge className="w-4 h-4 text-primary" />
                  </div>
                  <h3 className="font-bold text-lg text-primary-100">다이내믹스 <span className="text-sm text-zinc-500 font-normal ml-1">(음압)</span></h3>
                </div>
              </div>
              
              <div className="space-y-6 relative z-10">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-zinc-400">목표 음압 (Loudness Target)</label>
                  <select 
                    value={preset}
                    onChange={(e) => { setPreset(e.target.value); setActiveTemplate('custom'); }}
                    className="bg-[#121214] border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary text-white font-bold"
                  >
                    <option value="streaming">스트리밍 기본 (-14 LUFS)</option>
                    <option value="loud">모던 라우드 (-10 LUFS)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-3 pt-4 border-t border-white/5">
                  <label className="flex items-center gap-3 cursor-pointer group/label">
                    <div className="relative flex items-center">
                      <input type="checkbox" checked={extremeLoudness} onChange={(e) => { setExtremeLoudness(e.target.checked); setActiveTemplate('custom'); }} className="peer sr-only" />
                      <div className="w-10 h-6 bg-zinc-800 rounded-full peer-checked:bg-red-500/80 transition-colors" />
                      <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4 shadow-sm" />
                    </div>
                    <div>
                      <span className={`text-sm font-bold ${extremeLoudness ? 'text-red-400' : 'text-zinc-300'}`}>익스트림 부스터 (Extreme)</span>
                      <p className="text-[10px] text-zinc-500">공격적인 압축 및 게인 부스트 (음압 극대화)</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer group/label mt-2">
                    <div className="relative flex items-center">
                      <input type="checkbox" checked={truePeakGuard} onChange={(e) => setTruePeakGuard(e.target.checked)} className="peer sr-only" />
                      <div className="w-10 h-6 bg-zinc-800 rounded-full peer-checked:bg-primary transition-colors" />
                      <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4 shadow-sm" />
                    </div>
                    <div>
                      <span className={`text-sm font-bold ${truePeakGuard ? 'text-primary' : 'text-zinc-300'}`}>트루 피크 가드 (True Peak)</span>
                      <p className="text-[10px] text-zinc-500">출력 전단 클리핑 방지 리미터 적용</p>
                    </div>
                  </label>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
