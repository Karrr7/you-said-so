import Link from 'next/link'
import { createReadClient } from '@/lib/supabase'
import type { Metadata } from 'next'

export const revalidate = 21600

export const metadata: Metadata = {
  title: '嘴炮排行榜',
}

interface Props {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ tab?: string }>
}

export default async function LeaderboardPage({ params, searchParams }: Props) {
  const { locale } = await params
  const { tab } = await searchParams
  const isAccuracy = tab === 'accuracy'

  const db = await createReadClient()
  const { data: predictors } = await db
    .from('predictors')
    .select('id, name, slug, bullshit_score, accuracy_rate, total_predictions, avatar_url')
    .eq('locale', locale)
    .gt('total_predictions', 0)
    .order(isAccuracy ? 'accuracy_rate' : 'bullshit_score', { ascending: false })
    .limit(50)

  const rows = predictors ?? []

  return (
    <div>
      <h1 className="text-lg font-black text-[#e6edf3] mb-4 tracking-tight">
        {isAccuracy ? '🎯 最準排行榜' : '💨 嘴炮排行榜'}
      </h1>

      {/* Tab switcher */}
      <div className="flex gap-2 mb-6">
        <Link
          href={`/${locale}/leaderboard`}
          className={`px-3 py-1.5 rounded-md text-xs font-bold border transition-colors ${
            !isAccuracy
              ? 'bg-red-500/20 border-red-500/50 text-red-400'
              : 'border-[#21262d] text-[#6e7681] hover:text-[#e6edf3]'
          }`}
        >
          💨 嘴炮排行
        </Link>
        <Link
          href={`/${locale}/leaderboard?tab=accuracy`}
          className={`px-3 py-1.5 rounded-md text-xs font-bold border transition-colors ${
            isAccuracy
              ? 'bg-green-500/20 border-green-500/50 text-green-400'
              : 'border-[#21262d] text-[#6e7681] hover:text-[#e6edf3]'
          }`}
        >
          🎯 最準排行
        </Link>
      </div>

      {/* Leaderboard list */}
      {rows.length === 0 ? (
        <p className="text-[#6e7681] text-sm text-center py-12">目前沒有足夠資料</p>
      ) : (
        <div className="space-y-2">
          {rows.map((predictor, idx) => {
            const score = isAccuracy ? predictor.accuracy_rate : predictor.bullshit_score
            const scoreColor = isAccuracy
              ? predictor.accuracy_rate >= 70 ? 'text-green-400' : 'text-[#6e7681]'
              : predictor.bullshit_score > 50 ? 'text-red-400' : 'text-[#6e7681]'

            return (
              <Link
                key={predictor.id}
                href={`/${locale}/predictors/${predictor.slug}`}
                className="flex items-center gap-3 bg-[#161b22] border border-[#21262d] rounded-xl px-4 py-3 hover:border-[#30363d] transition-colors"
              >
                <span className={`text-sm font-black w-7 text-center ${idx === 0 ? 'text-yellow-400' : idx === 1 ? 'text-[#94a3b8]' : idx === 2 ? 'text-amber-600' : 'text-[#6e7681]'}`}>
                  #{idx + 1}
                </span>
                <div className="w-9 h-9 rounded-full bg-[#1a2235] border-2 border-[#21262d] flex items-center justify-center text-base flex-shrink-0">
                  {predictor.avatar_url
                    ? <img src={predictor.avatar_url} alt={predictor.name} className="w-full h-full rounded-full object-cover" />
                    : '👤'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[#e6edf3] text-sm truncate">{predictor.name}</div>
                  <div className="text-[10px] text-[#6e7681]">{predictor.total_predictions} 則預言</div>
                </div>
                <div className={`text-lg font-black ${scoreColor}`}>
                  {Number(score).toFixed(0)}%
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
