# RSS/YouTube Crawler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add automated Vercel Cron crawlers that pull RSS feeds and YouTube channel transcripts, extract predictions with Claude Haiku, run them through the existing AI review + dedup pipeline, and persist them as active predictions.

**Architecture:** Two new cron routes (`/api/cron/crawl-rss` every 6h, `/api/cron/crawl-youtube` daily) read active sources from the existing `sources` table, fetch content, call `extractPredictionsFromText()` to extract structured prediction data, then call shared `crawler.ts` helpers (`findOrCreatePredictor`, `createCrawledPrediction`) which reuse the same AI review + pg_trgm dedup pipeline from Plan 3. URL deduplication is done by checking `prediction_sources` before processing each item.

**Tech Stack:** `rss-parser` (RSS + YouTube Atom feeds), `youtube-transcript` (captions scraping), Claude Haiku via `@anthropic-ai/sdk`, Supabase service client, Vercel Cron, Vitest

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `lib/types.ts` | Modify | Add `Source` interface |
| `supabase/migrations/003_crawler_seeds.sql` | Create | Seed initial TW RSS sources + YouTube channels |
| `lib/rss.ts` | Create | Fetch + parse RSS feeds, filter already-seen URLs |
| `lib/youtube.ts` | Create | Fetch YouTube channel recent videos + transcripts |
| `lib/ai.ts` | Modify | Add `ExtractedPrediction` + `extractPredictionsFromText()` |
| `lib/crawler.ts` | Create | Shared `findOrCreatePredictor()` + `createCrawledPrediction()` helpers |
| `lib/__tests__/rss.test.ts` | Create | Tests for RSS parsing + filter |
| `lib/__tests__/youtube.test.ts` | Create | Tests for YouTube channel feed + transcript |
| `lib/__tests__/ai.test.ts` | Modify | Add tests for `extractPredictionsFromText` |
| `lib/__tests__/crawler.test.ts` | Create | Tests for shared crawler helpers |
| `app/api/cron/crawl-rss/route.ts` | Create | Cron route: crawl active RSS sources |
| `app/api/cron/crawl-youtube/route.ts` | Create | Cron route: crawl active YouTube channels |
| `vercel.json` | Modify | Add 2 new cron schedules |

---

### Task 1: Source Type + Packages + Seed Migration

**Files:**
- Modify: `lib/types.ts`
- Create: `supabase/migrations/003_crawler_seeds.sql`

- [ ] **Step 1: Add Source interface to lib/types.ts**

Open `lib/types.ts` and append after the `Vote` interface (before the final closing):

```typescript
export interface Source {
  id: string
  locale: Locale
  type: 'rss' | 'youtube_channel'
  name: string
  url_or_channel_id: string
  active: boolean
  created_at: string
}
```

- [ ] **Step 2: Install npm packages**

```bash
npm install rss-parser youtube-transcript
```

Expected: both packages appear in `package.json` dependencies.

- [ ] **Step 3: Write seed migration**

Create `supabase/migrations/003_crawler_seeds.sql`:

```sql
-- Seed initial TW RSS and YouTube sources
-- ⚠️ Verify RSS URLs and YouTube channel IDs before deploying to production.

INSERT INTO sources (locale, type, name, url_or_channel_id, active) VALUES
  -- TW RSS feeds
  ('tw', 'rss', 'Yahoo 奇摩新聞',   'https://tw.news.yahoo.com/rss/',             true),
  ('tw', 'rss', '中央社即時新聞',     'https://www.cna.com.tw/rss/aall.aspx',       true),
  ('tw', 'rss', 'ETtoday 即時',      'https://feeds.feedburner.com/ettoday/realtime', true),
  -- TW YouTube channels (replace UC... IDs with real channel IDs if incorrect)
  ('tw', 'youtube_channel', '股癌 Gooaye',       'UCaBf1a-dpIsw8OxqH4ki2Kg', true),
  ('tw', 'youtube_channel', '天龍人的日常',        'UC_VERIFY_AND_REPLACE_1',  false),
  ('tw', 'youtube_channel', '財經M平方',           'UC_VERIFY_AND_REPLACE_2',  false)
ON CONFLICT DO NOTHING;
```

