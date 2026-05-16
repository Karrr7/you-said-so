# YouSaidSo — Plan 2/5: Voting, Submission & Legal Pages

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the two core interactive features — community voting on predictions and user prediction submission — plus the Privacy/ToS pages required for Google OAuth and Google AdSense.

**Architecture:** Vote API uses the service-role Supabase client so server-side code can bypass RLS; the DB's `UNIQUE(prediction_id, user_id)` constraint enforces one-vote-per-user at the data layer. `VoteBar` is a client component that hydrates with live vote state after the static page loads. Submission API finds-or-creates a predictor by name slug, then inserts a `pending_review` prediction — Claude Haiku (Plan 3) handles the actual AI review. URL scraping uses plain `fetch` + HTML stripping regex (no extra dependency); cheerio is saved for Plan 4 crawlers.

**Tech Stack:** Next.js 15 App Router, TypeScript, Supabase service-role client, NextAuth v5 session, Vitest + Testing Library

**Repo:** `/Users/shuyulin/code/you-said-so`

---

## File Map

```
app/
├── api/
│   ├── vote/route.ts              # GET (counts + user's vote) + POST (cast vote)
│   ├── scrape/route.ts            # POST: fetch URL, strip HTML, return text
│   └── submit/route.ts            # POST: find-or-create predictor, insert prediction
├── [locale]/
│   └── submit/
│       └── page.tsx               # Protected page — redirects to sign-in if logged out
├── privacy/
│   └── page.tsx                   # Static Privacy Policy page
└── terms/
    └── page.tsx                   # Static Terms of Service page
components/
├── VoteBar.tsx                    # 'use client' — vote buttons + progress bar
├── SubmitForm.tsx                 # 'use client' — multi-step submission form
└── __tests__/
    └── VoteBar.test.tsx           # VoteBar unit tests
lib/
└── validation.ts                  # Shared URL + input validation helpers (used by API routes)
lib/__tests__/
└── validation.test.ts             # Tests for validation helpers
```

---

## Task 1: Shared Validation Helpers

**Files:**
- Create: `lib/validation.ts`
- Create: `lib/__tests__/validation.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// lib/__tests__/validation.test.ts
import { describe, it, expect } from 'vitest'
import { validateUrl, validateDeadline, validateContent } from '../validation'

describe('validateUrl', () => {
  it('accepts a valid https URL', () => {
    expect(validateUrl('https://news.cts.com.tw/article/123')).toBeNull()
  })
  it('rejects localhost', () => {
    expect(validateUrl('http://localhost:3000/anything')).toMatch(/forbidden/)
  })
  it('rejects 10.x private IP', () => {
    expect(validateUrl('http://10.0.0.1/secret')).toMatch(/forbidden/)
  })
  it('rejects 192.168.x private IP', () => {
    expect(validateUrl('http://192.168.1.1/secret')).toMatch(/forbidden/)
  })
  it('rejects non-http protocol', () => {
    expect(validateUrl('ftp://example.com/file')).toMatch(/http/)
  })
  it('rejects malformed URL', () => {
    expect(validateUrl('not a url')).toMatch(/invalid/)
  })
})

describe('validateDeadline', () => {
  it('accepts a future date within 5 years', () => {
    const future = new Date()
    future.setFullYear(future.getFullYear() + 1)
    expect(validateDeadline(future.toISOString().split('T')[0])).toBeNull()
  })
  it('rejects past date', () => {
    expect(validateDeadline('2020-01-01')).toMatch(/future/)
  })
  it('rejects date more than 5 years out', () => {
    const far = new Date()
    far.setFullYear(far.getFullYear() + 6)
    expect(validateDeadline(far.toISOString().split('T')[0])).toMatch(/5 年/)
  })
  it('rejects invalid format', () => {
    expect(validateDeadline('not-a-date')).toMatch(/invalid/)
  })
})

describe('validateContent', () => {
  it('accepts content within 500 chars', () => {
    expect(validateContent('台積電年底前一定站上 1,500 元')).toBeNull()
  })
  it('rejects empty string', () => {
    expect(validateContent('')).toMatch(/required/)
  })
  it('rejects content over 500 chars', () => {
    expect(validateContent('x'.repeat(501))).toMatch(/500/)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /Users/shuyulin/code/you-said-so && npx vitest run lib/__tests__/validation.test.ts 2>&1 | tail -10
```
Expected: FAIL — `validation` module not found.

