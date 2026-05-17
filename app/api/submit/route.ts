// app/api/submit/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { createServiceClient } from '@/lib/supabase'
import { validateUrl, validateDeadline, validateContent } from '@/lib/validation'
import { reviewSubmission, checkDuplicate } from '@/lib/ai'
import type { Category, Locale } from '@/lib/types'

const VALID_CATEGORIES: Category[] = ['stock', 'politics', 'fortune', 'tech', 'sports', 'ai', 'other']
const VALID_LOCALES: Locale[] = ['tw', 'jp', 'us']
const DAILY_LIMIT = 5

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[一-鿿㐀-䶿]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'predictor'
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'login required' }, { status: 401 })
  }
  const userId = session.user.email

  let body: {
    predictor_name?: string
    content?: string
    source_url?: string
    deadline?: string
    category?: string
    locale?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }

  const { predictor_name, content, source_url, deadline, category, locale } = body

  if (!predictor_name?.trim()) return NextResponse.json({ error: 'predictor_name required' }, { status: 400 })
  const contentError = validateContent(content ?? '')
  if (contentError) return NextResponse.json({ error: contentError }, { status: 400 })
  if (!source_url) return NextResponse.json({ error: 'source_url required' }, { status: 400 })
  const urlError = validateUrl(source_url)
  if (urlError) return NextResponse.json({ error: urlError }, { status: 400 })
  const deadlineError = validateDeadline(deadline ?? '')
  if (deadlineError) return NextResponse.json({ error: deadlineError }, { status: 400 })
  if (!category || !VALID_CATEGORIES.includes(category as Category)) {
    return NextResponse.json({ error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` }, { status: 400 })
  }
  const safeLocale: Locale = VALID_LOCALES.includes(locale as Locale) ? (locale as Locale) : 'tw'

  const db = createServiceClient()

  // Per-user rate limit: 5 submissions per calendar day
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const { count: userCount } = await db
    .from('predictions')
    .select('id', { count: 'exact', head: true })
    .eq('submitted_by', userId)
    .gte('created_at', todayStart.toISOString())
    .is('deleted_at', null)

  if ((userCount ?? 0) >= DAILY_LIMIT) {
    return NextResponse.json({ error: `daily limit of ${DAILY_LIMIT} submissions reached, try again tomorrow` }, { status: 429 })
  }

  // Find or create predictor
  const slug = toSlug(predictor_name.trim())
  let predictorId: string

  const { data: existing } = await db
    .from('predictors')
    .select('id')
    .eq('slug', slug)
    .single()

  if (existing) {
    predictorId = existing.id
  } else {
    const { data: created, error: createErr } = await db
      .from('predictors')
      .insert({
        name: predictor_name.trim(),
        slug,
        type: 'individual',
        category: category as Category,
        locale: safeLocale,
        bullshit_score: 0,
        accuracy_rate: 0,
        total_predictions: 0,
      })
      .select('id')
      .single()

    if (createErr || !created) {
      return NextResponse.json({ error: 'failed to create predictor' }, { status: 500 })
    }
    predictorId = created.id
  }

  // Generate unique prediction slug
  const contentSlug = content!
    .slice(0, 40)
    .toLowerCase()
    .replace(/[一-鿿㐀-䶿]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  const year = new Date(deadline!).getFullYear()
  const predictionSlug = `${slug}-${contentSlug || 'prediction'}-${year}-${Date.now()}`

  // Insert with pending_review status
  const { data: prediction, error: predErr } = await db
    .from('predictions')
    .insert({
      content: content!.trim(),
      predictor_id: predictorId,
      locale: safeLocale,
      slug: predictionSlug,
      deadline: deadline!,
      category: category as Category,
      verdict_type: 'subjective',
      status: 'pending_review',
      verdict: null,
      submitted_by: userId,
    })
    .select('id')
    .single()

  if (predErr || !prediction) {
    return NextResponse.json({ error: 'failed to create prediction' }, { status: 500 })
  }

  // Insert source
  await db.from('prediction_sources').insert({
    prediction_id: prediction.id,
    source_url: source_url!,
    source_name: new URL(source_url!).hostname.replace('www.', ''),
    source_snapshot: null,
  })

  // Skip AI review in dev when no API key is configured
  if (!process.env.ANTHROPIC_API_KEY) {
    await db.from('predictions')
      .update({ status: 'active' })
      .eq('id', prediction.id)
    return NextResponse.json({ success: true, prediction_id: prediction.id }, { status: 201 })
  }

  // ── AI REVIEW ────────────────────────────────────────────────────────────

  let reviewResult: Awaited<ReturnType<typeof reviewSubmission>>
  try {
    reviewResult = await reviewSubmission(content!.trim(), deadline!)
  } catch {
    // AI service error — approve so user isn't blocked; admin can review later
    await db.from('predictions').update({ status: 'active' }).eq('id', prediction.id)
    return NextResponse.json({ success: true, prediction_id: prediction.id }, { status: 201 })
  }

  if (!reviewResult.is_prediction) {
    await db.from('predictions').update({
      deleted_at: new Date().toISOString(),
      deleted_by: 'ai-review',
      delete_reason: reviewResult.reason || 'AI review: not a valid prediction',
    }).eq('id', prediction.id)

    return NextResponse.json(
      { error: `Submission rejected: ${reviewResult.reason || 'not a valid prediction with a deadline'}` },
      { status: 422 }
    )
  }

  // ── DEDUPLICATION ─────────────────────────────────────────────────────────

  const { data: similar } = await db.rpc('find_similar_predictions', {
    p_predictor_id: predictorId,
    p_deadline: deadline!,
    p_content: content!.trim(),
    p_exclude_id: prediction.id,
  })

  for (const candidate of (similar ?? [])) {
    let dupCheck: Awaited<ReturnType<typeof checkDuplicate>>
    try {
      dupCheck = await checkDuplicate(content!.trim(), candidate.content)
    } catch {
      continue
    }

    if (dupCheck.is_same) {
      await db.from('prediction_sources').insert({
        prediction_id: candidate.id,
        source_url: source_url!,
        source_name: new URL(source_url!).hostname.replace('www.', ''),
        source_snapshot: null,
      })
      await db.from('predictions').update({
        deleted_at: new Date().toISOString(),
        deleted_by: 'ai-review',
        delete_reason: 'Duplicate — merged source into existing prediction',
      }).eq('id', prediction.id)

      return NextResponse.json({ success: true, prediction_id: candidate.id }, { status: 201 })
    }
  }

  // ── APPROVE ───────────────────────────────────────────────────────────────

  await db.from('predictions').update({
    status: 'active',
    verdict_type: reviewResult.verdict_type,
  }).eq('id', prediction.id)

  return NextResponse.json({ success: true, prediction_id: prediction.id }, { status: 201 })
}
