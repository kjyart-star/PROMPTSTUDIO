'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Copy, Check, Share2, X } from 'lucide-react'

interface ShareDialogProps {
  isOpen: boolean
  title: string
  url: string
  uiLanguage: string
  onClose: () => void
}

export function ShareDialog({
  isOpen,
  title,
  url,
  uiLanguage,
  onClose
}: ShareDialogProps) {
  const [mounted, setMounted] = useState(false)
  const [copied, setCopied] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setMounted(true)
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      setCopied(false)
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      if (closeTimer.current) clearTimeout(closeTimer.current)
      closeTimer.current = setTimeout(() => {
        onClose()
      }, 1500)
    } catch {
      // Clipboard can fail on non-secure contexts / denied permission.
      setCopied(false)
    }
  }

  if (!isOpen || !mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      <div className="relative bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-fade-in-up z-10 flex flex-col gap-5">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        
        <div className="flex flex-col items-center text-center gap-3 mt-2">
          <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mb-1">
            <Share2 className="w-6 h-6 text-primary" />
          </div>
          <h3 className="text-xl font-bold text-white">
            {uiLanguage === 'KO' ? '공유하기' : uiLanguage === 'JA' ? '共有する' : 'Share'}
          </h3>
          <p className="text-sm text-zinc-400">
            {uiLanguage === 'KO' ? `"${title}" 곡을 친구들과 공유해보세요.` : uiLanguage === 'JA' ? `"${title}" を友達と共有しましょう。` : `Share "${title}" with your friends.`}
          </p>
        </div>

        <div className="flex items-center gap-2 mt-2 bg-black/50 p-2 rounded-xl border border-white/5">
          <input 
            type="text" 
            readOnly 
            value={url}
            className="flex-1 bg-transparent text-sm text-zinc-300 px-2 outline-none w-full truncate"
          />
          <button
            onClick={handleCopy}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              copied 
                ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                : 'bg-primary text-[#090909] hover:bg-primary hover:scale-105 active:scale-95 shadow-lg shadow-primary/20'
            }`}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                {uiLanguage === 'KO' ? '복사됨' : 'Copied'}
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                {uiLanguage === 'KO' ? '복사' : 'Copy'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
