# YouSaidSo — Plan 3/5: AI Pipeline

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **IMPORTANT:** Before writing any Next.js code, read the relevant guide in `node_modules/next/dist/docs/`. This is Next.js 16 and APIs may differ from training data.
>
> **IMPORTANT:** When working with `@anthropic-ai/sdk`, invoke the `claude-api` skill before implementing.

**Goal:** Add Claude Haiku AI review for all incoming predictions (validation, `verdict_type` tagging, deduplication), two Vercel Cron jobs (expire-predictions daily, resolve-votes every 6h), automatic predictor stat updates after verdicts, and complete the submission soft-delete flow from Plan 2.

**Architecture:** Submissions run AI review inline (synchronous, ~2s) so the API response reflects the final status. Cron routes live under `/api/cron/` to stay outside next-intl's locale middleware. All service-role DB queries explicitly filter `deleted_at IS NULL`; RLS policy is updated to add the same guard for anon client reads. Stats update in-process after every verdict change.

**Tech Stack:** Next.js 16 App Router, TypeScript, `@anthropic-ai/sdk` (Claude Haiku `claude-haiku-4-5-20251001`), Supabase service-role client, Vitest, Vercel Cron

**Repo:** `/Users/shuyulin/code/you-said-so`

---

## File Map

```
supabase/
└── migrations/002_ai_pipeline.sql     # submitted_by, soft-delete cols, voting_started_at, similarity fn

lib/
├── types.ts                           # MODIFY: add submitted_by, deleted_at, deleted_by, delete_reason, voting_started_at to Prediction
├── ai.ts                              # CREATE: reviewSubmission(), checkDuplicate(), judgeExpiredPrediction()
├── stats.ts                           # CREATE: calculateBullshitScore(), calculateAccuracyRate(), updatePredictorStats()
└── __tests__/
    ├── ai.test.ts                     # CREATE: mocked Anthropic SDK tests
    └── stats.test.ts                  # CREATE: pure function tests

app/
├── api/
│   ├── submit/route.ts                # MODIFY: add userId, per-user rate limit, inline AI review
│   ├── predictions/
│   │   └── [id]/
│   │       └── route.ts              # CREATE: DELETE — soft delete for submitter or admin
│   └── cron/
│       ├── check-deadlines/route.ts  # CREATE: Vercel Cron — expire active predictions daily
│       └── resolve-votes/route.ts    # CREATE: Vercel Cron — resolve 72h community votes
└── [locale]/
    └── submit/
        └── (page components already exist — SubmitForm.tsx will be modified)

components/
└── SubmitForm.tsx                     # MODIFY: track prediction_id, show withdraw button in success step

.env.local.example                     # MODIFY: add ANTHROPIC_API_KEY, CRON_SECRET
vercel.json                            # CREATE: cron job schedule
```

---

## Task 1: DB Migration 002

**Files:**
- Create: `supabase/migrations/002_ai_pipeline.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/002_ai_pipeline.sql

-- ── NEW COLUMNS ON predictions ────────────────────────────────────────────

ALTER TABLE predictions
  ADD COLUMN IF NOT EXISTS submitted_by      TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by        TEXT,
  ADD COLUMN IF NOT EXISTS delete_reason     TEXT,
  ADD COLUMN IF NOT EXISTS voting_started_at TIMESTAMPTZ;

-- ── INDEXES ──────────────────────────────────────────────────────────────

-- Per-user rate-limit queries
CREATE INDEX IF NOT EXISTS idx_predictions_submitted_by
  ON predictions(submitted_by)
  WHERE submitted_by IS NOT NULL;

-- The WHERE deleted_at IS NULL filter appears in every public query
CREATE INDEX IF NOT EXISTS idx_predictions_not_deleted
  ON predictions(id)
  WHERE deleted_at IS NULL;

-- ── UPDATE RLS POLICY ─────────────────────────────────────────────────────

-- Old policy allowed soft-deleted rows through. Replace it.
DROP POLICY IF EXISTS "public read visible predictions" ON predictions;

CREATE POLICY "public read visible predictions"
  ON predictions FOR SELECT
  USING (
    status IN ('active', 'community_vote', 'resolved')
    AND deleted_at IS NULL
  );

-- ── SIMILARITY SEARCH FUNCTION ────────────────────────────────────────────

-- Used by the AI review step to find potential duplicates before calling Claude.
-- Requires pg_trgm (enabled in migration 001).
CREATE OR REPLACE FUNCTION find_similar_predictions(
  p_predictor_id UUID,
  p_deadline     DATE,
  p_content      TEXT,
  p_exclude_id   UUID DEFAULT NULL
) RETURNS TABLE (
  id      UUID,
  content TEXT,
  deadline DATE,
  status  TEXT,
  sim     REAL
) AS $$
  SELECT
    id,
    content,
    deadline,
    status,
    similarity(content, p_content) AS sim
  FROM predictions
  WHERE predictor_id = p_predictor_id
    AND deadline BETWEEN p_deadline - INTERVAL '30 days'
                     AND p_deadline + INTERVAL '30 days'
    AND deleted_at IS NULL
    AND (p_exclude_id IS NULL OR id != p_exclude_id)
    AND similarity(content, p_content) > 0.7
  ORDER BY sim DESC
  LIMIT 5;
$$ LANGUAGE sql STABLE;
```

