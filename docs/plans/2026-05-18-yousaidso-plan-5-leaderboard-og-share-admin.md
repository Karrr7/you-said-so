# Leaderboard / OG Image / Share / Me / Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the YouSaidSo MVP with leaderboard rankings, dynamic OG image cards, share buttons, a user "my submissions" page, an admin moderation panel, and a sitemap for SEO.

**Architecture:** All new pages are Next.js 15 App Router Server Components with ISR where appropriate. The OG image is generated server-side via `@vercel/og`. Share buttons are a small `'use client'` component. Admin and Me pages use `auth()` server-side for access control. Service client bypasses RLS for admin/me queries.

**Tech Stack:** Next.js App Router, `@vercel/og`, NextAuth v5 `auth()`, Supabase service client, Tailwind CSS, Vitest + Testing Library

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `app/[locale]/leaderboard/page.tsx` | Create | Leaderboard ranked by bullshit or accuracy |
| `app/api/og/route.ts` | Create | Dynamic OG image for predictions |
| `app/[locale]/predictions/[slug]/page.tsx` | Modify | Add OG metadata + share buttons |
| `components/ShareButtons.tsx` | Create | LINE / X / FB / Threads / Copy client component |
| `components/__tests__/ShareButtons.test.tsx` | Create | Share URL + clipboard tests |
| `app/[locale]/me/page.tsx` | Create | User's own submissions with status + withdraw |
| `components/MyPredictionList.tsx` | Create | Client component for withdraw actions |
| `components/NavBar.tsx` | Modify | Add "我的提交" link for logged-in users |
| `app/admin/page.tsx` | Create | Admin panel: pending predictions list |
| `components/AdminPredictionList.tsx` | Create | Client component with approve/delete buttons |
| `app/api/admin/predictions/[id]/approve/route.ts` | Create | Admin approve endpoint |
| `app/sitemap.ts` | Create | XML sitemap for SEO |

---

### Task 1: Leaderboard Page

**Files:**
- Create: `app/[locale]/leaderboard/page.tsx`

- [ ] **Step 1: Create the leaderboard page**

Create `app/[locale]/leaderboard/page.tsx`:

