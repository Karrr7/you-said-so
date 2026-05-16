// components/__tests__/VoteBar.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import VoteBar from '../VoteBar'

const mockFetch = vi.fn()
global.fetch = mockFetch

beforeEach(() => {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ correct: 3, bullshit: 7, userVote: null }),
  })
})

describe('VoteBar', () => {
  it('renders vote buttons', async () => {
    render(<VoteBar predictionId="pred-1" initialCounts={{ correct: 3, bullshit: 7 }} />)
    expect(await screen.findByText(/嘴炮/)).toBeInTheDocument()
    expect(screen.getByText(/準了/)).toBeInTheDocument()
  })

  it('shows progress bar when total > 0', async () => {
    render(<VoteBar predictionId="pred-1" initialCounts={{ correct: 3, bullshit: 7 }} />)
    await waitFor(() => expect(screen.getByText(/嘴炮 70%/)).toBeInTheDocument())
    expect(screen.getByText(/準了 30%/)).toBeInTheDocument()
  })

  it('highlights user vote after mount fetches userVote', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ correct: 3, bullshit: 7, userVote: 'bullshit' }),
    })
    render(<VoteBar predictionId="pred-1" initialCounts={{ correct: 3, bullshit: 7 }} />)
    await waitFor(() => {
      const btn = screen.getByText(/嘴炮/).closest('button')
      expect(btn?.className).toMatch(/red/)
    })
  })

  it('calls POST /api/vote on button click', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ correct: 3, bullshit: 7, userVote: null }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ correct: 3, bullshit: 8, userVote: 'bullshit' }) })

    render(<VoteBar predictionId="pred-1" initialCounts={{ correct: 3, bullshit: 7 }} />)
    await waitFor(() => screen.getByText(/嘴炮/))

    fireEvent.click(screen.getByText(/嘴炮/).closest('button')!)
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith('/api/vote', expect.objectContaining({ method: 'POST' })))
  })
})
