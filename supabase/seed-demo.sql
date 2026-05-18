-- ============================================================
-- YouSaidSo Demo Seed Data
-- ============================================================
-- Prerequisites:
--   Run 001_initial.sql and 002_ai_pipeline.sql first.
--
-- How to run:
--   Supabase Dashboard → SQL Editor → paste and Run.
--   Safe to run multiple times (cleans up first).
-- ============================================================

-- Clean up previous demo data (CASCADE handles sources + votes)
DELETE FROM predictions WHERE slug LIKE 'demo-%';

-- ── PREDICTORS + PREDICTIONS ─────────────────────────────────
DO $$
DECLARE
  id_gooaye  UUID;
  id_tianji  UUID;
  id_xie     UUID;
  id_zhu     UUID;
  id_guo     UUID;
  id_tvbs    UUID;
  id_lei     UUID;
  id_liaohua UUID;
  id_xuanji  UUID;
BEGIN

-- ── Upsert predictors ────────────────────────────────────────

INSERT INTO predictors (name, slug, type, category, locale, bullshit_score, accuracy_rate, total_predictions)
VALUES ('股癌 Gooaye', 'gooaye', 'individual', 'stock', 'tw', 50.00, 50.00, 4)
ON CONFLICT (slug) DO UPDATE SET
  bullshit_score    = EXCLUDED.bullshit_score,
  accuracy_rate     = EXCLUDED.accuracy_rate,
  total_predictions = EXCLUDED.total_predictions
RETURNING id INTO id_gooaye;

INSERT INTO predictors (name, slug, type, category, locale, bullshit_score, accuracy_rate, total_predictions)
VALUES ('天機老師', 'tianji-laoshi', 'fortune', 'fortune', 'tw', 100.00, 0.00, 3)
ON CONFLICT (slug) DO UPDATE SET
  bullshit_score    = EXCLUDED.bullshit_score,
  accuracy_rate     = EXCLUDED.accuracy_rate,
  total_predictions = EXCLUDED.total_predictions
RETURNING id INTO id_tianji;

INSERT INTO predictors (name, slug, type, category, locale, bullshit_score, accuracy_rate, total_predictions)
VALUES ('謝金河', 'xie-jinhe', 'individual', 'stock', 'tw', 50.00, 50.00, 3)
ON CONFLICT (slug) DO UPDATE SET
  bullshit_score    = EXCLUDED.bullshit_score,
  accuracy_rate     = EXCLUDED.accuracy_rate,
  total_predictions = EXCLUDED.total_predictions
RETURNING id INTO id_xie;

INSERT INTO predictors (name, slug, type, category, locale, bullshit_score, accuracy_rate, total_predictions)
VALUES ('朱學恆', 'zhuxueheng', 'individual', 'politics', 'tw', 100.00, 0.00, 3)
ON CONFLICT (slug) DO UPDATE SET
  bullshit_score    = EXCLUDED.bullshit_score,
  accuracy_rate     = EXCLUDED.accuracy_rate,
  total_predictions = EXCLUDED.total_predictions
RETURNING id INTO id_zhu;

INSERT INTO predictors (name, slug, type, category, locale, bullshit_score, accuracy_rate, total_predictions)
VALUES ('郭台銘', 'guo-taiming', 'ceo', 'politics', 'tw', 100.00, 0.00, 2)
ON CONFLICT (slug) DO UPDATE SET
  bullshit_score    = EXCLUDED.bullshit_score,
  accuracy_rate     = EXCLUDED.accuracy_rate,
  total_predictions = EXCLUDED.total_predictions
RETURNING id INTO id_guo;

INSERT INTO predictors (name, slug, type, category, locale, bullshit_score, accuracy_rate, total_predictions)
VALUES ('TVBS 民調中心', 'tvbs-poll', 'polling', 'politics', 'tw', 0.00, 100.00, 1)
ON CONFLICT (slug) DO UPDATE SET
  bullshit_score    = EXCLUDED.bullshit_score,
  accuracy_rate     = EXCLUDED.accuracy_rate,
  total_predictions = EXCLUDED.total_predictions
RETURNING id INTO id_tvbs;

INSERT INTO predictors (name, slug, type, category, locale, bullshit_score, accuracy_rate, total_predictions)
VALUES ('雷軍', 'lei-jun', 'ceo', 'tech', 'tw', 0.00, 100.00, 2)
ON CONFLICT (slug) DO UPDATE SET
  bullshit_score    = EXCLUDED.bullshit_score,
  accuracy_rate     = EXCLUDED.accuracy_rate,
  total_predictions = EXCLUDED.total_predictions
RETURNING id INTO id_lei;