⚠️ **Manual step**: run this SQL in Supabase dashboard > SQL Editor. The `active = false` sources are stubs — find real channel IDs and flip `active` before enabling.

- [ ] **Step 4: Commit**

```bash
git add lib/types.ts supabase/migrations/003_crawler_seeds.sql package.json package-lock.json
git commit -m "feat: add Source type, install rss-parser + youtube-transcript, seed crawler sources"
```

---

### Task 2: lib/rss.ts + Tests

**Files:**
- Create: `lib/rss.ts`
- Create: `lib/__tests__/rss.test.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/__tests__/rss.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('rss-parser', () => {
  const mockParseURL = vi.fn()
  function MockParser() {
    return { parseURL: mockParseURL }
  }
  return { default: MockParser, __mockParseURL: mockParseURL }
})

async function getParseURL() {
  const mod = await import('rss-parser')
  const instance = new (mod.default as any)()
  return instance.parseURL as ReturnType<typeof vi.fn>
}

describe('fetchRssItems', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns mapped items with title, link, text', async () => {
    const parseURL = await getParseURL()
    parseURL.mockResolvedValueOnce({
      items: [
        { title: 'Test Title', link: 'https://example.com/1', contentSnippet: 'Some snippet' },
        { title: 'No Link', link: undefined, contentSnippet: 'Content' },
      ],
    })
    const { fetchRssItems } = await import('../rss')
    const items = await fetchRssItems('https://example.com/rss')
    expect(items).toHaveLength(2)
    expect(items[0].title).toBe('Test Title')
    expect(items[0].link).toBe('https://example.com/1')
    expect(items[0].text).toBe('Test Title\nSome snippet')
  })

  it('returns empty array when feed has no items', async () => {
    const parseURL = await getParseURL()
    parseURL.mockResolvedValueOnce({ items: [] })
    const { fetchRssItems } = await import('../rss')
    const items = await fetchRssItems('https://example.com/rss')
    expect(items).toHaveLength(0)
  })
})

describe('filterNewItems', () => {
  it('removes items whose link is in knownUrls', async () => {
    const { filterNewItems } = await import('../rss')
    const items = [
      { title: 'Old', link: 'https://example.com/old', text: 'old' },
      { title: 'New', link: 'https://example.com/new', text: 'new' },
    ]
    const known = new Set(['https://example.com/old'])
    const result = filterNewItems(items, known)
    expect(result).toHaveLength(1)
    expect(result[0].link).toBe('https://example.com/new')
  })

  it('removes items with empty link', async () => {
    const { filterNewItems } = await import('../rss')
    const items = [{ title: 'No link', link: '', text: 'text' }]
    const result = filterNewItems(items, new Set())
    expect(result).toHaveLength(0)
  })

  it('returns all items when knownUrls is empty', async () => {
    const { filterNewItems } = await import('../rss')
    const items = [
      { title: 'A', link: 'https://a.com', text: 'a' },
      { title: 'B', link: 'https://b.com', text: 'b' },
    ]
    const result = filterNewItems(items, new Set())
    expect(result).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run tests, confirm they fail**

```bash
npm test -- lib/__tests__/rss.test.ts
```

Expected: FAIL — `../rss` module not found.

- [ ] **Step 3: Implement lib/rss.ts**

Create `lib/rss.ts`:

```typescript
import Parser from 'rss-parser'

export interface RssItem {
  title: string
  link: string
  text: string
}

const parser = new Parser({ timeout: 10_000 })

export async function fetchRssItems(url: string): Promise<RssItem[]> {
  const feed = await parser.parseURL(url)
  return feed.items.map(item => ({
    title: item.title ?? '',
    link: item.link ?? '',
    text: [item.title, item.contentSnippet].filter(Boolean).join('\n'),
  }))
}

