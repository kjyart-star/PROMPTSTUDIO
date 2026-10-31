'use client'

import { useState, useEffect } from 'react'
import { withCorsCacheKey } from '@/lib/audio/corsUrl'

interface AudioDurationProps {
  url: string
  defaultSec?: number | null
  fallback?: string
  className?: string
}

export function AudioDuration({ url, defaultSec, fallback = '-', className = '' }: AudioDurationProps) {
  const [duration, setDuration] = useState<number | null>(defaultSec || null)

  useEffect(() => {
    // If we already have a valid default duration, use it
    if (defaultSec && defaultSec > 0) {
      setDuration(defaultSec)
      return
    }

    if (!url) return

    // 같은 주소를 플레이어가 crossOrigin 으로 다시 열 때, 여기서 CORS 없이 받아 둔 캐시(immutable)가
    // 재사용되면 CORS 오류가 난다 — 처음부터 CORS 로 받는다. 거부되면 한 번만 CORS 없이 다시 연다.
    const audio = new Audio()
    audio.preload = 'metadata'
    const corsUrl = withCorsCacheKey(url)
    if (corsUrl !== url) {
      audio.crossOrigin = 'anonymous'
      audio.addEventListener('error', () => {
        if (audio.crossOrigin) { audio.removeAttribute('crossorigin'); audio.src = corsUrl }
      }, { once: true })
    }
    audio.src = corsUrl
    
    const onLoadedMetadata = () => {
      if (audio.duration && audio.duration !== Infinity && !isNaN(audio.duration)) {
        setDuration(audio.duration)
      }
    }

    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    
    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.src = ''
    }
  }, [url, defaultSec])

  if (duration === null) {
    return <span className={className}>{fallback}</span>
  }

  const mins = Math.floor(duration / 60)
  const secs = Math.floor(duration % 60).toString().padStart(2, '0')
  
  return <span className={className}>{mins}:{secs}</span>
}
