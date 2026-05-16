// lib/utils.ts
import type { VoteCounts } from './types'

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[一-鿿㐀-䶿]/g, ' ') // replace CJK chars with space so adjacent latin/digits separate naturally
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
