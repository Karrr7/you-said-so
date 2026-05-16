// components/PredictionCard.tsx
import Link from 'next/link'
import type { PredictionWithRelations } from '@/lib/types'
import { formatDeadline, votePct } from '@/lib/utils'

interface Props {
  prediction: PredictionWithRelations
}

export default function PredictionCard({ prediction }: Props) {
  const { predictor, status, verdict, content, vote_counts, deadline, category, locale, slug } = prediction
  const isBullshit = verdict === 'bullshit'
  const isCorrect = verdict === 'correct'
  const isVoting = status === 'community_vote'
  const isResolved = status === 'resolved'
  const pct = votePct(vote_counts)
  const ringClass = predictor.bullshit_score > 70
    ? 'border-red-500 shadow-[0_0_0_1px_#0d1117,0_0_0_3px_#ef4444]'
    : predictor.accuracy_rate >= 70
    ? 'border-green-500 shadow-[0_0_0_1px_#0d1117,0_0_0_3px_#22c55e]'
    : 'border-[#21262d]'

  return (
    <article className="flex gap-3 py-4 border-b border-[#21262d]/60 hover:bg-[#1c2a3f]/20 rounded-md px-2 transition-colors">

      {/* Avatar */}
      <div className="flex-shrink-0 mt-1">
        <Link href={`/${locale}/predictors/${predictor.slug}`}>
          <div className={`w-11 h-11 rounded-full bg-[#1a2235] border-2 flex items-center justify-center text-xl ${ringClass}`}>
            {predictor.avatar_url
              ? <img src={predictor.avatar_url} alt={predictor.name} className="w-full h-full rounded-full object-cover" />
              : <span>👤</span>
            }
          </div>
        </Link>
      </div>

      {/* Right column */}
      <div className="flex-1 min-w-0">

        {/* Speech bubble */}
        <Link href={`/${locale}/predictions/${slug}`}>
          <div className="relative mb-2.5">
            {/* Yellow pop-art shadow */}
            <div className="absolute top-[5px] left-[5px] right-[-5px] bottom-[-5px] bg-[#f5a623] border-[3px] border-[#0a0c10] rounded-[20px]" />
            {/* Main bubble */}
            <div
              className="relative bg-[#fffef0] border-[3px] border-[#0a0c10] rounded-[20px] px-4 py-3"
              style={{ filter: isBullshit ? 'url(#wobble-strong)' : 'url(#wobble)' }}
            >
              {/* Left tail */}
              <div className="absolute -left-[13px] top-[14px] w-0 h-0 border-[7px] border-transparent border-r-[#0a0c10]" />
              <div className="absolute -left-[8px] top-[16px] w-0 h-0 border-[5px] border-transparent border-r-[#fffef0]" />

              {/* Content */}
              <p className={`text-[#0a0c10] font-bold text-sm leading-snug ${isResolved ? 'pr-20' : ''}`}>
                {content}
              </p>

              {/* Verdict stamp */}
              {isBullshit && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 -rotate-[8deg] text-[11px] font-black text-red-500 border-[2.5px] border-red-500 rounded-[4px] px-2 py-0.5 bg-red-500/[0.08] whitespace-nowrap pointer-events-none">
                  💨 嘴炮
                </span>
              )}
              {isCorrect && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 -rotate-[8deg] text-[11px] font-black text-green-600 border-[2.5px] border-green-600 rounded-[4px] px-2 py-0.5 bg-green-600/[0.08] whitespace-nowrap pointer-events-none">
                  🎯 準了
                </span>
              )}
            </div>
          </div>
        </Link>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <Link href={`/${locale}/predictors/${predictor.slug}`} className="font-bold text-[#e6edf3] hover:underline">
            {predictor.name}
          </Link>
          <span className="text-[#21262d]">·</span>
          <StatusTag status={status} verdict={verdict} />
          <span className="text-[#21262d]">·</span>
          <span className="text-blue-400/70">#{category}</span>
          <span className="text-[#21262d]">·</span>
          <span className="text-[#6e7681]">截止 {formatDeadline(deadline)}</span>
        </div>

        {/* Vote bar (community_vote only) */}
        {isVoting && (vote_counts.correct + vote_counts.bullshit) > 0 && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] text-red-400 font-semibold">嘴炮 {pct}%</span>
            <div className="flex-1 h-[3px] bg-[#21262d] rounded overflow-hidden">
              <div className="h-full bg-gradient-to-r from-red-500 to-purple-500 rounded" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[10px] text-[#6e7681]">準了 {100 - pct}%</span>
          </div>
        )}

      </div>
    </article>
  )
}

function StatusTag({ status, verdict }: { status: string; verdict: string | null }) {
  if (status === 'resolved' && verdict === 'bullshit')
    return <span className="text-red-400 font-semibold">❌ 已判定</span>
  if (status === 'resolved' && verdict === 'correct')
    return <span className="text-green-400 font-semibold">✅ 已判定</span>
  if (status === 'community_vote')
    return <span className="text-purple-400 font-semibold">🗳️ 投票中</span>
  return <span className="text-yellow-500/80 font-semibold">⏳ 進行中</span>
}
