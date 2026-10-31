'use client'

import { useEffect, useState } from 'react'
import { resolveStudioAudioUrl } from '@/lib/studio/audioUrl'
import { withCorsCacheKey } from '@/lib/audio/corsUrl'

const durationCache: Record<string, number> = {}

function format(secs: number) {
  return `${Math.floor(secs / 60)}:${Math.floor(secs % 60).toString().padStart(2, '0')}`
}

async function resolveUrl(url: string): Promise<string> {
  const u = await resolveStudioAudioUrl(url)
  if (!u) throw new Error('sign failed')
  return u
}

export function AudioDuration({ url, className = '' }: { url: string; className?: string }) {
  const [durationStr, setDurationStr] = useState<string>(
    url && durationCache[url] !== undefined ? format(durationCache[url]) : '-:-'
  )

  useEffect(() => {
    if (!url) return
    if (durationCache[url] !== undefined) {
      setDurationStr(format(durationCache[url]))
      return
    }

    let cancelled = false
    let audio: HTMLAudioElement | null = null
    const onMeta = () => {
      const secs = audio?.duration
      if (secs !== undefined && !isNaN(secs) && isFinite(secs)) {
        durationCache[url] = secs
        if (!cancelled) setDurationStr(format(secs))
      }
    }
    resolveUrl(url)
      .then((src) => {
        if (cancelled) return
        audio = new Audio()
        audio.preload = 'metadata'
        audio.muted = true
        audio.addEventListener('loadedmetadata', onMeta)
        // 플레이어가 같은 음원을 crossOrigin 으로 열 때 CORS 없이 받은 캐시가 재사용되면 오류가 난다 — CORS 로 받고, 거부되면 한 번만 CORS 없이.
        const corsSrc = withCorsCacheKey(src)
        if (corsSrc !== src) {
          audio.crossOrigin = 'anonymous'
          const a = audio
          a.addEventListener('error', () => {
            if (a.crossOrigin) { a.removeAttribute('crossorigin'); a.src = corsSrc }
          }, { once: true })
        }
        audio.src = corsSrc
      })
      .catch(() => {})

    return () => {
      cancelled = true
      if (audio) {
        audio.removeEventListener('loadedmetadata', onMeta)
        audio.src = ''
      }
    }
  }, [url])

  return <span className={className}>{durationStr}</span>
}
