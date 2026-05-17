// app/api/cron/resolve-votes/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { updatePredictorStats } from '@/lib/stats'

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  }

  const db = createServiceClient()
  const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString()

  const { data: ready } = await db
    .from('predictions')
    .select('id, predictor_id')
    .eq('status', 'community_vote')
    .is('deleted_at', null)
    .not('voting_started_at', 'is', null)
    .lt('voting_started_at', cutoff)
    .limit(50)

  const results = { resolved: 0, errors: 0 }

  for (const pred of ready ?? []) {
    try {
      const { data: votes } = await db
        .from('votes')
        .select('choice')
        .eq('prediction_id', pred.id)

      const rows = votes ?? []
      const correct = rows.filter(v => v.choice === 'correct').length
      const bullshit = rows.filter(v => v.choice === 'bullshit').length
      // Ties go to bullshit (more engaging outcome for the platform)
      const verdict: 'correct' | 'bullshit' = correct > bullshit ? 'correct' : 'bullshit'

      await db.from('predictions').update({
        status: 'resolved',
        verdict,
      }).eq('id', pred.id)

      await updatePredictorStats(pred.predictor_id)
      results.resolved++
    } catch {
      results.errors++
    }
  }

  return NextResponse.json({ ok: true, processed: ready?.length ?? 0, ...results })
}
