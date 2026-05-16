import { createReadClient } from '@/lib/supabase'
import PredictionCard from '@/components/PredictionCard'
import FeedDivider from '@/components/FeedDivider'
import type { PredictionWithRelations } from '@/lib/types'
import type { Metadata } from 'next'

export const revalidate = 3600 // ISR: revalidate every 1 hour

export const metadata: Metadata = {
  title: '今日預言 Feed',
}

async function fetchFeedPredictions(locale: string) {
  const db = await createReadClient()

  const { data: resolved } = await db
    .from('predictions')
    .select(`
      *,
      predictor:predictors(*),
      sources:prediction_sources(*),
      responses:prediction_responses(*)
    `)
    .eq('locale', locale)
    .eq('status', 'resolved')
    .gte('deadline', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    .order('created_at', { ascending: false })
    .limit(10)

  const { data: ongoing } = await db
    .from('predictions')
    .select(`
      *,
      predictor:predictors(*),
      sources:prediction_sources(*),
      responses:prediction_responses(*)
    `)
    .eq('locale', locale)
    .in('status', ['active', 'community_vote'])
    .order('deadline', { ascending: true })
    .limit(20)

  const allIds = [...(resolved ?? []), ...(ongoing ?? [])].map(p => p.id)
  const { data: votes } = await db
    .from('votes')
    .select('prediction_id, choice')
    .in('prediction_id', allIds)

  function countVotes(predictionId: string) {
    const predVotes = (votes ?? []).filter(v => v.prediction_id === predictionId)
    return {
      correct: predVotes.filter(v => v.choice === 'correct').length,
      bullshit: predVotes.filter(v => v.choice === 'bullshit').length,
    }
  }

  const withCounts = (items: any[]): PredictionWithRelations[] =>
    (items ?? []).map(p => ({ ...p, vote_counts: countVotes(p.id) }))

  return {
    resolved: withCounts(resolved ?? []),
    ongoing: withCounts(ongoing ?? []),
  }
}

interface Props {
  params: Promise<{ locale: string }>
}

export default async function FeedPage({ params }: Props) {
  const { locale } = await params
  const { resolved, ongoing } = await fetchFeedPredictions(locale)

  return (
    <div>
      <h1 className="text-lg font-black text-[#e6edf3] mb-4 tracking-tight">
        你說的哦 <span className="text-[#6e7681] font-normal text-sm">— 今日預言</span>
      </h1>

      {resolved.length > 0 && (
        <>
          <FeedDivider label="今日結果" />
          {resolved.map(p => <PredictionCard key={p.id} prediction={p} />)}
        </>
      )}

      {ongoing.length > 0 && (
        <>
          <FeedDivider label="進行中" />
          {ongoing.map(p => <PredictionCard key={p.id} prediction={p} />)}
        </>
      )}

      {resolved.length === 0 && ongoing.length === 0 && (
        <p className="text-[#6e7681] text-sm text-center py-12">今天還沒有預言，等等看</p>
      )}
    </div>
  )
}
