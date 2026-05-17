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
