'use client'

import { useEffect, useRef, useState, type ImgHTMLAttributes } from 'react'

/** 늦게 뜨는 그림 — 시머 스켈레톤 뒤에 있다가 불러오면 페이드인한다(캐시에서 이미 온 그림은 바로). 모션 줄이기는 CSS 가 즉시 표시. */
export function FadeImg({ className = '', onLoad, style, alt = '', ...rest }: ImgHTMLAttributes<HTMLImageElement>) {
  const [loaded, setLoaded] = useState(false)
  const ref = useRef<HTMLImageElement>(null)
  useEffect(() => {
    if (ref.current?.complete && ref.current.naturalWidth > 0) setLoaded(true)
  }, [rest.src])
  return (
    <>
      {!loaded && <span data-testid="img-skeleton" aria-hidden className="absolute inset-0 animate-pulse bg-white/[0.05] motion-reduce:animate-none" />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={ref}
        alt={alt}
        {...rest}
        onLoad={(e) => { setLoaded(true); onLoad?.(e) }}
        className={`${className} ${loaded ? 'cm-img-in' : ''}`}
        style={loaded ? style : { ...style, opacity: 0 }}
      />
    </>
  )
}