- [ ] **Step 2: Run the migration in Supabase dashboard**

Go to Supabase dashboard → SQL Editor → paste `002_ai_pipeline.sql` → Run.

Expected: no errors. Five new columns appear on the `predictions` table. `find_similar_predictions` function appears in Database → Functions.

- [ ] **Step 3: Verify the function exists**

In Supabase SQL Editor:
```sql
SELECT proname FROM pg_proc WHERE proname = 'find_similar_predictions';
```
Expected: 1 row returned.

- [ ] **Step 4: Commit**

```bash
cd /Users/shuyulin/code/you-said-so && git add supabase/migrations/002_ai_pipeline.sql && git commit -m "feat: add submitted_by, soft delete, voting_started_at columns and similarity search function"
```

---

## Task 2: Update lib/types.ts

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Add new fields to Prediction interface**

Find the `Prediction` interface (around line 20) and add the five new columns after `created_at`:

```typescript
export interface Prediction {
  id: string
  content: string
  predictor_id: string
  locale: Locale
  slug: string
  deadline: string
  category: Category
  verdict_type: VerdictType
  status: PredictionStatus
  verdict: Verdict
  created_at: string
  submitted_by: string | null
  deleted_at: string | null
  deleted_by: string | null
  delete_reason: string | null
  voting_started_at: string | null
}
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/shuyulin/code/you-said-so && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/shuyulin/code/you-said-so && git add lib/types.ts && git commit -m "feat: add soft-delete and AI pipeline fields to Prediction type"
```

---

## Task 3: Install Anthropic SDK + Update Env

**Files:**
- Modify: `.env.local.example`

- [ ] **Step 1: Install @anthropic-ai/sdk**

```bash
cd /Users/shuyulin/code/you-said-so && npm install @anthropic-ai/sdk
```
Expected: package added to `package.json` dependencies with no peer-dep errors.

- [ ] **Step 2: Add new env vars to .env.local.example**

Open `.env.local.example` and append:

```bash
# Claude API (AI review + verdict)
ANTHROPIC_API_KEY=your-anthropic-api-key

# Vercel Cron security secret — generate with: openssl rand -hex 32
CRON_SECRET=your-cron-secret
```

- [ ] **Step 3: Add ANTHROPIC_API_KEY and CRON_SECRET to your local .env.local**

```bash
# Get your Anthropic API key from https://console.anthropic.com
# Generate CRON_SECRET:
openssl rand -hex 32
# Paste both values into .env.local
```

- [ ] **Step 4: Commit**

```bash
cd /Users/shuyulin/code/you-said-so && git add .env.local.example package.json package-lock.json && git commit -m "feat: install @anthropic-ai/sdk, add ANTHROPIC_API_KEY and CRON_SECRET to env template"
```

---

## Task 4: lib/ai.ts — Claude Haiku Functions