INSERT INTO predictors (name, slug, type, category, locale, bullshit_score, accuracy_rate, total_predictions)
VALUES ('廖化分析師', 'liaohua-analyst', 'individual', 'stock', 'tw', 0.00, 0.00, 1)
ON CONFLICT (slug) DO UPDATE SET
  bullshit_score    = EXCLUDED.bullshit_score,
  accuracy_rate     = EXCLUDED.accuracy_rate,
  total_predictions = EXCLUDED.total_predictions
RETURNING id INTO id_liaohua;

INSERT INTO predictors (name, slug, type, category, locale, bullshit_score, accuracy_rate, total_predictions)
VALUES ('玄機道長', 'xuanji-daozhang', 'fortune', 'fortune', 'tw', 0.00, 0.00, 1)
ON CONFLICT (slug) DO UPDATE SET
  bullshit_score    = EXCLUDED.bullshit_score,
  accuracy_rate     = EXCLUDED.accuracy_rate,
  total_predictions = EXCLUDED.total_predictions
RETURNING id INTO id_xuanji;

-- ── Resolved — BULLSHIT 💨 ────────────────────────────────────

INSERT INTO predictions
  (content, predictor_id, locale, slug, deadline, category, verdict_type, status, verdict)
VALUES
  ('台積電2025年底股價將站上1000元，趨勢確立不需要懷疑',
   id_gooaye, 'tw', 'demo-gooaye-tsmc-1000-2025',
   '2025-12-31', 'stock', 'objective', 'resolved', 'bullshit'),

  ('2025年台股必跌逾三成，庚午年犯太歲大家要小心',
   id_tianji, 'tw', 'demo-tianji-stock-crash-2025',
   '2025-12-31', 'stock', 'subjective', 'resolved', 'bullshit'),

  ('美元今年將大幅走弱，台幣年底一定升破29元大關',
   id_xie, 'tw', 'demo-xie-twd-29-2025',
   '2025-12-31', 'stock', 'objective', 'resolved', 'bullshit'),

  ('民進黨年底支持率將跌破15%，政治寒冬正式來臨',
   id_zhu, 'tw', 'demo-zhu-dpp-15pct-2025',
   '2025-06-30', 'politics', 'subjective', 'resolved', 'bullshit'),

  ('我的AI工廠將在明年量產機器人並出貨百萬台，準備改變製造業',
   id_guo, 'tw', 'demo-guo-robot-million-2025',
   '2025-12-31', 'tech', 'objective', 'resolved', 'bullshit');

-- ── Resolved — CORRECT 🎯 ────────────────────────────────────

INSERT INTO predictions
  (content, predictor_id, locale, slug, deadline, category, verdict_type, status, verdict)
VALUES
  ('輝達（NVIDIA）市值今年將突破四兆美元，AI浪潮撐起估值',
   id_gooaye, 'tw', 'demo-gooaye-nvidia-4t-2025',
   '2025-12-31', 'stock', 'objective', 'resolved', 'correct'),

  ('台股今年高點將挑戰24000點，多頭格局不變',
   id_xie, 'tw', 'demo-xie-taiex-24000-2025',
   '2025-12-31', 'stock', 'objective', 'resolved', 'correct'),

  ('2024總統大選賴清德得票率將超過四成，民進黨勝選',
   id_tvbs, 'tw', 'demo-tvbs-lai-40pct-2024',
   '2024-01-13', 'politics', 'objective', 'resolved', 'correct'),

  ('小米SU7今年銷量將突破10萬輛，電動車市場一鳴驚人',
   id_lei, 'tw', 'demo-lei-su7-100k-2024',
   '2024-12-31', 'tech', 'objective', 'resolved', 'correct');

-- ── Community vote 🗳️ ────────────────────────────────────────

INSERT INTO predictions
  (content, predictor_id, locale, slug, deadline, category, verdict_type, status, verdict, voting_started_at)
VALUES
  ('柯文哲將在年底前獲判無罪，並重返政壇繼續政治生命',
   id_zhu, 'tw', 'demo-zhu-kmt-innocent-2025',
   '2025-12-31', 'politics', 'subjective', 'community_vote', NULL,
   NOW() - INTERVAL '24 hours'),

  ('2026年台灣將發生重大政治動盪，現任執政黨搖搖欲墜',
   id_tianji, 'tw', 'demo-tianji-political-2026',
   '2026-01-01', 'politics', 'subjective', 'community_vote', NULL,
   NOW() - INTERVAL '12 hours'),

  ('台積電ADR今年除息前將漲破200美元，空頭要小心',
   id_liaohua, 'tw', 'demo-liaohua-tsm-adr-200-2025',
   '2025-09-30', 'stock', 'objective', 'community_vote', NULL,
   NOW() - INTERVAL '36 hours');

