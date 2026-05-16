// components/PredictorHeader.tsx
import type { Predictor } from '@/lib/types'
import { scoreLabel } from '@/lib/utils'

export default function PredictorHeader({ predictor, predictionCount }: {
  predictor: Predictor
  predictionCount: { total: number; correct: number; bullshit: number }
}) {
  return (
    <div className="mb-6">
      {/* Avatar + name */}
      <div className="flex items-center gap-4 mb-4">
        <div className={`w-16 h-16 rounded-full bg-[#1a2235] border-2 flex items-center justify-center text-3xl flex-shrink-0
          ${predictor.bullshit_score > 70 ? 'border-red-500' : predictor.accuracy_rate >= 70 ? 'border-green-500' : 'border-[#21262d]'}
        `}>
          {predictor.avatar_url
            ? <img src={predictor.avatar_url} alt={predictor.name} className="w-full h-full rounded-full object-cover" />
            : <span>👤</span>}
        </div>
        <div>
          <h1 className="text-xl font-black text-[#e6edf3]">{predictor.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="text-sm font-bold px-2 py-0.5 rounded"
              style={{
                background: predictor.bullshit_score > 50 ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                color: predictor.bullshit_score > 50 ? '#ef4444' : '#22c55e',
              }}
            >
              {scoreLabel(predictor.bullshit_score, predictor.accuracy_rate)}
            </span>
            {predictor.wiki_url && (
              <a href={predictor.wiki_url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-400 hover:underline">
                Wiki →
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: '總預言', value: predictionCount.total },
          { label: '✅ 準了', value: predictionCount.correct },
          { label: '💨 嘴炮', value: predictionCount.bullshit },
          { label: '準確率', value: `${predictor.accuracy_rate}%` },
        ].map(({ label, value }) => (
          <div key={label} className="bg-[#161b22] border border-[#21262d] rounded-lg p-3 text-center">
            <div className="text-lg font-black text-[#e6edf3]">{value}</div>
            <div className="text-[10px] text-[#6e7681] mt-0.5">{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
