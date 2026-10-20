'use client'

import { useEffect, useState } from 'react'
import { withBase } from '@/lib/basePath'

const durationCache: Record<string, number> = {}

function format(secs: number) {
  return `${Math.floor(secs / 60)}:${Math.floor(secs % 60).toString().padStart(2, '0')}`
}

/** 스토리지 경로(audio/xxx.mp3)는 그대로는 Audio 가 못 읽는다 — 서명 URL 로 바꿔서 길이만 읽는다. */
async function resolveUrl(url: string): Promise<string> {
  if (/^https?:\/\//i.test(url)) return url
  const res = await fetch(withBase(`/api/tracks/signed-url?file_path=${encodeURIComponent(url)}`))
  if (!res.ok) throw new Error('sign failed')
  const data = await res.json()
  if (!data.signedUrl) throw new Error('no signed url')
  return data.signedUrl
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
        audio.src = src
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