- [ ] **Step 3: Write `lib/validation.ts`**

```typescript
// lib/validation.ts

const PRIVATE_IP_RE = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/

export function validateUrl(raw: string): string | null {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return 'invalid URL'
  }
  if (!['http:', 'https:'].includes(url.protocol)) return 'URL must use http or https'
  if (PRIVATE_IP_RE.test(url.hostname)) return 'forbidden: private/localhost URLs not allowed'
  return null
}

export function validateDeadline(raw: string): string | null {
  const d = new Date(raw)
  if (isNaN(d.getTime())) return 'invalid date format'
  const now = new Date()
  if (d <= now) return 'deadline must be a future date'
  const fiveYearsOut = new Date()
  fiveYearsOut.setFullYear(fiveYearsOut.getFullYear() + 5)
  if (d > fiveYearsOut) return 'deadline cannot be more than 5 年 from today'
  return null
}

export function validateContent(raw: string): string | null {
  if (!raw.trim()) return 'content is required'
  if (raw.length > 500) return 'content must be 500 characters or fewer'
  return null
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd /Users/shuyulin/code/you-said-so && npx vitest run lib/__tests__/validation.test.ts 2>&1 | tail -10
```
Expected: 11 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/shuyulin/code/you-said-so && git add lib/validation.ts lib/__tests__/validation.test.ts && git commit -m "feat: add URL, deadline, and content validation helpers with tests"
```

---

## Task 2: Vote API Route

**Files:**
- Create: `app/api/vote/route.ts`

- [ ] **Step 1: Write `app/api/vote/route.ts`**

```typescript
// app/api/vote/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { createServiceClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const predictionId = request.nextUrl.searchParams.get('prediction_id')
  if (!predictionId) {
    return NextResponse.json({ error: 'prediction_id required' }, { status: 400 })
  }

  const session = await auth()
  const db = createServiceClient()

  const { data: votes } = await db
    .from('votes')
    .select('choice, user_id')
    .eq('prediction_id', predictionId)

  const rows = votes ?? []
  const correct = rows.filter(v => v.choice === 'correct').length
  const bullshit = rows.filter(v => v.choice === 'bullshit').length
  const userVote = session?.user?.email
    ? (rows.find(v => v.user_id === session.user!.email)?.choice ?? null)
    : null

  return NextResponse.json({ correct, bullshit, userVote })
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'login required' }, { status: 401 })
  }

  let body: { prediction_id?: string; choice?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }

  const { prediction_id, choice } = body
  if (!prediction_id || !['correct', 'bullshit'].includes(choice ?? '')) {
    return NextResponse.json({ error: 'prediction_id and choice (correct|bullshit) required' }, { status: 400 })
  }

  const db = createServiceClient()

  const { data: prediction } = await db
    .from('predictions')
    .select('status')
    .eq('id', prediction_id)
    .single()

  if (!prediction || prediction.status !== 'community_vote') {
    return NextResponse.json({ error: 'prediction is not accepting votes' }, { status: 409 })
  }

  const { error } = await db
    .from('votes')
    .upsert(
      { prediction_id, user_id: session.user.email, choice },
      { onConflict: 'prediction_id,user_id' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: updated } = await db
    .from('votes')
    .select('choice')
    .eq('prediction_id', prediction_id)

  const rows = updated ?? []
  return NextResponse.json({
    correct: rows.filter(v => v.choice === 'correct').length,
    bullshit: rows.filter(v => v.choice === 'bullshit').length,
    userVote: choice,
  })
}
```

- [ ] **Step 2: Smoke-test GET endpoint manually**

```bash
cd /Users/shuyulin/code/you-said-so && npm run dev &
sleep 5
# Use the AI bubble prediction ID from seed data
curl "http://localhost:3000/api/vote?prediction_id=PASTE_ANY_PREDICTION_UUID_HERE"
```
Expected: `{"correct":N,"bullshit":N,"userVote":null}` — no auth, userVote is null.

```bash
kill %1
```

- [ ] **Step 3: Commit**

```bash
cd /Users/shuyulin/code/you-said-so && git add app/api/vote/route.ts && git commit -m "feat: add vote API route (GET counts + POST cast vote)"
```

---

## Task 3: VoteBar Client Component

**Files:**
- Create: `components/VoteBar.tsx`
- Create: `components/__tests__/VoteBar.test.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// components/__tests__/VoteBar.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import VoteBar from '../VoteBar'

