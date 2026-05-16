# YouSaidSo — Plan 1/5: Foundation & Core Pages

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the YouSaidSo Next.js 15 app with Supabase schema, Google auth, i18n routing, and read-only core pages (Home Feed, Predictor, Prediction Detail) displaying comic-bubble prediction cards.

**Architecture:** Next.js 15 App Router with `[locale]` route group handled by next-intl. Supabase holds all data; server components fetch directly using the service-role key. NextAuth v5 handles Google OAuth. ISR via `revalidate` exports keeps pages near-static for SEO.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS v3, Supabase (`@supabase/ssr`), NextAuth v5 (`next-auth@beta`), next-intl v3, Vitest, React Testing Library

**Repo:** `git@github.com:Karrr7/you-said-so.git`

---

## File Map

```
you-said-so/
├── app/
│   ├── layout.tsx                         # Root layout — SVG filter defs, fonts
│   ├── globals.css
│   ├── api/
│   │   └── auth/[...nextauth]/route.ts    # NextAuth handler
│   └── [locale]/
│       ├── layout.tsx                     # Locale layout — NavBar
│       ├── page.tsx                       # Home Feed (ISR 1h)
│       ├── predictors/[slug]/page.tsx     # Predictor page (ISR 6h)
│       └── predictions/[slug]/page.tsx    # Prediction detail (on-demand ISR)
├── components/
│   ├── NavBar.tsx
│   ├── PredictionCard.tsx                 # Comic bubble card — all states
│   ├── PredictorHeader.tsx                # Avatar + stats bar
│   └── FeedDivider.tsx                    # "今日結果 / 進行中" section label
├── lib/
│   ├── types.ts                           # All TypeScript interfaces
│   ├── supabase.ts                        # Server + browser client helpers
│   ├── auth.ts                            # NextAuth config
│   └── utils.ts                           # slugify, scoreLabel, formatDeadline
├── i18n/
│   ├── routing.ts                         # defineRouting (locales, defaultLocale)
│   ├── request.ts                         # getRequestConfig
│   └── messages/tw.json                   # TW locale strings
├── supabase/
│   └── migrations/001_initial.sql         # Full schema + RLS + indexes
├── scripts/
│   └── seed.ts                            # Seed script (ts-node)
├── middleware.ts                           # next-intl routing
├── auth.ts                                # NextAuth export (root level)
├── next.config.ts
├── .env.local.example
├── vitest.config.ts
└── package.json
```

---

## Task 1: Repo Clone & Next.js Project Init

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.js`, `vitest.config.ts`

- [ ] **Step 1: Clone repo and scaffold Next.js app**

```bash
git clone git@github.com:Karrr7/you-said-so.git
cd you-said-so
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --app \
  --src-dir=false \
  --import-alias="@/*" \
  --no-eslint
```

- [ ] **Step 2: Install all dependencies**

```bash
npm install \
  @supabase/ssr @supabase/supabase-js \
  next-auth@beta \
  next-intl \
  @vercel/og

npm install -D \
  vitest \
  @vitejs/plugin-react \
  @testing-library/react \
  @testing-library/jest-dom \
  @testing-library/user-event \
  jsdom \
  ts-node
```

- [ ] **Step 3: Write `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
```

- [ ] **Step 4: Write `vitest.setup.ts`**

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 5: Write `next.config.ts`**

```typescript
import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

const config: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
}

export default withNextIntl(config)
```

- [ ] **Step 6: Verify Next.js starts**

```bash
npm run dev
```
Expected: server starts at `http://localhost:3000` with no errors.

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat: scaffold Next.js 15 app with Tailwind, Vitest, next-intl, NextAuth"
```

---

## Task 2: Environment Variables

**Files:**
- Create: `.env.local.example`, `.env.local` (local only, never committed)

- [ ] **Step 1: Write `.env.local.example`**

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# NextAuth
NEXTAUTH_SECRET=generate-with-openssl-rand-base64-32
NEXTAUTH_URL=http://localhost:3000

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Admin whitelist (comma-separated emails)
ADMIN_EMAILS=your@email.com
```

- [ ] **Step 2: Create real `.env.local` from the example**

```bash
cp .env.local.example .env.local
# Fill in real values from Supabase dashboard + Google Cloud Console
```