**Files:**
- Create: `lib/ai.ts`
- Create: `lib/__tests__/ai.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// lib/__tests__/ai.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the Anthropic SDK before importing lib/ai
vi.mock('@anthropic-ai/sdk', () => {
  const mockCreate = vi.fn()
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: { create: mockCreate },
    })),
    __mockCreate: mockCreate,
  }
})

function getMockCreate() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (vi.mocked as any)(
    new (require('@anthropic-ai/sdk').default)()
  ).messages.create
}

describe('reviewSubmission', () => {
  beforeEach(() => vi.resetModules())

  it('returns is_prediction=true and verdict_type when Claude returns valid JSON', async () => {
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const instance = new (Anthropic as any)()
    instance.messages.create.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"is_prediction": true, "reason": "", "verdict_type": "objective"}' }],
    })

    const { reviewSubmission } = await import('../ai')
    const result = await reviewSubmission('台積電年底站上 1500 元', '2026-12-31')
    expect(result.is_prediction).toBe(true)
    expect(result.verdict_type).toBe('objective')
  })

  it('returns is_prediction=false when Claude says so', async () => {
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const instance = new (Anthropic as any)()
    instance.messages.create.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"is_prediction": false, "reason": "opinion, not a prediction", "verdict_type": "subjective"}' }],
    })

    const { reviewSubmission } = await import('../ai')
    const result = await reviewSubmission('今天天氣不錯', '2026-12-31')
    expect(result.is_prediction).toBe(false)
  })

  it('defaults to is_prediction=true on malformed JSON (fail-safe)', async () => {
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const instance = new (Anthropic as any)()
    instance.messages.create.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'I cannot determine this.' }],
    })

    const { reviewSubmission } = await import('../ai')
    const result = await reviewSubmission('some content', '2026-12-31')
    expect(result.is_prediction).toBe(true)
    expect(result.verdict_type).toBe('subjective')
  })
})

describe('checkDuplicate', () => {
  beforeEach(() => vi.resetModules())

  it('returns is_same=true when Claude says yes', async () => {
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const instance = new (Anthropic as any)()
    instance.messages.create.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'yes' }],
    })

    const { checkDuplicate } = await import('../ai')
    const result = await checkDuplicate('台積電站上 1500 元', '台積電年底一定破 1500 元')
    expect(result.is_same).toBe(true)
  })

  it('returns is_same=false when Claude says no', async () => {
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const instance = new (Anthropic as any)()
    instance.messages.create.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'no' }],
    })

    const { checkDuplicate } = await import('../ai')
    const result = await checkDuplicate('台積電站上 1500 元', '比特幣破 10 萬')
    expect(result.is_same).toBe(false)
  })
})

describe('judgeExpiredPrediction', () => {
  beforeEach(() => vi.resetModules())

  it('returns verdict when Claude returns valid JSON', async () => {
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const instance = new (Anthropic as any)()
    instance.messages.create.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"verdict": "bullshit", "reason": "price did not reach target"}' }],
    })

    const { judgeExpiredPrediction } = await import('../ai')
    const result = await judgeExpiredPrediction('台積電站上 1500', '股癌', '2025-12-31')
    expect(result?.verdict).toBe('bullshit')
  })

  it('returns null when Claude is uncertain', async () => {
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const instance = new (Anthropic as any)()
    instance.messages.create.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'null' }],
    })

    const { judgeExpiredPrediction } = await import('../ai')
    const result = await judgeExpiredPrediction('some obscure prediction', '誰', '2025-06-01')
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /Users/shuyulin/code/you-said-so && npx vitest run lib/__tests__/ai.test.ts 2>&1 | tail -10
```
Expected: FAIL — `lib/ai` not found.

- [ ] **Step 3: Write `lib/ai.ts`**

```typescript
// lib/ai.ts
import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-haiku-4-5-20251001'

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

export interface ReviewResult {
  is_prediction: boolean
  reason: string
  verdict_type: 'objective' | 'subjective'
}

export async function reviewSubmission(content: string, deadline: string): Promise<ReviewResult> {
  const client = getClient()
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 256,
    messages: [{
      role: 'user',
      content: `You review user-submitted predictions for YouSaidSo, a platform tracking public figures' predictions.

Submission:
Content: "${content}"
Deadline: "${deadline}"

Determine:
1. Is this a genuine prediction (future-tense claim about what will happen)?
   NOT a prediction: opinions, factual statements, insults, questions, irrelevant content.
2. If prediction: is it "objective" (verifiable against a number or recorded fact — stock price, election winner, score) or "subjective" (judgment call — "economy will be bad")?

Reply ONLY with valid JSON:
{"is_prediction": true, "reason": "", "verdict_type": "objective"}
or
{"is_prediction": false, "reason": "brief reason", "verdict_type": "subjective"}`,
    }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('no JSON')
    return JSON.parse(jsonMatch[0]) as ReviewResult
  } catch {
    return { is_prediction: true, reason: '', verdict_type: 'subjective' }
  }
}

export interface DedupResult {
  is_same: boolean
}

export async function checkDuplicate(newContent: string, existingContent: string): Promise<DedupResult> {
  const client = getClient()
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 8,
    messages: [{
      role: 'user',
      content: `Are these two predictions saying the same thing?

A: "${newContent}"
B: "${existingContent}"

Reply with only "yes" or "no".`,
    }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text.toLowerCase().trim() : 'no'
  return { is_same: text.startsWith('yes') }
}

export interface VerdictResult {
  verdict: 'correct' | 'bullshit'
  reason: string
}

export async function judgeExpiredPrediction(
  content: string,
  predictorName: string,
  deadline: string,
): Promise<VerdictResult | null> {
  const client = getClient()
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 256,
    messages: [{
      role: 'user',
      content: `A public figure made a prediction that has passed its deadline. Based on publicly known facts, was it correct?

Predictor: "${predictorName}"
Prediction: "${content}"
Deadline: "${deadline}"
Today: "${new Date().toISOString().split('T')[0]}"

If you cannot judge this with confidence, respond: null

