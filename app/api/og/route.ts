import { ImageResponse } from '@vercel/og'
import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const slug = searchParams.get('slug')

  let content = 'YouSaidSo 你說的哦'
  let predictorName = ''
  let verdict: string | null = null

  if (slug) {
    const db = createServiceClient()
    const { data } = await db
      .from('predictions')
      .select('content, verdict, predictor:predictors(name)')
      .eq('slug', slug)
      .single()

    if (data) {
      content = data.content
      verdict = data.verdict
      const pred = data.predictor
      predictorName = Array.isArray(pred) ? (pred[0]?.name ?? '') : ((pred as any)?.name ?? '')
    }
  }

  const isBullshit = verdict === 'bullshit'
  const isCorrect = verdict === 'correct'
  const hasVerdict = isBullshit || isCorrect

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          background: '#0d1117',
          padding: '56px 60px',
          fontFamily: 'sans-serif',
        }}
      >
        {predictorName ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
            <span style={{ fontSize: 28, fontWeight: 900, color: '#e6edf3' }}>
              {predictorName}
            </span>
            {hasVerdict && (
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: isBullshit ? '#ef4444' : '#22c55e',
                  border: `3px solid ${isBullshit ? '#ef4444' : '#22c55e'}`,
                  borderRadius: 6,
                  padding: '4px 12px',
                  transform: 'rotate(-4deg)',
                  display: 'flex',
                }}
              >
                {isBullshit ? '💨 嘴炮' : '🎯 準了'}
              </span>
            )}
          </div>
        ) : null}

        <div
          style={{
            display: 'flex',
            flex: 1,
            background: '#fffef0',
            border: '4px solid #0a0c10',
            borderRadius: 24,
            padding: '36px 44px',
            boxShadow: '8px 8px 0 #f5a623, 8px 8px 0 2px #0a0c10',
            alignItems: 'center',
          }}
        >
          <p
            style={{
              fontSize: content.length > 50 ? 32 : 38,
              fontWeight: 700,
              color: '#0a0c10',
              margin: 0,
              lineHeight: 1.4,
            }}
          >
            {`「${content.slice(0, 80)}${content.length > 80 ? '…' : ''}」`}
          </p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
          <span style={{ fontSize: 18, color: '#6e7681', fontWeight: 700 }}>
            YouSaidSo 你說的哦
          </span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}