```typescript
import Link from 'next/link'
import { createReadClient } from '@/lib/supabase'
import type { Metadata } from 'next'

export const revalidate = 21600 // ISR: 6 hours

export const metadata: Metadata = {
  title: '嘴炮排行榜',
}

interface Props {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ tab?: string }>
}

export default async function LeaderboardPage({ params, searchParams }: Props) {
  const { locale } = await params
  const { tab } = await searchParams
  const isAccuracy = tab === 'accuracy'

  const db = await createReadClient()
  const { data: predictors } = await db
    .from('predictors')
    .select('id, name, slug, bullshit_score, accuracy_rate, total_predictions, avatar_url')
    .eq('locale', locale)
    .gt('total_predictions', 0)
    .order(isAccuracy ? 'accuracy_rate' : 'bullshit_score', { ascending: false })
    .limit(50)

  const rows = predictors ?? []

  return (
    <div>
      <h1 className="text-lg font-black text-[#e6edf3] mb-4 tracking-tight">
        {isAccuracy ? '🎯 最準排行榜' : '💨 嘴炮排行榜'}
      </h1>

      {/* Tab switcher */}
      <div className="flex gap-2 mb-6">
        <Link
          href={`/${locale}/leaderboard`}
          className={`px-3 py-1.5 rounded-md text-xs font-bold border transition-colors ${
            !isAccuracy
              ? 'bg-red-500/20 border-red-500/50 text-red-400'
              : 'border-[#21262d] text-[#6e7681] hover:text-[#e6edf3]'
          }`}
        >
          💨 嘴炮排行
        </Link>
        <Link
          href={`/${locale}/leaderboard?tab=accuracy`}
          className={`px-3 py-1.5 rounded-md text-xs font-bold border transition-colors ${
            isAccuracy
              ? 'bg-green-500/20 border-green-500/50 text-green-400'
              : 'border-[#21262d] text-[#6e7681] hover:text-[#e6edf3]'
          }`}
        >
          🎯 最準排行
        </Link>
      </div>

      {/* Leaderboard table */}
      {rows.length === 0 ? (
        <p className="text-[#6e7681] text-sm text-center py-12">目前沒有足夠資料</p>
      ) : (
        <div className="space-y-2">
          {rows.map((predictor, idx) => {
            const score = isAccuracy ? predictor.accuracy_rate : predictor.bullshit_score
            const scoreColor = isAccuracy
              ? predictor.accuracy_rate >= 70 ? 'text-green-400' : 'text-[#6e7681]'
              : predictor.bullshit_score > 50 ? 'text-red-400' : 'text-[#6e7681]'

            return (
              <Link
                key={predictor.id}
                href={`/${locale}/predictors/${predictor.slug}`}
                className="flex items-center gap-3 bg-[#161b22] border border-[#21262d] rounded-xl px-4 py-3 hover:border-[#30363d] transition-colors"
              >
                {/* Rank */}
                <span className={`text-sm font-black w-7 text-center ${idx === 0 ? 'text-yellow-400' : idx === 1 ? 'text-[#94a3b8]' : idx === 2 ? 'text-amber-600' : 'text-[#6e7681]'}`}>
                  #{idx + 1}
                </span>

                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-[#1a2235] border-2 border-[#21262d] flex items-center justify-center text-base flex-shrink-0">
                  {predictor.avatar_url
                    ? <img src={predictor.avatar_url} alt={predictor.name} className="w-full h-full rounded-full object-cover" />
                    : '👤'}
                </div>

                {/* Name + stats */}
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[#e6edf3] text-sm truncate">{predictor.name}</div>
                  <div className="text-[10px] text-[#6e7681]">{predictor.total_predictions} 則預言</div>
                </div>

                {/* Score */}
                <div className={`text-lg font-black ${scoreColor}`}>
                  {score.toFixed(0)}%
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run full test suite**

```bash
cd /Users/shuyulin/code/you-said-so && npm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
cd /Users/shuyulin/code/you-said-so && git add app/[locale]/leaderboard/page.tsx && git commit -m "feat: add leaderboard page with bullshit/accuracy ranking"
```

---

### Task 2: OG Image Route + Prediction Metadata

**Files:**
- Create: `app/api/og/route.ts`
- Modify: `app/[locale]/predictions/[slug]/page.tsx`

- [ ] **Step 1: Create app/api/og/route.ts**

First create the directory:
```bash
mkdir -p /Users/shuyulin/code/you-said-so/app/api/og
```

Create `app/api/og/route.ts`:

```typescript
import { ImageResponse } from '@vercel/og'
import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const slug = searchParams.get('slug')

  let content = 'YouSaidSo 你說的哦'
  let predictorName = ''
  let verdict: string | null = null

  if (slug) {
    const db = createServiceClient()
    const { data } = await db
      .from('predictions')
      .select('content, verdict, predictor:predictors(name)')
      .eq('slug', slug)
      .single()

    if (data) {
      content = data.content
      verdict = data.verdict
      const pred = data.predictor
      predictorName = Array.isArray(pred) ? (pred[0]?.name ?? '') : ((pred as any)?.name ?? '')
    }
  }

  const isBullshit = verdict === 'bullshit'
  const isCorrect = verdict === 'correct'
  const hasVerdict = isBullshit || isCorrect

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          background: '#0d1117',
          padding: '56px 60px',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Header: predictor + verdict badge */}
        {predictorName && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
            <span style={{ fontSize: 28, fontWeight: 900, color: '#e6edf3' }}>
              {predictorName}
            </span>
            {hasVerdict && (
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: isBullshit ? '#ef4444' : '#22c55e',
                  border: `3px solid ${isBullshit ? '#ef4444' : '#22c55e'}`,
                  borderRadius: 6,
                  padding: '4px 12px',
                  transform: 'rotate(-4deg)',
                  display: 'flex',
                }}
              >
                {isBullshit ? '💨 嘴炮' : '🎯 準了'}
              </span>
            )}
          </div>
        )}

        {/* Speech bubble */}
        <div
          style={{
            display: 'flex',
            flex: 1,
            background: '#fffef0',
            border: '4px solid #0a0c10',
            borderRadius: 24,
            padding: '36px 44px',
            boxShadow: '8px 8px 0 #f5a623, 8px 8px 0 2px #0a0c10',
            alignItems: 'center',
          }}
        >
          <p
            style={{
              fontSize: content.length > 50 ? 32 : 38,
              fontWeight: 700,
              color: '#0a0c10',
              margin: 0,
              lineHeight: 1.4,
            }}
          >
            「{content.slice(0, 80)}{content.length > 80 ? '…' : ''}」
          </p>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
          <span style={{ fontSize: 18, color: '#6e7681', fontWeight: 700 }}>
            YouSaidSo 你說的哦
          </span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}
