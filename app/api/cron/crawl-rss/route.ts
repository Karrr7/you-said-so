import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { fetchRssItems, filterNewItems } from '@/lib/rss'
import { extractPredictionsFromText } from '@/lib/ai'
import { findOrCreatePredictor, createCrawledPrediction } from '@/lib/crawler'
import type { Category, Locale, Source } from '@/lib/types'

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  }

  const db = createServiceClient()
  const results = { sources: 0, articles: 0, extracted: 0, created: 0, errors: 0 }

  const { data: sources } = await db
    .from('sources')
    .select('*')
    .eq('type', 'rss')
    .eq('active', true)

  for (const source of (sources ?? []) as Source[]) {
    results.sources++
    try {
      const items = await fetchRssItems(source.url_or_channel_id)

      const itemLinks = items.map(i => i.link).filter(Boolean)
      let knownUrls = new Set<string>()
      if (itemLinks.length > 0) {
        const { data: existing } = await db
          .from('prediction_sources')
          .select('source_url')
          .in('source_url', itemLinks)
        knownUrls = new Set((existing ?? []).map((r: { source_url: string }) => r.source_url))
      }

      const newItems = filterNewItems(items, knownUrls)
      results.articles += newItems.length

      for (const item of newItems) {
        if (!item.text.trim()) continue

        const extracted = await extractPredictionsFromText(item.text, source.name)
        results.extracted += extracted.length

        for (const pred of extracted) {
          try {
            const predictorId = await findOrCreatePredictor(
              db,
              pred.predictor_name,
              pred.category as Category,
              source.locale as Locale,
            )
            const id = await createCrawledPrediction(db, {
              predictor_id: predictorId,
              content: pred.content,
              deadline: pred.deadline,
              category: pred.category as Category,
              locale: source.locale as Locale,
              source_url: item.link,
              source_name: source.name,
            })
            if (id) results.created++
          } catch {
            results.errors++
          }
        }
      }
    } catch {
      results.errors++
    }
  }

  return NextResponse.json({ ok: true, ...results })
}