export function filterNewItems(items: RssItem[], knownUrls: Set<string>): RssItem[] {
  return items.filter(item => item.link && !knownUrls.has(item.link))
}
```

- [ ] **Step 4: Run tests, confirm they pass**

```bash
npm test -- lib/__tests__/rss.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/rss.ts lib/__tests__/rss.test.ts
git commit -m "feat: add RSS feed fetcher with dedup filter"
```

---

### Task 3: lib/youtube.ts + Tests

**Files:**
- Create: `lib/youtube.ts`
- Create: `lib/__tests__/youtube.test.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/__tests__/youtube.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock rss-parser (reuse same mock pattern)
vi.mock('rss-parser', () => {
  const mockParseURL = vi.fn()
  function MockParser() {
    return { parseURL: mockParseURL }
  }
  return { default: MockParser }
})

vi.mock('youtube-transcript', () => ({
  YoutubeTranscript: {
    fetchTranscript: vi.fn(),
  },
}))

async function getParseURL() {
  const mod = await import('rss-parser')
  const instance = new (mod.default as any)()
  return instance.parseURL as ReturnType<typeof vi.fn>
}

async function getFetchTranscript() {
  const { YoutubeTranscript } = await import('youtube-transcript')
  return YoutubeTranscript.fetchTranscript as ReturnType<typeof vi.fn>
}

describe('fetchChannelRecentVideos', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns video list from channel Atom feed', async () => {
    const parseURL = await getParseURL()
    parseURL.mockResolvedValueOnce({
      items: [
        { title: 'Video One', link: 'https://www.youtube.com/watch?v=ABC123' },
        { title: 'Video Two', link: 'https://www.youtube.com/watch?v=DEF456' },
      ],
    })
    const { fetchChannelRecentVideos } = await import('../youtube')
    const videos = await fetchChannelRecentVideos('UCtest123')
    expect(videos).toHaveLength(2)
    expect(videos[0].videoId).toBe('ABC123')
    expect(videos[0].title).toBe('Video One')
    expect(videos[0].videoUrl).toBe('https://www.youtube.com/watch?v=ABC123')
    expect(parseURL).toHaveBeenCalledWith(
      'https://www.youtube.com/feeds/videos.xml?channel_id=UCtest123',
    )
  })

  it('skips items with no parseable video ID', async () => {
    const parseURL = await getParseURL()
    parseURL.mockResolvedValueOnce({
      items: [
        { title: 'Good', link: 'https://www.youtube.com/watch?v=GOOD1' },
        { title: 'Bad', link: 'https://www.youtube.com/channel/UCtest' },
      ],
    })
    const { fetchChannelRecentVideos } = await import('../youtube')
    const videos = await fetchChannelRecentVideos('UCtest123')
    expect(videos).toHaveLength(1)
    expect(videos[0].videoId).toBe('GOOD1')
  })
})

