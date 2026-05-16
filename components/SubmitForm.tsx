'use client'
import { useState } from 'react'
import type { Category } from '@/lib/types'

const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'stock', label: '台股' },
  { value: 'politics', label: '政治' },
  { value: 'fortune', label: '命理' },
  { value: 'tech', label: '科技' },
  { value: 'sports', label: '球賽' },
  { value: 'ai', label: 'AI' },
  { value: 'other', label: '其他' },
]

interface Props { locale: string }

type Step = 'url' | 'details' | 'success'

export default function SubmitForm({ locale }: Props) {
  const [step, setStep] = useState<Step>('url')
  const [url, setUrl] = useState('')
  const [scraping, setScraping] = useState(false)
  const [scrapeError, setScrapeError] = useState('')
  const [form, setForm] = useState({
    predictor_name: '',
    content: '',
    deadline: '',
    category: 'other' as Category,
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  async function handleFetchUrl() {
    setScraping(true)
    setScrapeError('')
    const res = await fetch('/api/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
    setScraping(false)
    if (!res.ok) {
      const data = await res.json()
      setScrapeError(data.error ?? 'fetch failed')
    } else {
      setStep('details')
    }
  }

  function skipToManual() {
    setScrapeError('')
    setStep('details')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setSubmitError('')

    const res = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, source_url: url, locale }),
    })

    setSubmitting(false)
    if (!res.ok) {
      const data = await res.json()
      setSubmitError(data.error ?? 'submission failed')
    } else {
      setStep('success')
    }
  }

  if (step === 'success') {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-4">🎉</div>
        <h2 className="text-lg font-black text-[#e6edf3] mb-2">提交成功！</h2>
        <p className="text-sm text-[#6e7681] mb-6">我們會在審核後發布這則預言。</p>
        <a href={`/${locale}`} className="text-sm text-blue-400 hover:underline">← 回首頁</a>
      </div>
    )
  }

  if (step === 'url') {
    return (
      <div>
        <label className="block text-xs font-bold text-[#6e7681] mb-2 uppercase tracking-widest">
          新聞 / 影片連結
        </label>
        <input
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://..."
          className="w-full bg-[#161b22] border border-[#21262d] rounded-lg px-4 py-3 text-[#e6edf3] text-sm focus:outline-none focus:border-blue-500 mb-3"
        />
        {scrapeError && (
          <div className="text-xs text-red-400 mb-3">
            ⚠ {scrapeError} —{' '}
            <button onClick={skipToManual} className="underline">手動填寫預言內容</button>
          </div>
        )}
        <div className="flex gap-3">
          <button
            onClick={handleFetchUrl}
            disabled={!url || scraping}
            className="flex-1 py-2.5 bg-[#fffef0] text-[#0a0c10] font-bold text-sm rounded-lg border-2 border-[#0a0c10] disabled:opacity-40"
            style={{ boxShadow: '3px 3px 0 #f5a623, 3px 3px 0 1px #0a0c10' }}
          >
            {scraping ? '擷取中…' : '自動擷取'}
          </button>
          <button
            onClick={skipToManual}
            className="px-4 py-2.5 text-sm text-[#6e7681] hover:text-[#e6edf3] border border-[#21262d] rounded-lg"
          >
            手動填寫
          </button>
        </div>
      </div>
    )
  }

  // step === 'details'
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-bold text-[#6e7681] mb-2 uppercase tracking-widest">
          預言者姓名 *
        </label>
        <input
          type="text"
          required
          maxLength={100}
          value={form.predictor_name}
          onChange={e => setForm(f => ({ ...f, predictor_name: e.target.value }))}
          placeholder="例：股癌 Gooaye、天機老師"
          className="w-full bg-[#161b22] border border-[#21262d] rounded-lg px-4 py-3 text-[#e6edf3] text-sm focus:outline-none focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-[#6e7681] mb-2 uppercase tracking-widest">
          預言內容（一句話）*
        </label>
        <textarea
          required
          maxLength={500}
          rows={3}
          value={form.content}
          onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
          placeholder="填入預言那句話，例：台積電年底前一定站上 1,500 元"
          className="w-full bg-[#161b22] border border-[#21262d] rounded-lg px-4 py-3 text-[#e6edf3] text-sm focus:outline-none focus:border-blue-500 resize-none"
        />
        <div className="text-[10px] text-[#6e7681] mt-1 text-right">{form.content.length}/500</div>
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-xs font-bold text-[#6e7681] mb-2 uppercase tracking-widest">
            截止日期 *
          </label>
          <input
            type="date"
            required
            value={form.deadline}
            onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
            className="w-full bg-[#161b22] border border-[#21262d] rounded-lg px-4 py-3 text-[#e6edf3] text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-bold text-[#6e7681] mb-2 uppercase tracking-widest">
            分類 *
          </label>
          <select
            value={form.category}
            onChange={e => setForm(f => ({ ...f, category: e.target.value as Category }))}
            className="w-full bg-[#161b22] border border-[#21262d] rounded-lg px-4 py-3 text-[#e6edf3] text-sm focus:outline-none focus:border-blue-500"
          >
            {CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
      </div>

      {url && (
        <div className="text-xs text-[#6e7681]">
          來源：<span className="text-blue-400">{url}</span>
        </div>
      )}

      {submitError && (
        <div className="text-xs text-red-400">⚠ {submitError}</div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={() => setStep('url')}
          className="px-4 py-2.5 text-sm text-[#6e7681] hover:text-[#e6edf3] border border-[#21262d] rounded-lg"
        >
          ← 返回
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 py-2.5 bg-[#fffef0] text-[#0a0c10] font-bold text-sm rounded-lg border-2 border-[#0a0c10] disabled:opacity-40"
          style={{ boxShadow: '3px 3px 0 #f5a623, 3px 3px 0 1px #0a0c10' }}
        >
          {submitting ? '提交中…' : '提交預言'}
        </button>
      </div>
    </form>
  )
}
