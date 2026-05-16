import { describe, it, expect } from 'vitest'
import { validateUrl, validateDeadline, validateContent } from '../validation'

describe('validateUrl', () => {
  it('accepts a valid https URL', () => {
    expect(validateUrl('https://news.cts.com.tw/article/123')).toBeNull()
  })
  it('rejects localhost', () => {
    expect(validateUrl('http://localhost:3000/anything')).toMatch(/forbidden/)
  })
  it('rejects 10.x private IP', () => {
    expect(validateUrl('http://10.0.0.1/secret')).toMatch(/forbidden/)
  })
  it('rejects 192.168.x private IP', () => {
    expect(validateUrl('http://192.168.1.1/secret')).toMatch(/forbidden/)
  })
  it('rejects non-http protocol', () => {
    expect(validateUrl('ftp://example.com/file')).toMatch(/http/)
  })
  it('rejects malformed URL', () => {
    expect(validateUrl('not a url')).toMatch(/invalid/)
  })
})

describe('validateDeadline', () => {
  it('accepts a future date within 5 years', () => {
    const future = new Date()
    future.setFullYear(future.getFullYear() + 1)
    expect(validateDeadline(future.toISOString().split('T')[0])).toBeNull()
  })
  it('rejects past date', () => {
    expect(validateDeadline('2020-01-01')).toMatch(/future/)
  })
  it('rejects date more than 5 years out', () => {
    const far = new Date()
    far.setFullYear(far.getFullYear() + 6)
    expect(validateDeadline(far.toISOString().split('T')[0])).toMatch(/5 年/)
  })
  it('rejects invalid format', () => {
    expect(validateDeadline('not-a-date')).toMatch(/invalid/)
  })
})

describe('validateContent', () => {
  it('accepts content within 500 chars', () => {
    expect(validateContent('台積電年底前一定站上 1,500 元')).toBeNull()
  })
  it('rejects empty string', () => {
    expect(validateContent('')).toMatch(/required/)
  })
  it('rejects content over 500 chars', () => {
    expect(validateContent('x'.repeat(501))).toMatch(/500/)
  })
})
