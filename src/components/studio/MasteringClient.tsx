'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { 
  Upload, Play, Pause, Download, Trash2, Sliders, Settings2, 
  FileAudio, RotateCcw, Activity, Maximize2, Gauge, Check, 
  RefreshCw, ListFilter, Volume2, ShieldCheck, Sparkles, Wand2,
  Zap, Layers, Radio, Disc, Music, ArrowUpRight
} from 'lucide-react'
import { audioBufferToWav, makeSoftClipCurve } from '@/lib/audioUtils'
import { StudioHero } from './StudioHero'

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
  const [uiLanguage, setUiLanguage] = useState('KO')
  const [tracks, setTracks] = useState<Track[]>([])
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null)
  
  // Mastering Parameters
  const [drive, setDrive] = useState<number>(0) // 0.0 to 10.0 dB
  const [tamer, setTamer] = useState<number>(0) // 0 to 100 (De-Harsh)
  const [character, setCharacter] = useState<string>('standard')
  const [width, setWidth] = useState<number>(1.0) // 0.0 (Mono) ~ 1.0 (Normal) ~ 2.0 (Wide)
  
  // 7-Band EQ (-10.0dB to +10.0dB)
  const [eq, setEq] = useState({
    eq60: 0,
    eq150: 0,
    eq400: 0,
    eq1k: 0,
    eq2_5k: 0,
    eq6k: 0,
    eq12k: 0
  })
  
  // Direct Input Editing State for 7-Band EQ values
  const [editingBand, setEditingBand] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState<string>('')

  // Real-time A/B Comparison Toggle (true = Mastered ON 🟢, false = Bypass 🔴)
  const [abToggle, setAbToggle] = useState<boolean>(true)
  
  // Real-time LUFS Meter State
  const [lufsText, setLufsText] = useState<string>('-∞ LUFS')
  const [visualLufsPercent, setVisualLufsPercent] = useState<number>(0)

  // Audio Playback & Web Audio API Refs
  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const [playbackTime, setPlaybackTime] = useState<number>(0)
  const [duration, setDuration] = useState<number>(0)
  const [isProcessingBatch, setIsProcessingBatch] = useState<boolean>(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const playerRef = useRef<HTMLAudioElement | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const mediaSourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  
  // Web Audio Nodes Ref
  const rtNodesRef = useRef<{
    dryGain: GainNode | null
    wetGain: GainNode | null
    sunoNotch2: BiquadFilterNode | null
    highShelf10k: BiquadFilterNode | null
    eq60: BiquadFilterNode | null
    eq150: BiquadFilterNode | null
    eq400: BiquadFilterNode | null
    eq1k: BiquadFilterNode | null
    eq2_5k: BiquadFilterNode | null
    eq6k: BiquadFilterNode | null
    eq12k: BiquadFilterNode | null
    gainLL: GainNode | null
    gainLR: GainNode | null
    gainRL: GainNode | null
    gainRR: GainNode | null
    driveGain: GainNode | null
    limiter: DynamicsCompressorNode | null
    analyser: AnalyserNode | null
  }>({
    dryGain: null, wetGain: null, sunoNotch2: null, highShelf10k: null,
    eq60: null, eq150: null, eq400: null, eq1k: null, eq2_5k: null,
    eq6k: null, eq12k: null, gainLL: null, gainLR: null, gainRL: null,
    gainRR: null, driveGain: null, limiter: null, analyser: null
  })

  const animationFrameIdRef = useRef<number>(0)

  // Language setup
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedLang = localStorage.getItem('language')
      if (storedLang) {
        setUiLanguage(storedLang.toUpperCase())
      } else {
        const browserLang = navigator.language || ''
        const defaultLang = browserLang.toLowerCase().startsWith('ko') ? 'KO' : browserLang.toLowerCase().startsWith('ja') ? 'JA' : 'EN'
        setUiLanguage(defaultLang)
        localStorage.setItem('language', defaultLang)
      }
      const handleLangChange = (e: any) => setUiLanguage(e.detail.toUpperCase())
      window.addEventListener('languageChange', handleLangChange)
      return () => window.removeEventListener('languageChange', handleLangChange)
    }
  }, [])

  // Initialize Web Audio Context & Node Routing
  const initAudioEngine = () => {
    if (audioCtxRef.current || !playerRef.current) return
    
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext
    const ctx = new AudioCtxClass()
    audioCtxRef.current = ctx

    const source = ctx.createMediaElementSource(playerRef.current)
    mediaSourceRef.current = source

    // A/B Gains
    const dryGain = ctx.createGain()
    const wetGain = ctx.createGain()
    dryGain.gain.value = 0
    wetGain.gain.value = 1

    // K-Weighting Filter Chain for LUFS Measurement (ITU-R BS.1770 / EBU R128)
    const meterKPRe = ctx.createBiquadFilter()
    meterKPRe.type = 'highshelf'
    meterKPRe.frequency.value = 1500
    meterKPRe.gain.value = 4

    const meterKRL = ctx.createBiquadFilter()
    meterKRL.type = 'highpass'
    meterKRL.frequency.value = 38
    meterKRL.Q.value = 0.5

    // Suno De-Harsh Noise Suppressor Filters
    const sunoNotch2 = ctx.createBiquadFilter()
    sunoNotch2.type = 'peaking'
    sunoNotch2.frequency.value = 3500

    const highShelf10k = ctx.createBiquadFilter()
    highShelf10k.type = 'highshelf'
    highShelf10k.frequency.value = 10000

    // 7-Band Graphic/Parametric EQ Filters
    const eq60 = ctx.createBiquadFilter()
    eq60.type = 'lowshelf'
    eq60.frequency.value = 60

    const eq150 = ctx.createBiquadFilter()
    eq150.type = 'peaking'
    eq150.frequency.value = 150

    const eq400 = ctx.createBiquadFilter()
    eq400.type = 'peaking'
    eq400.frequency.value = 400

    const eq1k = ctx.createBiquadFilter()
    eq1k.type = 'peaking'
    eq1k.frequency.value = 1000

    const eq2_5k = ctx.createBiquadFilter()
    eq2_5k.type = 'peaking'
    eq2_5k.frequency.value = 2500

    const eq6k = ctx.createBiquadFilter()
    eq6k.type = 'peaking'
    eq6k.frequency.value = 6000

    const eq12k = ctx.createBiquadFilter()
    eq12k.type = 'highshelf'
    eq12k.frequency.value = 12000

    // Mid-Side Stereo Width Splitter & Merger
    const splitter = ctx.createChannelSplitter(2)
    const merger = ctx.createChannelMerger(2)
    const gainLL = ctx.createGain()
    const gainLR = ctx.createGain()
    const gainRL = ctx.createGain()
    const gainRR = ctx.createGain()

    // Dynamics Maximizer & Brickwall Limiter
    const driveGain = ctx.createGain()
    driveGain.gain.value = 1.0

    const limiter = ctx.createDynamicsCompressor()
    limiter.threshold.value = -0.5
    limiter.knee.value = 0
    limiter.ratio.value = 20
    limiter.attack.value = 0.001
    limiter.release.value = 0.05

    const softClipper = ctx.createWaveShaper()
    softClipper.curve = makeSoftClipCurve(1.5)
    softClipper.oversample = '4x'

    const analyser = ctx.createAnalyser()
    analyser.fftSize = 2048

    // Node Wiring Topology
    source.connect(dryGain)
    dryGain.connect(ctx.destination)

    source.connect(sunoNotch2)
    sunoNotch2.connect(highShelf10k)
    highShelf10k.connect(eq60)
    eq60.connect(eq150)
    eq150.connect(eq400)
    eq400.connect(eq1k)
    eq1k.connect(eq2_5k)
    eq2_5k.connect(eq6k)
    eq6k.connect(eq12k)

    eq12k.connect(splitter)

    splitter.connect(gainLL, 0)
    splitter.connect(gainLR, 0)
    splitter.connect(gainRL, 1)
    splitter.connect(gainRR, 1)

    gainLL.connect(merger, 0, 0)
    gainRL.connect(merger, 0, 0)
    gainLR.connect(merger, 0, 1)
    gainRR.connect(merger, 0, 1)

    merger.connect(driveGain)
    driveGain.connect(limiter)
    limiter.connect(softClipper)
    softClipper.connect(wetGain)
    wetGain.connect(ctx.destination)

    softClipper.connect(meterKPRe)
    meterKPRe.connect(meterKRL)
    meterKRL.connect(analyser)

    rtNodesRef.current = {
      dryGain, wetGain, sunoNotch2, highShelf10k,
      eq60, eq150, eq400, eq1k, eq2_5k, eq6k, eq12k,
      gainLL, gainLR, gainRL, gainRR, driveGain, limiter, analyser
    }

    updateRealtimeDSP()
  }

  // Update Real-Time DSP Parameters
  const updateRealtimeDSP = useCallback(() => {
    const nodes = rtNodesRef.current
    if (!nodes.wetGain || !audioCtxRef.current) return

    nodes.dryGain!.gain.value = abToggle ? 0 : 1
    nodes.wetGain!.gain.value = abToggle ? 1 : 0

    const tamerVal = tamer
    if (tamerVal <= 0) {
      nodes.sunoNotch2!.gain.value = 0
      nodes.highShelf10k!.gain.value = 0
    } else {
      nodes.sunoNotch2!.gain.value = -(tamerVal / 100) * 6.0
      nodes.sunoNotch2!.Q.value = 1.0 + (tamerVal / 100) * 1.5
      nodes.highShelf10k!.gain.value = -(tamerVal / 100) * 4.0
    }

    nodes.eq60!.gain.value = eq.eq60
    nodes.eq150!.gain.value = eq.eq150
    nodes.eq400!.gain.value = eq.eq400
    nodes.eq1k!.gain.value = eq.eq1k
    nodes.eq2_5k!.gain.value = eq.eq2_5k
    nodes.eq6k!.gain.value = eq.eq6k
    nodes.eq12k!.gain.value = eq.eq12k

    const w = width
    nodes.gainLL!.gain.value = 0.5 * (1 + (2 - w))
    nodes.gainRL!.gain.value = 0.5 * (1 - (2 - w))
    nodes.gainLR!.gain.value = 0.5 * (1 - (2 - w))
    nodes.gainRR!.gain.value = 0.5 * (1 + (2 - w))

    nodes.driveGain!.gain.value = Math.pow(10, drive / 20)
  }, [abToggle, tamer, eq, width, drive])

  useEffect(() => {
    updateRealtimeDSP()
  }, [updateRealtimeDSP])

  // LUFS Meter Mapping
  const lufsToPercent = (lufs: number): number => {
    if (lufs <= -60) return 0
    if (lufs >= 0) return 100
    if (lufs <= -40) return ((lufs + 60) / 20) * 15
    if (lufs <= -30) return 15 + ((lufs + 40) / 10) * 13
    if (lufs <= -24) return 28 + ((lufs + 30) / 6) * 10
    if (lufs <= -20) return 38 + ((lufs + 24) / 4) * 10
    if (lufs <= -16) return 48 + ((lufs + 20) / 4) * 12
    if (lufs <= -14) return 60 + ((lufs + 16) / 2) * 8
    if (lufs <= -12) return 68 + ((lufs + 14) / 2) * 7
    if (lufs <= -9) return 75 + ((lufs + 12) / 3) * 8
    if (lufs <= -6) return 83 + ((lufs + 9) / 3) * 7
    if (lufs <= -3) return 90 + ((lufs + 6) / 3) * 5
    return 95 + ((lufs + 3) / 3) * 5
  }

  const startLufsMetering = () => {
    if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current)
    const dataArray = new Float32Array(2048)

    const updateMeter = () => {
      const analyser = rtNodesRef.current.analyser
      const player = playerRef.current

      if (analyser && player && !player.paused && !player.ended) {
        analyser.getFloatTimeDomainData(dataArray)
        let sum = 0
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i] * dataArray[i]
        }
        const rms = Math.sqrt(sum / dataArray.length)
        if (rms > 0.00001) {
          const db = 20 * Math.log10(rms)
          const lufs = db - 0.691
          const clampedLufs = Math.max(-60, Math.min(0, lufs))
          setLufsText(`${clampedLufs.toFixed(1)} LUFS`)
          setVisualLufsPercent(lufsToPercent(clampedLufs))
        } else {
          setLufsText('-∞ LUFS')
          setVisualLufsPercent(0)
        }
        animationFrameIdRef.current = requestAnimationFrame(updateMeter)
      } else {
        setLufsText('-∞ LUFS')
        setVisualLufsPercent(0)
      }
    }

    animationFrameIdRef.current = requestAnimationFrame(updateMeter)
  }

  const stopLufsMetering = () => {
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current)
    }
    setLufsText('-∞ LUFS')
    setVisualLufsPercent(0)
  }

  // File Queue Management & Drag-and-Drop Handlers
  const [isDragging, setIsDragging] = useState<boolean>(false)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files))
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files))
    }
  }

  const addFiles = (files: File[]) => {
    const audioFiles = files.filter(f => f.type.startsWith('audio/') || /\.(wav|mp3|flac|m4a|ogg|aac|wma)$/i.test(f.name))
    if (audioFiles.length === 0 && files.length > 0) {
      alert(uiLanguage === 'KO' ? '오디오 파일만 업로드 가능합니다 (.wav, .mp3 등).' : 'Please drop valid audio files.')
      return
    }
    if (tracks.length + audioFiles.length > 20) {
      alert(uiLanguage === 'KO' ? '최대 20곡까지만 업로드 가능합니다.' : 'Maximum 20 tracks allowed.')
      return
    }

    const newTracks: Track[] = audioFiles.map(file => ({
      id: Math.random().toString(36).substring(2, 9),
      file,
      name: file.name,
      status: 'pending',
      progress: 0
    }))

    setTracks(prev => [...prev, ...newTracks])

    if (!activeTrackId && newTracks.length > 0) {
      loadTrackToPlayer(newTracks[0])
    }
  }

  const loadTrackToPlayer = (track: Track) => {
    initAudioEngine()
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume()
    }
    
    setActiveTrackId(track.id)
    if (playerRef.current) {
      playerRef.current.src = URL.createObjectURL(track.file)
      playerRef.current.load()
      setPlaybackTime(0)
      setIsPlaying(false)
    }
  }

  const togglePlay = () => {
    if (!playerRef.current) return
    initAudioEngine()
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume()
    }

    if (playerRef.current.paused) {
      playerRef.current.play().then(() => {
        setIsPlaying(true)
        startLufsMetering()
      }).catch(console.error)
    } else {
      playerRef.current.pause()
      setIsPlaying(false)
      stopLufsMetering()
    }
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetTime = Number(e.target.value)
    setPlaybackTime(targetTime)
    if (playerRef.current) {
      playerRef.current.currentTime = targetTime
    }
  }

  const removeTrack = (id: string) => {
    setTracks(prev => prev.filter(t => t.id !== id))
    if (activeTrackId === id) {
      if (playerRef.current) {
        playerRef.current.pause()
        playerRef.current.src = ''
      }
      setIsPlaying(false)
      setActiveTrackId(null)
      stopLufsMetering()
    }
  }

  const resetAllSettings = () => {
    setDrive(0)
    setTamer(0)
    setCharacter('standard')
    setWidth(1.0)
    setEq({
      eq60: 0, eq150: 0, eq400: 0, eq1k: 0, eq2_5k: 0, eq6k: 0, eq12k: 0
    })
    setEditingBand(null)
  }

  // Presets Handler
  const applyCharacterPreset = (presetKey: string) => {
    setCharacter(presetKey)
    switch (presetKey) {
      case 'standard':
        setEq({ eq60: 0, eq150: 0, eq400: 0, eq1k: 0, eq2_5k: 0, eq6k: 0, eq12k: 0 })
        break
      case 'clean':
        setEq({ eq60: 0, eq150: 0, eq400: -2.5, eq1k: -1.0, eq2_5k: +1.0, eq6k: +2.0, eq12k: +2.5 })
        break
      case 'punchy':
        setEq({ eq60: +3.0, eq150: +2.5, eq400: -1.0, eq1k: 0, eq2_5k: +1.5, eq6k: +1.0, eq12k: 0 })
        break
      case 'warm':
        setEq({ eq60: +1.5, eq150: +2.5, eq400: +1.5, eq1k: 0, eq2_5k: -1.0, eq6k: -1.5, eq12k: -2.5 })
        break
      case 'airy':
        setEq({ eq60: -1.0, eq150: -0.5, eq400: 0, eq1k: +1.0, eq2_5k: +2.0, eq6k: +3.5, eq12k: +4.5 })
        break
      case 'vshape':
        setEq({ eq60: +3.5, eq150: +2.0, eq400: -2.0, eq1k: -1.5, eq2_5k: +1.0, eq6k: +2.5, eq12k: +3.5 })
        break
    }
  }

  const startEditingEqBand = (bandKey: string, currentVal: number) => {
    setEditingBand(bandKey)
    setEditingValue(currentVal.toFixed(1))
  }

  const commitEditingEqBand = () => {
    if (!editingBand) return
    let val = parseFloat(editingValue)
    if (isNaN(val)) val = 0
    val = Math.max(-10.0, Math.min(10.0, Math.round(val * 10) / 10))
    setEq(prev => ({ ...prev, [editingBand]: val }))
    setEditingBand(null)
  }

  // Offline Render WAV Export
  const processTrackAudio = async (track: Track): Promise<Track> => {
    try {
      const arrayBuf = await track.file.arrayBuffer()
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext
      const tempCtx = new AudioCtxClass()
      const decodedBuffer = await tempCtx.decodeAudioData(arrayBuf)
      tempCtx.close()

      const targetSampleRate = 48000
      const durationSec = decodedBuffer.duration
      const targetLength = Math.ceil(durationSec * targetSampleRate)

      const offlineCtx = new OfflineAudioContext(
        decodedBuffer.numberOfChannels,
        targetLength,
        targetSampleRate
      )

      const source = offlineCtx.createBufferSource()
      source.buffer = decodedBuffer

      const sunoNotch2 = offlineCtx.createBiquadFilter()
      sunoNotch2.type = 'peaking'
      sunoNotch2.frequency.value = 3500
      if (tamer > 0) {
        sunoNotch2.gain.value = -(tamer / 100) * 6.0
        sunoNotch2.Q.value = 1.0 + (tamer / 100) * 1.5
      }

      const highShelf10k = offlineCtx.createBiquadFilter()
      highShelf10k.type = 'highshelf'
      highShelf10k.frequency.value = 10000
      if (tamer > 0) {
        highShelf10k.gain.value = -(tamer / 100) * 4.0
      }

      const eq60 = offlineCtx.createBiquadFilter(); eq60.type = 'lowshelf'; eq60.frequency.value = 60; eq60.gain.value = eq.eq60
      const eq150 = offlineCtx.createBiquadFilter(); eq150.type = 'peaking'; eq150.frequency.value = 150; eq150.gain.value = eq.eq150
      const eq400 = offlineCtx.createBiquadFilter(); eq400.type = 'peaking'; eq400.frequency.value = 400; eq400.gain.value = eq.eq400
      const eq1k = offlineCtx.createBiquadFilter(); eq1k.type = 'peaking'; eq1k.frequency.value = 1000; eq1k.gain.value = eq.eq1k
      const eq2_5k = offlineCtx.createBiquadFilter(); eq2_5k.type = 'peaking'; eq2_5k.frequency.value = 2500; eq2_5k.gain.value = eq.eq2_5k
      const eq6k = offlineCtx.createBiquadFilter(); eq6k.type = 'peaking'; eq6k.frequency.value = 6000; eq6k.gain.value = eq.eq6k
      const eq12k = offlineCtx.createBiquadFilter(); eq12k.type = 'highshelf'; eq12k.frequency.value = 12000; eq12k.gain.value = eq.eq12k

      const splitter = offlineCtx.createChannelSplitter(2)
      const merger = offlineCtx.createChannelMerger(2)
      const gainLL = offlineCtx.createGain()
      const gainLR = offlineCtx.createGain()
      const gainRL = offlineCtx.createGain()
      const gainRR = offlineCtx.createGain()

      const w = width
      gainLL.gain.value = 0.5 * (1 + (2 - w))
      gainRL.gain.value = 0.5 * (1 - (2 - w))
      gainLR.gain.value = 0.5 * (1 - (2 - w))
      gainRR.gain.value = 0.5 * (1 + (2 - w))

      const driveGain = offlineCtx.createGain()
      driveGain.gain.value = Math.pow(10, drive / 20)

      const limiter = offlineCtx.createDynamicsCompressor()
      limiter.threshold.value = -0.5
      limiter.knee.value = 0
      limiter.ratio.value = 20
      limiter.attack.value = 0.001
      limiter.release.value = 0.05

      const softClipper = offlineCtx.createWaveShaper()
      softClipper.curve = makeSoftClipCurve(1.5)
      softClipper.oversample = '4x'

      source.connect(sunoNotch2)
      sunoNotch2.connect(highShelf10k)
      highShelf10k.connect(eq60)
      eq60.connect(eq150)
      eq150.connect(eq400)
      eq400.connect(eq1k)
      eq1k.connect(eq2_5k)
      eq2_5k.connect(eq6k)
      eq6k.connect(eq12k)

      eq12k.connect(splitter)
      splitter.connect(gainLL, 0); splitter.connect(gainLR, 0)
      splitter.connect(gainRL, 1); splitter.connect(gainRR, 1)

      gainLL.connect(merger, 0, 0); gainRL.connect(merger, 0, 0)
      gainLR.connect(merger, 0, 1); gainRR.connect(merger, 0, 1)

      merger.connect(driveGain)
      driveGain.connect(limiter)
      limiter.connect(softClipper)
      softClipper.connect(offlineCtx.destination)

      source.start()
      const renderedBuf = await offlineCtx.startRendering()
      const wavBlob = audioBufferToWav(renderedBuf)
      const processedUrl = URL.createObjectURL(wavBlob)

      return {
        ...track,
        originalBuffer: decodedBuffer,
        processedBuffer: renderedBuf,
        processedBlob: wavBlob,
        processedUrl,
        status: 'done',
        progress: 100
      }
    } catch (err) {
      console.error('Error processing audio:', err)
      return { ...track, status: 'error' }
    }
  }

  const processAllBatch = async () => {
    if (tracks.length === 0) return
    setIsProcessingBatch(true)
    setTracks(prev => prev.map(t => ({ ...t, status: 'processing', progress: 10 })))

    const results: Track[] = []
    for (let i = 0; i < tracks.length; i++) {
      const result = await processTrackAudio(tracks[i])
      results.push(result)
      setTracks(prev => prev.map(t => t.id === tracks[i].id ? result : t))
    }
    setIsProcessingBatch(false)

    for (const resTrack of results) {
      if (resTrack.status === 'done') {
        await downloadTrack(resTrack, exportFormat)
      }
    }
  }

  const [exportFormat, setExportFormat] = useState<'wav' | 'mp3'>('mp3')
  const [isConvertingMp3, setIsConvertingMp3] = useState<Record<string, boolean>>({})

  const downloadTrack = async (track: Track, format: 'wav' | 'mp3') => {
    let targetTrack = track
    if (targetTrack.status !== 'done' || !targetTrack.processedBlob) {
      targetTrack = await processTrackAudio(track)
      setTracks(prev => prev.map(t => t.id === track.id ? targetTrack : t))
    }

    if (!targetTrack.processedBlob && !targetTrack.processedUrl) return
    const baseName = targetTrack.name.replace(/\.[^/.]+$/, '')

    if (format === 'wav') {
      const a = document.createElement('a')
      a.href = targetTrack.processedUrl!
      a.download = `CookieMusic_Mastered_${baseName}.wav`
      a.click()
    } else {
      setIsConvertingMp3(prev => ({ ...prev, [targetTrack.id]: true }))
      try {
        const formData = new FormData()
        formData.append('file', targetTrack.processedBlob!, `${baseName}.wav`)

        const res = await fetch('/api/convert-to-mp3', {
          method: 'POST',
          body: formData,
        })
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}))
          throw new Error(errJson.error || 'MP3 conversion failed')
        }
        const mp3Blob = await res.blob()
        const mp3Url = URL.createObjectURL(mp3Blob)
        const a = document.createElement('a')
        a.href = mp3Url
        a.download = `CookieMusic_Mastered_${baseName}.mp3`
        a.click()
        setTimeout(() => URL.revokeObjectURL(mp3Url), 10000)
      } catch (err) {
        console.error('MP3 conversion error:', err)
        alert('MP3 변환 실패. WAV 무손실 파일로 대체 다운로드합니다.')
        const a = document.createElement('a')
        a.href = targetTrack.processedUrl!
        a.download = `CookieMusic_Mastered_${baseName}.wav`
        a.click()
      } finally {
        setIsConvertingMp3(prev => ({ ...prev, [targetTrack.id]: false }))
      }
    }
  }

  const downloadProcessedWav = (track: Track) => {
    downloadTrack(track, exportFormat)
  }

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00'
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const activeTrack = tracks.find(t => t.id === activeTrackId)

  return (
    <div className="w-full pb-10 text-white font-sans selection:bg-primary selection:text-black space-y-8 animate-in fade-in duration-500">
      
      {/* Hidden Audio Element */}
      <audio 
        ref={playerRef} 
        onPlay={() => { setIsPlaying(true); startLufsMetering(); }}
        onPause={() => { setIsPlaying(false); stopLufsMetering(); }}
        onTimeUpdate={() => setPlaybackTime(playerRef.current?.currentTime || 0)}
        onLoadedMetadata={() => setDuration(playerRef.current?.duration || 0)}
        onEnded={() => { setIsPlaying(false); stopLufsMetering(); }}
      />

      {/* 🚀 Sleek DAW Header & Presets Toolbar */}
      <StudioHero
        badge={
          <>
            <Zap className="w-3.5 h-3.5" />
            <span>Next-Gen Audio Engine</span>
          </>
        }
        title={
          uiLanguage === 'KO' ? (
            <>AI 음원 <span className="text-primary drop-shadow-[0_0_15px_rgba(var(--cm-brand-rgb),0.4)]">마스터링 스튜디오</span></>
          ) : (
            <>COOKIEMUSIC <span className="text-primary drop-shadow-[0_0_15px_rgba(var(--cm-brand-rgb),0.4)]">MASTERING STUDIO</span></>
          )
        }
        desc="Web Audio API 기반 48kHz 실시간 7밴드 Parametric EQ, Maximizer, De-Harsh 및 LUFS 라우드니스 프로세서"
        bg="/studio/hero-console.webp"
      >
          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center gap-2 bg-black/60 backdrop-blur-xl p-2 rounded-2xl border border-white/10">
            {[
              { key: 'standard', label: 'Standard (기본)' },
              { key: 'clean', label: 'Clean (선명)' },
              { key: 'punchy', label: 'Punchy (타격감)' },
              { key: 'warm', label: 'Warm (따뜻함)' },
              { key: 'airy', label: 'Airy (고음 공간감)' },
              { key: 'vshape', label: 'V-Shape (다이나믹)' },
            ].map(p => (
              <button
                key={p.key}
                onClick={() => applyCharacterPreset(p.key)}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  character === p.key 
                    ? 'bg-primary text-black shadow-[0_0_10px_rgba(var(--cm-brand-rgb),0.4)]' 
                    : 'text-zinc-400 hover:text-white hover:bg-white/10'
                }`}
              >
                {p.label}
              </button>
            ))}
            
            <button
              onClick={resetAllSettings}
              className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors ml-auto cursor-pointer"
              title="설정 초기화"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
      </StudioHero>

      {/* 🎛️ Upper Grid: Track Source & LUFS Workstation Console */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Card: File Queue & Player (5 cols) */}
        <div className="lg:col-span-5 bg-[#0f1115]/90 border border-white/10 rounded-3xl p-6 shadow-xl backdrop-blur-md flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Disc className="w-5 h-5 text-primary" />
                <h3 className="text-base font-extrabold text-white">음원 파일 트랙</h3>
              </div>
              <span className="text-xs font-bold text-zinc-400 bg-white/5 px-2.5 py-1 rounded-full border border-white/10">
                {tracks.length} / 20 Tracks
              </span>
            </div>

            {/* Dropzone */}
            <div 
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all group relative overflow-hidden ${
                isDragging 
                  ? 'border-primary bg-primary/20 scale-[1.02] shadow-[0_0_20px_rgba(var(--cm-brand-rgb),0.3)]' 
                  : 'border-white/15 hover:border-primary bg-black/40 hover:bg-black/60'
              }`}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".wav,.mp3,.flac,.m4a" 
                multiple 
                onChange={handleFileChange} 
              />
              <Upload className="w-8 h-8 text-zinc-500 group-hover:text-primary mx-auto mb-2 transition-colors group-hover:scale-110" />
              <p className="text-xs font-extrabold text-zinc-200 group-hover:text-white">
                음원 파일(.wav, .mp3)을 클릭하거나 드래그하세요
              </p>
              <p className="text-[10px] text-zinc-500 mt-1 font-medium">드래그 앤 드롭으로 일괄 업로드 지원</p>
            </div>

            {/* Queue List */}
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
              {tracks.length === 0 ? (
                <div className="text-center py-8 text-zinc-600 text-xs font-medium">
                  대기 중인 음원 파일이 없습니다.
                </div>
              ) : (
                tracks.map(t => (
                  <div 
                    key={t.id}
                    onClick={() => loadTrackToPlayer(t)}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                      activeTrackId === t.id 
                        ? 'bg-primary/10 border-primary/50 text-white' 
                        : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.07] text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <Music className={`w-4 h-4 shrink-0 ${activeTrackId === t.id ? 'text-primary' : 'text-zinc-500'}`} />
                      <span className="text-xs font-bold truncate">{t.name}</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {t.status === 'done' && (
                        <>
                          <button 
                            onClick={(e) => { e.stopPropagation(); downloadTrack(t, 'mp3'); }}
                            disabled={isConvertingMp3[t.id]}
                            className="px-2 py-1 rounded-md bg-primary hover:bg-[var(--cm-brand-dim)] text-black font-extrabold text-[10px] transition-all flex items-center gap-1 shadow-sm disabled:opacity-50 cursor-pointer"
                            title="MP3 (320kbps) 다운로드"
                          >
                            {isConvertingMp3[t.id] ? (
                              <RotateCcw className="w-3 h-3 animate-spin" />
                            ) : (
                              <Download className="w-3 h-3" />
                            )}
                            <span>MP3</span>
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); downloadTrack(t, 'wav'); }}
                            className="px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 text-white font-extrabold text-[10px] transition-all flex items-center gap-1 border border-white/10 cursor-pointer"
                            title="WAV (48kHz 무손실) 다운로드"
                          >
                            <Download className="w-3 h-3 text-primary" />
                            <span>WAV</span>
                          </button>
                        </>
                      )}
                      <button 
                        onClick={(e) => { e.stopPropagation(); removeTrack(t.id); }}
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Active Track Transport & A/B Switch */}
          {activeTrack && (
            <div className="pt-4 border-t border-white/10 space-y-3">
              <div className="flex items-center gap-3">
                <button 
                  onClick={togglePlay}
                  className="w-12 h-12 rounded-2xl bg-primary hover:bg-[var(--cm-brand-dim)] text-black font-extrabold flex items-center justify-center transition-transform active:scale-95 cursor-pointer shadow-[0_0_15px_rgba(var(--cm-brand-rgb),0.3)] shrink-0"
                >
                  {isPlaying ? <Pause className="w-6 h-6 fill-black" /> : <Play className="w-6 h-6 fill-black ml-0.5" />}
                </button>
                
                <div className="flex-1 space-y-1">
                  <div className="flex justify-between text-xs font-bold text-zinc-300">
                    <span className="truncate max-w-[180px]">{activeTrack.name}</span>
                    <span className="font-mono text-primary text-[11px]">{formatTime(playbackTime)} / {formatTime(duration)}</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max={duration || 100} 
                    step="0.1"
                    value={playbackTime}
                    onChange={handleSeek}
                    className="w-full h-1.5 bg-black rounded-full accent-primary cursor-pointer"
                  />
                </div>
              </div>

              {/* A/B Comparison Switch */}
              <div className="flex items-center justify-between bg-black/50 p-2.5 rounded-2xl border border-white/10">
                <span className="text-xs font-bold text-zinc-400 pl-2">🎧 실시간 모니터링 모드</span>
                <div className="flex items-center bg-zinc-900 rounded-xl p-1 border border-white/10">
                  <button 
                    onClick={() => setAbToggle(true)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      abToggle ? 'bg-primary text-black shadow-md' : 'text-zinc-500 hover:text-white'
                    }`}
                  >
                    MASTERED 🟢
                  </button>
                  <button 
                    onClick={() => setAbToggle(false)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      !abToggle ? 'bg-red-500 text-white shadow-md' : 'text-zinc-500 hover:text-white'
                    }`}
                  >
                    BYPASS 🔴
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Card: LUFS Workstation Display (7 cols) */}
        <div className="lg:col-span-7 bg-[#0f1115]/90 border border-white/10 rounded-3xl p-6 lg:p-8 shadow-xl backdrop-blur-md flex flex-col justify-between space-y-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                <h3 className="text-base font-extrabold text-white">유통사 표준 LUFS 라우드니스 콘솔</h3>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-zinc-400 bg-white/5 px-3 py-1 rounded-full border border-white/10">
                <span>EBU R128</span>
                <span className="text-primary">(-14 LUFS Target)</span>
              </div>
            </div>

            {/* Main Visual LUFS Meter Display */}
            <div className="bg-[#090a0d] border border-white/10 rounded-2xl p-5 space-y-4 shadow-inner">
              <div className="flex justify-between items-end border-b border-white/5 pb-3">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Short-Term Loudness</span>
                <span className="text-3xl lg:text-4xl font-black font-mono text-primary drop-shadow-[0_0_15px_rgba(var(--cm-brand-rgb),0.5)]">
                  {lufsText}
                </span>
              </div>

              {/* Dual Scale LUFS Level Meter */}
              <div className="space-y-1.5">
                <div className="relative w-full h-3 text-[9px] text-zinc-500 font-mono select-none">
                  <span className="absolute left-[0%] -translate-x-1/2">-60</span>
                  <span className="absolute left-[28%] -translate-x-1/2">-30</span>
                  <span className="absolute left-[48%] -translate-x-1/2">-20</span>
                  <span className="absolute left-[68%] -translate-x-1/2 text-primary font-bold">-14 LUFS</span>
                  <span className="absolute left-[83%] -translate-x-1/2">-9</span>
                  <span className="absolute left-[100%] -translate-x-full text-red-500">0</span>
                </div>

                <div className="w-full h-4 bg-[#1a1a1a] rounded relative overflow-hidden border border-white/10 shadow-inner">
                  <div 
                    className="h-full rounded-l transition-all duration-75 ease-out"
                    style={{ 
                      width: `${visualLufsPercent}%`,
                      background: 'linear-gradient(90deg, #4caf50 0%, #4caf50 60%, #ffeb3b 68%, #ff9800 83%, #f44336 90%, #f44336 100%)' 
                    }}
                  />
                  <div className="absolute top-0 left-[68%] w-0.5 h-full bg-primary z-10 shadow-[0_0_8px_var(--cm-brand)]" title="Target -14 LUFS / 0 LU" />
                </div>

                <div className="relative w-full h-3 text-[9px] text-zinc-500 font-mono select-none">
                  <span className="absolute left-[0%] -translate-x-1/2">-46</span>
                  <span className="absolute left-[28%] -translate-x-1/2">-16</span>
                  <span className="absolute left-[48%] -translate-x-1/2">-6</span>
                  <span className="absolute left-[68%] -translate-x-1/2 text-primary font-bold">0 LU</span>
                  <span className="absolute left-[83%] -translate-x-1/2">+5</span>
                  <span className="absolute left-[100%] -translate-x-full text-red-500">+14</span>
                </div>
              </div>
            </div>

            {/* Quick Metrics Cards */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-black/40 border border-white/5 rounded-xl p-3">
                <span className="text-[10px] font-bold text-zinc-500 block mb-1">DRIVE BOOST</span>
                <span className="text-sm font-black font-mono text-primary">+{drive.toFixed(1)} dB</span>
              </div>
              <div className="bg-black/40 border border-white/5 rounded-xl p-3">
                <span className="text-[10px] font-bold text-zinc-500 block mb-1">DE-HARSH</span>
                <span className="text-sm font-black font-mono text-primary">{tamer === 0 ? 'BYPASS' : `${tamer}%`}</span>
              </div>
              <div className="bg-black/40 border border-white/5 rounded-xl p-3">
                <span className="text-[10px] font-bold text-zinc-500 block mb-1">STEREO WIDTH</span>
                <span className="text-sm font-black font-mono text-primary">{Math.round(width * 100)}%</span>
              </div>
            </div>
          </div>

          {/* Master Format Selector & Download Action */}
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-black/60 p-2.5 rounded-2xl border border-white/10">
              <span className="text-xs font-bold text-zinc-400 pl-2">💾 추출 포맷 선택</span>
              <div className="flex items-center bg-zinc-900 rounded-xl p-1 border border-white/10">
                <button 
                  onClick={() => setExportFormat('mp3')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    exportFormat === 'mp3' ? 'bg-primary text-black shadow-md' : 'text-zinc-500 hover:text-white'
                  }`}
                >
                  MP3 (320kbps) 🎵
                </button>
                <button 
                  onClick={() => setExportFormat('wav')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    exportFormat === 'wav' ? 'bg-primary text-black shadow-md' : 'text-zinc-500 hover:text-white'
                  }`}
                >
                  WAV (무손실 48kHz) 💿
                </button>
              </div>
            </div>

            <button 
              onClick={processAllBatch}
              disabled={isProcessingBatch || tracks.length === 0}
              className="w-full py-4 bg-primary hover:bg-[var(--cm-brand-dim)] text-black font-black text-sm lg:text-base rounded-2xl transition-all shadow-[0_0_20px_rgba(var(--cm-brand-rgb),0.3)] hover:shadow-[0_0_30px_rgba(var(--cm-brand-rgb),0.5)] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer uppercase"
            >
              {isProcessingBatch ? (
                <>
                  <RotateCcw className="w-5 h-5 animate-spin" />
                  <span>오프라인 렌더링 중...</span>
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  <span>마스터링 최종본 추출 ({tracks.length}개 곡 {exportFormat.toUpperCase()})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 🎛️ Lower Grid: DAW Parameter Rack Console */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Module 1: Loudness & Noise Control (4 cols) */}
        <div className="lg:col-span-4 bg-[#0f1115]/90 border border-white/10 rounded-3xl p-6 space-y-6 shadow-xl backdrop-blur-md">
          <div className="flex items-center gap-2">
            <Gauge className="w-5 h-5 text-primary" />
            <h3 className="text-base font-extrabold text-white">볼륨 & 노이즈 프로세서</h3>
          </div>

          {/* Drive Slider */}
          <div className="space-y-2 bg-black/40 p-4 rounded-2xl border border-white/5">
            <div className="flex justify-between items-center text-xs font-bold">
              <span className="text-zinc-300">Maximizer Drive</span>
              <span className="text-primary font-mono font-black">{drive.toFixed(1)} dB</span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="10" 
              step="0.1" 
              value={drive} 
              onChange={(e) => setDrive(parseFloat(e.target.value))}
              className="w-full h-2 bg-black rounded-full accent-primary cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-zinc-500">
              <span>Original</span>
              <span className="text-primary">Target 0 LU</span>
            </div>
          </div>

          {/* De-Harsh Slider */}
          <div className="space-y-2 bg-black/40 p-4 rounded-2xl border border-white/5">
            <div className="flex justify-between items-center text-xs font-bold">
              <span className="text-zinc-300">Suno De-Harsh</span>
              <span className="text-primary font-mono">{tamer === 0 ? 'Off' : `${tamer}%`}</span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="100" 
              step="1" 
              value={tamer} 
              onChange={(e) => setTamer(parseInt(e.target.value))}
              className="w-full h-2 bg-black rounded-full accent-primary cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-zinc-500">
              <span>Bypass</span>
              <span className="text-primary">추천 (50%)</span>
              <span>Heavy Cut</span>
            </div>
          </div>

          {/* Stereo Width */}
          <div className="space-y-2 bg-black/40 p-4 rounded-2xl border border-white/5">
            <div className="flex justify-between items-center text-xs font-bold">
              <span className="text-zinc-300">Stereo Width Matrix</span>
              <span className="text-primary font-mono">{Math.round(width * 100)}%</span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="2" 
              step="0.01" 
              value={width} 
              onChange={(e) => setWidth(parseFloat(e.target.value))}
              className="w-full h-2 bg-black rounded-full accent-primary cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-zinc-500">
              <span>Mono</span>
              <span>100%</span>
              <span>200% Wide</span>
            </div>
          </div>
        </div>

        {/* Module 2: Pro 7-Band Graphic EQ Fader Console (8 cols) */}
        <div className="lg:col-span-8 bg-[#0f1115]/90 border border-white/10 rounded-3xl p-6 lg:p-8 space-y-6 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-primary" />
              <h3 className="text-base font-extrabold text-white">프로페셔널 7밴드 Parametric EQ 콘솔</h3>
            </div>
            <span className="text-xs text-zinc-500 font-medium">수치 클릭 시 직접 입력 지원</span>
          </div>

          {/* 7-Band Vertical Fader Rack */}
          <div className="grid grid-cols-7 gap-2 lg:gap-4 bg-black/60 p-5 rounded-2xl border border-white/10">
            {[
              { key: 'eq60', label: 'Sub', freq: '60Hz' },
              { key: 'eq150', label: 'Bass', freq: '150Hz' },
              { key: 'eq400', label: 'L-Mid', freq: '400Hz' },
              { key: 'eq1k', label: 'Mid', freq: '1kHz' },
              { key: 'eq2_5k', label: 'H-Mid', freq: '2.5kHz' },
              { key: 'eq6k', label: 'Pres', freq: '6kHz' },
              { key: 'eq12k', label: 'Air', freq: '12kHz' },
            ].map(b => {
              const currentVal = (eq as any)[b.key]
              const isEditing = editingBand === b.key

              return (
                <div key={b.key} className="flex flex-col items-center">
                  {/* Band Title */}
                  <div className="text-[11px] text-center text-zinc-400 mb-2 font-bold">
                    <span className="text-zinc-200 block">{b.label}</span>
                    <span className="text-[9px] text-zinc-500 font-mono">{b.freq}</span>
                  </div>

                  {/* Fader Track */}
                  <div className="h-36 flex items-center justify-center relative w-full my-2">
                    <input 
                      type="range" 
                      min="-10" 
                      max="10" 
                      step="0.1" 
                      value={currentVal} 
                      onChange={(e) => {
                        const val = parseFloat(e.target.value)
                        setEq(prev => ({ ...prev, [b.key]: val }))
                        setCharacter('custom')
                      }}
                      className="w-32 h-2 bg-zinc-900 rounded-full accent-primary cursor-pointer -rotate-90 origin-center absolute shadow-inner"
                    />
                  </div>

                  {/* Editable Value Tag */}
                  {isEditing ? (
                    <input 
                      type="number"
                      step="0.1"
                      min="-10"
                      max="10"
                      autoFocus
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      onBlur={commitEditingEqBand}
                      onKeyDown={(e) => e.key === 'Enter' && commitEditingEqBand()}
                      className="w-12 bg-black text-primary border border-primary rounded-lg text-xs font-mono font-bold text-center p-0.5 outline-none"
                    />
                  ) : (
                    <span 
                      onClick={() => startEditingEqBand(b.key, currentVal)}
                      className="text-[11px] font-mono font-bold text-primary cursor-pointer hover:bg-white/10 px-2 py-1 rounded-lg border border-white/10 transition-colors"
                      title="클릭하여 직접 수치 입력"
                    >
                      {currentVal > 0 ? `+${currentVal.toFixed(1)}` : currentVal.toFixed(1)}dB
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

      </div>

    </div>
  )
}