describe('fetchTranscriptText', () => {
  beforeEach(() => vi.clearAllMocks())

  it('joins transcript segments into a single string', async () => {
    const fetchTranscript = await getFetchTranscript()
    fetchTranscript.mockResolvedValueOnce([
      { text: 'Hello', duration: 1, offset: 0 },
      { text: 'world', duration: 1, offset: 1 },
    ])
    const { fetchTranscriptText } = await import('../youtube')
    const result = await fetchTranscriptText('ABC123')
    expect(result).toBe('Hello world')
  })

  it('returns null when transcript fetch throws', async () => {
    const fetchTranscript = await getFetchTranscript()
    fetchTranscript.mockRejectedValueOnce(new Error('Transcript disabled'))
    const { fetchTranscriptText } = await import('../youtube')
    const result = await fetchTranscriptText('DISABLED')
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests, confirm they fail**

```bash
npm test -- lib/__tests__/youtube.test.ts
```

Expected: FAIL — `../youtube` not found.

- [ ] **Step 3: Implement lib/youtube.ts**

Create `lib/youtube.ts`:

```typescript
import Parser from 'rss-parser'
import { YoutubeTranscript } from 'youtube-transcript'

export interface YoutubeVideo {
  videoId: string
  title: string
  videoUrl: string
}

const parser = new Parser({ timeout: 10_000 })

export async function fetchChannelRecentVideos(channelId: string): Promise<YoutubeVideo[]> {
  const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
  const feed = await parser.parseURL(feedUrl)
  return feed.items
    .filter(item => !!item.link)
    .map(item => {
      let videoId = ''
      try {
        videoId = new URL(item.link!).searchParams.get('v') ?? ''
      } catch {
        videoId = ''
      }
      return { videoId, title: item.title ?? '', videoUrl: item.link! }
    })
    .filter(v => v.videoId !== '')
}

export async function fetchTranscriptText(videoId: string): Promise<string | null> {
  try {
    const segments = await YoutubeTranscript.fetchTranscript(videoId)
    return segments.map(s => s.text).join(' ')
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run tests, confirm they pass**

```bash
npm test -- lib/__tests__/youtube.test.ts
```

Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/youtube.ts lib/__tests__/youtube.test.ts
git commit -m "feat: add YouTube channel feed fetcher and transcript extractor"
```

---

### Task 4: extractPredictionsFromText in lib/ai.ts + Tests

**Files:**
- Modify: `lib/ai.ts`
- Modify: `lib/__tests__/ai.test.ts`

- [ ] **Step 1: Write failing tests**

Open `lib/__tests__/ai.test.ts` and append the new describe block at the bottom (before the final blank line):

```typescript
describe('extractPredictionsFromText', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns parsed prediction array when Claude returns valid JSON', async () => {
    const create = await getCreate()
    create.mockResolvedValueOnce({
      content: [{
        type: 'text',
        text: '[{"predictor_name":"股癌","content":"台積電年底破1500","deadline":"2026-12-31","category":"stock"}]',
      }],
    })
    const { extractPredictionsFromText } = await import('../ai')
    const result = await extractPredictionsFromText('股癌說台積電年底破1500', 'Yahoo 奇摩新聞')
    expect(result).toHaveLength(1)
    expect(result[0].predictor_name).toBe('股癌')
    expect(result[0].deadline).toBe('2026-12-31')
    expect(result[0].category).toBe('stock')
  })

  it('returns empty array when Claude finds no predictions', async () => {
    const create = await getCreate()
    create.mockResolvedValueOnce({
      content: [{ type: 'text', text: '[]' }],
    })
    const { extractPredictionsFromText } = await import('../ai')
    const result = await extractPredictionsFromText('今天天氣很好', 'ETtoday')
    expect(result).toHaveLength(0)
  })

  it('filters out items with invalid deadline format', async () => {
    const create = await getCreate()
    create.mockResolvedValueOnce({
      content: [{
        type: 'text',
        text: '[{"predictor_name":"A","content":"B","deadline":"not-a-date","category":"other"},{"predictor_name":"C","content":"D","deadline":"2026-06-01","category":"stock"}]',
      }],
    })
    const { extractPredictionsFromText } = await import('../ai')
    const result = await extractPredictionsFromText('some text', 'source')
    expect(result).toHaveLength(1)
    expect(result[0].predictor_name).toBe('C')
  })

  it('returns empty array on malformed JSON', async () => {
    const create = await getCreate()
    create.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'not json at all' }],
    })
    const { extractPredictionsFromText } = await import('../ai')
    const result = await extractPredictionsFromText('some text', 'source')
    expect(result).toHaveLength(0)
  })

  it('returns empty array for empty input text', async () => {
    const create = await getCreate()
    const { extractPredictionsFromText } = await import('../ai')
    const result = await extractPredictionsFromText('   ', 'source')
    expect(result).toHaveLength(0)
    expect(create).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests, confirm the new cases fail**

```bash
npm test -- lib/__tests__/ai.test.ts
```

Expected: existing 7 tests PASS, new 5 tests FAIL (`extractPredictionsFromText` not exported).

- [ ] **Step 3: Add ExtractedPrediction interface and extractPredictionsFromText to lib/ai.ts**

Open `lib/ai.ts` and append after the `judgeExpiredPrediction` function:

```typescript
export interface ExtractedPrediction {
  predictor_name: string
  content: string
  deadline: string
  category: string
}

export async function extractPredictionsFromText(
  articleText: string,
  sourceName: string,
): Promise<ExtractedPrediction[]> {
  if (!articleText.trim()) return []

  const client = getClient()
  const today = new Date().toISOString().split('T')[0]
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `Extract all concrete predictions from this text. A prediction is a future-tense claim by a named person about what will happen, with an implied or stated deadline.

Source: "${sourceName}"
Today: "${today}"
Text:
${articleText.slice(0, 3000)}

Return a JSON array. If no predictions found, return [].
Each item: {"predictor_name": "...", "content": "...", "deadline": "YYYY-MM-DD", "category": "stock|politics|fortune|tech|sports|ai|other"}

Rules:
- predictor_name: the person or institution making the prediction
- content: the prediction sentence, max 200 chars
- deadline: date by which it can be verified; if vague like "this year" use ${new Date().getFullYear()}-12-31; skip if no deadline can be inferred
- Only include predictions with a clear named predictor AND an inferable deadline

Reply ONLY with a valid JSON array.`,
    }],
  })

  const responseText = message.content[0].type === 'text' ? message.content[0].text : '[]'
  try {
    const jsonMatch = responseText.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return []
    const results = JSON.parse(jsonMatch[0])
    if (!Array.isArray(results)) return []
    return results.filter(
      (r: unknown): r is ExtractedPrediction =>
        typeof r === 'object' &&
        r !== null &&
        typeof (r as ExtractedPrediction).predictor_name === 'string' &&
        typeof (r as ExtractedPrediction).content === 'string' &&
        typeof (r as ExtractedPrediction).deadline === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test((r as ExtractedPrediction).deadline),
    )
  } catch {
    return []
  }
}
```

- [ ] **Step 4: Run all ai tests, confirm they pass**

```bash
npm test -- lib/__tests__/ai.test.ts
```

Expected: PASS (12 tests total).

- [ ] **Step 5: Commit**

```bash
git add lib/ai.ts lib/__tests__/ai.test.ts
git commit -m "feat: add extractPredictionsFromText to AI lib"
```

---

### Task 5: lib/crawler.ts + Tests

**Files:**
- Create: `lib/crawler.ts`
- Create: `lib/__tests__/crawler.test.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/__tests__/crawler.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