- [ ] **Step 3: Add `.env.local` to `.gitignore` (verify it's already there)**

```bash
grep ".env.local" .gitignore
```
Expected: `.env.local` appears in output.

- [ ] **Step 4: Commit example file**

```bash
git add .env.local.example
git commit -m "chore: add env variable template"
```

---

## Task 3: Supabase Schema Migration

**Files:**
- Create: `supabase/migrations/001_initial.sql`

- [ ] **Step 1: Write full schema migration**

Create `supabase/migrations/001_initial.sql`:

```sql
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── PREDICTORS ──────────────────────────────────────────────────────────
CREATE TABLE predictors (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name             TEXT NOT NULL,
  slug             TEXT NOT NULL UNIQUE,
  type             TEXT NOT NULL CHECK (type IN (
                     'individual','fortune','official','academic',
                     'polling','media','foreign_media','ceo','ai')),
  category         TEXT NOT NULL CHECK (category IN (
                     'stock','politics','fortune','tech','sports','other')),
  locale           TEXT NOT NULL DEFAULT 'tw' CHECK (locale IN ('tw','jp','us')),
  avatar_url       TEXT,
  wiki_url         TEXT,
  youtube_channel_url TEXT,
  twitter_url      TEXT,
  facebook_url     TEXT,
  threads_url      TEXT,
  website_url      TEXT,
  bullshit_score   NUMERIC(5,2) NOT NULL DEFAULT 0,
  accuracy_rate    NUMERIC(5,2) NOT NULL DEFAULT 0,
  total_predictions INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── PREDICTIONS ──────────────────────────────────────────────────────────
CREATE TABLE predictions (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content      TEXT NOT NULL,
  predictor_id UUID NOT NULL REFERENCES predictors(id) ON DELETE CASCADE,
  locale       TEXT NOT NULL DEFAULT 'tw' CHECK (locale IN ('tw','jp','us')),
  slug         TEXT NOT NULL UNIQUE,
  deadline     DATE NOT NULL,
  category     TEXT NOT NULL CHECK (category IN (
                 'stock','politics','fortune','tech','sports','ai','other')),
  verdict_type TEXT NOT NULL CHECK (verdict_type IN ('objective','subjective')),
  status       TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN (
                 'pending_review','active','community_vote','resolved')),
  verdict      TEXT CHECK (verdict IN ('correct','bullshit')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── PREDICTION SOURCES ───────────────────────────────────────────────────
CREATE TABLE prediction_sources (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prediction_id UUID NOT NULL REFERENCES predictions(id) ON DELETE CASCADE,
  source_url    TEXT NOT NULL,
  source_name   TEXT NOT NULL,
  source_snapshot TEXT,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── PREDICTION RESPONSES ─────────────────────────────────────────────────
CREATE TABLE prediction_responses (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prediction_id UUID NOT NULL REFERENCES predictions(id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  source_url    TEXT,
  source_name   TEXT,
  responded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── VOTES ────────────────────────────────────────────────────────────────
CREATE TABLE votes (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prediction_id UUID NOT NULL REFERENCES predictions(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL,
  choice        TEXT NOT NULL CHECK (choice IN ('correct','bullshit')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(prediction_id, user_id)
);

-- ── SOURCES (crawler config) ─────────────────────────────────────────────
CREATE TABLE sources (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  locale            TEXT NOT NULL CHECK (locale IN ('tw','jp','us')),
  type              TEXT NOT NULL CHECK (type IN ('rss','youtube_channel')),
  name              TEXT NOT NULL,
  url_or_channel_id TEXT NOT NULL,
  active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── REPORTS (content abuse) ──────────────────────────────────────────────
CREATE TABLE reports (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prediction_id UUID NOT NULL REFERENCES predictions(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL,
  reason        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── INDEXES ──────────────────────────────────────────────────────────────
CREATE INDEX idx_predictions_predictor  ON predictions(predictor_id);
CREATE INDEX idx_predictions_status     ON predictions(status);
CREATE INDEX idx_predictions_deadline   ON predictions(deadline);
CREATE INDEX idx_predictions_locale     ON predictions(locale);
CREATE INDEX idx_predictions_slug       ON predictions(slug);
CREATE INDEX idx_predictors_slug        ON predictors(slug);
CREATE INDEX idx_pred_sources_pred_id   ON prediction_sources(prediction_id);
CREATE INDEX idx_pred_responses_pred_id ON prediction_responses(prediction_id);
CREATE INDEX idx_votes_pred_id          ON votes(prediction_id);

-- pg_trgm index for deduplication similarity search
CREATE INDEX idx_predictions_content_trgm ON predictions
  USING gin(content gin_trgm_ops);

-- ── ROW LEVEL SECURITY ───────────────────────────────────────────────────
ALTER TABLE predictors          ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE prediction_sources  ENABLE ROW LEVEL SECURITY;
ALTER TABLE prediction_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE sources             ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports             ENABLE ROW LEVEL SECURITY;

-- Public read (no login required for browsing)
CREATE POLICY "public read predictors"
  ON predictors FOR SELECT USING (true);

CREATE POLICY "public read visible predictions"
  ON predictions FOR SELECT
  USING (status IN ('active','community_vote','resolved'));

CREATE POLICY "public read prediction_sources"
  ON prediction_sources FOR SELECT USING (true);

CREATE POLICY "public read prediction_responses"
  ON prediction_responses FOR SELECT USING (true);

-- All writes go through server-side API routes using service_role key.
-- Client-side direct writes are blocked by the absence of write policies.
```

- [ ] **Step 2: Run migration in Supabase dashboard**

Go to Supabase dashboard → SQL Editor → paste the contents of `001_initial.sql` → Run.

Expected: all tables appear in the Table Editor with no errors.

- [ ] **Step 3: Verify pg_trgm index exists**

In SQL Editor:
```sql
SELECT indexname FROM pg_indexes
WHERE tablename = 'predictions' AND indexname = 'idx_predictions_content_trgm';
```
Expected: 1 row returned.

- [ ] **Step 4: Commit migration file**

```bash
git add supabase/migrations/001_initial.sql
git commit -m "feat: add full Supabase schema with RLS and pg_trgm"
```

---

## Task 4: TypeScript Types

**Files:**
- Create: `lib/types.ts`

- [ ] **Step 1: Write types**

```typescript
// lib/types.ts

export type Locale = 'tw' | 'jp' | 'us'

export type PredictorType =
  | 'individual' | 'fortune' | 'official' | 'academic'
  | 'polling' | 'media' | 'foreign_media' | 'ceo' | 'ai'

export type Category =
  | 'stock' | 'politics' | 'fortune' | 'tech' | 'sports' | 'ai' | 'other'

export type VerdictType = 'objective' | 'subjective'

export type PredictionStatus =
  | 'pending_review' | 'active' | 'community_vote' | 'resolved'

export type Verdict = 'correct' | 'bullshit' | null

export interface Predictor {
  id: string
  name: string
  slug: string
  type: PredictorType
  category: Category
  locale: Locale
  avatar_url: string | null
  wiki_url: string | null
  youtube_channel_url: string | null
  twitter_url: string | null
  facebook_url: string | null
  threads_url: string | null
  website_url: string | null
  bullshit_score: number
  accuracy_rate: number
  total_predictions: number
  created_at: string
}

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
}

export interface PredictionWithRelations extends Prediction {
  predictor: Predictor
  sources: PredictionSource[]
  responses: PredictionResponse[]
  vote_counts: { correct: number; bullshit: number }
}

export interface PredictionSource {
  id: string
  prediction_id: string
  source_url: string
  source_name: string
  source_snapshot: string | null
  discovered_at: string
}

export interface PredictionResponse {
  id: string
  prediction_id: string
  content: string
  source_url: string | null
  source_name: string | null
  responded_at: string
}

export interface Vote {
  id: string
  prediction_id: string
  user_id: string
  choice: 'correct' | 'bullshit'
  created_at: string
}

export interface VoteCounts {
  correct: number
  bullshit: number
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add TypeScript types for all DB entities"
```

---

## Task 5: Supabase Client Helpers

**Files:**
- Create: `lib/supabase.ts`

- [ ] **Step 1: Write Supabase client helpers**

```typescript
// lib/supabase.ts
import { createServerClient, createBrowserClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Server-side client — for Server Components and API Routes
// Uses service_role key to bypass RLS (access control enforced at API layer)
export function createServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  )
}

// Server-side client for reading public data (respects RLS)
export async function createReadClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}

// Browser client — for Client Components
export function createBrowserSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 2: Write a quick connection smoke test**

Create `lib/__tests__/supabase.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'

// We just test that the module exports functions — real DB calls tested in E2E
describe('supabase client exports', () => {
  it('exports createServiceClient', async () => {
    // Set required env vars for test
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service')

    const { createServiceClient, createBrowserSupabaseClient } = await import('../supabase')
    expect(typeof createServiceClient).toBe('function')
    expect(typeof createBrowserSupabaseClient).toBe('function')
  })
})
```

- [ ] **Step 3: Run test**

```bash
npx vitest run lib/__tests__/supabase.test.ts
```
Expected: 1 test passes.

- [ ] **Step 4: Commit**

```bash
git add lib/supabase.ts lib/__tests__/supabase.test.ts
git commit -m "feat: add Supabase server and browser client helpers"
```

---

## Task 6: NextAuth v5 (Google OAuth)

**Files:**
- Create: `auth.ts`, `app/api/auth/[...nextauth]/route.ts`

- [ ] **Step 1: Write `auth.ts` at project root**

```typescript
// auth.ts
import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    jwt({ token, profile }) {
      if (profile?.email) token.email = profile.email
      return token
    },
    session({ session, token }) {
      if (token.email) session.user.email = token.email as string
      return session
    },
  },
})
```

- [ ] **Step 2: Write the NextAuth API route**

```typescript
// app/api/auth/[...nextauth]/route.ts
export { handlers as GET, handlers as POST } from '@/auth'
```

- [ ] **Step 3: Add Google OAuth credentials in Google Cloud Console**

Go to https://console.cloud.google.com → APIs & Services → Credentials:
- Create OAuth 2.0 Client ID (Web application)
- Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`
- Copy Client ID and Client Secret into `.env.local`

