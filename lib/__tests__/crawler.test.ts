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
  return Promise.resolve({ data, error: null })
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

  let predictorSelectCalls = 0

  const db: any = {
    from: (table: string) => {
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        single: () => {
          if (table === 'predictors') {
            predictorSelectCalls++
            if (predictorSelectCalls === 1) {
              return makeSingleResult(predictorExisting)
            }
            return makeSingleResult({ slug: 'test-slug' })
          }
          return makeSingleResult(null)
        },
        insert: () => chain,
        update: () => chain,
        then: (resolve: (v: unknown) => unknown) => resolve({ error: null }),
      }
      // insert().select().single() path
      const insertChain: any = {
        select: () => ({
          single: () => {
            if (table === 'predictors') return makeSingleResult(predictorCreated)
            if (table === 'predictions') return makeSingleResult(predictionCreated)
            return makeSingleResult(null)
          },
        }),
        then: (resolve: (v: unknown) => unknown) => resolve({ error: null }),
      }
      return {
        select: () => chain,
        eq: () => chain,
        single: () => chain.single(),
        insert: () => insertChain,
        update: () => ({
          eq: () => Promise.resolve({ error: null }),
        }),
      }
    },
    rpc: () => Promise.resolve({ data: similar }),
  }
  return db as unknown as SupabaseClient
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

  it('collapses multiple spaces to single dash', async () => {
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

  it('returns existing id when duplicate found', async () => {
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