-- ── Active — ongoing ⏳ ───────────────────────────────────────

INSERT INTO predictions
  (content, predictor_id, locale, slug, deadline, category, verdict_type, status, verdict)
VALUES
  ('比特幣2026年底將站上20萬美元，這次不一樣',
   id_gooaye, 'tw', 'demo-gooaye-btc-200k-2026',
   '2026-12-31', 'stock', 'objective', 'active', NULL),

  ('台積電2026年EPS將突破120元，AI需求撐起業績',
   id_gooaye, 'tw', 'demo-gooaye-tsmc-eps-120-2026',
   '2026-12-31', 'stock', 'objective', 'active', NULL),

  ('2026年金牛座財運亨通，投資必有重大收穫，宜積極佈局',
   id_tianji, 'tw', 'demo-tianji-taurus-2026',
   '2026-12-31', 'fortune', 'subjective', 'active', NULL),

  ('聯準會2026年將降息三次，全球資金行情再起',
   id_xie, 'tw', 'demo-xie-fed-3cuts-2026',
   '2026-12-31', 'stock', 'subjective', 'active', NULL),

  ('鴻海股價2026年將衝上300元，AI伺服器訂單爆發',
   id_guo, 'tw', 'demo-guo-foxconn-300-2026',
   '2026-12-31', 'stock', 'objective', 'active', NULL),

  ('2026年台灣將發生嚴重天災，宜避免南部戶外大型活動',
   id_xuanji, 'tw', 'demo-xuanji-disaster-2026',
   '2026-12-31', 'fortune', 'subjective', 'active', NULL),

  ('小米汽車2026年全球銷量將超越特斯拉，彎道超車',
   id_lei, 'tw', 'demo-lei-xiaomi-tesla-2026',
   '2026-12-31', 'tech', 'objective', 'active', NULL),

  ('2026年地方選舉國民黨大勝，一舉奪回三都執政權',
   id_zhu, 'tw', 'demo-zhu-kmt-wins-2026',
   '2026-12-31', 'politics', 'subjective', 'active', NULL);

-- ── Prediction Sources ────────────────────────────────────────

INSERT INTO prediction_sources (prediction_id, source_url, source_name)
SELECT id, 'https://gooaye.com/podcast/tsmc-2025', 'Gooaye Podcast' FROM predictions WHERE slug = 'demo-gooaye-tsmc-1000-2025';
INSERT INTO prediction_sources (prediction_id, source_url, source_name)
SELECT id, 'https://www.youtube.com/watch?v=demo_tianji1', 'YouTube 天機老師' FROM predictions WHERE slug = 'demo-tianji-stock-crash-2025';
INSERT INTO prediction_sources (prediction_id, source_url, source_name)
SELECT id, 'https://www.cna.com.tw/news/afe/202501010001.aspx', '中央社' FROM predictions WHERE slug = 'demo-xie-twd-29-2025';
INSERT INTO prediction_sources (prediction_id, source_url, source_name)
SELECT id, 'https://tw.news.yahoo.com/politics/demo-zhu-dpp', 'Yahoo 奇摩新聞' FROM predictions WHERE slug = 'demo-zhu-dpp-15pct-2025';
INSERT INTO prediction_sources (prediction_id, source_url, source_name)
SELECT id, 'https://www.storm.mg/article/demo-guo-robot', '風傳媒' FROM predictions WHERE slug = 'demo-guo-robot-million-2025';

INSERT INTO prediction_sources (prediction_id, source_url, source_name)
SELECT id, 'https://gooaye.com/podcast/nvidia-2025', 'Gooaye Podcast' FROM predictions WHERE slug = 'demo-gooaye-nvidia-4t-2025';
INSERT INTO prediction_sources (prediction_id, source_url, source_name)
SELECT id, 'https://www.moneydj.com/interview/xie-jinhe-2025', 'MoneyDJ' FROM predictions WHERE slug = 'demo-xie-taiex-24000-2025';
INSERT INTO prediction_sources (prediction_id, source_url, source_name)
SELECT id, 'https://news.tvbs.com.tw/politics/demo-poll-2024', 'TVBS 新聞' FROM predictions WHERE slug = 'demo-tvbs-lai-40pct-2024';
INSERT INTO prediction_sources (prediction_id, source_url, source_name)
SELECT id, 'https://www.youtube.com/watch?v=demo_leijun_su7', 'YouTube 雷軍發表會' FROM predictions WHERE slug = 'demo-lei-su7-100k-2024';

