// components/__tests__/PredictionCard.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import PredictionCard from '../PredictionCard'
import type { PredictionWithRelations } from '@/lib/types'

vi.mock('next/link', () => ({ default: ({ children, href }: any) => <a href={href}>{children}</a> }))

const basePrediction: PredictionWithRelations = {
  id: '1',
  content: '台積電年底前一定站上 1,500 元',
  predictor_id: 'p1',
  locale: 'tw',
  slug: 'gooaye-tsmc-1500-2025',
  deadline: '2025-12-31',
  category: 'stock',
  verdict_type: 'objective',
  status: 'active',
  verdict: null,
  created_at: '2025-01-01T00:00:00Z',
  predictor: {
    id: 'p1', name: '股癌 Gooaye', slug: 'gooaye', type: 'individual',
    category: 'stock', locale: 'tw', avatar_url: null, wiki_url: null,
    youtube_channel_url: null, twitter_url: null, facebook_url: null,
    threads_url: null, website_url: null, bullshit_score: 62,
    accuracy_rate: 38, total_predictions: 38, created_at: '2025-01-01T00:00:00Z',
  },
  sources: [],
  responses: [],
  vote_counts: { correct: 0, bullshit: 0 },
}

describe('PredictionCard', () => {
  it('shows prediction content in speech bubble', () => {
    render(<PredictionCard prediction={basePrediction} />)
    expect(screen.getByText(/台積電年底前一定站上 1,500 元/)).toBeInTheDocument()
  })

  it('shows predictor name', () => {
    render(<PredictionCard prediction={basePrediction} />)
    expect(screen.getByText('股癌 Gooaye')).toBeInTheDocument()
  })

  it('shows 嘴炮 stamp when verdict is bullshit', () => {
    render(<PredictionCard prediction={{ ...basePrediction, status: 'resolved', verdict: 'bullshit' }} />)
    expect(screen.getByTestId('verdict-stamp')).toHaveTextContent('嘴炮')
  })

  it('shows 準了 stamp when verdict is correct', () => {
    render(<PredictionCard prediction={{ ...basePrediction, status: 'resolved', verdict: 'correct' }} />)
    expect(screen.getByTestId('verdict-stamp')).toHaveTextContent('準了')
  })

  it('shows vote bar when status is community_vote', () => {
    render(<PredictionCard prediction={{
      ...basePrediction,
      status: 'community_vote',
      vote_counts: { correct: 300, bullshit: 700 },
    }} />)
    expect(screen.getByText(/嘴炮 70%/)).toBeInTheDocument()
  })

  it('shows no stamp when status is active', () => {
    render(<PredictionCard prediction={basePrediction} />)
    expect(screen.queryByTestId('verdict-stamp')).toBeNull()
  })
})
