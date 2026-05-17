-- supabase/migrations/002_ai_pipeline.sql

-- ── NEW COLUMNS ON predictions ────────────────────────────────────────────

ALTER TABLE predictions
  ADD COLUMN IF NOT EXISTS submitted_by      TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by        TEXT,
  ADD COLUMN IF NOT EXISTS delete_reason     TEXT,
  ADD COLUMN IF NOT EXISTS voting_started_at TIMESTAMPTZ;

-- ── INDEXES ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_predictions_submitted_by
  ON predictions(submitted_by)
  WHERE submitted_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_predictions_not_deleted
  ON predictions(id)
  WHERE deleted_at IS NULL;

-- ── UPDATE RLS POLICY ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS "public read visible predictions" ON predictions;

CREATE POLICY "public read visible predictions"
  ON predictions FOR SELECT
  USING (
    status IN ('active', 'community_vote', 'resolved')
    AND deleted_at IS NULL
  );

-- ── SIMILARITY SEARCH FUNCTION ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION find_similar_predictions(
  p_predictor_id UUID,
  p_deadline     DATE,
  p_content      TEXT,
  p_exclude_id   UUID DEFAULT NULL
) RETURNS TABLE (
  id      UUID,
  content TEXT,
  deadline DATE,
  status  TEXT,
  sim     REAL
) AS $$
  SELECT
    id,
    content,
    deadline,
    status,
    similarity(content, p_content) AS sim
  FROM predictions
  WHERE predictor_id = p_predictor_id
    AND deadline BETWEEN p_deadline - INTERVAL '30 days'
                     AND p_deadline + INTERVAL '30 days'
    AND deleted_at IS NULL
    AND (p_exclude_id IS NULL OR id != p_exclude_id)
    AND similarity(content, p_content) > 0.7
  ORDER BY sim DESC
  LIMIT 5;
$$ LANGUAGE sql STABLE;
