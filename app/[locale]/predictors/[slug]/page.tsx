// app/[locale]/predictors/[slug]/page.tsx
import { notFound } from 'next/navigation'
import { createReadClient } from '@/lib/supabase'
import PredictorHeader from '@/components/PredictorHeader'
import PredictionCard from '@/components/PredictionCard'
import FeedDivider from '@/components/FeedDivider'
import type { PredictionWithRelations } from '@/lib/types'
import type { Metadata } from 'next'

export const revalidate = 21600 // ISR: 6 hours

interface Props {
  params: Promise<{ locale: string; slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const db = await createReadClient()
  const { data } = await db.from('predictors').select('name').eq('slug', slug).single()
  return { title: data ? `${data.name} 的預言記錄` : '找不到此預言者' }
}

export default async function PredictorPage({ params }: Props) {
  const { locale, slug } = await params
  const db = await createReadClient()

  const { data: predictor } = await db
    .from('predictors')
    .select('*')
    .eq('slug', slug)
    .eq('locale', locale)
    .single()

  if (!predictor) notFound()

  const { data: predictions } = await db
    .from('predictions')
    .select(`*, predictor:predictors(*), sources:prediction_sources(*), responses:prediction_responses(*)`)
    .eq('predictor_id', predictor.id)
    .in('status', ['active', 'community_vote', 'resolved'])
    .order('deadline', { ascending: false })

  const { data: votes } = await db
    .from('votes')
    .select('prediction_id, choice')
    .in('prediction_id', (predictions ?? []).map(p => p.id))

  const withCounts = (predictions ?? []).map(p => ({
    ...p,
    vote_counts: {
      correct: (votes ?? []).filter(v => v.prediction_id === p.id && v.choice === 'correct').length,
      bullshit: (votes ?? []).filter(v => v.prediction_id === p.id && v.choice === 'bullshit').length,
    },
  })) as PredictionWithRelations[]

  const resolved = withCounts.filter(p => p.status === 'resolved')
  const ongoing = withCounts.filter(p => p.status !== 'resolved')

  const predictionCount = {
    total: predictor.total_predictions,
    correct: resolved.filter(p => p.verdict === 'correct').length,
    bullshit: resolved.filter(p => p.verdict === 'bullshit').length,
  }

  return (
    <div>
      <PredictorHeader predictor={predictor} predictionCount={predictionCount} />
      {resolved.length > 0 && <><FeedDivider label="已判定" />{resolved.map(p => <PredictionCard key={p.id} prediction={p} />)}</>}
      {ongoing.length > 0 && <><FeedDivider label="進行中" />{ongoing.map(p => <PredictionCard key={p.id} prediction={p} />)}</>}
    </div>
  )
}
