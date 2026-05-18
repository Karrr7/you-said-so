import type { MetadataRoute } from 'next'
import { createReadClient } from '@/lib/supabase'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://yousaidso.tw'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const db = await createReadClient()

  const [{ data: predictions }, { data: predictors }] = await Promise.all([
    db
      .from('predictions')
      .select('slug, created_at')
      .in('status', ['active', 'community_vote', 'resolved'])
      .is('deleted_at', null)
      .limit(1000),
    db
      .from('predictors')
      .select('slug, created_at')
      .eq('locale', 'tw')
      .limit(500),
  ])

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/tw`,             lastModified: new Date(), changeFrequency: 'hourly',  priority: 1 },
    { url: `${BASE_URL}/tw/leaderboard`, lastModified: new Date(), changeFrequency: 'daily',   priority: 0.8 },
    { url: `${BASE_URL}/tw/submit`,      lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/privacy`,        lastModified: new Date(), changeFrequency: 'monthly', priority: 0.2 },
    { url: `${BASE_URL}/terms`,          lastModified: new Date(), changeFrequency: 'monthly', priority: 0.2 },
  ]

  const predictionPages: MetadataRoute.Sitemap = (predictions ?? []).map(p => ({
    url: `${BASE_URL}/tw/predictions/${p.slug}`,
    lastModified: new Date(p.created_at),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  const predictorPages: MetadataRoute.Sitemap = (predictors ?? []).map(p => ({
    url: `${BASE_URL}/tw/predictors/${p.slug}`,
    lastModified: new Date(p.created_at),
    changeFrequency: 'daily' as const,
    priority: 0.9,
  }))

  return [...staticPages, ...predictionPages, ...predictorPages]
}