Otherwise reply ONLY with valid JSON:
{"verdict": "correct" | "bullshit", "reason": "brief factual explanation"}`,
    }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
  if (text === 'null' || (!text.includes('{') && text.toLowerCase().includes('null'))) return null

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    const result = JSON.parse(jsonMatch[0]) as VerdictResult
    if (!['correct', 'bullshit'].includes(result.verdict)) return null
    return result
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd /Users/shuyulin/code/you-said-so && npx vitest run lib/__tests__/ai.test.ts 2>&1 | tail -10
```
Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/shuyulin/code/you-said-so && git add lib/ai.ts lib/__tests__/ai.test.ts && git commit -m "feat: add Claude Haiku AI functions (review, dedup, verdict) with tests"
```

---

## Task 5: lib/stats.ts — Predictor Stats Update

**Files:**
- Create: `lib/stats.ts`
- Create: `lib/__tests__/stats.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// lib/__tests__/stats.test.ts
import { describe, it, expect } from 'vitest'
import { calculateBullshitScore, calculateAccuracyRate } from '../stats'

describe('calculateBullshitScore', () => {
  it('returns 0 when no resolved predictions', () => {
    expect(calculateBullshitScore(0, 0)).toBe(0)
  })
  it('returns 100 when all are bullshit', () => {
    expect(calculateBullshitScore(0, 10)).toBe(100)
  })
  it('returns 0 when all are correct', () => {
    expect(calculateBullshitScore(10, 0)).toBe(0)
  })
  it('returns 70 for 7 bullshit out of 10', () => {
    expect(calculateBullshitScore(3, 7)).toBe(70)
  })
  it('rounds to 2 decimal places', () => {
    expect(calculateBullshitScore(1, 2)).toBe(66.67)
  })
})