INSERT INTO prediction_sources (prediction_id, source_url, source_name)
SELECT id, 'https://news.ltn.com.tw/news/politics/demo-zhu-kmt', '自由時報' FROM predictions WHERE slug = 'demo-zhu-kmt-innocent-2025';
INSERT INTO prediction_sources (prediction_id, source_url, source_name)
SELECT id, 'https://www.youtube.com/watch?v=demo_tianji2', 'YouTube 天機老師' FROM predictions WHERE slug = 'demo-tianji-political-2026';
INSERT INTO prediction_sources (prediction_id, source_url, source_name)
SELECT id, 'https://www.cnyes.com/twstock/demo-liaohua-adr', '鉅亨網' FROM predictions WHERE slug = 'demo-liaohua-tsm-adr-200-2025';

INSERT INTO prediction_sources (prediction_id, source_url, source_name)
SELECT id, 'https://gooaye.com/podcast/btc-2026', 'Gooaye Podcast' FROM predictions WHERE slug = 'demo-gooaye-btc-200k-2026';
INSERT INTO prediction_sources (prediction_id, source_url, source_name)
SELECT id, 'https://gooaye.com/podcast/tsmc-eps-2026', 'Gooaye Podcast' FROM predictions WHERE slug = 'demo-gooaye-tsmc-eps-120-2026';
INSERT INTO prediction_sources (prediction_id, source_url, source_name)
SELECT id, 'https://www.moneydj.com/interview/xie-jinhe-fed-2026', 'MoneyDJ' FROM predictions WHERE slug = 'demo-xie-fed-3cuts-2026';
INSERT INTO prediction_sources (prediction_id, source_url, source_name)
SELECT id, 'https://www.ettoday.net/news/demo-guo-foxconn', 'ETtoday' FROM predictions WHERE slug = 'demo-guo-foxconn-300-2026';
INSERT INTO prediction_sources (prediction_id, source_url, source_name)
SELECT id, 'https://www.youtube.com/watch?v=demo_leijun_2026', 'YouTube 雷軍' FROM predictions WHERE slug = 'demo-lei-xiaomi-tesla-2026';
INSERT INTO prediction_sources (prediction_id, source_url, source_name)
SELECT id, 'https://news.ltn.com.tw/news/politics/demo-zhu-kmt-2026', '自由時報' FROM predictions WHERE slug = 'demo-zhu-kmt-wins-2026';

-- ── Votes (community_vote predictions) ───────────────────────

-- 柯文哲獲判無罪: 嘴炮 60% / 準了 40%  (30 votes)
INSERT INTO votes (prediction_id, user_id, choice)
SELECT p.id,
       'demo-voter-' || s.n,
       CASE WHEN s.n <= 18 THEN 'bullshit' ELSE 'correct' END
FROM predictions p, generate_series(1, 30) AS s(n)
WHERE p.slug = 'demo-zhu-kmt-innocent-2025'
ON CONFLICT (prediction_id, user_id) DO NOTHING;

-- 重大政治動盪: 準了 55% / 嘴炮 45%  (40 votes)
INSERT INTO votes (prediction_id, user_id, choice)
SELECT p.id,
       'demo-voter-' || s.n,
       CASE WHEN s.n <= 22 THEN 'correct' ELSE 'bullshit' END
FROM predictions p, generate_series(1, 40) AS s(n)
WHERE p.slug = 'demo-tianji-political-2026'
ON CONFLICT (prediction_id, user_id) DO NOTHING;

-- 台積電ADR 200: 嘴炮 70% / 準了 30%  (20 votes)
INSERT INTO votes (prediction_id, user_id, choice)
SELECT p.id,
       'demo-voter-' || s.n,
       CASE WHEN s.n <= 14 THEN 'bullshit' ELSE 'correct' END
FROM predictions p, generate_series(1, 20) AS s(n)
WHERE p.slug = 'demo-liaohua-tsm-adr-200-2025'
ON CONFLICT (prediction_id, user_id) DO NOTHING;

END $$;

-- ── Verify ───────────────────────────────────────────────────
SELECT
  (SELECT COUNT(*) FROM predictors
   WHERE slug IN ('gooaye','tianji-laoshi','xie-jinhe','zhuxueheng',
                  'guo-taiming','tvbs-poll','lei-jun','liaohua-analyst','xuanji-daozhang')
  ) AS predictors,
  (SELECT COUNT(*) FROM predictions WHERE slug LIKE 'demo-%') AS predictions,
  (SELECT COUNT(*) FROM prediction_sources
   WHERE prediction_id IN (SELECT id FROM predictions WHERE slug LIKE 'demo-%')
  ) AS sources,
  (SELECT COUNT(*) FROM votes
   WHERE prediction_id IN (SELECT id FROM predictions WHERE slug LIKE 'demo-%')
  ) AS votes;

-- Expected: 9 | 20 | 18 | 90
