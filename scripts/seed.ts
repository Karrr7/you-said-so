// scripts/seed.ts
// Run: npx ts-node --project tsconfig.json --transpile-only scripts/seed.ts

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey || supabaseUrl.includes('your-project')) {
  console.log('⚠️  Skipping seed: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local')
  console.log('   Fill in your Supabase credentials and re-run: npx ts-node --transpile-only scripts/seed.ts')
  process.exit(0)
}

const db = createClient(supabaseUrl, serviceRoleKey)

async function seed() {
  console.log('Seeding predictors...')

  const { data: predictors, error: pErr } = await db.from('predictors').insert([
    {
      name: '股癌 Gooaye',
      slug: 'gooaye',
      type: 'individual',
      category: 'stock',
      locale: 'tw',
      bullshit_score: 62,
      accuracy_rate: 38,
      total_predictions: 3,
    },
    {
      name: '天機老師',
      slug: 'tianji-teacher',
      type: 'fortune',
      category: 'fortune',
      locale: 'tw',
      bullshit_score: 83,
      accuracy_rate: 17,
      total_predictions: 3,
    },
    {
      name: '政治大學選研中心',
      slug: 'nccu-election-center',
      type: 'academic',
      category: 'politics',
      locale: 'tw',
      bullshit_score: 29,
      accuracy_rate: 71,
      total_predictions: 2,
    },
  ]).select()

  if (pErr) { console.error('Predictor seed error:', pErr.message); process.exit(1) }
  console.log(`✓ Inserted ${predictors!.length} predictors`)

  const gooaye = predictors!.find(p => p.slug === 'gooaye')!
  const tianji = predictors!.find(p => p.slug === 'tianji-teacher')!
  const nccu = predictors!.find(p => p.slug === 'nccu-election-center')!

  console.log('Seeding predictions...')

  const { data: predictions, error: predErr } = await db.from('predictions').insert([
    {
      content: '比特幣在 2025 年 3 月就會破 10 萬美金，不信你等著',
      predictor_id: gooaye.id,
      locale: 'tw',
      slug: 'gooaye-bitcoin-100k-2025',
      deadline: '2025-03-31',
      category: 'stock',
      verdict_type: 'objective',
      status: 'resolved',
      verdict: 'bullshit',
    },
    {
      content: '執政黨在北部選區的選情，明顯比南部告急',
      predictor_id: nccu.id,
      locale: 'tw',
      slug: 'nccu-ruling-party-north-2026',
      deadline: '2026-01-31',
      category: 'politics',
      verdict_type: 'objective',
      status: 'resolved',
      verdict: 'correct',
    },
    {
      content: '台積電在 2026 年底前，股價一定站上 1,500 元',
      predictor_id: gooaye.id,
      locale: 'tw',
      slug: 'gooaye-tsmc-1500-2026',
      deadline: '2026-12-31',
      category: 'stock',
      verdict_type: 'objective',
      status: 'active',
      verdict: null,
    },
    {
      content: 'AI 泡沫會在年底前正式破裂，就像 2000 年網路泡沫一樣',
      predictor_id: gooaye.id,
      locale: 'tw',
      slug: 'gooaye-ai-bubble-2026',
      deadline: '2026-12-31',
      category: 'ai',
      verdict_type: 'subjective',
      status: 'community_vote',
      verdict: null,
    },
    {
      content: '龍年財運大爆發，今年重壓台股的人都會賺到笑',
      predictor_id: tianji.id,
      locale: 'tw',
      slug: 'tianji-dragon-year-stock-2026',
      deadline: '2026-12-31',
      category: 'fortune',
      verdict_type: 'subjective',
      status: 'active',
      verdict: null,
    },
  ]).select()

  if (predErr) { console.error('Prediction seed error:', predErr.message); process.exit(1) }
  console.log(`✓ Inserted ${predictions!.length} predictions`)

  const aiPrediction = predictions!.find(p => p.slug === 'gooaye-ai-bubble-2026')!

  await db.from('prediction_sources').insert([
    {
      prediction_id: aiPrediction.id,
      source_url: 'https://www.youtube.com/watch?v=example',
      source_name: 'YouTube — 股癌 Podcast',
      source_snapshot: '股癌在節目中說：「AI 泡沫會在年底前正式破裂」',
    },
  ])

  const fakeVotes = [
    ...Array.from({ length: 7 }, (_, i) => ({
      prediction_id: aiPrediction.id,
      user_id: `seed-bullshit-${i}`,
      choice: 'bullshit' as const,
    })),
    ...Array.from({ length: 3 }, (_, i) => ({
      prediction_id: aiPrediction.id,
      user_id: `seed-correct-${i}`,
      choice: 'correct' as const,
    })),
  ]
  await db.from('votes').insert(fakeVotes)

  console.log('✓ Seed complete!')
}

seed().catch(err => {
  console.error('Seed failed:', err)
  process.exit(1)
})
