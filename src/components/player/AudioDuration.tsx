'use client'

import { useState, useEffect } from 'react'

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

    const audio = new Audio(url)
    audio.preload = 'metadata'
    
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
