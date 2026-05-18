'use client'

import { useState } from 'react'

interface AdminPrediction {
  id: string
  content: string
  deadline: string
  category: string
  submitted_by: string | null
  predictor: { name: string }
  sources: Array<{ source_url: string; source_name: string }>
}

interface Props {
  predictions: AdminPrediction[]
}

export default function AdminPredictionList({ predictions }: Props) {
  const [states, setStates] = useState<Record<string, 'approved' | 'deleted' | 'loading'>>({})

  async function approve(id: string) {
    setStates(s => ({ ...s, [id]: 'loading' }))
    const res = await fetch(`/api/admin/predictions/${id}/approve`, { method: 'POST' })
    if (res.ok) {
      setStates(s => ({ ...s, [id]: 'approved' }))
    } else {
      setStates(s => { const n = { ...s }; delete n[id]; return n })
      alert('Approve failed')
    }
  }

  async function deletePrediction(id: string) {
    if (!confirm('Delete this prediction?')) return
    setStates(s => ({ ...s, [id]: 'loading' }))
    const res = await fetch(`/api/predictions/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Admin deleted from panel' }),
    })
    if (res.ok) {
      setStates(s => ({ ...s, [id]: 'deleted' }))
    } else {
      setStates(s => { const n = { ...s }; delete n[id]; return n })
      alert('Delete failed')
    }
  }

  const done = predictions.filter(p => states[p.id] && states[p.id] !== 'loading')

  if (predictions.length === 0) {
    return <p className="text-[#6e7681] text-sm text-center py-12">沒有待審核的預言 🎉</p>
  }

  return (
    <div>
      <div className="space-y-3">
        {predictions.map(p => {
          const state = states[p.id]
          if (state === 'approved') return (
            <div key={p.id} className="bg-green-900/20 border border-green-800/50 rounded-xl p-3 text-xs text-green-400">
              ✓ Approved: {p.content.slice(0, 60)}
            </div>
          )
          if (state === 'deleted') return (
            <div key={p.id} className="bg-red-900/20 border border-red-800/50 rounded-xl p-3 text-xs text-red-400">
              ✗ Deleted: {p.content.slice(0, 60)}
            </div>
          )

          const source = p.sources[0]

          return (
            <div key={p.id} className="bg-[#161b22] border border-[#21262d] rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#e6edf3] leading-snug mb-1">
                    {p.content}
                  </p>
                  <div className="flex flex-wrap gap-2 text-[11px] text-[#6e7681] mb-2">
                    <span className="font-semibold text-[#94a3b8]">{p.predictor.name}</span>
                    <span>·</span>
                    <span>截止 {p.deadline}</span>
                    <span>·</span>
                    <span>#{p.category}</span>
                    {p.submitted_by && (
                      <><span>·</span><span>{p.submitted_by}</span></>
                    )}
                  </div>
                  {source && (
                    <a
                      href={source.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-blue-400 hover:underline truncate block max-w-sm"
                    >
                      {source.source_name} ↗ {source.source_url.slice(0, 60)}
                    </a>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => approve(p.id)}
                    disabled={state === 'loading'}
                    className="text-xs font-bold px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded-lg transition-colors"
                  >
                    {state === 'loading' ? '…' : '✓ 通過'}
                  </button>
                  <button
                    onClick={() => deletePrediction(p.id)}
                    disabled={state === 'loading'}
                    className="text-xs font-bold px-3 py-1.5 bg-[#21262d] hover:bg-red-900/50 disabled:opacity-50 text-red-400 rounded-lg transition-colors"
                  >
                    ✗ 刪除
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      {done.length > 0 && (
        <p className="text-[10px] text-[#6e7681] text-center mt-4">
          已處理 {done.length} 筆（刷新頁面以清除）
        </p>
      )}
    </div>
  )
}