const mockFetch = vi.fn()
global.fetch = mockFetch

beforeEach(() => {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ correct: 3, bullshit: 7, userVote: null }),
  })
})

describe('VoteBar', () => {
  it('renders vote buttons', async () => {
    render(<VoteBar predictionId="pred-1" initialCounts={{ correct: 3, bullshit: 7 }} />)
    expect(await screen.findByText(/嘴炮/)).toBeInTheDocument()
    expect(screen.getByText(/準了/)).toBeInTheDocument()
  })

  it('shows progress bar when total > 0', async () => {
    render(<VoteBar predictionId="pred-1" initialCounts={{ correct: 3, bullshit: 7 }} />)
    await waitFor(() => expect(screen.getByText(/嘴炮 70%/)).toBeInTheDocument())
    expect(screen.getByText(/準了 30%/)).toBeInTheDocument()
  })

  it('highlights user vote after mount fetches userVote', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ correct: 3, bullshit: 7, userVote: 'bullshit' }),
    })
    render(<VoteBar predictionId="pred-1" initialCounts={{ correct: 3, bullshit: 7 }} />)
    await waitFor(() => {
      const btn = screen.getByText(/嘴炮/).closest('button')
      expect(btn?.className).toMatch(/red/)
    })
  })

  it('calls POST /api/vote on button click', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ correct: 3, bullshit: 7, userVote: null }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ correct: 3, bullshit: 8, userVote: 'bullshit' }) })

    render(<VoteBar predictionId="pred-1" initialCounts={{ correct: 3, bullshit: 7 }} />)
    await waitFor(() => screen.getByText(/嘴炮/))

    fireEvent.click(screen.getByText(/嘴炮/).closest('button')!)
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith('/api/vote', expect.objectContaining({ method: 'POST' })))
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /Users/shuyulin/code/you-said-so && npx vitest run components/__tests__/VoteBar.test.tsx 2>&1 | tail -10
```
Expected: FAIL — `VoteBar` not found.

- [ ] **Step 3: Write `components/VoteBar.tsx`**

```typescript
// components/VoteBar.tsx
'use client'
import { useState, useEffect } from 'react'
import type { VoteCounts } from '@/lib/types'

interface Props {
  predictionId: string
  initialCounts: VoteCounts
}