vi.mock('../ai', () => ({
  reviewSubmission: vi.fn(),
  checkDuplicate: vi.fn(),
}))

async function getMocks() {
  const ai = await import('../ai')
  return {
    reviewSubmission: ai.reviewSubmission as ReturnType<typeof vi.fn>,
    checkDuplicate: ai.checkDuplicate as ReturnType<typeof vi.fn>,
  }
}

function makeSingleResult(data: unknown) {
  return { data, error: null }
}

function makeDb(overrides: {
  predictorExisting?: { id: string } | null
  predictorCreated?: { id: string }
  predictionCreated?: { id: string }
  similar?: Array<{ id: string; content: string }>
} = {}): SupabaseClient {
  const {
    predictorExisting = null,
    predictorCreated = { id: 'new-pred-id' },
    predictionCreated = { id: 'new-prediction-id' },
    similar = [],
  } = overrides

  let predictorSelectCallCount = 0

  return {
    from: (table: string) => ({
      select: () => ({
        eq: (col: string) => ({
          single: () => {
            if (table === 'predictors') {
              predictorSelectCallCount++
              // First call: existence check; second call (in createCrawledPrediction): get slug
              if (predictorSelectCallCount === 1) {
                return Promise.resolve(makeSingleResult(predictorExisting))
              }
              return Promise.resolve(makeSingleResult({ slug: 'test-slug' }))
            }
            return Promise.resolve(makeSingleResult(null))
          },
        }),
      }),
      insert: () => ({
        select: () => ({
          single: () => {
            if (table === 'predictors') return Promise.resolve(makeSingleResult(predictorCreated))
            if (table === 'predictions') return Promise.resolve(makeSingleResult(predictionCreated))
            return Promise.resolve(makeSingleResult(null))
          },
        }),
        then: (resolve: (v: unknown) => unknown) => resolve({ error: null }),
      }),
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
    rpc: () => Promise.resolve({ data: similar }),
  } as unknown as SupabaseClient
}

describe('toSlug', () => {
  it('converts English name to slug', async () => {
    const { toSlug } = await import('../crawler')
    expect(toSlug('Stock Cancer')).toBe('stock-cancer')
  })

  it('strips Chinese characters', async () => {
    const { toSlug } = await import('../crawler')
    expect(toSlug('股癌 Gooaye')).toBe('gooaye')
  })

  it('returns "predictor" for all-Chinese name', async () => {
    const { toSlug } = await import('../crawler')
    expect(toSlug('天機老師')).toBe('predictor')
  })

  it('collapses multiple dashes', async () => {
    const { toSlug } = await import('../crawler')
    expect(toSlug('hello  world')).toBe('hello-world')
  })
})

describe('findOrCreatePredictor', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns existing predictor id when slug already exists', async () => {
    const db = makeDb({ predictorExisting: { id: 'existing-id' } })
    const { findOrCreatePredictor } = await import('../crawler')
    const id = await findOrCreatePredictor(db, 'Gooaye', 'stock', 'tw')
    expect(id).toBe('existing-id')
  })

  it('creates new predictor and returns its id', async () => {
    const db = makeDb({ predictorExisting: null, predictorCreated: { id: 'fresh-id' } })
    const { findOrCreatePredictor } = await import('../crawler')
    const id = await findOrCreatePredictor(db, 'NewGuy', 'stock', 'tw')
    expect(id).toBe('fresh-id')
  })
})

