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
