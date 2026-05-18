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