describe('createCrawledPrediction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null when AI review rejects content', async () => {
    const { reviewSubmission } = await getMocks()
    reviewSubmission.mockResolvedValueOnce({ is_prediction: false, reason: 'not a prediction', verdict_type: 'subjective' })
    const db = makeDb()
    const { createCrawledPrediction } = await import('../crawler')
    const result = await createCrawledPrediction(db, {
      predictor_id: 'pred-id',
      content: 'some opinion',
      deadline: '2026-12-31',
      category: 'stock',
      locale: 'tw',
      source_url: 'https://example.com/1',
      source_name: 'Example',
    })
    expect(result).toBeNull()
  })

  it('returns prediction id when AI approves and no duplicates', async () => {
    const { reviewSubmission, checkDuplicate } = await getMocks()
    reviewSubmission.mockResolvedValueOnce({ is_prediction: true, reason: '', verdict_type: 'objective' })
    const db = makeDb({ predictionCreated: { id: 'created-id' }, similar: [] })
    const { createCrawledPrediction } = await import('../crawler')
    const result = await createCrawledPrediction(db, {
      predictor_id: 'pred-id',
      content: '台積電破1500',
      deadline: '2026-12-31',
      category: 'stock',
      locale: 'tw',
      source_url: 'https://example.com/1',
      source_name: 'Example',
    })
    expect(result).toBe('created-id')
    expect(checkDuplicate).not.toHaveBeenCalled()
  })

  it('returns existing id and soft-deletes new prediction when duplicate found', async () => {
    const { reviewSubmission, checkDuplicate } = await getMocks()
    reviewSubmission.mockResolvedValueOnce({ is_prediction: true, reason: '', verdict_type: 'objective' })
    checkDuplicate.mockResolvedValueOnce({ is_same: true })
    const db = makeDb({
      predictionCreated: { id: 'new-id' },
      similar: [{ id: 'existing-id', content: '台積電年底破1500元' }],
    })
    const { createCrawledPrediction } = await import('../crawler')
    const result = await createCrawledPrediction(db, {
      predictor_id: 'pred-id',
      content: '台積電破1500',
      deadline: '2026-12-31',
      category: 'stock',
      locale: 'tw',
      source_url: 'https://example.com/1',
      source_name: 'Example',
    })
    expect(result).toBe('existing-id')
  })

  it('returns null when AI review throws', async () => {
    const { reviewSubmission } = await getMocks()
    reviewSubmission.mockRejectedValueOnce(new Error('API error'))
    const db = makeDb()
    const { createCrawledPrediction } = await import('../crawler')
    const result = await createCrawledPrediction(db, {
      predictor_id: 'pred-id',
      content: 'some content',
      deadline: '2026-12-31',
      category: 'stock',
      locale: 'tw',
      source_url: 'https://example.com/1',
      source_name: 'Example',
    })
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests, confirm they fail**

```bash
npm test -- lib/__tests__/crawler.test.ts
```

Expected: FAIL — `../crawler` not found.

- [ ] **Step 3: Implement lib/crawler.ts**

Create `lib/crawler.ts`:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'
import { reviewSubmission, checkDuplicate } from './ai'
import type { Category, Locale } from './types'

export function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[一-鿿㐀-䶿]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'predictor'
}

export async function findOrCreatePredictor(
  db: SupabaseClient,
  name: string,
  category: Category,
  locale: Locale,
): Promise<string> {
  const slug = toSlug(name)
  // 'ai' is not a valid predictor category in the DB — map to 'tech'
  const dbCategory = category === 'ai' ? 'tech' : category

  const { data: existing } = await db
    .from('predictors')
    .select('id')
    .eq('slug', slug)
    .single()

  if (existing) return existing.id

  const { data: created, error } = await db
    .from('predictors')
    .insert({
      name: name.trim(),
      slug,
      type: 'individual',
      category: dbCategory,
      locale,
      bullshit_score: 0,
      accuracy_rate: 0,
      total_predictions: 0,
    })
    .select('id')
    .single()

  if (error || !created) throw new Error(`Failed to create predictor: ${name}`)
  return created.id
}

export async function createCrawledPrediction(
  db: SupabaseClient,
  params: {
    predictor_id: string
    content: string
    deadline: string
    category: Category
    locale: Locale
    source_url: string
    source_name: string
  },
): Promise<string | null> {
  let reviewResult: Awaited<ReturnType<typeof reviewSubmission>>
  try {
    reviewResult = await reviewSubmission(params.content, params.deadline)
  } catch {
    return null
  }
  if (!reviewResult.is_prediction) return null

  // Build prediction slug
  const { data: predictor } = await db
    .from('predictors')
    .select('slug')
    .eq('id', params.predictor_id)
    .single()
  const predictorSlug = predictor?.slug ?? 'predictor'

  const contentSlug = params.content
    .slice(0, 40)
    .toLowerCase()
    .replace(/[一-鿿㐀-䶿]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  const year = new Date(params.deadline).getFullYear()
  const predictionSlug = `${predictorSlug}-${contentSlug || 'prediction'}-${year}-${Date.now()}`

  // Insert pending
  const { data: prediction, error: predErr } = await db
    .from('predictions')
    .insert({
      content: params.content.trim(),
      predictor_id: params.predictor_id,
      locale: params.locale,
      slug: predictionSlug,
      deadline: params.deadline,
      category: params.category,
      verdict_type: reviewResult.verdict_type,
      status: 'pending_review',
      verdict: null,
      submitted_by: null,
    })
    .select('id')
    .single()

  if (predErr || !prediction) return null

  // Record source
  await db.from('prediction_sources').insert({
    prediction_id: prediction.id,
    source_url: params.source_url,
    source_name: params.source_name,
    source_snapshot: null,
  })

  // Deduplication via pg_trgm
  const { data: similar } = await db.rpc('find_similar_predictions', {
    p_predictor_id: params.predictor_id,
    p_deadline: params.deadline,
    p_content: params.content.trim(),
    p_exclude_id: prediction.id,
  })

  for (const candidate of (similar ?? [])) {
    let dupCheck: Awaited<ReturnType<typeof checkDuplicate>>
    try {
      dupCheck = await checkDuplicate(params.content.trim(), candidate.content)
    } catch {
      continue
    }
    if (dupCheck.is_same) {
      await db.from('prediction_sources').insert({
        prediction_id: candidate.id,
        source_url: params.source_url,
        source_name: params.source_name,
        source_snapshot: null,
      })
      await db.from('predictions').update({
        deleted_at: new Date().toISOString(),
        deleted_by: 'crawler-dedup',
        delete_reason: 'Duplicate — merged source into existing prediction',
      }).eq('id', prediction.id)
      return candidate.id
    }
  }

  // Approve
  await db.from('predictions').update({ status: 'active' }).eq('id', prediction.id)
  return prediction.id
}
```

- [ ] **Step 4: Run tests, confirm they pass**

```bash
npm test -- lib/__tests__/crawler.test.ts
```

Expected: PASS (8 tests).

- [ ] **Step 5: Run full test suite to confirm no regressions**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add lib/crawler.ts lib/__tests__/crawler.test.ts
git commit -m "feat: add findOrCreatePredictor and createCrawledPrediction crawler helpers"
```

---

### Task 6: RSS Cron Route + vercel.json

**Files:**
- Create: `app/api/cron/crawl-rss/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Create app/api/cron/crawl-rss/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { fetchRssItems, filterNewItems } from '@/lib/rss'
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
  const results = { sources: 0, articles: 0, extracted: 0, created: 0, errors: 0 }

  const { data: sources } = await db
    .from('sources')
    .select('*')
    .eq('type', 'rss')
    .eq('active', true)

  for (const source of (sources ?? []) as Source[]) {
    results.sources++
    try {
      const items = await fetchRssItems(source.url_or_channel_id)

      // Batch-check which URLs are already in prediction_sources
      const itemLinks = items.map(i => i.link).filter(Boolean)
      let knownUrls = new Set<string>()
      if (itemLinks.length > 0) {
        const { data: existing } = await db
          .from('prediction_sources')
          .select('source_url')
          .in('source_url', itemLinks)
        knownUrls = new Set((existing ?? []).map((r: { source_url: string }) => r.source_url))
      }

      const newItems = filterNewItems(items, knownUrls)
      results.articles += newItems.length

      for (const item of newItems) {
        if (!item.text.trim()) continue

        const extracted = await extractPredictionsFromText(item.text, source.name)
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
              source_url: item.link,
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
```

- [ ] **Step 2: Update vercel.json**

Replace the contents of `vercel.json` with:

```json
{
  "crons": [
    { "path": "/api/cron/check-deadlines",  "schedule": "0 2 * * *"   },
    { "path": "/api/cron/resolve-votes",    "schedule": "0 */6 * * *" },
    { "path": "/api/cron/crawl-rss",        "schedule": "0 */6 * * *" },
    { "path": "/api/cron/crawl-youtube",    "schedule": "0 3 * * *"   }
  ]
}
```

- [ ] **Step 3: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add app/api/cron/crawl-rss/route.ts vercel.json
git commit -m "feat: add crawl-rss cron route with URL dedup"
```

---

### Task 7: YouTube Cron Route

**Files:**
- Create: `app/api/cron/crawl-youtube/route.ts`

- [ ] **Step 1: Create app/api/cron/crawl-youtube/route.ts**

```typescript
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

      // Batch-check which video URLs are already processed
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
```

- [ ] **Step 2: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add app/api/cron/crawl-youtube/route.ts
git commit -m "feat: add crawl-youtube cron route with transcript extraction"
```

---

## Self-Review: Spec Coverage Checklist

- [x] RSS Feed every 4-6h: `crawl-rss` cron at `0 */6 * * *`
- [x] YouTube channel daily: `crawl-youtube` cron at `0 3 * * *`
- [x] Checks prediction_sources for already-processed URLs before calling Claude
- [x] Extracts predictor_name, content, deadline, category from article/transcript
- [x] Runs same AI review pipeline as submit route (reviewSubmission + dedup)
- [x] No hard-codes: sources read from `sources` table; add a row to enable new feeds
- [x] CRON_SECRET auth in production
- [x] `active = false` sources are skipped (new markets only need a row flip)
- [x] Category 'ai' mapped to 'tech' for predictor table (DB constraint workaround)
- [x] All tests in Vitest with same mock pattern as existing ai.test.ts
- [x] `submitted_by: null` for crawled predictions (vs. user email for manual submissions)
- [x] vercel.json updated with both new cron paths

## Manual Steps After Implementation

1. **Run migration** in Supabase dashboard SQL Editor:
   ```
   supabase/migrations/003_crawler_seeds.sql
   ```
2. **Verify + enable YouTube channel IDs**: look up actual channel IDs for 天龍人的日常, 財經M平方, etc., update the DB rows and flip `active = true`.
3. **Add env var** `CRON_SECRET` in Vercel dashboard (if not already set from Plan 3).
