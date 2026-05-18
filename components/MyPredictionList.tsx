'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Prediction {
  id: string
  content: string
  status: string
  deleted_at: string | null
  deadline: string
  predictor: { name: string; slug: string }
  locale: string
  slug: string
}

interface Props {
  predictions: Prediction[]
  locale: string
}

export default function MyPredictionList({ predictions, locale }: Props) {
  const [withdrawn, setWithdrawn] = useState<Set<string>>(new Set())

  async function withdraw(id: string) {
    const res = await fetch(`/api/predictions/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setWithdrawn(prev => new Set([...prev, id]))
    } else {
      alert('無法撤回，請稍後再試')
    }
  }

  if (predictions.length === 0) {
    return (
      <p className="text-[#6e7681] text-sm text-center py-12">
        你還沒有提交過預言
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {predictions.map(p => {
        const isWithdrawn = withdrawn.has(p.id) || !!p.deleted_at
        const canWithdraw = p.status === 'pending_review' && !p.deleted_at && !withdrawn.has(p.id)

        const statusLabel = isWithdrawn
          ? <span className="text-[#6e7681]">已撤回</span>
          : p.status === 'pending_review'
          ? <span className="text-yellow-500/80">審核中</span>
          : p.status === 'active'
          ? <span className="text-green-400">已上線</span>
          : p.status === 'community_vote'
          ? <span className="text-purple-400">投票中</span>
          : p.status === 'resolved'
          ? <span className="text-blue-400">已判定</span>
          : <span className="text-[#6e7681]">{p.status}</span>

        return (
          <div key={p.id} className="bg-[#161b22] border border-[#21262d] rounded-xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#e6edf3] leading-snug mb-1">
                  {isWithdrawn
                    ? <span className="line-through text-[#6e7681]">{p.content.slice(0, 60)}{p.content.length > 60 ? '…' : ''}</span>
                    : <Link href={`/${locale}/predictions/${p.slug}`} className="hover:underline">
                        {p.content.slice(0, 60)}{p.content.length > 60 ? '…' : ''}
                      </Link>
                  }
                </p>
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <Link href={`/${locale}/predictors/${p.predictor.slug}`} className="text-[#6e7681] hover:text-[#e6edf3]">
                    {p.predictor.name}
                  </Link>
                  <span className="text-[#21262d]">·</span>
                  <span className="text-[#6e7681]">截止 {p.deadline.replace(/-/g, '/')}</span>
                  <span className="text-[#21262d]">·</span>
                  {statusLabel}
                </div>
              </div>
              {canWithdraw && (
                <button
                  onClick={() => withdraw(p.id)}
                  className="text-[11px] text-[#6e7681] hover:text-red-400 transition-colors flex-shrink-0 border border-[#21262d] rounded-md px-2 py-1"
                >
                  撤回
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
