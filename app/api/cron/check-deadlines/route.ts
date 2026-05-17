// app/api/cron/check-deadlines/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { judgeExpiredPrediction } from '@/lib/ai'
import { updatePredictorStats } from '@/lib/stats'

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  }

  const db = createServiceClient()
  const today = new Date().toISOString().split('T')[0]

  const { data: expired } = await db
    .from('predictions')
    .select('id, content, deadline, verdict_type, predictor_id, predictor:predictors(name)')
    .eq('status', 'active')
    .lt('deadline', today)
    .is('deleted_at', null)
    .limit(50)

  const results = { resolved: 0, moved_to_vote: 0, errors: 0 }

  for (const pred of expired ?? []) {
    try {
      const predictorRaw = pred.predictor as unknown
      const predictorName =
        Array.isArray(predictorRaw)
          ? (predictorRaw[0] as { name: string } | undefined)?.name ?? ''
          : (predictorRaw as { name: string } | null)?.name ?? ''
      let verdict: 'correct' | 'bullshit' | null = null

      if (pred.verdict_type === 'objective') {
        const judged = await judgeExpiredPrediction(pred.content, predictorName, pred.deadline)
        verdict = judged?.verdict ?? null
      }

      if (verdict) {
        await db.from('predictions').update({
          status: 'resolved',
          verdict,
        }).eq('id', pred.id)
        await updatePredictorStats(pred.predictor_id)
        results.resolved++
      } else {
        await db.from('predictions').update({
          status: 'community_vote',
          voting_started_at: new Date().toISOString(),
        }).eq('id', pred.id)
        results.moved_to_vote++
      }
    } catch {
      results.errors++
    }
  }

  return NextResponse.json({ ok: true, processed: expired?.length ?? 0, ...results })
}
