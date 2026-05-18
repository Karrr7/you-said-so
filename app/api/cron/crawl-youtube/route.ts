import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { fetchChannelRecentVideos, fetchTranscriptText } from '@/lib/youtube'
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
  const results = { channels: 0, videos: 0, extracted: 0, created: 0, skipped: 0, errors: 0 }

  const { data: sources } = await db
    .from('sources')
    .select('*')
    .eq('type', 'youtube_channel')
    .eq('active', true)

  for (const source of (sources ?? []) as Source[]) {
    results.channels++
    try {
      const videos = await fetchChannelRecentVideos(source.url_or_channel_id)

      const videoUrls = videos.map(v => v.videoUrl)
      let knownUrls = new Set<string>()
      if (videoUrls.length > 0) {
        const { data: existing } = await db
          .from('prediction_sources')
          .select('source_url')
          .in('source_url', videoUrls)
        knownUrls = new Set((existing ?? []).map((r: { source_url: string }) => r.source_url))
      }

      const newVideos = videos.filter(v => !knownUrls.has(v.videoUrl))

      for (const video of newVideos) {
        results.videos++
        const transcript = await fetchTranscriptText(video.videoId)
        if (!transcript) {
          results.skipped++
          continue
        }

        const text = `${video.title}\n${transcript}`
        const extracted = await extractPredictionsFromText(text, source.name)
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
              source_url: video.videoUrl,
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
