'use client'

import { useState } from 'react'

interface Props {
  url: string
  content: string
  predictorName: string
  verdict: 'correct' | 'bullshit' | null
}

export default function ShareButtons({ url, content, predictorName, verdict }: Props) {
  const [copied, setCopied] = useState(false)

  const shareText = verdict === 'bullshit'
    ? `${predictorName} 嘴炮了！「${content.slice(0, 30)}」`
    : verdict === 'correct'
    ? `${predictorName} 準了！「${content.slice(0, 30)}」`
    : `「${content.slice(0, 30)}」— YouSaidSo 你說的哦`

  const encodedUrl = encodeURIComponent(url)
  const encodedText = encodeURIComponent(shareText)

  async function copyLink() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const linkClass =
    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#21262d] text-xs font-semibold text-[#6e7681] hover:text-[#e6edf3] hover:border-[#30363d] transition-colors'

  return (
    <div className="mt-4">
      <p className="text-[10px] font-bold text-[#6e7681] uppercase tracking-widest mb-2">分享</p>
      <div className="flex flex-wrap gap-2">
        <a
          href={`https://social-plugins.line.me/lineit/share?url=${encodedUrl}`}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
        >
          LINE
        </a>
        <a
          href={`https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
        >
          X
        </a>
        <a
          href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
        >
          Facebook
        </a>
        <a
          href={`https://www.threads.net/intent/post?text=${encodedText}%20${encodedUrl}`}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
        >
          Threads
        </a>
        <button
          onClick={copyLink}
          className={`${linkClass} ${copied ? 'text-green-400 border-green-500/50' : ''}`}
        >
          {copied ? '✓ 已複製' : '複製連結'}
        </button>
      </div>
    </div>
  )
}
