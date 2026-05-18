import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('rss-parser', () => {
  const mockParseURL = vi.fn()
  function MockParser() {
    return { parseURL: mockParseURL }
  }
  return { default: MockParser, __mockParseURL: mockParseURL }
})

async function getParseURL() {
  const mod = await import('rss-parser')
  const instance = new (mod.default as any)()
  return instance.parseURL as ReturnType<typeof vi.fn>
}

describe('fetchRssItems', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns mapped items with title, link, text', async () => {
    const parseURL = await getParseURL()
    parseURL.mockResolvedValueOnce({
      items: [
        { title: 'Test Title', link: 'https://example.com/1', contentSnippet: 'Some snippet' },
        { title: 'No Link', link: undefined, contentSnippet: 'Content' },
      ],
    })
    const { fetchRssItems } = await import('../rss')
    const items = await fetchRssItems('https://example.com/rss')
    expect(items).toHaveLength(2)
    expect(items[0].title).toBe('Test Title')
    expect(items[0].link).toBe('https://example.com/1')
    expect(items[0].text).toBe('Test Title\nSome snippet')
  })

  it('returns empty array when feed has no items', async () => {
    const parseURL = await getParseURL()
    parseURL.mockResolvedValueOnce({ items: [] })
    const { fetchRssItems } = await import('../rss')
    const items = await fetchRssItems('https://example.com/rss')
    expect(items).toHaveLength(0)
  })
})

describe('filterNewItems', () => {
  it('removes items whose link is in knownUrls', async () => {
    const { filterNewItems } = await import('../rss')
    const items = [
      { title: 'Old', link: 'https://example.com/old', text: 'old' },
      { title: 'New', link: 'https://example.com/new', text: 'new' },
    ]
    const known = new Set(['https://example.com/old'])
    const result = filterNewItems(items, known)
    expect(result).toHaveLength(1)
    expect(result[0].link).toBe('https://example.com/new')
  })

  it('removes items with empty link', async () => {
    const { filterNewItems } = await import('../rss')
    const items = [{ title: 'No link', link: '', text: 'text' }]
    const result = filterNewItems(items, new Set())
    expect(result).toHaveLength(0)
  })

  it('returns all items when knownUrls is empty', async () => {
    const { filterNewItems } = await import('../rss')
    const items = [
      { title: 'A', link: 'https://a.com', text: 'a' },
      { title: 'B', link: 'https://b.com', text: 'b' },
    ]
    const result = filterNewItems(items, new Set())
    expect(result).toHaveLength(2)
  })
})
