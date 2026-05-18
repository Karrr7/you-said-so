import Parser from 'rss-parser'
import { YoutubeTranscript } from 'youtube-transcript'

export interface YoutubeVideo {
  videoId: string
  title: string
  videoUrl: string
}

const parser = new Parser({ timeout: 10_000 })

export async function fetchChannelRecentVideos(channelId: string): Promise<YoutubeVideo[]> {
  const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
  const feed = await parser.parseURL(feedUrl)
  return feed.items
    .filter(item => !!item.link)
    .map(item => {
      let videoId = ''
      try {
        videoId = new URL(item.link!).searchParams.get('v') ?? ''
      } catch {
        videoId = ''
      }
      return { videoId, title: item.title ?? '', videoUrl: item.link! }
    })
    .filter(v => v.videoId !== '')
}

export async function fetchTranscriptText(videoId: string): Promise<string | null> {
  try {
    const segments = await YoutubeTranscript.fetchTranscript(videoId)
    return segments.map(s => s.text).join(' ')
  } catch {
    return null
  }
}