- [ ] **Step 4: Generate NEXTAUTH_SECRET**

```bash
openssl rand -base64 32
# Paste output into .env.local as NEXTAUTH_SECRET
```

- [ ] **Step 5: Verify auth endpoint responds**

```bash
npm run dev
curl http://localhost:3000/api/auth/providers
```
Expected: JSON with `google` provider listed.

- [ ] **Step 6: Commit**

```bash
git add auth.ts app/api/auth/
git commit -m "feat: add NextAuth v5 with Google OAuth"
```

---

## Task 7: i18n Routing (next-intl)

**Files:**
- Create: `i18n/routing.ts`, `i18n/request.ts`, `i18n/messages/tw.json`, `middleware.ts`

- [ ] **Step 1: Write `i18n/routing.ts`**

```typescript
// i18n/routing.ts
import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['tw', 'jp', 'us'] as const,
  defaultLocale: 'tw',
})
```

- [ ] **Step 2: Write `i18n/request.ts`**

```typescript
// i18n/request.ts
import { getRequestConfig } from 'next-intl/server'
import { routing } from './routing'

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale
  if (!locale || !(routing.locales as readonly string[]).includes(locale)) {
    locale = routing.defaultLocale
  }
  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  }
})
```

- [ ] **Step 3: Write `i18n/messages/tw.json`**

```json
{
  "nav": {
    "leaderboard": "排行榜",
    "submit": "提交預言",
    "login": "登入",
    "logout": "登出"
  },
  "feed": {
    "todayResults": "今日結果",
    "ongoing": "進行中",
    "empty": "今天還沒有結果，等等看"
  },
  "verdict": {
    "correct": "準了",
    "bullshit": "嘴炮",
    "pending": "進行中",
    "voting": "投票中"
  },
  "category": {
    "stock": "台股",
    "politics": "政治",
    "fortune": "命理",
    "tech": "科技",
    "sports": "球賽",
    "ai": "AI",
    "other": "其他"
  }
}
```

- [ ] **Step 4: Write `middleware.ts`**

```typescript
// middleware.ts
import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'

export default createMiddleware(routing)

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
}
```

- [ ] **Step 5: Verify routing**

```bash
npm run dev
```
Open `http://localhost:3000` — should redirect to `http://localhost:3000/tw`.

- [ ] **Step 6: Commit**

```bash
git add i18n/ middleware.ts
git commit -m "feat: add next-intl i18n with tw/jp/us locale routing"
```

---

## Task 8: Root Layout & Global Styles

**Files:**
- Modify: `app/layout.tsx`, `app/globals.css`
- Create: `app/[locale]/layout.tsx`

- [ ] **Step 1: Write root `app/layout.tsx`** (includes SVG filter + Google Fonts)

