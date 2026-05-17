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
