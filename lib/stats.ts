// lib/stats.ts
import { createServiceClient } from './supabase'

export function calculateBullshitScore(correct: number, bullshit: number): number {
  const total = correct + bullshit
  if (total === 0) return 0
  return Math.round((bullshit / total) * 100 * 100) / 100
}

export function calculateAccuracyRate(correct: number, bullshit: number): number {
  const total = correct + bullshit
  if (total === 0) return 0
  return Math.round((correct / total) * 100 * 100) / 100
}

export async function updatePredictorStats(predictorId: string): Promise<void> {
  const db = createServiceClient()

  const { data: all } = await db
    .from('predictions')
    .select('status, verdict')
    .eq('predictor_id', predictorId)
    .is('deleted_at', null)

  const rows = all ?? []
  const resolved = rows.filter(p => p.status === 'resolved')
  const correct = resolved.filter(p => p.verdict === 'correct').length
  const bullshit = resolved.filter(p => p.verdict === 'bullshit').length

  await db.from('predictors').update({
    bullshit_score: calculateBullshitScore(correct, bullshit),
    accuracy_rate: calculateAccuracyRate(correct, bullshit),
    total_predictions: rows.length,
  }).eq('id', predictorId)
}