```

- [ ] **Step 2: Read and update prediction detail page metadata**

Read `app/[locale]/predictions/[slug]/page.tsx`, then update the `generateMetadata` function to include OG image:

Replace the existing `generateMetadata` function with:

```typescript
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const db = await createReadClient()
  const { data } = await db.from('predictions').select('content, verdict').eq('slug', slug).single()
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://yousaidso.tw'
  const title = data ? `「${data.content.slice(0, 30)}…」` : '找不到此預言'
  const ogImageUrl = `${baseUrl}/api/og?slug=${slug}`
  return {
    title,
    openGraph: {
      title,
      images: [{ url: ogImageUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      images: [ogImageUrl],
    },
  }
}
```

- [ ] **Step 3: Run full test suite**

```bash
cd /Users/shuyulin/code/you-said-so && npm test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
cd /Users/shuyulin/code/you-said-so && git add app/api/og/route.ts app/[locale]/predictions/[slug]/page.tsx && git commit -m "feat: add OG image route and update prediction detail metadata"
```

---

### Task 3: ShareButtons Component

**Files:**
- Create: `components/ShareButtons.tsx`
- Create: `components/__tests__/ShareButtons.test.tsx`
- Modify: `app/[locale]/predictions/[slug]/page.tsx`

- [ ] **Step 1: Write the failing test first**

Create `components/__tests__/ShareButtons.test.tsx`:

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ShareButtons from '../ShareButtons'

const writeText = vi.fn().mockResolvedValue(undefined)
Object.assign(navigator, { clipboard: { writeText } })

const defaultProps = {
  url: 'https://yousaidso.tw/tw/predictions/test-slug',
  content: '台積電年底破1500',
  predictorName: '股癌',
  verdict: 'bullshit' as const,
}

describe('ShareButtons', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders LINE share link with encoded URL', () => {
    render(<ShareButtons {...defaultProps} />)
    const lineLink = screen.getByRole('link', { name: /LINE/i })
    expect(lineLink).toBeDefined()
    expect((lineLink as HTMLAnchorElement).href).toContain('social-plugins.line.me')
    expect((lineLink as HTMLAnchorElement).href).toContain(
      encodeURIComponent('https://yousaidso.tw/tw/predictions/test-slug'),
    )
  })

  it('renders X/Twitter share link', () => {
    render(<ShareButtons {...defaultProps} />)
    const xLink = screen.getByRole('link', { name: /^X$|Twitter/i })
    expect((xLink as HTMLAnchorElement).href).toContain('twitter.com/intent/tweet')
  })

  it('copies URL to clipboard on button click', async () => {
    render(<ShareButtons {...defaultProps} />)
    const copyBtn = screen.getByRole('button', { name: /複製/i })
    fireEvent.click(copyBtn)
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('https://yousaidso.tw/tw/predictions/test-slug')
    })
  })

  it('shows checkmark after copy', async () => {
    render(<ShareButtons {...defaultProps} />)
    const copyBtn = screen.getByRole('button', { name: /複製/i })
    fireEvent.click(copyBtn)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /已複製|✓/i })).toBeDefined()
    })
  })
})
```

- [ ] **Step 2: Run test (expect FAIL — module not found)**

```bash
cd /Users/shuyulin/code/you-said-so && npm test -- components/__tests__/ShareButtons.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement components/ShareButtons.tsx**

Create `components/ShareButtons.tsx`:

```typescript
'use client'

import { useState } from 'react'

interface Props {
  url: string
  content: string
  predictorName: string
  verdict: 'correct' | 'bullshit' | null
}

export default function ShareButtons({ url, content, predictorName, verdict }: Props) {
  const [copied, setCopied] = useState(false)

  const shareText = verdict === 'bullshit'
    ? `${predictorName} 嘴炮了！「${content.slice(0, 30)}」`
    : verdict === 'correct'
    ? `${predictorName} 準了！「${content.slice(0, 30)}」`
    : `「${content.slice(0, 30)}」— YouSaidSo 你說的哦`

  const encodedUrl = encodeURIComponent(url)
  const encodedText = encodeURIComponent(shareText)

  async function copyLink() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const linkClass = 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#21262d] text-xs font-semibold text-[#6e7681] hover:text-[#e6edf3] hover:border-[#30363d] transition-colors'

  return (
    <div className="mt-4">
      <p className="text-[10px] font-bold text-[#6e7681] uppercase tracking-widest mb-2">分享</p>
      <div className="flex flex-wrap gap-2">
        <a
          href={`https://social-plugins.line.me/lineit/share?url=${encodedUrl}`}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
        >
          <span>LINE</span>
        </a>
        <a
          href={`https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
        >
          <span>X</span>
        </a>
        <a
          href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
        >
          <span>Facebook</span>
        </a>
        <a
          href={`https://www.threads.net/intent/post?text=${encodedText}%20${encodedUrl}`}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
        >
          <span>Threads</span>
        </a>
        <button
          onClick={copyLink}
          className={`${linkClass} ${copied ? 'text-green-400 border-green-500/50' : ''}`}
        >
          {copied ? '✓ 已複製' : '複製連結'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests (expect PASS — 4 tests)**

```bash
cd /Users/shuyulin/code/you-said-so && npm test -- components/__tests__/ShareButtons.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Add ShareButtons to prediction detail page**

Read `app/[locale]/predictions/[slug]/page.tsx`, then:

1. Add this import at the top of the file:
```typescript
import ShareButtons from '@/components/ShareButtons'
```

2. After the `{/* Sources */}` section and before the closing `</div>`, insert the ShareButtons. Find the `{/* Sources */}` section in the file and add ShareButtons right before it:

```typescript
      {/* Share */}
      <ShareButtons
        url={`${process.env.NEXT_PUBLIC_BASE_URL ?? 'https://yousaidso.tw'}/${locale}/predictions/${slug}`}
        content={prediction.content}
        predictorName={predictor.name}
        verdict={prediction.verdict}
      />
```

- [ ] **Step 6: Run full test suite**

```bash
cd /Users/shuyulin/code/you-said-so && npm test
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
cd /Users/shuyulin/code/you-said-so && git add components/ShareButtons.tsx components/__tests__/ShareButtons.test.tsx app/[locale]/predictions/[slug]/page.tsx && git commit -m "feat: add ShareButtons component with LINE/X/FB/Threads/copy"
```

---

### Task 4: Me Page + NavBar Update

**Files:**
- Create: `app/[locale]/me/page.tsx`
- Create: `components/MyPredictionList.tsx`
- Modify: `components/NavBar.tsx`

- [ ] **Step 1: Create components/MyPredictionList.tsx**

Create `components/MyPredictionList.tsx`:

```typescript
'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Prediction {
  id: string
  content: string
  status: string
  deleted_at: string | null
  deadline: string
  predictor: { name: string; slug: string }
  locale: string
  slug: string
}

interface Props {
  predictions: Prediction[]
  locale: string
}

export default function MyPredictionList({ predictions, locale }: Props) {
  const [withdrawn, setWithdrawn] = useState<Set<string>>(new Set())

  async function withdraw(id: string) {
    const res = await fetch(`/api/predictions/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setWithdrawn(prev => new Set([...prev, id]))
    } else {
      alert('無法撤回，請稍後再試')
    }
  }

  if (predictions.length === 0) {
    return (
      <p className="text-[#6e7681] text-sm text-center py-12">
        你還沒有提交過預言
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {predictions.map(p => {
        const isWithdrawn = withdrawn.has(p.id) || !!p.deleted_at
        const canWithdraw = p.status === 'pending_review' && !p.deleted_at && !withdrawn.has(p.id)

        const statusLabel = isWithdrawn
          ? <span className="text-[#6e7681]">已撤回</span>
          : p.status === 'pending_review'
          ? <span className="text-yellow-500/80">審核中</span>
          : p.status === 'active'
          ? <span className="text-green-400">已上線</span>
          : p.status === 'community_vote'
          ? <span className="text-purple-400">投票中</span>
          : p.status === 'resolved'
          ? <span className="text-blue-400">已判定</span>
          : <span className="text-[#6e7681]">{p.status}</span>

        return (
          <div key={p.id} className="bg-[#161b22] border border-[#21262d] rounded-xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#e6edf3] leading-snug mb-1">
                  {isWithdrawn
                    ? <span className="line-through text-[#6e7681]">{p.content.slice(0, 60)}{p.content.length > 60 ? '…' : ''}</span>
                    : <Link href={`/${locale}/predictions/${p.slug}`} className="hover:underline">
                        {p.content.slice(0, 60)}{p.content.length > 60 ? '…' : ''}
                      </Link>
                  }
                </p>
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <Link href={`/${locale}/predictors/${p.predictor.slug}`} className="text-[#6e7681] hover:text-[#e6edf3]">
                    {p.predictor.name}
                  </Link>
                  <span className="text-[#21262d]">·</span>
                  <span className="text-[#6e7681]">截止 {p.deadline.replace(/-/g, '/')}</span>
                  <span className="text-[#21262d]">·</span>
                  {statusLabel}
                </div>
              </div>
              {canWithdraw && (
                <button
                  onClick={() => withdraw(p.id)}
                  className="text-[11px] text-[#6e7681] hover:text-red-400 transition-colors flex-shrink-0 border border-[#21262d] rounded-md px-2 py-1"
                >
                  撤回
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Create app/[locale]/me/page.tsx**

First create the directory:
```bash
mkdir -p /Users/shuyulin/code/you-said-so/app/\[locale\]/me
```

Create `app/[locale]/me/page.tsx`:

```typescript
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { createServiceClient } from '@/lib/supabase'
import MyPredictionList from '@/components/MyPredictionList'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '我的提交' }

interface Props {
  params: Promise<{ locale: string }>
}

export default async function MePage({ params }: Props) {
  const { locale } = await params
  const session = await auth()

  if (!session?.user?.email) {
    redirect(`/${locale}/submit`)
  }

  const db = createServiceClient()
  const { data: predictions } = await db
    .from('predictions')
    .select('id, content, status, deleted_at, deadline, slug, locale, predictor:predictors(name, slug)')
    .eq('submitted_by', session.user.email)
    .order('created_at', { ascending: false })
    .limit(100)

  const rows = (predictions ?? []).map(p => ({
    ...p,
    predictor: Array.isArray(p.predictor) ? p.predictor[0] : p.predictor,
  })) as any[]

  return (
    <div>
      <h1 className="text-lg font-black text-[#e6edf3] mb-1 tracking-tight">我的提交</h1>
      <p className="text-[#6e7681] text-xs mb-5">{session.user.email}</p>
      <MyPredictionList predictions={rows} locale={locale} />
    </div>
  )
}
```

- [ ] **Step 3: Add "我的提交" to NavBar**

Read `components/NavBar.tsx`, then find the block inside the `{session ? (` branch that contains the "提交預言" link. Add a "我的提交" link right before the "提交預言" link:

Find this text in NavBar.tsx:
```typescript
              <Link href={`/${locale}/submit`} className="text-sm text-[#6e7681] hover:text-[#e6edf3] transition-colors">
                提交預言
              </Link>
```

Replace with:
```typescript
              <Link href={`/${locale}/me`} className="text-sm text-[#6e7681] hover:text-[#e6edf3] transition-colors">
                我的提交
              </Link>
              <Link href={`/${locale}/submit`} className="text-sm text-[#6e7681] hover:text-[#e6edf3] transition-colors">
                提交預言
              </Link>
```

- [ ] **Step 4: Run full test suite**

```bash
cd /Users/shuyulin/code/you-said-so && npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/shuyulin/code/you-said-so && git add app/\[locale\]/me/page.tsx components/MyPredictionList.tsx components/NavBar.tsx && git commit -m "feat: add Me page with submission history and withdraw, update NavBar"
```

---

### Task 5: Admin Panel + Approve API

**Files:**
- Create: `app/admin/page.tsx`
- Create: `components/AdminPredictionList.tsx`
- Create: `app/api/admin/predictions/[id]/approve/route.ts`

- [ ] **Step 1: Create approve API route**

First create the directory:
```bash
mkdir -p /Users/shuyulin/code/you-said-so/app/api/admin/predictions/\[id\]/approve
```

Create `app/api/admin/predictions/[id]/approve/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { createServiceClient } from '@/lib/supabase'

function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  const list = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim()).filter(Boolean)
  return list.includes(email)
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!isAdmin(session?.user?.email)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { id } = await params
  const db = createServiceClient()

  const { error } = await db
    .from('predictions')
    .update({ status: 'active' })
    .eq('id', id)
    .eq('status', 'pending_review')

  if (error) return NextResponse.json({ error: 'update failed' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Create components/AdminPredictionList.tsx**

Create `components/AdminPredictionList.tsx`:

```typescript
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
    if (res.ok) setStates(s => ({ ...s, [id]: 'approved' }))
    else { setStates(s => { const n = { ...s }; delete n[id]; return n }); alert('Approve failed') }
  }

  async function deletePrediction(id: string) {
    if (!confirm('Delete this prediction?')) return
    setStates(s => ({ ...s, [id]: 'loading' }))
    const res = await fetch(`/api/predictions/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Admin deleted from panel' }),
    })
    if (res.ok) setStates(s => ({ ...s, [id]: 'deleted' }))
    else { setStates(s => { const n = { ...s }; delete n[id]; return n }); alert('Delete failed') }
  }

  const pending = predictions.filter(p => !states[p.id])
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
            <div key={p.id} className="bg-green-900/20 border border-green-800/50 rounded-xl p-3 text-xs text-green-400">✓ Approved: {p.content.slice(0, 60)}</div>
          )
          if (state === 'deleted') return (
            <div key={p.id} className="bg-red-900/20 border border-red-800/50 rounded-xl p-3 text-xs text-red-400">✗ Deleted: {p.content.slice(0, 60)}</div>
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
                    {p.submitted_by && <><span>·</span><span>{p.submitted_by}</span></>}
                  </div>
                  {source && (
                    <a href={source.source_url} target="_blank" rel="noopener noreferrer"
                      className="text-[11px] text-blue-400 hover:underline truncate block max-w-sm">
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
        <p className="text-[10px] text-[#6e7681] text-center mt-4">已處理 {done.length} 筆（刷新頁面以清除）</p>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create app/admin/page.tsx**

First ensure the directory exists:
```bash
mkdir -p /Users/shuyulin/code/you-said-so/app/admin
```

Create `app/admin/page.tsx`:

```typescript
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { createServiceClient } from '@/lib/supabase'
import AdminPredictionList from '@/components/AdminPredictionList'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Admin Panel' }

function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  const list = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim()).filter(Boolean)
  return list.includes(email)
}

export default async function AdminPage() {
  const session = await auth()
  if (!isAdmin(session?.user?.email)) redirect('/')

  const db = createServiceClient()
  const { data: predictions } = await db
    .from('predictions')
    .select('id, content, deadline, category, submitted_by, predictor:predictors(name), sources:prediction_sources(source_url, source_name)')
    .eq('status', 'pending_review')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(100)

  const rows = (predictions ?? []).map(p => ({
    ...p,
    predictor: Array.isArray(p.predictor) ? p.predictor[0] : p.predictor,
    sources: Array.isArray(p.sources) ? p.sources : [],
  })) as any[]

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-black text-[#e6edf3]">Admin Panel</h1>
        <span className="text-xs text-[#6e7681]">{rows.length} 待審核</span>
      </div>
      <AdminPredictionList predictions={rows} />
    </div>
  )
}
```

- [ ] **Step 4: Run full test suite**

```bash
cd /Users/shuyulin/code/you-said-so && npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/shuyulin/code/you-said-so && git add app/admin/page.tsx components/AdminPredictionList.tsx app/api/admin/predictions/\[id\]/approve/route.ts && git commit -m "feat: add admin panel with approve/delete and approve API endpoint"
```

---

### Task 6: Sitemap + Final Test Run

**Files:**
- Create: `app/sitemap.ts`

- [ ] **Step 1: Create app/sitemap.ts**

Create `app/sitemap.ts`:

```typescript
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
    { url: `${BASE_URL}/tw`, lastModified: new Date(), changeFrequency: 'hourly', priority: 1 },
    { url: `${BASE_URL}/tw/leaderboard`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE_URL}/tw/submit`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/privacy`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.2 },
    { url: `${BASE_URL}/terms`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.2 },
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
```

- [ ] **Step 2: Run full test suite one final time**

```bash
cd /Users/shuyulin/code/you-said-so && npm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
cd /Users/shuyulin/code/you-said-so && git add app/sitemap.ts && git commit -m "feat: add sitemap for SEO with predictions and predictors"
```

---

## Self-Review: Spec Coverage Checklist

- [x] Leaderboard `/[locale]/leaderboard` with bullshit/accuracy toggle
- [x] OG image card for prediction pages (dynamic, `@vercel/og`)
- [x] OG metadata + Twitter card in prediction detail `generateMetadata`
- [x] Share buttons: LINE (first for TW), X, Facebook, Threads, Copy link
- [x] Me page `/[locale]/me` — user submissions with status badges + withdraw button
- [x] NavBar: "我的提交" link added for logged-in users
- [x] Admin panel `/admin` — lists pending_review, approve/delete actions
- [x] Admin approve endpoint `POST /api/admin/predictions/[id]/approve`
- [x] Sitemap `app/sitemap.ts` covering all public pages + predictions + predictors
- [x] All new pages use service client where RLS bypass is needed (me, admin)
- [x] ShareButtons tests (4 tests covering link URLs + clipboard)
- [x] ISR: leaderboard 6h, me page dynamic (no cache — user-specific)
- [x] Admin page redirects to `/` for non-admins (no 403 page shown)

## Manual Steps After Implementation

1. Add `NEXT_PUBLIC_BASE_URL=https://yousaidso.tw` to Vercel environment variables (for OG image URLs and share links)
2. Add your email to `ADMIN_EMAILS` in Vercel env to access `/admin`
3. Submit sitemap to Google Search Console: `https://yousaidso.tw/sitemap.xml`
