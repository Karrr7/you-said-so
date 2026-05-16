// app/[locale]/predictions/[slug]/page.tsx
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createReadClient } from '@/lib/supabase'
import { formatDeadline, scoreLabel } from '@/lib/utils'
import type { Metadata } from 'next'
import VoteBar from '@/components/VoteBar'

export const revalidate = 3600

interface Props {
  params: Promise<{ locale: string; slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const db = await createReadClient()
  const { data } = await db.from('predictions').select('content').eq('slug', slug).single()
  return { title: data ? `「${data.content.slice(0, 30)}…」` : '找不到此預言' }
}

export default async function PredictionDetailPage({ params }: Props) {
  const { locale, slug } = await params
  const db = await createReadClient()

  const { data: prediction } = await db
    .from('predictions')
    .select(`*, predictor:predictors(*), sources:prediction_sources(*), responses:prediction_responses(*)`)
    .eq('slug', slug)
    .single()

  if (!prediction) notFound()

  const { data: votes } = await db
    .from('votes')
    .select('choice')
    .eq('prediction_id', prediction.id)

  const correct = (votes ?? []).filter(v => v.choice === 'correct').length
  const bullshit = (votes ?? []).filter(v => v.choice === 'bullshit').length
  const total = correct + bullshit
  const pct = total > 0 ? Math.round(bullshit / total * 100) : 50

  const predictor = prediction.predictor

  return (
    <div className="max-w-lg mx-auto">

      {/* Back link */}
      <Link href={`/${locale}`} className="text-[11px] text-[#6e7681] hover:text-[#e6edf3] mb-4 inline-block">
        ← 返回 Feed
      </Link>

      {/* Predictor */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-[#1a2235] border-2 border-[#21262d] flex items-center justify-center text-lg">
          {predictor.avatar_url
            ? <img src={predictor.avatar_url} alt={predictor.name} className="w-full h-full rounded-full object-cover" />
            : '👤'}
        </div>
        <div>
          <Link href={`/${locale}/predictors/${predictor.slug}`} className="font-bold text-[#e6edf3] hover:underline text-sm">
            {predictor.name}
          </Link>
          <div className="text-[11px] text-[#6e7681]">
            {scoreLabel(predictor.bullshit_score, predictor.accuracy_rate)}
          </div>
        </div>
      </div>

      {/* Speech bubble (large) */}
      <div className="relative mb-6">
        <div className="absolute top-[6px] left-[6px] right-[-6px] bottom-[-6px] bg-[#f5a623] border-[3.5px] border-[#0a0c10] rounded-[24px]" />
        <div className="relative bg-[#fffef0] border-[3.5px] border-[#0a0c10] rounded-[24px] px-5 py-4" style={{ filter: 'url(#wobble)' }}>
          <div className="absolute -left-[14px] top-[18px] w-0 h-0 border-[8px] border-transparent border-r-[#0a0c10]" />
          <div className="absolute -left-[9px] top-[20px] w-0 h-0 border-[6px] border-transparent border-r-[#fffef0]" />
          <p className="text-[#0a0c10] font-bold text-base leading-relaxed">
            {prediction.content}
          </p>
          {prediction.verdict === 'bullshit' && (
            <span className="absolute right-4 top-1/2 -translate-y-1/2 -rotate-[8deg] text-sm font-black text-red-500 border-[3px] border-red-500 rounded-[5px] px-3 py-1 bg-red-500/[0.08]">
              💨 嘴炮
            </span>
          )}
          {prediction.verdict === 'correct' && (
            <span className="absolute right-4 top-1/2 -translate-y-1/2 -rotate-[8deg] text-sm font-black text-green-600 border-[3px] border-green-600 rounded-[5px] px-3 py-1 bg-green-600/[0.08]">
              🎯 準了
            </span>
          )}
        </div>
      </div>

      {/* Metadata */}
      <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-4 mb-4 space-y-2 text-sm">
        <div className="flex justify-between"><span className="text-[#6e7681]">截止日期</span><span className="font-medium">{formatDeadline(prediction.deadline)}</span></div>
        <div className="flex justify-between"><span className="text-[#6e7681]">分類</span><span className="font-medium">#{prediction.category}</span></div>
        <div className="flex justify-between"><span className="text-[#6e7681]">判定類型</span><span className="font-medium">{prediction.verdict_type === 'objective' ? '一翻兩瞪眼' : '社群投票'}</span></div>
        <div className="flex justify-between"><span className="text-[#6e7681]">狀態</span><span className="font-medium">{prediction.status}</span></div>
      </div>

      {/* Voting — community_vote predictions only */}
      {prediction.status === 'community_vote' && (
        <VoteBar
          predictionId={prediction.id}
          initialCounts={{ correct, bullshit }}
        />
      )}

      {/* Read-only vote result — resolved predictions */}
      {prediction.status === 'resolved' && total > 0 && (
        <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-4 mb-4">
          <div className="flex justify-between text-xs mb-2">
            <span className="text-red-400 font-semibold">嘴炮 {pct}%（{bullshit} 票）</span>
            <span className="text-green-400 font-semibold">準了 {100 - pct}%（{correct} 票）</span>
          </div>
          <div className="h-2 bg-[#21262d] rounded overflow-hidden">
            <div className="h-full bg-gradient-to-r from-red-500 to-purple-500 rounded" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {/* Sources */}
      {prediction.sources.length > 0 && (
        <div className="mb-4">
          <h2 className="text-xs font-bold text-[#6e7681] uppercase tracking-widest mb-2">來源</h2>
          <div className="space-y-2">
            {prediction.sources.map((s: any) => (
              <a key={s.id} href={s.source_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 bg-[#161b22] border border-[#21262d] rounded-lg px-3 py-2 hover:border-blue-500/50 transition-colors text-sm">
                <span className="text-[#6e7681]">{s.source_name}</span>
                <span className="text-blue-400 text-[11px] ml-auto">↗</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Predictor responses */}
      {prediction.responses.length > 0 && (
        <div>
          <h2 className="text-xs font-bold text-[#6e7681] uppercase tracking-widest mb-2">預言者回應</h2>
          {prediction.responses.map((r: any) => (
            <div key={r.id} className="bg-[#161b22] border border-[#21262d] border-l-4 border-l-yellow-500/50 rounded-lg p-3 text-sm text-[#94a3b8]">
              <p>{r.content}</p>
              {r.source_url && (
                <a href={r.source_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-[11px] mt-1 block hover:underline">
                  {r.source_name ?? '來源'} ↗
                </a>
              )}
            </div>
          ))}
        </div>
      )}

    </div>
  )
}
