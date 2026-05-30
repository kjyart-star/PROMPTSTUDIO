'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Upload, Play, Pause, Download, Trash2, Sliders, Settings2, FileAudio, RotateCcw, X, Activity, Maximize2, Gauge, Check, RefreshCw, ListFilter } from 'lucide-react'
import { audioBufferToWav, estimateTruePeak, makeDistortionCurve } from '@/lib/audioUtils'

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
  const [clarity, setClarity] = useState(55)
  const [warmth, setWarmth] = useState(48)
  const [saturation, setSaturation] = useState(20)
  const [width, setWidth] = useState(30)
  
  // Toggles
  const [extremeLoudness, setExtremeLoudness] = useState(false)
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
    if (tracks.length + audioFiles.length > 30) {
      alert('최대 30곡까지만 업로드 가능합니다.')
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

  const handleTemplateChange = (templateId: string) => {
    setActiveTemplate(templateId)
    switch (templateId) {
      case 'streaming':
        setClarity(55); setWarmth(48); setSaturation(20); setWidth(30); setPreset('streaming'); setExtremeLoudness(false); setTruePeakGuard(true);
        break;
      case 'vocal':
        setClarity(65); setWarmth(40); setSaturation(10); setWidth(20); setPreset('streaming'); setExtremeLoudness(false); setTruePeakGuard(true);
        break;
      case 'bass':
        setClarity(40); setWarmth(75); setSaturation(40); setWidth(15); setPreset('loud'); setExtremeLoudness(false); setTruePeakGuard(true);
        break;
      case 'extreme':
        setClarity(60); setWarmth(60); setSaturation(50); setWidth(50); setPreset('loud'); setExtremeLoudness(true); setTruePeakGuard(true);
        break;
      case 'vintage':
        setClarity(40); setWarmth(55); setSaturation(80); setWidth(10); setPreset('streaming'); setExtremeLoudness(false); setTruePeakGuard(true);
        break;
      case 'custom':
        // Do nothing, just switch the active label
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
    setActiveTemplate('custom')
  }

  // Trigger 'custom' template mode when user manually changes a slider
  const handleSliderChange = (setter: any, value: number) => {
    setter(value)
    setActiveTemplate('custom')
  }

  const processAudio = async (track: Track): Promise<Track> => {
    if (!audioContextRef.current) return track

    try {
      let buffer = track.originalBuffer
      if (!buffer) {
        const arrayBuffer = await track.file.arrayBuffer()
        buffer = await audioContextRef.current.decodeAudioData(arrayBuffer)
      }

      const offlineCtx = new OfflineAudioContext(buffer.numberOfChannels, buffer.length, buffer.sampleRate)
      const source = offlineCtx.createBufferSource()
      source.buffer = buffer
      
      // 1. Tube Saturation (WaveShaper)
      const shaper = offlineCtx.createWaveShaper()
      shaper.curve = makeDistortionCurve(saturation * 4) // Multiply for dramatic effect
      shaper.oversample = '4x'

      // 2. EQ (Clarity & Warmth)
      const highShelf = offlineCtx.createBiquadFilter()
      highShelf.type = 'highshelf'
      highShelf.frequency.value = 8000
      highShelf.gain.value = (clarity - 50) / 5 // +/- 10dB

      const lowShelf = offlineCtx.createBiquadFilter()
      lowShelf.type = 'lowshelf'
      lowShelf.frequency.value = 150
      lowShelf.gain.value = (warmth - 50) / 5 // +/- 10dB

      // 3. Stereo Width Simulation (Delay on one channel via Splitter/Merger)
      // Only apply if stereo and width > 0
      const hasWidth = buffer.numberOfChannels === 2 && width > 0
      let leftGain, rightGain, rightDelay, merger
      if (hasWidth) {
        const splitter = offlineCtx.createChannelSplitter(2)
        merger = offlineCtx.createChannelMerger(2)
        
        leftGain = offlineCtx.createGain()
        rightGain = offlineCtx.createGain()
        
        // Haas effect delay (0 to 30ms based on width slider)
        rightDelay = offlineCtx.createDelay(0.1)
        rightDelay.delayTime.value = (width / 100) * 0.03
        
        splitter.connect(leftGain, 0)
        splitter.connect(rightDelay, 1)
        rightDelay.connect(rightGain)
        
        leftGain.connect(merger, 0, 0)
        rightGain.connect(merger, 0, 1)
        
        lowShelf.connect(splitter)
      } else {
        merger = lowShelf
      }

      // 4. Dynamics Compressor (Maximizer)
      const compressor = offlineCtx.createDynamicsCompressor()
      
      if (extremeLoudness) {
        compressor.threshold.value = -30
        compressor.ratio.value = 12
        compressor.knee.value = 0
        compressor.attack.value = 0.003
        compressor.release.value = 0.25
      } else {
        compressor.threshold.value = preset === 'loud' ? -20 : -14
        compressor.ratio.value = preset === 'loud' ? 6 : 3
        compressor.knee.value = 5
      }
      
      const makeupGain = offlineCtx.createGain()
      makeupGain.gain.value = extremeLoudness ? 3.0 : 1.5 // Dramatic loudness boost
      
      source.connect(shaper)
      shaper.connect(highShelf)
      highShelf.connect(lowShelf)
      
      if (hasWidth && merger) {
        merger.connect(compressor)
      } else {
        lowShelf.connect(compressor)
      }
      
      compressor.connect(makeupGain)
      
      // True Peak Guard (Hard Limiter)
      const limiter = offlineCtx.createDynamicsCompressor()
      if (truePeakGuard) {
        limiter.threshold.value = -1.0
        limiter.ratio.value = 20
        limiter.knee.value = 0
        limiter.attack.value = 0.001
        limiter.release.value = 0.1
        makeupGain.connect(limiter)
        limiter.connect(offlineCtx.destination)
      } else {
        makeupGain.connect(offlineCtx.destination)
      }
      
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
            <p className="text-sm text-primary/70 font-medium">최대 30곡 일괄 업로드 (WAV, MP3)</p>
          </div>

          {/* Queue List */}
          <div className="lg:w-2/3 flex flex-col h-full relative z-10 bg-black/40 rounded-3xl border border-white/5 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Activity className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-bold">배치 큐 (Batch Queue)</h2>
              </div>
              <div className="px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-bold">
                {tracks.length} / 30 Tracks
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
                  <div key={track.id} className="flex items-center gap-4 p-3.5 rounded-2xl bg-white/5 border border-white/10 group hover:bg-white/10 transition-colors">
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
                        <div className="w-full bg-black rounded-full h-1 mt-2 overflow-hidden">
                          <div className="bg-primary h-full rounded-full transition-all duration-300" style={{ width: `${track.progress}%` }} />
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => playPreview(track, 'original')} className="p-2 rounded-xl bg-black hover:bg-zinc-800 transition-colors" title="원본 재생">
                        {currentlyPlayingId === track.id && sourceNodeRef.current?.buffer === track.originalBuffer ? <Pause className="w-4 h-4 text-primary" /> : <Play className="w-4 h-4 text-zinc-400" />}
                      </button>
                      <button onClick={() => playPreview(track, 'processed')} disabled={track.status !== 'done'} className="p-2 rounded-xl bg-primary/20 text-primary hover:bg-primary/30 transition-colors disabled:opacity-30" title="마스터링 재생">
                        {currentlyPlayingId === track.id && sourceNodeRef.current?.buffer === track.processedBuffer ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>
                      {track.status === 'done' && track.processedUrl && (
                        <a href={track.processedUrl} download={`Mastered_${track.name.replace(/\.[^/.]+$/, "")}.wav`} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-white" title="WAV 다운로드">
                          <Download className="w-4 h-4" />
                        </a>
                      )}
                      <button onClick={() => removeTrack(track.id)} className="p-2 rounded-xl text-zinc-500 hover:text-red-400 transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
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

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="flex items-center bg-black border border-white/10 rounded-xl overflow-hidden p-1">
                <div className="px-3 text-xs font-bold text-zinc-500 flex items-center gap-2 border-r border-white/10">
                  <ListFilter className="w-3 h-3" />
                  기본 템플릿
                </div>
                <button onClick={() => handleTemplateChange('streaming')} className={`px-4 py-2 text-xs font-bold transition-all rounded-lg ${activeTemplate === 'streaming' ? 'bg-primary text-black' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}>균형형</button>
                <button onClick={() => handleTemplateChange('vocal')} className={`px-4 py-2 text-xs font-bold transition-all rounded-lg ${activeTemplate === 'vocal' ? 'bg-primary text-black' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}>보컬 강조</button>
                <button onClick={() => handleTemplateChange('bass')} className={`px-4 py-2 text-xs font-bold transition-all rounded-lg ${activeTemplate === 'bass' ? 'bg-primary text-black' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}>저음 강화</button>
                <button onClick={() => handleTemplateChange('extreme')} className={`px-4 py-2 text-xs font-bold transition-all rounded-lg ${activeTemplate === 'extreme' ? 'bg-primary text-black' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}>익스트림</button>
                <button onClick={() => handleTemplateChange('vintage')} className={`px-4 py-2 text-xs font-bold transition-all rounded-lg ${activeTemplate === 'vintage' ? 'bg-primary text-black' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}>아날로그</button>
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
              <button onClick={downloadAll} disabled={!tracks.some(t => t.status === 'done')} className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 font-bold flex items-center gap-2 text-sm disabled:opacity-30 transition-all">
                <Download className="w-4 h-4" /> 전체 다운로드
              </button>
              <button onClick={processAll} disabled={isProcessingAll || tracks.length === 0} className="px-6 py-2.5 rounded-xl bg-primary text-black font-extrabold flex items-center gap-2 hover:brightness-110 disabled:opacity-50 shadow-lg shadow-primary/20 transition-all">
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
                    <span className="text-zinc-400">무게감 (Low-Shelf)</span>
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