```typescript
// app/layout.tsx
import type { Metadata } from 'next'
import { Noto_Sans_TC, Inter } from 'next/font/google'
import './globals.css'

const notoSansTC = Noto_Sans_TC({
  subsets: ['latin'],
  weight: ['400', '500', '700', '900'],
  variable: '--font-noto',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: { default: 'YouSaidSo 你說的哦', template: '%s | YouSaidSo' },
  description: '追蹤各路大師預言準確率，是智慧還是嘴炮？',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html suppressHydrationWarning>
      <body className={`${notoSansTC.variable} ${inter.variable} bg-[#0d1117] text-[#e6edf3] antialiased`}>
        {/* Hidden SVG filter — referenced by comic bubble components */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="absolute w-0 h-0 overflow-hidden"
          aria-hidden="true"
        >
          <defs>
            <filter id="wobble" x="-6%" y="-10%" width="116%" height="128%">
              <feTurbulence type="fractalNoise" baseFrequency="0.028" numOctaves="4" seed="7" result="noise" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.2" xChannelSelector="R" yChannelSelector="G" />
            </filter>
            <filter id="wobble-strong" x="-8%" y="-12%" width="120%" height="132%">
              <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="5" seed="12" result="noise" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="3.5" xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </defs>
        </svg>
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Write `app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --font-noto: '';
  --font-inter: '';
}

body {
  font-family: var(--font-noto), var(--font-inter), sans-serif;
}

/* Subtle grid background */
body::before {
  content: '';
  position: fixed;
  inset: 0;
  background-image:
    linear-gradient(rgba(59, 130, 246, 0.025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(59, 130, 246, 0.025) 1px, transparent 1px);
  background-size: 36px 36px;
  pointer-events: none;
  z-index: 0;
}

main { position: relative; z-index: 1; }
```

- [ ] **Step 3: Write `app/[locale]/layout.tsx`**

```typescript
// app/[locale]/layout.tsx
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { routing } from '@/i18n/routing'
import NavBar from '@/components/NavBar'

interface Props {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params

  if (!(routing.locales as readonly string[]).includes(locale)) notFound()

  const messages = await getMessages()

  return (
    <NextIntlClientProvider messages={messages}>
      <NavBar locale={locale} />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-20">
        {children}
      </main>
    </NextIntlClientProvider>
  )
}
```

- [ ] **Step 4: Verify app compiles**

```bash
npx tsc --noEmit && npm run build
```
Expected: build succeeds (pages may be empty stubs for now).

- [ ] **Step 5: Commit**

```bash
git add app/layout.tsx app/globals.css app/[locale]/layout.tsx
git commit -m "feat: add root layout with SVG filters, fonts, and locale layout"
```

---

## Task 9: Utility Functions

**Files:**
- Create: `lib/utils.ts`, `lib/__tests__/utils.test.ts`

- [ ] **Step 1: Write failing tests first**

```typescript
// lib/__tests__/utils.test.ts
import { describe, it, expect } from 'vitest'
import { slugify, scoreLabel, formatDeadline, votePct } from '../utils'

describe('slugify', () => {
  it('converts Chinese + English to url-safe slug', () => {
    expect(slugify('股癌 Gooaye台積電2025')).toBe('gooaye-2025')
  })
  it('strips special chars', () => {
    expect(slugify('hello world!')).toBe('hello-world')
  })
  it('collapses multiple dashes', () => {
    expect(slugify('a  b   c')).toBe('a-b-c')
  })
})

describe('scoreLabel', () => {
  it('returns 準神 when accuracy_rate >= 70', () => {
    expect(scoreLabel(30, 70)).toBe('🎯 準神 70%')
  })
  it('returns 嘴炮 when bullshit_score > 50', () => {
    expect(scoreLabel(62, 38)).toBe('💨 嘴炮 62%')
  })
  it('returns neutral label when both <= 50', () => {
    expect(scoreLabel(48, 52)).toBe('📊 有待觀察')
  })
})

describe('formatDeadline', () => {
  it('formats YYYY-MM-DD to locale string', () => {
    expect(formatDeadline('2026-12-31')).toBe('2026/12/31')
  })
})

describe('votePct', () => {
  it('returns bullshit percentage', () => {
    expect(votePct({ correct: 300, bullshit: 700 })).toBe(70)
  })
  it('returns 0 when no votes', () => {
    expect(votePct({ correct: 0, bullshit: 0 })).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run lib/__tests__/utils.test.ts
```
Expected: FAIL — `utils` not found.

- [ ] **Step 3: Write `lib/utils.ts`**

```typescript
// lib/utils.ts
import type { VoteCounts } from './types'

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[一-鿿㐀-䶿]/g, '') // strip CJK chars
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function scoreLabel(bullshitScore: number, accuracyRate: number): string {
  if (accuracyRate >= 70) return `🎯 準神 ${accuracyRate}%`
  if (bullshitScore > 50) return `💨 嘴炮 ${bullshitScore}%`
  return '📊 有待觀察'
}

export function formatDeadline(dateStr: string): string {
  return dateStr.replace(/-/g, '/')
}

export function votePct(counts: VoteCounts): number {
  const total = counts.correct + counts.bullshit
  if (total === 0) return 0
  return Math.round((counts.bullshit / total) * 100)
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run lib/__tests__/utils.test.ts
```
Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/utils.ts lib/__tests__/utils.test.ts
git commit -m "feat: add utility functions with tests (slugify, scoreLabel, votePct)"
```

---

## Task 10: NavBar Component

**Files:**
- Create: `components/NavBar.tsx`

- [ ] **Step 1: Write `components/NavBar.tsx`**

```typescript
// components/NavBar.tsx
import Link from 'next/link'
import { auth } from '@/auth'

interface Props { locale: string }

export default async function NavBar({ locale }: Props) {
  const session = await auth()

  return (
    <header className="sticky top-0 z-50 bg-[#0d1117]/90 backdrop-blur border-b border-[#21262d]">
      <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">

        {/* Logo */}
        <Link href={`/${locale}`} className="flex items-center gap-2.5 group">
          <div
            className="relative w-8 h-8 flex items-center justify-center"
            style={{ filter: 'url(#wobble)' }}
          >
            {/* Yellow shadow layer */}
            <div className="absolute inset-0 translate-x-[2px] translate-y-[2px] bg-[#f5a623] border-2 border-[#0a0c10] rounded-lg" />
            {/* White bubble */}
            <div className="relative bg-[#fffef0] border-2 border-[#0a0c10] rounded-lg w-full h-full flex items-center justify-center">
              <span className="font-black text-[#0a0c10] text-sm leading-none" style={{ fontFamily: 'var(--font-inter)' }}>Y</span>
            </div>
          </div>
          <div>
            <div className="font-black text-[#e6edf3] text-lg leading-none tracking-wide">
              YouSaidSo
            </div>
            <div className="text-[10px] text-[#6e7681] leading-none mt-0.5">你說的哦</div>
          </div>
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-4">
          <Link href={`/${locale}/leaderboard`} className="text-sm text-[#6e7681] hover:text-[#e6edf3] transition-colors">
            排行榜
          </Link>
          {session ? (
            <>
              <Link href={`/${locale}/submit`} className="text-sm text-[#6e7681] hover:text-[#e6edf3] transition-colors">
                提交預言
              </Link>
              <form action={async () => {
                'use server'
                const { signOut } = await import('@/auth')
                await signOut()
              }}>
                <button type="submit" className="text-sm text-[#6e7681] hover:text-[#e6edf3] transition-colors">
                  登出
                </button>
              </form>
            </>
          ) : (
            <form action={async () => {
              'use server'
              const { signIn } = await import('@/auth')
              await signIn('google')
            }}>
              <button
                type="submit"
                className="text-xs font-bold px-3 py-1.5 bg-[#fffef0] text-[#0a0c10] border-2 border-[#0a0c10] rounded-md"
                style={{ boxShadow: '2px 2px 0 #f5a623, 2px 2px 0 1px #0a0c10' }}
              >
                登入
              </button>
            </form>
          )}
        </nav>

      </div>
    </header>
  )
}
```

- [ ] **Step 2: Verify NavBar renders**

```bash
npm run dev
```
Open `http://localhost:3000/tw` — NavBar should appear with YouSaidSo logo and nav links.

- [ ] **Step 3: Commit**

```bash
git add components/NavBar.tsx
git commit -m "feat: add NavBar with YouSaidSo comic bubble logo"
```

---

## Task 11: PredictionCard Component

**Files:**
- Create: `components/PredictionCard.tsx`, `components/__tests__/PredictionCard.test.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// components/__tests__/PredictionCard.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import PredictionCard from '../PredictionCard'
import type { PredictionWithRelations } from '@/lib/types'

const basePrediction: PredictionWithRelations = {
  id: '1',
  content: '台積電年底前一定站上 1,500 元',
  predictor_id: 'p1',
  locale: 'tw',
  slug: 'gooaye-tsmc-1500-2025',
  deadline: '2025-12-31',
  category: 'stock',
  verdict_type: 'objective',
  status: 'active',
  verdict: null,
  created_at: '2025-01-01T00:00:00Z',
  predictor: {
    id: 'p1', name: '股癌 Gooaye', slug: 'gooaye', type: 'individual',
    category: 'stock', locale: 'tw', avatar_url: null, wiki_url: null,
    youtube_channel_url: null, twitter_url: null, facebook_url: null,
    threads_url: null, website_url: null, bullshit_score: 62,
    accuracy_rate: 38, total_predictions: 38, created_at: '2025-01-01T00:00:00Z',
  },
  sources: [],
  responses: [],
  vote_counts: { correct: 0, bullshit: 0 },
}

describe('PredictionCard', () => {
  it('shows prediction content in speech bubble', () => {
    render(<PredictionCard prediction={basePrediction} />)
    expect(screen.getByText(/台積電年底前一定站上 1,500 元/)).toBeInTheDocument()
  })

  it('shows predictor name', () => {
    render(<PredictionCard prediction={basePrediction} />)
    expect(screen.getByText('股癌 Gooaye')).toBeInTheDocument()
  })

  it('shows 嘴炮 stamp when verdict is bullshit', () => {
    render(<PredictionCard prediction={{ ...basePrediction, status: 'resolved', verdict: 'bullshit' }} />)
    expect(screen.getByText(/嘴炮/)).toBeInTheDocument()
  })

  it('shows 準了 stamp when verdict is correct', () => {
    render(<PredictionCard prediction={{ ...basePrediction, status: 'resolved', verdict: 'correct' }} />)
    expect(screen.getByText(/準了/)).toBeInTheDocument()
  })

  it('shows vote bar when status is community_vote', () => {
    render(<PredictionCard prediction={{
      ...basePrediction,
      status: 'community_vote',
      vote_counts: { correct: 300, bullshit: 700 },
    }} />)
    expect(screen.getByText(/嘴炮 70%/)).toBeInTheDocument()
  })

  it('shows no stamp when status is active', () => {
    render(<PredictionCard prediction={basePrediction} />)
    expect(screen.queryByText(/嘴炮|準了/)).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run components/__tests__/PredictionCard.test.tsx
```
Expected: FAIL — `PredictionCard` not found.

- [ ] **Step 3: Write `components/PredictionCard.tsx`**

```typescript
// components/PredictionCard.tsx
import Link from 'next/link'
import type { PredictionWithRelations } from '@/lib/types'
import { scoreLabel, formatDeadline, votePct } from '@/lib/utils'

interface Props {
  prediction: PredictionWithRelations
}

export default function PredictionCard({ prediction }: Props) {
  const { predictor, status, verdict, content, vote_counts, deadline, category, locale, slug } = prediction
  const isBullshit = verdict === 'bullshit'
  const isCorrect = verdict === 'correct'
  const isVoting = status === 'community_vote'
  const isResolved = status === 'resolved'
  const pct = votePct(vote_counts)
  const ringClass = predictor.bullshit_score > 70
    ? 'border-red-500 shadow-[0_0_0_1px_#0d1117,0_0_0_3px_#ef4444]'
    : predictor.accuracy_rate >= 70
    ? 'border-green-500 shadow-[0_0_0_1px_#0d1117,0_0_0_3px_#22c55e]'
    : 'border-[#21262d]'

  return (
    <article className="flex gap-3 py-4 border-b border-[#21262d]/60 hover:bg-[#1c2a3f]/20 rounded-md px-2 transition-colors">

      {/* Avatar */}
      <div className="flex-shrink-0 mt-1">
        <Link href={`/${locale}/predictors/${predictor.slug}`}>
          <div className={`w-11 h-11 rounded-full bg-[#1a2235] border-2 flex items-center justify-center text-xl ${ringClass}`}>
            {predictor.avatar_url
              ? <img src={predictor.avatar_url} alt={predictor.name} className="w-full h-full rounded-full object-cover" />
              : <span>👤</span>
            }
          </div>
        </Link>
      </div>

      {/* Right column */}
      <div className="flex-1 min-w-0">

        {/* Speech bubble */}
        <Link href={`/${locale}/predictions/${slug}`}>
          <div className="relative mb-2.5">
            {/* Yellow pop-art shadow */}
            <div className="absolute top-[5px] left-[5px] right-[-5px] bottom-[-5px] bg-[#f5a623] border-[3px] border-[#0a0c10] rounded-[20px]" />
            {/* Main bubble */}
            <div
              className="relative bg-[#fffef0] border-[3px] border-[#0a0c10] rounded-[20px] px-4 py-3"
              style={{ filter: isBullshit ? 'url(#wobble-strong)' : 'url(#wobble)' }}
            >
              {/* Left tail */}
              <div className="absolute -left-[13px] top-[14px] w-0 h-0 border-[7px] border-transparent border-r-[#0a0c10]" />
              <div className="absolute -left-[8px] top-[16px] w-0 h-0 border-[5px] border-transparent border-r-[#fffef0]" />

              {/* Content */}
              <p className={`text-[#0a0c10] font-bold text-sm leading-snug ${isResolved ? 'pr-20' : ''}`}>
                {content}
              </p>

              {/* Verdict stamp */}
              {isBullshit && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 -rotate-[8deg] text-[11px] font-black text-red-500 border-[2.5px] border-red-500 rounded-[4px] px-2 py-0.5 bg-red-500/[0.08] whitespace-nowrap pointer-events-none">
                  💨 嘴炮
                </span>
              )}
              {isCorrect && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 -rotate-[8deg] text-[11px] font-black text-green-600 border-[2.5px] border-green-600 rounded-[4px] px-2 py-0.5 bg-green-600/[0.08] whitespace-nowrap pointer-events-none">
                  🎯 準了
                </span>
              )}
            </div>
          </div>
        </Link>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <Link href={`/${locale}/predictors/${predictor.slug}`} className="font-bold text-[#e6edf3] hover:underline">
            {predictor.name}
          </Link>
          <span className={predictor.bullshit_score > 50 ? 'text-red-400 font-semibold' : 'text-green-400 font-semibold'}>
            {scoreLabel(predictor.bullshit_score, predictor.accuracy_rate)}
          </span>
          <span className="text-[#21262d]">·</span>
          <StatusTag status={status} verdict={verdict} />
          <span className="text-[#21262d]">·</span>
          <span className="text-blue-400/70">#{category}</span>
          <span className="text-[#21262d]">·</span>
          <span className="text-[#6e7681]">截止 {formatDeadline(deadline)}</span>
        </div>

        {/* Vote bar (community_vote only) */}
        {isVoting && (vote_counts.correct + vote_counts.bullshit) > 0 && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] text-red-400 font-semibold">嘴炮 {pct}%</span>
            <div className="flex-1 h-[3px] bg-[#21262d] rounded overflow-hidden">
              <div className="h-full bg-gradient-to-r from-red-500 to-purple-500 rounded" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[10px] text-[#6e7681]">準了 {100 - pct}%</span>
          </div>
        )}

      </div>
    </article>
  )
}

