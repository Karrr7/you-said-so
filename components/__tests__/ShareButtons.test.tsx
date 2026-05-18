import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ShareButtons from '../ShareButtons'

const writeText = vi.fn().mockResolvedValue(undefined)
Object.assign(navigator, { clipboard: { writeText } })

const defaultProps = {
  url: 'https://yousaidso.tw/tw/predictions/test-slug',
  content: '台積電年底破1500',
  predictorName: '股癌',
  verdict: 'bullshit' as const,
}

describe('ShareButtons', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders LINE share link with encoded URL', () => {
    render(<ShareButtons {...defaultProps} />)
    const lineLink = screen.getByRole('link', { name: /LINE/i })
    expect(lineLink).toBeDefined()
    expect((lineLink as HTMLAnchorElement).href).toContain('social-plugins.line.me')
    expect((lineLink as HTMLAnchorElement).href).toContain(
      encodeURIComponent('https://yousaidso.tw/tw/predictions/test-slug'),
    )
  })

  it('renders X/Twitter share link', () => {
    render(<ShareButtons {...defaultProps} />)
    const xLink = screen.getByRole('link', { name: /^X$/i })
    expect((xLink as HTMLAnchorElement).href).toContain('twitter.com/intent/tweet')
  })

  it('copies URL to clipboard on button click', async () => {
    render(<ShareButtons {...defaultProps} />)
    const copyBtn = screen.getByRole('button', { name: /複製/i })
    fireEvent.click(copyBtn)
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('https://yousaidso.tw/tw/predictions/test-slug')
    })
  })

  it('shows "已複製" after copy', async () => {
    render(<ShareButtons {...defaultProps} />)
    const copyBtn = screen.getByRole('button', { name: /複製/i })
    fireEvent.click(copyBtn)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /已複製/i })).toBeDefined()
    })
  })
})
