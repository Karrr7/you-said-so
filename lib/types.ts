// lib/types.ts

export type Locale = 'tw' | 'jp' | 'us'

export type PredictorType =
  | 'individual' | 'fortune' | 'official' | 'academic'
  | 'polling' | 'media' | 'foreign_media' | 'ceo' | 'ai'

export type Category =
  | 'stock' | 'politics' | 'fortune' | 'tech' | 'sports' | 'ai' | 'other'

export type VerdictType = 'objective' | 'subjective'

export type PredictionStatus =
  | 'pending_review' | 'active' | 'community_vote' | 'resolved'

export type Verdict = 'correct' | 'bullshit' | null

export interface Predictor {
  id: string
  name: string
  slug: string
  type: PredictorType
  category: Category
  locale: Locale
  avatar_url: string | null
  wiki_url: string | null
  youtube_channel_url: string | null
  twitter_url: string | null
  facebook_url: string | null
  threads_url: string | null
  website_url: string | null
  bullshit_score: number
  accuracy_rate: number
  total_predictions: number
  created_at: string
}

export interface Prediction {
  id: string
  content: string
  predictor_id: string
  locale: Locale
  slug: string
  deadline: string
  category: Category
  verdict_type: VerdictType
  status: PredictionStatus
  verdict: Verdict
  created_at: string
  submitted_by: string | null
  deleted_at: string | null
  deleted_by: string | null
  delete_reason: string | null
  voting_started_at: string | null
}

export interface PredictionWithRelations extends Prediction {
  predictor: Predictor
  sources: PredictionSource[]
  responses: PredictionResponse[]
  vote_counts: { correct: number; bullshit: number }
}

export interface PredictionSource {
  id: string
  prediction_id: string
  source_url: string
  source_name: string
  source_snapshot: string | null
  discovered_at: string
}

export interface PredictionResponse {
  id: string
  prediction_id: string
  content: string
  source_url: string | null
  source_name: string | null
  responded_at: string
}

export interface Vote {
  id: string
  prediction_id: string
  user_id: string
  choice: 'correct' | 'bullshit'
  created_at: string
}

export interface VoteCounts {
  correct: number
  bullshit: number
}