function StatusTag({ status, verdict }: { status: string; verdict: string | null }) {
  if (status === 'resolved' && verdict === 'bullshit')
    return <span className="text-red-400 font-semibold">❌ 已判定</span>
  if (status === 'resolved' && verdict === 'correct')
    return <span className="text-green-400 font-semibold">✅ 已判定</span>
  if (status === 'community_vote')
    return <span className="text-purple-400 font-semibold">🗳️ 投票中</span>
  return <span className="text-yellow-500/80 font-semibold">⏳ 進行中</span>
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run components/__tests__/PredictionCard.test.tsx
```
Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/PredictionCard.tsx components/__tests__/PredictionCard.test.tsx
git commit -m "feat: add PredictionCard comic bubble component with tests"
```

---

## Task 12: Home Feed Page

**Files:**
- Create: `app/[locale]/page.tsx`, `components/FeedDivider.tsx`

- [ ] **Step 1: Write `components/FeedDivider.tsx`**

```typescript
// components/FeedDivider.tsx
export default function FeedDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-2 my-1">
      <div className="flex-1 h-px bg-[#21262d]" />
      <span className="text-[10px] font-bold tracking-widest uppercase text-[#6e7681]">{label}</span>
      <div className="flex-1 h-px bg-[#21262d]" />
    </div>
  )
}
```

- [ ] **Step 2: Write `app/[locale]/page.tsx`**

```typescript
// app/[locale]/page.tsx
import { createReadClient } from '@/lib/supabase'
import PredictionCard from '@/components/PredictionCard'
import FeedDivider from '@/components/FeedDivider'
import type { PredictionWithRelations } from '@/lib/types'
import type { Metadata } from 'next'

export const revalidate = 3600 // ISR: revalidate every 1 hour

export const metadata: Metadata = {
  title: '今日預言 Feed',
}

async function fetchFeedPredictions(locale: string) {
  const db = await createReadClient()

  // Fetch resolved predictions (most recent first, limit today's)
  const today = new Date().toISOString().split('T')[0]
  const { data: resolved } = await db
    .from('predictions')
    .select(`
      *,
      predictor:predictors(*),
      sources:prediction_sources(*),
      responses:prediction_responses(*)
    `)
    .eq('locale', locale)
    .eq('status', 'resolved')
    .gte('deadline', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    .order('created_at', { ascending: false })
    .limit(10)

  // Fetch active + voting predictions (soonest deadline first)
  const { data: ongoing } = await db
    .from('predictions')
    .select(`
      *,
      predictor:predictors(*),
      sources:prediction_sources(*),
      responses:prediction_responses(*)
    `)
    .eq('locale', locale)
    .in('status', ['active', 'community_vote'])
    .order('deadline', { ascending: true })
    .limit(20)

  // Fetch vote counts for all predictions
  const allIds = [...(resolved ?? []), ...(ongoing ?? [])].map(p => p.id)
  const { data: votes } = await db
    .from('votes')
    .select('prediction_id, choice')
    .in('prediction_id', allIds)

  function countVotes(predictionId: string) {
    const predVotes = (votes ?? []).filter(v => v.prediction_id === predictionId)
    return {
      correct: predVotes.filter(v => v.choice === 'correct').length,
      bullshit: predVotes.filter(v => v.choice === 'bullshit').length,
    }
  }

  const withCounts = (items: any[]): PredictionWithRelations[] =>
    (items ?? []).map(p => ({ ...p, vote_counts: countVotes(p.id) }))

  return {
    resolved: withCounts(resolved ?? []),
    ongoing: withCounts(ongoing ?? []),
  }
}

interface Props {
  params: Promise<{ locale: string }>
}

export default async function FeedPage({ params }: Props) {
  const { locale } = await params
  const { resolved, ongoing } = await fetchFeedPredictions(locale)

  return (
    <div>
      <h1 className="text-lg font-black text-[#e6edf3] mb-4 tracking-tight">
        你說的哦 <span className="text-[#6e7681] font-normal text-sm">— 今日預言</span>
      </h1>

      {resolved.length > 0 && (
        <>
          <FeedDivider label="今日結果" />
          {resolved.map(p => <PredictionCard key={p.id} prediction={p} />)}
        </>
      )}

      {ongoing.length > 0 && (
        <>
          <FeedDivider label="進行中" />
          {ongoing.map(p => <PredictionCard key={p.id} prediction={p} />)}
        </>
      )}

      {resolved.length === 0 && ongoing.length === 0 && (
        <p className="text-[#6e7681] text-sm text-center py-12">今天還沒有預言，等等看</p>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify page renders**

```bash
npm run dev
```
Open `http://localhost:3000/tw` — page should load (empty feed if no seed data yet; no console errors).

- [ ] **Step 4: Commit**

```bash
git add app/[locale]/page.tsx components/FeedDivider.tsx
git commit -m "feat: add home feed page with ISR and PredictionCard list"
```

---

## Task 13: Predictor Page

**Files:**
- Create: `components/PredictorHeader.tsx`, `app/[locale]/predictors/[slug]/page.tsx`

- [ ] **Step 1: Write `components/PredictorHeader.tsx`**

```typescript
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
```

- [ ] **Step 2: Write `app/[locale]/predictors/[slug]/page.tsx`**

```typescript
// app/[locale]/predictors/[slug]/page.tsx
import { notFound } from 'next/navigation'
import { createReadClient } from '@/lib/supabase'
import PredictorHeader from '@/components/PredictorHeader'
import PredictionCard from '@/components/PredictionCard'
import FeedDivider from '@/components/FeedDivider'
import type { PredictionWithRelations } from '@/lib/types'
import type { Metadata } from 'next'

export const revalidate = 21600 // ISR: 6 hours

interface Props {
  params: Promise<{ locale: string; slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const db = await createReadClient()
  const { data } = await db.from('predictors').select('name').eq('slug', slug).single()
  return { title: data ? `${data.name} 的預言記錄` : '找不到此預言者' }
}

export default async function PredictorPage({ params }: Props) {
  const { locale, slug } = await params
  const db = await createReadClient()

  const { data: predictor } = await db
    .from('predictors')
    .select('*')
    .eq('slug', slug)
    .eq('locale', locale)
    .single()

  if (!predictor) notFound()

  const { data: predictions } = await db
    .from('predictions')
    .select(`*, predictor:predictors(*), sources:prediction_sources(*), responses:prediction_responses(*)`)
    .eq('predictor_id', predictor.id)
    .in('status', ['active', 'community_vote', 'resolved'])
    .order('deadline', { ascending: false })

  const { data: votes } = await db
    .from('votes')
    .select('prediction_id, choice')
    .in('prediction_id', (predictions ?? []).map(p => p.id))

  const withCounts = (predictions ?? []).map(p => ({
    ...p,
    vote_counts: {
      correct: (votes ?? []).filter(v => v.prediction_id === p.id && v.choice === 'correct').length,
      bullshit: (votes ?? []).filter(v => v.prediction_id === p.id && v.choice === 'bullshit').length,
    },
  })) as PredictionWithRelations[]

  const resolved = withCounts.filter(p => p.status === 'resolved')
  const ongoing = withCounts.filter(p => p.status !== 'resolved')

  const predictionCount = {
    total: predictor.total_predictions,
    correct: resolved.filter(p => p.verdict === 'correct').length,
    bullshit: resolved.filter(p => p.verdict === 'bullshit').length,
  }

  return (
    <div>
      <PredictorHeader predictor={predictor} predictionCount={predictionCount} />
      {resolved.length > 0 && <><FeedDivider label="已判定" />{resolved.map(p => <PredictionCard key={p.id} prediction={p} />)}</>}
      {ongoing.length > 0 && <><FeedDivider label="進行中" />{ongoing.map(p => <PredictionCard key={p.id} prediction={p} />)}</>}
    </div>
  )
}
```

- [ ] **Step 3: Verify page structure compiles**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/PredictorHeader.tsx app/[locale]/predictors/
git commit -m "feat: add predictor page with stats header and prediction timeline"
```

---

## Task 14: Prediction Detail Page

**Files:**
- Create: `app/[locale]/predictions/[slug]/page.tsx`

- [ ] **Step 1: Write prediction detail page**

```typescript
// app/[locale]/predictions/[slug]/page.tsx
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createReadClient } from '@/lib/supabase'
import { formatDeadline, scoreLabel } from '@/lib/utils'
import type { Metadata } from 'next'

