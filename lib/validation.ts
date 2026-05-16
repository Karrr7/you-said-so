const PRIVATE_IP_RE = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/

export function validateUrl(raw: string): string | null {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return 'invalid URL'
  }
  if (!['http:', 'https:'].includes(url.protocol)) return 'URL must use http or https'
  if (PRIVATE_IP_RE.test(url.hostname)) return 'forbidden: private/localhost URLs not allowed'
  return null
}

export function validateDeadline(raw: string): string | null {
  const d = new Date(raw)
  if (isNaN(d.getTime())) return 'invalid date format'
  const now = new Date()
  if (d <= now) return 'deadline must be a future date'
  const fiveYearsOut = new Date()
  fiveYearsOut.setFullYear(fiveYearsOut.getFullYear() + 5)
  if (d > fiveYearsOut) return 'deadline cannot be more than 5 年 from today'
  return null
}

export function validateContent(raw: string): string | null {
  if (!raw.trim()) return 'content is required'
  if (raw.length > 500) return 'content must be 500 characters or fewer'
  return null
}
