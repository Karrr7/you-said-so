// lib/__tests__/ai.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the Anthropic SDK before importing lib/ai
vi.mock('@anthropic-ai/sdk', () => {
  const mockCreate = vi.fn()
  function MockAnthropic() {
    return { messages: { create: mockCreate } }
  }
  return { default: MockAnthropic, __mockCreate: mockCreate }
})

async function getCreate() {
  const mod = await import('@anthropic-ai/sdk')
  const instance = new (mod.default as any)()
  return instance.messages.create as ReturnType<typeof vi.fn>
}

describe('reviewSubmission', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns is_prediction=true and verdict_type when Claude returns valid JSON', async () => {
    const create = await getCreate()
    create.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"is_prediction": true, "reason": "", "verdict_type": "objective"}' }],
    })
    const { reviewSubmission } = await import('../ai')
    const result = await reviewSubmission('台積電年底站上 1500 元', '2026-12-31')
    expect(result.is_prediction).toBe(true)
    expect(result.verdict_type).toBe('objective')
  })

  it('returns is_prediction=false when Claude says so', async () => {
    const create = await getCreate()
    create.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"is_prediction": false, "reason": "opinion not prediction", "verdict_type": "subjective"}' }],
    })
    const { reviewSubmission } = await import('../ai')
    const result = await reviewSubmission('今天天氣不錯', '2026-12-31')
    expect(result.is_prediction).toBe(false)
  })

  it('defaults to is_prediction=true on malformed JSON (fail-safe)', async () => {
    const create = await getCreate()
    create.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'I cannot determine this.' }],
    })
    const { reviewSubmission } = await import('../ai')
    const result = await reviewSubmission('some content', '2026-12-31')
    expect(result.is_prediction).toBe(true)
    expect(result.verdict_type).toBe('subjective')
  })
})

describe('checkDuplicate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns is_same=true when Claude says yes', async () => {
    const create = await getCreate()
    create.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'yes' }],
    })
    const { checkDuplicate } = await import('../ai')
    const result = await checkDuplicate('台積電站上 1500 元', '台積電年底一定破 1500 元')
    expect(result.is_same).toBe(true)
  })

  it('returns is_same=false when Claude says no', async () => {
    const create = await getCreate()
    create.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'no' }],
    })
    const { checkDuplicate } = await import('../ai')
    const result = await checkDuplicate('台積電站上 1500 元', '比特幣破 10 萬')
    expect(result.is_same).toBe(false)
  })
})

describe('judgeExpiredPrediction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns verdict when Claude returns valid JSON', async () => {
    const create = await getCreate()
    create.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"verdict": "bullshit", "reason": "price did not reach target"}' }],
    })
    const { judgeExpiredPrediction } = await import('../ai')
    const result = await judgeExpiredPrediction('台積電站上 1500', '股癌', '2025-12-31')
    expect(result?.verdict).toBe('bullshit')
  })

  it('returns null when Claude is uncertain', async () => {
    const create = await getCreate()
    create.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'null' }],
    })
    const { judgeExpiredPrediction } = await import('../ai')
    const result = await judgeExpiredPrediction('some obscure prediction', '誰', '2025-06-01')
    expect(result).toBeNull()
  })
})