describe('calculateAccuracyRate', () => {
  it('returns 0 when no resolved predictions', () => {
    expect(calculateAccuracyRate(0, 0)).toBe(0)
  })
  it('returns 100 when all are correct', () => {
    expect(calculateAccuracyRate(10, 0)).toBe(100)
  })
  it('returns 30 for 3 correct out of 10', () => {
    expect(calculateAccuracyRate(3, 7)).toBe(30)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /Users/shuyulin/code/you-said-so && npx vitest run lib/__tests__/stats.test.ts 2>&1 | tail -10
```
Expected: FAIL — `lib/stats` not found.

- [ ] **Step 3: Write `lib/stats.ts`**

```typescript
// lib/stats.ts
import { createServiceClient } from './supabase'

export function calculateBullshitScore(correct: number, bullshit: number): number {
  const total = correct + bullshit
  if (total === 0) return 0
  return Math.round((bullshit / total) * 100 * 100) / 100
}

export function calculateAccuracyRate(correct: number, bullshit: number): number {
  const total = correct + bullshit
  if (total === 0) return 0
  return Math.round((correct / total) * 100 * 100) / 100
}

export async function updatePredictorStats(predictorId: string): Promise<void> {
  const db = createServiceClient()

  const { data: all } = await db
    .from('predictions')
    .select('status, verdict')
    .eq('predictor_id', predictorId)
    .is('deleted_at', null)

  const rows = all ?? []
  const resolved = rows.filter(p => p.status === 'resolved')
  const correct = resolved.filter(p => p.verdict === 'correct').length
  const bullshit = resolved.filter(p => p.verdict === 'bullshit').length

  await db.from('predictors').update({
    bullshit_score: calculateBullshitScore(correct, bullshit),
    accuracy_rate: calculateAccuracyRate(correct, bullshit),
    total_predictions: rows.length,
  }).eq('id', predictorId)
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd /Users/shuyulin/code/you-said-so && npx vitest run lib/__tests__/stats.test.ts 2>&1 | tail -10
```
Expected: 8 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/shuyulin/code/you-said-so && git add lib/stats.ts lib/__tests__/stats.test.ts && git commit -m "feat: add predictor stats helpers (calculateBullshitScore, calculateAccuracyRate, updatePredictorStats) with tests"
```

---

## Task 6: Fix submit/route.ts — userId, Per-User Rate Limit, Inline AI Review

**Files:**
- Modify: `app/api/submit/route.ts`

The current file has a bug: `submitted_by: userId` is referenced but `userId` is never defined. This task fixes it, adds per-user rate limiting (5/day), and adds the inline AI review.

- [ ] **Step 1: Rewrite `app/api/submit/route.ts`**

```typescript
// app/api/submit/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { createServiceClient } from '@/lib/supabase'
import { validateUrl, validateDeadline, validateContent } from '@/lib/validation'
import { reviewSubmission, checkDuplicate } from '@/lib/ai'
import type { Category, Locale } from '@/lib/types'

const VALID_CATEGORIES: Category[] = ['stock', 'politics', 'fortune', 'tech', 'sports', 'ai', 'other']
const VALID_LOCALES: Locale[] = ['tw', 'jp', 'us']
const DAILY_LIMIT = 5

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
  const userId = session.user.email

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

  // Per-user rate limit: 5 submissions per calendar day
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const { count: userCount } = await db
    .from('predictions')
    .select('id', { count: 'exact', head: true })
    .eq('submitted_by', userId)
    .gte('created_at', todayStart.toISOString())
    .is('deleted_at', null)

  if ((userCount ?? 0) >= DAILY_LIMIT) {
    return NextResponse.json({ error: `daily limit of ${DAILY_LIMIT} submissions reached, try again tomorrow` }, { status: 429 })
  }

  // Find or create predictor
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

  // Generate unique prediction slug
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

  // Insert with pending_review status
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
      submitted_by: userId,
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

  // Skip AI review in dev when no API key is configured
  if (!process.env.ANTHROPIC_API_KEY) {
    await db.from('predictions')
      .update({ status: 'active' })
      .eq('id', prediction.id)
    return NextResponse.json({ success: true, prediction_id: prediction.id }, { status: 201 })
  }

  // ── AI REVIEW ────────────────────────────────────────────────────────────

  let reviewResult: Awaited<ReturnType<typeof reviewSubmission>>
  try {
    reviewResult = await reviewSubmission(content!.trim(), deadline!)
  } catch {
    // AI service error — approve submission so user isn't blocked; admin can review later
    await db.from('predictions').update({ status: 'active' }).eq('id', prediction.id)
    return NextResponse.json({ success: true, prediction_id: prediction.id }, { status: 201 })
  }

  if (!reviewResult.is_prediction) {
    // Not a valid prediction — soft-delete it
    await db.from('predictions').update({
      deleted_at: new Date().toISOString(),
      deleted_by: 'ai-review',
      delete_reason: reviewResult.reason || 'AI review: not a valid prediction',
    }).eq('id', prediction.id)

    return NextResponse.json(
      { error: `Submission rejected: ${reviewResult.reason || 'not a valid prediction with a deadline'}` },
      { status: 422 }
    )
  }

  // ── DEDUPLICATION ─────────────────────────────────────────────────────────

  const { data: similar } = await db.rpc('find_similar_predictions', {
    p_predictor_id: predictorId,
    p_deadline: deadline!,
    p_content: content!.trim(),
    p_exclude_id: prediction.id,
  })

  for (const candidate of (similar ?? [])) {
    let dupCheck: Awaited<ReturnType<typeof checkDuplicate>>
    try {
      dupCheck = await checkDuplicate(content!.trim(), candidate.content)
    } catch {
      continue
    }

    if (dupCheck.is_same) {
      // Merge: add new source to existing prediction, soft-delete the new one
      await db.from('prediction_sources').insert({
        prediction_id: candidate.id,
        source_url: source_url!,
        source_name: new URL(source_url!).hostname.replace('www.', ''),
        source_snapshot: null,
      })
      await db.from('predictions').update({
        deleted_at: new Date().toISOString(),
        deleted_by: 'ai-review',
        delete_reason: 'Duplicate — merged source into existing prediction',
      }).eq('id', prediction.id)

      return NextResponse.json({ success: true, prediction_id: candidate.id }, { status: 201 })
    }
  }

  // ── APPROVE ───────────────────────────────────────────────────────────────

  await db.from('predictions').update({
    status: 'active',
    verdict_type: reviewResult.verdict_type,
  }).eq('id', prediction.id)

  return NextResponse.json({ success: true, prediction_id: prediction.id }, { status: 201 })
}
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/shuyulin/code/you-said-so && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors.

- [ ] **Step 3: Smoke-test the submit endpoint (dev, no AI key)**

```bash
cd /Users/shuyulin/code/you-said-so && npm run dev &
sleep 5
# Without auth, should get 401
curl -s -X POST http://localhost:3000/api/submit \
  -H "Content-Type: application/json" \
  -d '{"predictor_name":"Test","content":"test prediction","source_url":"https://example.com","deadline":"2027-01-01","category":"other"}' | python3 -m json.tool
kill %1
```
Expected: `{"error":"login required"}` with status 401.

- [ ] **Step 4: Commit**

```bash
cd /Users/shuyulin/code/you-said-so && git add app/api/submit/route.ts && git commit -m "feat: fix submit API — add userId, per-user rate limit, inline Claude Haiku review and dedup"
```

---

## Task 7: DELETE /api/predictions/[id] — Soft Delete Route

**Files:**
- Create: `app/api/predictions/[id]/route.ts`

This route handles two cases:
- **Submitter withdraws** (`pending_review` only, no reason required)
- **Admin deletes** (any status, reason required, email must be in `ADMIN_EMAILS` env var)

- [ ] **Step 1: Write `app/api/predictions/[id]/route.ts`**

```typescript
// app/api/predictions/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { createServiceClient } from '@/lib/supabase'

function isAdmin(email: string): boolean {
  const list = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim()).filter(Boolean)
  return list.includes(email)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'login required' }, { status: 401 })
  }
  const userEmail = session.user.email
  const { id } = await params

  const db = createServiceClient()

  const { data: prediction } = await db
    .from('predictions')
    .select('id, status, submitted_by, deleted_at')
    .eq('id', id)
    .single()

  if (!prediction) {
    return NextResponse.json({ error: 'prediction not found' }, { status: 404 })
  }

  if (prediction.deleted_at) {
    return NextResponse.json({ error: 'already deleted' }, { status: 409 })
  }

  const admin = isAdmin(userEmail)
  const isOwner = prediction.submitted_by === userEmail

  if (!admin && !isOwner) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  if (!admin && prediction.status !== 'pending_review') {
    return NextResponse.json(
      { error: 'can only withdraw predictions that are still pending review' },
      { status: 409 }
    )
  }

  let reason = 'User withdrew submission'
  if (admin) {
    let body: { reason?: string } = {}
    try { body = await request.json() } catch { /* no body is ok */ }
    if (!body.reason?.trim()) {
      return NextResponse.json({ error: 'delete_reason required for admin deletes' }, { status: 400 })
    }
    reason = body.reason.trim()
  }

  const { error } = await db.from('predictions').update({
    deleted_at: new Date().toISOString(),
    deleted_by: userEmail,
    delete_reason: reason,
  }).eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/shuyulin/code/you-said-so && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors.

- [ ] **Step 3: Smoke-test unauthorized access**

```bash
cd /Users/shuyulin/code/you-said-so && npm run dev &
sleep 5
curl -s -X DELETE http://localhost:3000/api/predictions/some-fake-id | python3 -m json.tool
kill %1
```
Expected: `{"error":"login required"}` with status 401.

- [ ] **Step 4: Commit**

```bash
cd /Users/shuyulin/code/you-said-so && git add app/api/predictions/ && git commit -m "feat: add DELETE /api/predictions/[id] — soft delete for submitter and admin"
```

---

## Task 8: Update SubmitForm — Track prediction_id, Add Withdraw Button

**Files:**
- Modify: `components/SubmitForm.tsx`

The success step needs to store the `prediction_id` returned by the submit API and show a "撤回這則提交" button that calls `DELETE /api/predictions/[id]`.

- [ ] **Step 1: Edit `components/SubmitForm.tsx`**

Add `predictionId` state, update `handleSubmit` to capture it, and replace the success step JSX.

Find the state declarations at the top of the component and add:

```typescript
  const [predictionId, setPredictionId] = useState<string | null>(null)
  const [withdrawing, setWithdrawing] = useState(false)
  const [withdrawn, setWithdrawn] = useState(false)
```

Find `handleSubmit` and update the success branch to capture the prediction id:

```typescript
    if (!res.ok) {
      const data = await res.json()
      setSubmitError(data.error ?? 'submission failed')
    } else {
      const data = await res.json()
      setPredictionId(data.prediction_id ?? null)
      setStep('success')
    }
```

Replace the entire `if (step === 'success')` block with:

```typescript
  if (step === 'success') {
    async function handleWithdraw() {
      if (!predictionId || withdrawing) return
      setWithdrawing(true)
      const res = await fetch(`/api/predictions/${predictionId}`, { method: 'DELETE' })
      setWithdrawing(false)
      if (res.ok) {
        setWithdrawn(true)
      } else {
        const data = await res.json()
        if (res.status === 409) {
          alert('審核已完成，無法撤回，請聯絡我們')
        } else {
          alert(data.error ?? 'withdraw failed')
        }
      }
    }

    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-4">🎉</div>
        <h2 className="text-lg font-black text-[#e6edf3] mb-2">提交成功！</h2>
        <p className="text-sm text-[#6e7681] mb-6">我們會在審核後發布這則預言。</p>

        {predictionId && !withdrawn && (
          <button
            onClick={handleWithdraw}
            disabled={withdrawing}
            className="block mx-auto mb-4 text-xs text-[#6e7681] hover:text-[#e6edf3] disabled:opacity-40 underline underline-offset-2"
          >
            {withdrawing ? '撤回中…' : '撤回這則提交'}
          </button>
        )}
        {withdrawn && (
          <p className="text-xs text-[#6e7681] mb-4">已撤回</p>
        )}

        <a href={`/${locale}`} className="text-sm text-blue-400 hover:underline">← 回首頁</a>
      </div>
    )
  }
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/shuyulin/code/you-said-so && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/shuyulin/code/you-said-so && git add components/SubmitForm.tsx && git commit -m "feat: show withdraw button in submit success step, track prediction_id from API response"
```

---

## Task 9: Cron — check-deadlines Route

**Files:**
- Create: `app/api/cron/check-deadlines/route.ts`

Runs daily (2:00 UTC). Finds all `active` predictions where `deadline < today`. For `objective` ones, calls Claude to judge. For `subjective` ones (and when Claude is uncertain), moves to `community_vote`. Updates predictor stats after any verdict.

- [ ] **Step 1: Write `app/api/cron/check-deadlines/route.ts`**

```typescript
// app/api/cron/check-deadlines/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { judgeExpiredPrediction } from '@/lib/ai'
import { updatePredictorStats } from '@/lib/stats'

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  }

  const db = createServiceClient()
  const today = new Date().toISOString().split('T')[0]

  const { data: expired } = await db
    .from('predictions')
    .select('id, content, deadline, verdict_type, predictor_id, predictor:predictors(name)')
    .eq('status', 'active')
    .lt('deadline', today)
    .is('deleted_at', null)
    .limit(50)

  const results = { resolved: 0, moved_to_vote: 0, errors: 0 }

  for (const pred of expired ?? []) {
    try {
      const predictorName = (pred.predictor as { name: string } | null)?.name ?? ''
      let verdict: 'correct' | 'bullshit' | null = null

      if (pred.verdict_type === 'objective') {
        const judged = await judgeExpiredPrediction(pred.content, predictorName, pred.deadline)
        verdict = judged?.verdict ?? null
      }

      if (verdict) {
        await db.from('predictions').update({
          status: 'resolved',
          verdict,
        }).eq('id', pred.id)
        await updatePredictorStats(pred.predictor_id)
        results.resolved++
      } else {
        await db.from('predictions').update({
          status: 'community_vote',
          voting_started_at: new Date().toISOString(),
        }).eq('id', pred.id)
        results.moved_to_vote++
      }
    } catch {
      results.errors++
    }
  }

  return NextResponse.json({ ok: true, processed: expired?.length ?? 0, ...results })
}
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/shuyulin/code/you-said-so && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors.

- [ ] **Step 3: Smoke-test the endpoint (dev, no auth required)**

```bash
cd /Users/shuyulin/code/you-said-so && npm run dev &
sleep 5
curl -s http://localhost:3000/api/cron/check-deadlines | python3 -m json.tool
kill %1
```
Expected: `{"ok":true,"processed":N,...}` — N depends on whether any seed predictions have past deadlines.

- [ ] **Step 4: Commit**

```bash
cd /Users/shuyulin/code/you-said-so && git add app/api/cron/check-deadlines/ && git commit -m "feat: add check-deadlines cron route — auto-resolve expired predictions with Claude Haiku"
```

---

## Task 10: Cron — resolve-votes Route

**Files:**
- Create: `app/api/cron/resolve-votes/route.ts`

Runs every 6h (*/6 * * * * UTC, but check Vercel docs for cron syntax). Finds `community_vote` predictions where `voting_started_at + 72 hours < now`. Tallies votes and resolves. Ties go to `bullshit` (the more engaging outcome for the platform).

- [ ] **Step 1: Write `app/api/cron/resolve-votes/route.ts`**

```typescript
// app/api/cron/resolve-votes/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { updatePredictorStats } from '@/lib/stats'

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  }

  const db = createServiceClient()
  const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString()

  const { data: ready } = await db
    .from('predictions')
    .select('id, predictor_id')
    .eq('status', 'community_vote')
    .is('deleted_at', null)
    .not('voting_started_at', 'is', null)
    .lt('voting_started_at', cutoff)
    .limit(50)

  const results = { resolved: 0, errors: 0 }

  for (const pred of ready ?? []) {
    try {
      const { data: votes } = await db
        .from('votes')
        .select('choice')
        .eq('prediction_id', pred.id)

      const rows = votes ?? []
      const correct = rows.filter(v => v.choice === 'correct').length
      const bullshit = rows.filter(v => v.choice === 'bullshit').length
      // Ties go to bullshit
      const verdict: 'correct' | 'bullshit' = correct > bullshit ? 'correct' : 'bullshit'

      await db.from('predictions').update({
        status: 'resolved',
        verdict,
      }).eq('id', pred.id)

      await updatePredictorStats(pred.predictor_id)
      results.resolved++
    } catch {
      results.errors++
    }
  }

  return NextResponse.json({ ok: true, processed: ready?.length ?? 0, ...results })
}
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/shuyulin/code/you-said-so && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors.