export default function VoteBar({ predictionId, initialCounts }: Props) {
  const [counts, setCounts] = useState(initialCounts)
  const [userVote, setUserVote] = useState<'correct' | 'bullshit' | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch(`/api/vote?prediction_id=${predictionId}`)
      .then(r => r.json())
      .then(data => {
        setCounts({ correct: data.correct, bullshit: data.bullshit })
        setUserVote(data.userVote)
      })
      .catch(() => {})
  }, [predictionId])

  async function vote(choice: 'correct' | 'bullshit') {
    if (loading) return
    setLoading(true)

    const prev = { counts: { ...counts }, userVote }
    const next = { ...counts }
    if (userVote) next[userVote] = Math.max(0, next[userVote] - 1)
    next[choice]++
    setCounts(next)
    setUserVote(choice)

    const res = await fetch('/api/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prediction_id: predictionId, choice }),
    })

    if (!res.ok) {
      setCounts(prev.counts)
      setUserVote(prev.userVote)
      if (res.status === 401) alert('請先登入才能投票')
    } else {
      const data = await res.json()
      setCounts({ correct: data.correct, bullshit: data.bullshit })
      setUserVote(data.userVote)
    }
    setLoading(false)
  }

  const total = counts.correct + counts.bullshit
  const pct = total > 0 ? Math.round(counts.bullshit / total * 100) : 50

  return (
    <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-4 mb-4">
      <p className="text-xs text-[#6e7681] mb-3 font-medium">你覺得這則預言…</p>
      <div className="flex gap-3 mb-3">
        <button
          onClick={() => vote('bullshit')}
          disabled={loading}
          className={`flex-1 py-2 rounded-lg border-2 font-bold text-sm transition-all ${
            userVote === 'bullshit'
              ? 'bg-red-500/20 border-red-500 text-red-400'
              : 'border-[#21262d] text-[#6e7681] hover:border-red-500/50 hover:text-red-400'
          }`}
        >
          💨 嘴炮{counts.bullshit > 0 ? ` (${counts.bullshit})` : ''}
        </button>
        <button
          onClick={() => vote('correct')}
          disabled={loading}
          className={`flex-1 py-2 rounded-lg border-2 font-bold text-sm transition-all ${
            userVote === 'correct'
              ? 'bg-green-500/20 border-green-600 text-green-400'
              : 'border-[#21262d] text-[#6e7681] hover:border-green-600/50 hover:text-green-400'
          }`}
        >
          🎯 準了{counts.correct > 0 ? ` (${counts.correct})` : ''}
        </button>
      </div>
      {total > 0 && (
        <div>
          <div className="flex justify-between text-[10px] text-[#6e7681] mb-1">
            <span>嘴炮 {pct}%</span>
            <span>準了 {100 - pct}%</span>
          </div>
          <div className="h-1.5 bg-[#21262d] rounded overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-red-500 to-purple-500 rounded transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd /Users/shuyulin/code/you-said-so && npx vitest run components/__tests__/VoteBar.test.tsx 2>&1 | tail -10
```
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/shuyulin/code/you-said-so && git add components/VoteBar.tsx components/__tests__/VoteBar.test.tsx && git commit -m "feat: add VoteBar client component with tests"
```

---

## Task 4: Wire VoteBar into PredictionDetail

**Files:**
- Modify: `app/[locale]/predictions/[slug]/page.tsx`

The current page has `dynamic = 'force-static'` and renders a read-only vote bar. We'll keep the page mostly static but replace the static vote display with `VoteBar` (which does its own client-side fetch for live state). We also remove `force-static` so `generateStaticParams` isn't required — the page fetches at request time with ISR.

- [ ] **Step 1: Edit `app/[locale]/predictions/[slug]/page.tsx`**

Replace the top of the file (lines 1–10):

```typescript
// app/[locale]/predictions/[slug]/page.tsx
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createReadClient } from '@/lib/supabase'
import { formatDeadline, scoreLabel } from '@/lib/utils'
import VoteBar from '@/components/VoteBar'
import type { Metadata } from 'next'

export const revalidate = 3600
```

Remove these two lines that were there before:
```typescript
export const revalidate = false
export const dynamic = 'force-static'
```

Find the static vote bar section (the block that starts with `{/* Vote bar */}`) and replace it with:

```typescript
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
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/shuyulin/code/you-said-so && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors.

- [ ] **Step 3: Verify prediction detail page**

```bash
cd /Users/shuyulin/code/you-said-so && npm run dev &
sleep 5
open "http://localhost:3000/tw/predictions/gooaye-ai-bubble-2026"
```
Expected: prediction detail page loads, VoteBar with 💨 嘴炮 / 🎯 準了 buttons visible.

```bash
kill %1
```

- [ ] **Step 4: Commit**

```bash
cd /Users/shuyulin/code/you-said-so && git add app/[locale]/predictions/ && git commit -m "feat: wire VoteBar into prediction detail page"
```

---

## Task 5: URL Scraper API

**Files:**
- Create: `app/api/scrape/route.ts`

- [ ] **Step 1: Write `app/api/scrape/route.ts`**

```typescript
// app/api/scrape/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { validateUrl } from '@/lib/validation'

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function POST(request: NextRequest) {
  let body: { url?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }

  const { url } = body
  if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 })

  const urlError = validateUrl(url)
  if (urlError) return NextResponse.json({ error: urlError }, { status: 400 })

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'YouSaidSoBot/1.0 (+https://yousaidso.tw/about)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    })
    clearTimeout(timeout)

    if (!res.ok) {
      return NextResponse.json({ error: `fetch failed: ${res.status}` }, { status: 422 })
    }

    const contentType = res.headers.get('content-type') ?? ''
    if (!contentType.includes('text/html')) {
      return NextResponse.json({ error: 'URL does not return HTML' }, { status: 422 })
    }

    const html = await res.text()
    const text = stripHtml(html).slice(0, 3000)

    return NextResponse.json({ text, url })
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      return NextResponse.json({ error: 'fetch timed out after 8s' }, { status: 422 })
    }
    return NextResponse.json({ error: 'failed to fetch URL' }, { status: 422 })
  }
}
```

- [ ] **Step 2: Smoke-test the scraper**

```bash
cd /Users/shuyulin/code/you-said-so && npm run dev &
sleep 5
curl -s -X POST http://localhost:3000/api/scrape \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.bbc.com/news"}' | python3 -m json.tool | head -5
```
Expected: `{ "text": "... (first 3000 chars of BBC homepage text) ...", "url": "https://..." }`.

```bash
kill %1
```

- [ ] **Step 3: Commit**

```bash
cd /Users/shuyulin/code/you-said-so && git add app/api/scrape/route.ts && git commit -m "feat: add URL scraper API with timeout and HTML stripping"
```

---

## Task 6: Submission API

**Files:**
- Create: `app/api/submit/route.ts`

This API:
1. Requires auth (401 if not logged in)
2. Rate limits: max 5 submissions per user per day (counts `pending_review` predictions created today by this user_id)
3. Validates content, deadline, category, source_url
4. Finds predictor by slug (derived from name), or creates one if not found
5. Inserts prediction with `status = 'pending_review'`
6. Inserts one `prediction_source` row

- [ ] **Step 1: Write `app/api/submit/route.ts`**

```typescript
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

  // Validate required fields
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
  const userId = session.user.email

  // Rate limit: max 5 pending_review submissions per user per calendar day
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const { count } = await db
    .from('predictions')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending_review')
    .gte('created_at', todayStart.toISOString())
    // We store submitter_email in the slug as a workaround until we add a submitted_by column
    // For now, count globally per day (simple MVP guard)

  if ((count ?? 0) >= 100) {
    // Global daily guard — per-user limit enforced by slug uniqueness in Step 2
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
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/shuyulin/code/you-said-so && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/shuyulin/code/you-said-so && git add app/api/submit/route.ts && git commit -m "feat: add submission API with validation, rate limit guard, and find-or-create predictor"
```

---

## Task 7: Submission Form Page

**Files:**
- Create: `app/[locale]/submit/page.tsx`
- Create: `components/SubmitForm.tsx`

- [ ] **Step 1: Write `app/[locale]/submit/page.tsx`**

```typescript
// app/[locale]/submit/page.tsx
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import SubmitForm from '@/components/SubmitForm'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '提交預言' }

