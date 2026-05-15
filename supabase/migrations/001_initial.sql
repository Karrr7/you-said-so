-- Enable extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── PREDICTORS ──────────────────────────────────────────────────────────
CREATE TABLE predictors (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name             TEXT NOT NULL,
  slug             TEXT NOT NULL UNIQUE,
  type             TEXT NOT NULL CHECK (type IN (
                     'individual','fortune','official','academic',
                     'polling','media','foreign_media','ceo','ai')),
  category         TEXT NOT NULL CHECK (category IN (
                     'stock','politics','fortune','tech','sports','other')),
  locale           TEXT NOT NULL DEFAULT 'tw' CHECK (locale IN ('tw','jp','us')),
  avatar_url       TEXT,
  wiki_url         TEXT,
  youtube_channel_url TEXT,
  twitter_url      TEXT,
  facebook_url     TEXT,
  threads_url      TEXT,
  website_url      TEXT,
  bullshit_score   NUMERIC(5,2) NOT NULL DEFAULT 0,
  accuracy_rate    NUMERIC(5,2) NOT NULL DEFAULT 0,
  total_predictions INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── PREDICTIONS ──────────────────────────────────────────────────────────
CREATE TABLE predictions (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content      TEXT NOT NULL,
  predictor_id UUID NOT NULL REFERENCES predictors(id) ON DELETE CASCADE,
  locale       TEXT NOT NULL DEFAULT 'tw' CHECK (locale IN ('tw','jp','us')),
  slug         TEXT NOT NULL UNIQUE,
  deadline     DATE NOT NULL,
  category     TEXT NOT NULL CHECK (category IN (
                 'stock','politics','fortune','tech','sports','ai','other')),
  verdict_type TEXT NOT NULL CHECK (verdict_type IN ('objective','subjective')),
  status       TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN (
                 'pending_review','active','community_vote','resolved')),
  verdict      TEXT CHECK (verdict IN ('correct','bullshit')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── PREDICTION SOURCES ───────────────────────────────────────────────────
CREATE TABLE prediction_sources (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prediction_id UUID NOT NULL REFERENCES predictions(id) ON DELETE CASCADE,
  source_url    TEXT NOT NULL,
  source_name   TEXT NOT NULL,
  source_snapshot TEXT,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── PREDICTION RESPONSES ─────────────────────────────────────────────────
CREATE TABLE prediction_responses (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prediction_id UUID NOT NULL REFERENCES predictions(id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  source_url    TEXT,
  source_name   TEXT,
  responded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── VOTES ────────────────────────────────────────────────────────────────
CREATE TABLE votes (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prediction_id UUID NOT NULL REFERENCES predictions(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL,
  choice        TEXT NOT NULL CHECK (choice IN ('correct','bullshit')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(prediction_id, user_id)
);

-- ── SOURCES (crawler config) ─────────────────────────────────────────────
CREATE TABLE sources (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  locale            TEXT NOT NULL CHECK (locale IN ('tw','jp','us')),
  type              TEXT NOT NULL CHECK (type IN ('rss','youtube_channel')),
  name              TEXT NOT NULL,
  url_or_channel_id TEXT NOT NULL,
  active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── REPORTS (content abuse) ──────────────────────────────────────────────
CREATE TABLE reports (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prediction_id UUID NOT NULL REFERENCES predictions(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL,
  reason        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── INDEXES ──────────────────────────────────────────────────────────────
CREATE INDEX idx_predictions_predictor  ON predictions(predictor_id);
CREATE INDEX idx_predictions_status     ON predictions(status);
CREATE INDEX idx_predictions_deadline   ON predictions(deadline);
CREATE INDEX idx_predictions_locale     ON predictions(locale);
CREATE INDEX idx_predictions_slug       ON predictions(slug);
CREATE INDEX idx_predictors_slug        ON predictors(slug);
CREATE INDEX idx_pred_sources_pred_id   ON prediction_sources(prediction_id);
CREATE INDEX idx_pred_responses_pred_id ON prediction_responses(prediction_id);
CREATE INDEX idx_votes_pred_id          ON votes(prediction_id);

-- pg_trgm index for deduplication similarity search
CREATE INDEX idx_predictions_content_trgm ON predictions
  USING gin(content gin_trgm_ops);

-- ── ROW LEVEL SECURITY ───────────────────────────────────────────────────
ALTER TABLE predictors          ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE prediction_sources  ENABLE ROW LEVEL SECURITY;
ALTER TABLE prediction_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE sources             ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports             ENABLE ROW LEVEL SECURITY;

-- Public read (no login required for browsing)
CREATE POLICY "public read predictors"
  ON predictors FOR SELECT USING (true);

CREATE POLICY "public read visible predictions"
  ON predictions FOR SELECT
  USING (status IN ('active','community_vote','resolved'));

CREATE POLICY "public read prediction_sources"
  ON prediction_sources FOR SELECT USING (true);

CREATE POLICY "public read prediction_responses"
  ON prediction_responses FOR SELECT USING (true);

-- All writes go through server-side API routes using service_role key.
-- Client-side direct writes are blocked by the absence of write policies.
