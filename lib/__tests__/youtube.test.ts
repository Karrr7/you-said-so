import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('rss-parser', () => {
  const mockParseURL = vi.fn()
  function MockParser() {
    return { parseURL: mockParseURL }
  }
  return { default: MockParser }
})

vi.mock('youtube-transcript', () => ({
  YoutubeTranscript: {
    fetchTranscript: vi.fn(),
  },
}))

async function getParseURL() {
  const mod = await import('rss-parser')
  const instance = new (mod.default as any)()
  return instance.parseURL as ReturnType<typeof vi.fn>
}

async function getFetchTranscript() {
  const { YoutubeTranscript } = await import('youtube-transcript')
  return YoutubeTranscript.fetchTranscript as ReturnType<typeof vi.fn>
}

describe('fetchChannelRecentVideos', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns video list from channel Atom feed', async () => {
    const parseURL = await getParseURL()
    parseURL.mockResolvedValueOnce({
      items: [
        { title: 'Video One', link: 'https://www.youtube.com/watch?v=ABC123' },
        { title: 'Video Two', link: 'https://www.youtube.com/watch?v=DEF456' },
      ],
    })
    const { fetchChannelRecentVideos } = await import('../youtube')
    const videos = await fetchChannelRecentVideos('UCtest123')
    expect(videos).toHaveLength(2)
    expect(videos[0].videoId).toBe('ABC123')
    expect(videos[0].title).toBe('Video One')
    expect(videos[0].videoUrl).toBe('https://www.youtube.com/watch?v=ABC123')
    expect(parseURL).toHaveBeenCalledWith(
      'https://www.youtube.com/feeds/videos.xml?channel_id=UCtest123',
    )
  })

  it('skips items with no parseable video ID', async () => {
    const parseURL = await getParseURL()
    parseURL.mockResolvedValueOnce({
      items: [
        { title: 'Good', link: 'https://www.youtube.com/watch?v=GOOD1' },
        { title: 'Bad', link: 'https://www.youtube.com/channel/UCtest' },
      ],
    })
    const { fetchChannelRecentVideos } = await import('../youtube')
    const videos = await fetchChannelRecentVideos('UCtest123')
    expect(videos).toHaveLength(1)
    expect(videos[0].videoId).toBe('GOOD1')
  })
})

describe('fetchTranscriptText', () => {
  beforeEach(() => vi.clearAllMocks())

  it('joins transcript segments into a single string', async () => {
    const fetchTranscript = await getFetchTranscript()
    fetchTranscript.mockResolvedValueOnce([
      { text: 'Hello', duration: 1, offset: 0 },
      { text: 'world', duration: 1, offset: 1 },
    ])
    const { fetchTranscriptText } = await import('../youtube')
    const result = await fetchTranscriptText('ABC123')
    expect(result).toBe('Hello world')
  })

  it('returns null when transcript fetch throws', async () => {
    const fetchTranscript = await getFetchTranscript()
    fetchTranscript.mockRejectedValueOnce(new Error('Transcript disabled'))
    const { fetchTranscriptText } = await import('../youtube')
    const result = await fetchTranscriptText('DISABLED')
    expect(result).toBeNull()
  })
})
