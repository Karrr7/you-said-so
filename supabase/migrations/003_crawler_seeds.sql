-- Seed initial TW RSS and YouTube sources
-- ⚠️ Verify RSS URLs and YouTube channel IDs before deploying to production.

INSERT INTO sources (locale, type, name, url_or_channel_id, active) VALUES
  -- TW RSS feeds
  ('tw', 'rss', 'Yahoo 奇摩新聞',   'https://tw.news.yahoo.com/rss/',             true),
  ('tw', 'rss', '中央社即時新聞',     'https://www.cna.com.tw/rss/aall.aspx',       true),
  ('tw', 'rss', 'ETtoday 即時',      'https://feeds.feedburner.com/ettoday/realtime', true),
  -- TW YouTube channels (replace UC... IDs with real channel IDs if incorrect)
  ('tw', 'youtube_channel', '股癌 Gooaye',       'UCaBf1a-dpIsw8OxqH4ki2Kg', true),
  ('tw', 'youtube_channel', '天龍人的日常',        'UC_VERIFY_AND_REPLACE_1',  false),
  ('tw', 'youtube_channel', '財經M平方',           'UC_VERIFY_AND_REPLACE_2',  false)
ON CONFLICT DO NOTHING;
