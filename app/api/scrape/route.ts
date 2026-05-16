// app/api/scrape/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { validateUrl } from '@/lib/validation'

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function POST(request: NextRequest) {
  let body: { url?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }

  const { url } = body
  if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 })

  const urlError = validateUrl(url)
  if (urlError) return NextResponse.json({ error: urlError }, { status: 400 })

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'YouSaidSoBot/1.0 (+https://yousaidso.tw/about)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    })
    clearTimeout(timeout)

    if (!res.ok) {
      return NextResponse.json({ error: `fetch failed: ${res.status}` }, { status: 422 })
    }

    const contentType = res.headers.get('content-type') ?? ''
    if (!contentType.includes('text/html')) {
      return NextResponse.json({ error: 'URL does not return HTML' }, { status: 422 })
    }

    const html = await res.text()
    const text = stripHtml(html).slice(0, 3000)

    return NextResponse.json({ text, url })
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      return NextResponse.json({ error: 'fetch timed out after 8s' }, { status: 422 })
    }
    return NextResponse.json({ error: 'failed to fetch URL' }, { status: 422 })
  }
}
