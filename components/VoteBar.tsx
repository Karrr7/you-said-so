// components/VoteBar.tsx
'use client'
import { useState, useEffect } from 'react'
import type { VoteCounts } from '@/lib/types'

interface Props {
  predictionId: string
  initialCounts: VoteCounts
}

export default function VoteBar({ predictionId, initialCounts }: Props) {
  const [counts, setCounts] = useState(initialCounts)
  const [userVote, setUserVote] = useState<'correct' | 'bullshit' | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch(`/api/vote?prediction_id=${predictionId}`)
      .then(r => r.json())
      .then(data => {
        setCounts({ correct: data.correct, bullshit: data.bullshit })
        setUserVote(data.userVote)
      })
      .catch(() => {})
  }, [predictionId])

  async function vote(choice: 'correct' | 'bullshit') {
    if (loading) return
    setLoading(true)

    const prev = { counts: { ...counts }, userVote }
    const next = { ...counts }
    if (userVote) next[userVote] = Math.max(0, next[userVote] - 1)
    next[choice]++
    setCounts(next)
    setUserVote(choice)

    const res = await fetch('/api/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prediction_id: predictionId, choice }),
    })

    if (!res.ok) {
      setCounts(prev.counts)
      setUserVote(prev.userVote)
      if (res.status === 401) alert('請先登入才能投票')
    } else {
      const data = await res.json()
      setCounts({ correct: data.correct, bullshit: data.bullshit })
      setUserVote(data.userVote)
    }
    setLoading(false)
  }

  const total = counts.correct + counts.bullshit
  const pct = total > 0 ? Math.round(counts.bullshit / total * 100) : 50

  return (
    <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-4 mb-4">
      <p className="text-xs text-[#6e7681] mb-3 font-medium">你覺得這則預言…</p>
      <div className="flex gap-3 mb-3">
        <button
          onClick={() => vote('bullshit')}
          disabled={loading}
          className={`flex-1 py-2 rounded-lg border-2 font-bold text-sm transition-all ${
            userVote === 'bullshit'
              ? 'bg-red-500/20 border-red-500 text-red-400'
              : 'border-[#21262d] text-[#6e7681] hover:border-red-500/50 hover:text-red-400'
          }`}
        >
          {total > 0 ? `嘴炮 ${pct}%` : '嘴炮'}
        </button>
        <button
          onClick={() => vote('correct')}
          disabled={loading}
          className={`flex-1 py-2 rounded-lg border-2 font-bold text-sm transition-all ${
            userVote === 'correct'
              ? 'bg-green-500/20 border-green-600 text-green-400'
              : 'border-[#21262d] text-[#6e7681] hover:border-green-600/50 hover:text-green-400'
          }`}
        >
          {total > 0 ? `準了 ${100 - pct}%` : '準了'}
        </button>
      </div>
      {total > 0 && (
        <div className="h-1.5 bg-[#21262d] rounded overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-red-500 to-purple-500 rounded transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  )
}