// On-demand ISR — revalidated when verdict changes via revalidateTag
export const revalidate = false
export const dynamic = 'force-static'

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
  const pct = total > 0 ? Math.round(bullshit / total * 100) : 0

  const predictor = prediction.predictor

  return (
    <div className="max-w-lg mx-auto">

      {/* Back link */}
      <Link href={`/${locale}`} className="text-[11px] text-[#6e7681] hover:text-[#e6edf3] mb-4 inline-block">
        ← 返回 Feed
      </Link>

      {/* Predictor */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-[#1a2235] border-2 border-[#21262d] flex items-center justify-content-center text-lg flex items-center justify-center">
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

      {/* Vote bar */}
      {total > 0 && (
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
```

- [ ] **Step 2: Verify build**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/[locale]/predictions/
git commit -m "feat: add prediction detail page with sources and predictor responses"
```

---

## Task 15: Seed Data Script

**Files:**
- Create: `scripts/seed.ts`

- [ ] **Step 1: Write seed script**

```typescript
// scripts/seed.ts
// Run: npx ts-node --project tsconfig.json scripts/seed.ts

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

  if (pErr) { console.error('Predictor seed error:', pErr); process.exit(1) }
  console.log(`✓ Inserted ${predictors.length} predictors`)

  const gooaye = predictors.find(p => p.slug === 'gooaye')!
  const tianji = predictors.find(p => p.slug === 'tianji-teacher')!
  const nccu = predictors.find(p => p.slug === 'nccu-election-center')!

  console.log('Seeding predictions...')

  const { data: predictions, error: predErr } = await db.from('predictions').insert([
    // Resolved — bullshit
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
    // Resolved — correct
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
    // Active
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
    // Community vote
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
    // Active
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

  if (predErr) { console.error('Prediction seed error:', predErr); process.exit(1) }
  console.log(`✓ Inserted ${predictions.length} predictions`)

  // Seed sources
  const aiPrediction = predictions.find(p => p.slug === 'gooaye-ai-bubble-2026')!
  await db.from('prediction_sources').insert([
    {
      prediction_id: aiPrediction.id,
      source_url: 'https://example.com/youtube-video',
      source_name: 'YouTube',
      source_snapshot: '股癌在節目中說：「AI 泡沫會在年底前正式破裂」',
    },
  ])

  // Seed votes for community_vote prediction
  const fakeVotes = Array.from({ length: 7 }, (_, i) => ({
    prediction_id: aiPrediction.id,
    user_id: `fake-user-${i}`,
    choice: 'bullshit' as const,
  })).concat(Array.from({ length: 3 }, (_, i) => ({
    prediction_id: aiPrediction.id,
    user_id: `fake-user-correct-${i}`,
    choice: 'correct' as const,
  })))
  await db.from('votes').insert(fakeVotes)

  console.log('✓ Seed complete!')
}

seed().catch(console.error)
```

- [ ] **Step 2: Run seed script**

```bash
npx ts-node --project tsconfig.json --transpile-only scripts/seed.ts
```
Expected:
```
Seeding predictors...
✓ Inserted 3 predictors
Seeding predictions...
✓ Inserted 5 predictions
✓ Seed complete!
```

- [ ] **Step 3: Verify data in Supabase dashboard**

Go to Supabase → Table Editor → `predictions`. Should see 5 rows.

- [ ] **Step 4: Verify feed page shows data**

```bash
npm run dev
```
Open `http://localhost:3000/tw` — feed should show prediction cards with comic bubbles. Resolved predictions should have 嘴炮/準了 stamps.

- [ ] **Step 5: Run all tests**

```bash
npx vitest run
```
Expected: all tests pass.

- [ ] **Step 6: Final commit**

```bash
git add scripts/seed.ts
git commit -m "feat: add seed script with predictors, predictions, sources, and votes"
```

---

## Self-Review Checklist

After writing, verify against spec:

| Spec Requirement | Covered By |
|---|---|
| Next.js 15 App Router | Task 1 |
| Supabase schema (all 7 tables) | Task 3 |
| pg_trgm index | Task 3 |
| RLS policies | Task 3 |
| TypeScript types for all entities | Task 4 |
| Service role + anon client separation | Task 5 |
| NextAuth Google OAuth | Task 6 |
| next-intl `/tw/` routing | Task 7 |
| ISR (Feed 1h, Predictor 6h, Detail on-demand) | Tasks 12–14 |
| SVG wobble filter in layout | Task 8 |
| NavBar with YouSaidSo logo | Task 10 |
| Comic bubble PredictionCard (all 4 states) | Task 11 |
| Avatar accuracy ring | Task 11 |
| Predictor stats header | Task 13 |
| Vote progress bar | Task 11, 14 |
| PredictionSource display | Task 14 |
| PredictionResponse display | Task 14 |
| Seed data (30+ predictions target for launch) | Task 15 — extend script |
| `locale` field on all entities | Task 3, 4 |
| Slug-based URLs | Task 3 (slug column), Tasks 12–14 |

**Note:** Seed script in Task 15 inserts 5 predictions as a template. Before launch, extend it with 30+ resolved and 20+ active predictions per the Cold Start Strategy in the spec.

**Plans 2–5 cover:** Submission form, AI pipeline (Claude Haiku), RSS/YouTube crawlers, voting API, OG cards, sharing buttons, rate limiting, admin dashboard, Privacy/ToS pages.