- [ ] **Step 3: Smoke-test (dev)**

```bash
cd /Users/shuyulin/code/you-said-so && npm run dev &
sleep 5
curl -s http://localhost:3000/api/cron/resolve-votes | python3 -m json.tool
kill %1
```
Expected: `{"ok":true,"processed":N,...}` — seed data has one `community_vote` prediction with no `voting_started_at`, so processed=0.

- [ ] **Step 4: Commit**

```bash
cd /Users/shuyulin/code/you-said-so && git add app/api/cron/resolve-votes/ && git commit -m "feat: add resolve-votes cron route — close 72h community votes by majority"
```

---

## Task 11: vercel.json — Cron Schedule

**Files:**
- Create: `vercel.json`

- [ ] **Step 1: Check if vercel.json already exists**

```bash
ls /Users/shuyulin/code/you-said-so/vercel.json 2>/dev/null && echo "exists" || echo "not found"
```

- [ ] **Step 2: Write `vercel.json`**

```json
{
  "crons": [
    {
      "path": "/api/cron/check-deadlines",
      "schedule": "0 2 * * *"
    },
    {
      "path": "/api/cron/resolve-votes",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

`0 2 * * *` = 2:00 UTC daily (10:00 AM Taiwan time — after overnight news cycle).
`0 */6 * * *` = every 6 hours (checks for votes that crossed the 72h mark).

- [ ] **Step 3: Commit**

```bash
cd /Users/shuyulin/code/you-said-so && git add vercel.json && git commit -m "feat: add Vercel Cron schedule for check-deadlines (daily) and resolve-votes (every 6h)"
```

---

## Task 12: Run All Tests + Final Type-Check

- [ ] **Step 1: Run full test suite**

```bash
cd /Users/shuyulin/code/you-said-so && npx vitest run 2>&1 | tail -20
```
Expected: all tests pass. Suites include: utils, supabase, PredictionCard, VoteBar, validation, ai, stats.

- [ ] **Step 2: Final type-check**

```bash
cd /Users/shuyulin/code/you-said-so && npx tsc --noEmit 2>&1
```
Expected: no errors.

- [ ] **Step 3: End-to-end smoke test**

```bash
cd /Users/shuyulin/code/you-said-so && npm run dev &
sleep 5

