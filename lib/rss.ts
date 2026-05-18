import Parser from 'rss-parser'

export interface RssItem {
  title: string
  link: string
  text: string
}

const parser = new Parser({ timeout: 10_000 })

export async function fetchRssItems(url: string): Promise<RssItem[]> {
  const feed = await parser.parseURL(url)
  return feed.items.map(item => ({
    title: item.title ?? '',
    link: item.link ?? '',
    text: [item.title, item.contentSnippet].filter(Boolean).join('\n'),
  }))
}

export function filterNewItems(items: RssItem[], knownUrls: Set<string>): RssItem[] {
  return items.filter(item => item.link && !knownUrls.has(item.link))
}