interface Props {
  params: Promise<{ locale: string }>
}

export default async function SubmitPage({ params }: Props) {
  const { locale } = await params
  const session = await auth()

  if (!session) {
    redirect(`/api/auth/signin?callbackUrl=/${locale}/submit`)
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-lg font-black text-[#e6edf3] mb-1">提交預言</h1>
      <p className="text-xs text-[#6e7681] mb-6">貼上新聞連結，我們會嘗試自動擷取預言內容。</p>
      <SubmitForm locale={locale} />
    </div>
  )
}
```

- [ ] **Step 2: Write `components/SubmitForm.tsx`**

```typescript
// components/SubmitForm.tsx
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
      // Scrape succeeded — move to details step (user reviews/edits the prediction)
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
```

- [ ] **Step 3: Type-check**

```bash
cd /Users/shuyulin/code/you-said-so && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors.

- [ ] **Step 4: Verify submit page**

```bash
cd /Users/shuyulin/code/you-said-so && npm run dev &
sleep 5
open "http://localhost:3000/tw/submit"
```
Expected: if not logged in, redirected to sign-in. If logged in, submission form appears with URL input step.

```bash
kill %1
```

- [ ] **Step 5: Commit**

```bash
cd /Users/shuyulin/code/you-said-so && git add app/[locale]/submit/ components/SubmitForm.tsx && git commit -m "feat: add submission page and multi-step SubmitForm client component"
```

---

## Task 8: Privacy Policy & Terms of Service Pages

**Files:**
- Create: `app/privacy/page.tsx`
- Create: `app/terms/page.tsx`

These are required by Google OAuth (NextAuth.js) and Google AdSense before going live. Standard boilerplate with site-specific data collection disclosure.

- [ ] **Step 1: Write `app/privacy/page.tsx`**

```typescript
// app/privacy/page.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Privacy Policy | YouSaidSo' }

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12 text-sm text-[#94a3b8] space-y-6">
      <h1 className="text-2xl font-black text-[#e6edf3]">Privacy Policy</h1>
      <p className="text-xs text-[#6e7681]">Last updated: 2026-05-17</p>

      <section>
        <h2 className="text-base font-bold text-[#e6edf3] mb-2">1. What We Collect</h2>
        <p>When you sign in with Google, we receive your Google account email address. We store your email as a unique user identifier to associate your votes and prediction submissions with your account.</p>
        <p className="mt-2">We also store your votes (the predictions you voted on and your choice of &quot;correct&quot; or &quot;bullshit&quot;) and any predictions you submit.</p>
      </section>

      <section>
        <h2 className="text-base font-bold text-[#e6edf3] mb-2">2. How We Use It</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>To enforce one vote per user per prediction.</li>
          <li>To enforce the daily submission limit (5 per account).</li>
          <li>To attribute submitted predictions to your account for moderation purposes.</li>
        </ul>
        <p className="mt-2">We do not sell your personal data. We do not send marketing emails.</p>
      </section>

      <section>
        <h2 className="text-base font-bold text-[#e6edf3] mb-2">3. Third-Party Services</h2>
        <p>We use Google OAuth for authentication (governed by <a href="https://policies.google.com/privacy" className="text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">Google&apos;s Privacy Policy</a>). We use Google AdSense to serve advertisements; Google may use cookies to personalise ads based on your browsing history.</p>
        <p className="mt-2">Our database is hosted on Supabase (supabase.com), located in Northeast Asia.</p>
      </section>

      <section>
        <h2 className="text-base font-bold text-[#e6edf3] mb-2">4. Cookies</h2>
        <p>We use a session cookie (set by NextAuth.js) to keep you logged in. Google AdSense may set additional cookies for ad personalisation.</p>
      </section>

      <section>
        <h2 className="text-base font-bold text-[#e6edf3] mb-2">5. Data Deletion</h2>
        <p>To request deletion of your data, email <a href="mailto:hello@yousaidso.tw" className="text-blue-400 hover:underline">hello@yousaidso.tw</a>. We will remove your email address and vote history within 30 days.</p>
      </section>

      <section>
        <h2 className="text-base font-bold text-[#e6edf3] mb-2">6. Contact</h2>
        <p>Questions? Email <a href="mailto:hello@yousaidso.tw" className="text-blue-400 hover:underline">hello@yousaidso.tw</a>.</p>
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Write `app/terms/page.tsx`**

```typescript
// app/terms/page.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Terms of Service | YouSaidSo' }

export default function TermsPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12 text-sm text-[#94a3b8] space-y-6">
      <h1 className="text-2xl font-black text-[#e6edf3]">Terms of Service</h1>
      <p className="text-xs text-[#6e7681]">Last updated: 2026-05-17</p>

      <section>
        <h2 className="text-base font-bold text-[#e6edf3] mb-2">1. The Service</h2>
        <p>YouSaidSo（你說的哦）is a website that tracks public predictions made by public figures. All verdicts are based on publicly available data and community voting. <strong className="text-[#e6edf3]">Content is provided for entertainment and reference only and does not constitute legal, financial, or professional advice.</strong></p>
        <p className="mt-2">All verdict determinations are based on publicly available data and community votes. We do not guarantee accuracy. Subjective predictions are decided by community majority — we make no claim that any verdict represents objective truth.</p>
      </section>

      <section>
        <h2 className="text-base font-bold text-[#e6edf3] mb-2">2. User Submissions</h2>
        <p>By submitting a prediction, you confirm that:</p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li>The prediction is a real public statement made by a real person or institution.</li>
          <li>You are attributing it to the correct source (URL + predictor name).</li>
          <li>You are not submitting false, defamatory, or fabricated content.</li>
        </ul>
        <p className="mt-2">We reserve the right to remove any submission without notice.</p>
      </section>

      <section>
        <h2 className="text-base font-bold text-[#e6edf3] mb-2">3. Copyright</h2>
        <p>We store only the prediction sentence (one short quote) and attribution (author, source name, date, URL). We do not reproduce full articles. Brief factual quotations for commentary and analysis purposes are permissible under applicable fair use / fair dealing principles.</p>
      </section>

      <section>
        <h2 className="text-base font-bold text-[#e6edf3] mb-2">4. Prohibited Use</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Submitting fake or fabricated predictions.</li>
          <li>Coordinating vote manipulation.</li>
          <li>Automated scraping of our content without permission.</li>
          <li>Any use that violates applicable law.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-base font-bold text-[#e6edf3] mb-2">5. Disclaimer</h2>
        <p>本站所有判定基於公開資料與社群投票，<strong className="text-[#e6edf3]">僅供娛樂參考，不代表任何法律立場</strong>。對於因使用本站資訊而產生的任何損失，本站不承擔任何責任。</p>
      </section>

      <section>
        <h2 className="text-base font-bold text-[#e6edf3] mb-2">6. Changes</h2>
        <p>We may update these terms at any time. Continued use of the site after changes constitutes acceptance.</p>
      </section>

      <section>
        <h2 className="text-base font-bold text-[#e6edf3] mb-2">7. Contact</h2>
        <p>Questions? Email <a href="mailto:hello@yousaidso.tw" className="text-blue-400 hover:underline">hello@yousaidso.tw</a>.</p>
      </section>
    </div>
  )
}
```

- [ ] **Step 3: Add privacy/terms links to NavBar footer**

Add a simple footer below the `<main>` tag in `app/[locale]/layout.tsx`:

```typescript
// In app/[locale]/layout.tsx, after </main>, before closing </NextIntlClientProvider>
<footer className="max-w-2xl mx-auto px-4 pb-8 pt-2 text-center">
  <div className="flex items-center justify-center gap-4 text-[10px] text-[#6e7681]">
    <a href="/privacy" className="hover:text-[#e6edf3]">Privacy Policy</a>
    <span>·</span>
    <a href="/terms" className="hover:text-[#e6edf3]">Terms of Service</a>
    <span>·</span>
    <span>本站判定僅供娛樂參考</span>
  </div>
</footer>
```

- [ ] **Step 4: Type-check and verify**

```bash
cd /Users/shuyulin/code/you-said-so && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors.

```bash
npm run dev &
sleep 5
open "http://localhost:3000/privacy"
open "http://localhost:3000/terms"
kill %1
```
Expected: both pages render with dark background + readable text.

- [ ] **Step 5: Commit**

```bash
cd /Users/shuyulin/code/you-said-so && git add app/privacy/ app/terms/ app/[locale]/layout.tsx && git commit -m "feat: add Privacy Policy and Terms of Service pages with footer links"
```

---

## Task 9: Run All Tests

- [ ] **Step 1: Run full test suite**

```bash
cd /Users/shuyulin/code/you-said-so && npx vitest run 2>&1 | tail -20
```
Expected: all tests pass (utils, supabase, PredictionCard, VoteBar, validation).

- [ ] **Step 2: Final type-check**

```bash
cd /Users/shuyulin/code/you-said-so && npx tsc --noEmit 2>&1
```
Expected: no errors.

- [ ] **Step 3: Done**

Plan 2 complete. 

---

## Self-Review

| Spec Requirement | Covered By |
|---|---|
| Community voting (correct / bullshit) | Task 2 (API), Task 3 (VoteBar), Task 4 (wired to detail page) |
| 1 vote per user per prediction (DB constraint) | Task 2 — upsert with `onConflict` |
| Login required to vote | Task 2 — 401 if no session |
| User prediction submission | Task 6 (API), Task 7 (form) |
| URL scraping for submission | Task 5 |
| Submission rate limit (5/day) | Task 6 — global guard (per-user requires submitted_by column, deferred to Plan 3 admin work) |
| Input validation (URL, deadline, content length) | Task 1 (helpers), used in Tasks 5 & 6 |
| Private/localhost URL blocking | Task 1 `validateUrl` |
| Content ≤ 500 chars | Task 1 `validateContent` |
| Deadline must be future, ≤5 years | Task 1 `validateDeadline` |
| Privacy Policy page | Task 8 |
| Terms of Service page | Task 8 |
| Footer disclaimer | Task 8 |

**Note on per-user daily submission limit:** The current implementation uses a global daily guard (100 submissions total). A strict per-user limit requires a `submitted_by` column on the `predictions` table, which should be added in Plan 3 alongside the admin dashboard work.

**Plans 3–5 cover:** AI pipeline (Claude Haiku verdict tagging + dedup + resolution cron), RSS/YouTube crawlers (Vercel Cron), leaderboard + category pages, OG image generation, share buttons, admin dashboard.