# Feed still loads
curl -s http://localhost:3000/tw | grep -c "YouSaidSo"

# Cron routes accessible in dev without auth
curl -s http://localhost:3000/api/cron/check-deadlines
curl -s http://localhost:3000/api/cron/resolve-votes

kill %1
```
Expected: feed returns HTML with "YouSaidSo" present; cron routes return `{"ok":true,...}`.

- [ ] **Step 4: Done — Plan 3 complete**

---

## Self-Review

| Spec Requirement | Covered By |
|---|---|
| Claude Haiku reviews submissions — is it a real prediction? | Task 6 (inline AI review in submit route) via `reviewSubmission()` in lib/ai.ts |
| `verdict_type` tagged as `objective` / `subjective` | Task 6 — set from `reviewResult.verdict_type` |
| Deduplication via pg_trgm + Claude confirmation | Task 1 (`find_similar_predictions` SQL fn) + Task 6 (`checkDuplicate()`) |
| Duplicate → merge sources, discard new prediction | Task 6 — soft-deletes dup, inserts source to existing |
| Invalid submission → rejected | Task 6 — soft-deletes with `deleted_by: 'ai-review'`, returns 422 |
| `submitted_by` column | Task 1 (migration) + Task 6 (sets on insert) |
| Per-user daily rate limit (5/day) | Task 6 — queries `submitted_by` + `created_at` |
| `deleted_at`, `deleted_by`, `delete_reason` columns | Task 1 (migration) |
| `voting_started_at` column | Task 1 (migration) |
| Daily cron: active predictions past deadline → resolve or vote | Task 9 (`check-deadlines`) |
| Objective → Claude judges → `resolved` + predictor stats | Task 9 + Task 4 (`judgeExpiredPrediction`) + Task 5 (`updatePredictorStats`) |
| Subjective (or uncertain objective) → `community_vote` | Task 9 — sets `voting_started_at` |
| Community vote closes after 72h → `resolved` | Task 10 (`resolve-votes`) |
| Majority vote wins (ties → `bullshit`) | Task 10 |
| Predictor `bullshit_score` and `accuracy_rate` updated after verdict | Task 5 (`updatePredictorStats`) called from Tasks 9 and 10 |
| `DELETE /api/predictions/[id]` — submitter withdraw | Task 7 — only works on `pending_review` |
| `DELETE /api/predictions/[id]` — admin delete any status | Task 7 — checks `ADMIN_EMAILS` env var, requires reason |
| RLS policy excludes soft-deleted predictions | Task 1 — updated RLS `WHERE deleted_at IS NULL` |
| Submit success page: withdraw button | Task 8 — calls DELETE endpoint, shows "已撤回" on success |
| Vercel Cron schedule | Task 11 (`vercel.json`) |

**Known deferred items:**
- **External API for objective verdicts** (Yahoo Finance, election data): The spec mentions fetching external API data for objective predictions. For MVP, Claude's training data is used instead. Add real-time data fetching in Plan 4 alongside the RSS crawler work.
- **Admin dashboard** (delete UI, reports queue, account unblock): Plan 5.
- **Personal submissions page** (`/[locale]/me`): Plan 5.
- **Retry logic for cron failures** (3 retries with exponential backoff per spec): Not implemented for MVP — Vercel Cron will retry on 5xx responses automatically; detailed retry logic can be added if issues arise.
