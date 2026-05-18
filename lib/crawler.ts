import type { SupabaseClient } from '@supabase/supabase-js'
import { reviewSubmission, checkDuplicate } from './ai'
import type { Category, Locale } from './types'

export function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[一-鿿㐀-䶿]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'predictor'
}

export async function findOrCreatePredictor(
  db: SupabaseClient,
  name: string,
  category: Category,
  locale: Locale,
): Promise<string> {
  const slug = toSlug(name)
  // 'ai' is not a valid predictor category in the DB constraint — map to 'tech'
  const dbCategory = category === 'ai' ? 'tech' : category

  const { data: existing } = await db
    .from('predictors')
    .select('id')
    .eq('slug', slug)
    .single()

  if (existing) return existing.id

  const { data: created, error } = await db
    .from('predictors')
    .insert({
      name: name.trim(),
      slug,
      type: 'individual',
      category: dbCategory,
      locale,
      bullshit_score: 0,
      accuracy_rate: 0,
      total_predictions: 0,
    })
    .select('id')
    .single()

  if (error || !created) throw new Error(`Failed to create predictor: ${name}`)
  return created.id
}

export async function createCrawledPrediction(
  db: SupabaseClient,
  params: {
    predictor_id: string
    content: string
    deadline: string
    category: Category
    locale: Locale
    source_url: string
    source_name: string
  },
): Promise<string | null> {
  let reviewResult: Awaited<ReturnType<typeof reviewSubmission>>
  try {
    reviewResult = await reviewSubmission(params.content, params.deadline)
  } catch {
    return null
  }
  if (!reviewResult.is_prediction) return null

  // Build prediction slug
  const { data: predictor } = await db
    .from('predictors')
    .select('slug')
    .eq('id', params.predictor_id)
    .single()
  const predictorSlug = predictor?.slug ?? 'predictor'

  const contentSlug = params.content
    .slice(0, 40)
    .toLowerCase()
    .replace(/[一-鿿㐀-䶿]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  const year = new Date(params.deadline).getFullYear()
  const predictionSlug = `${predictorSlug}-${contentSlug || 'prediction'}-${year}-${Date.now()}`

  // Insert pending
  const { data: prediction, error: predErr } = await db
    .from('predictions')
    .insert({
      content: params.content.trim(),
      predictor_id: params.predictor_id,
      locale: params.locale,
      slug: predictionSlug,
      deadline: params.deadline,
      category: params.category,
      verdict_type: reviewResult.verdict_type,
      status: 'pending_review',
      verdict: null,
      submitted_by: null,
    })
    .select('id')
    .single()

  if (predErr || !prediction) return null

  // Record source
  await db.from('prediction_sources').insert({
    prediction_id: prediction.id,
    source_url: params.source_url,
    source_name: params.source_name,
    source_snapshot: null,
  })

  // Deduplication via pg_trgm
  const { data: similar } = await db.rpc('find_similar_predictions', {
    p_predictor_id: params.predictor_id,
    p_deadline: params.deadline,
    p_content: params.content.trim(),
    p_exclude_id: prediction.id,
  })

  for (const candidate of (similar ?? [])) {
    let dupCheck: Awaited<ReturnType<typeof checkDuplicate>>
    try {
      dupCheck = await checkDuplicate(params.content.trim(), candidate.content)
    } catch {
      continue
    }
    if (dupCheck.is_same) {
      await db.from('prediction_sources').insert({
        prediction_id: candidate.id,
        source_url: params.source_url,
        source_name: params.source_name,
        source_snapshot: null,
      })
      await db.from('predictions').update({
        deleted_at: new Date().toISOString(),
        deleted_by: 'crawler-dedup',
        delete_reason: 'Duplicate — merged source into existing prediction',
      }).eq('id', prediction.id)
      return candidate.id
    }
  }

  // Approve
  await db.from('predictions').update({ status: 'active' }).eq('id', prediction.id)
  return prediction.id
}
