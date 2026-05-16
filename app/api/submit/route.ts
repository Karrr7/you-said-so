// app/api/submit/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { createServiceClient } from '@/lib/supabase'
import { validateUrl, validateDeadline, validateContent } from '@/lib/validation'
import type { Category, Locale } from '@/lib/types'

const VALID_CATEGORIES: Category[] = ['stock', 'politics', 'fortune', 'tech', 'sports', 'ai', 'other']
const VALID_LOCALES: Locale[] = ['tw', 'jp', 'us']

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

  // Rate limit: global daily guard
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const { count } = await db
    .from('predictions')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending_review')
    .gte('created_at', todayStart.toISOString())

  if ((count ?? 0) >= 100) {
    return NextResponse.json({ error: 'daily submission limit reached, try again tomorrow' }, { status: 429 })
  }

  // Find or create predictor by slug
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

  // Generate unique slug for prediction
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

  // Insert prediction
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

  return NextResponse.json({ success: true, prediction_id: prediction.id }, { status: 201 })
}
