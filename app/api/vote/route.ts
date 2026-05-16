// app/api/vote/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { createServiceClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const predictionId = request.nextUrl.searchParams.get('prediction_id')
  if (!predictionId) {
    return NextResponse.json({ error: 'prediction_id required' }, { status: 400 })
  }

  const session = await auth()
  const db = createServiceClient()

  const { data: votes, error: votesError } = await db
    .from('votes')
    .select('choice, user_id')
    .eq('prediction_id', predictionId)

  if (votesError) return NextResponse.json({ error: votesError.message }, { status: 500 })

  const rows = votes ?? []
  const correct = rows.filter(v => v.choice === 'correct').length
  const bullshit = rows.filter(v => v.choice === 'bullshit').length
  const userVote = session?.user?.email
    ? (rows.find(v => v.user_id === session.user!.email)?.choice ?? null)
    : null

  return NextResponse.json({ correct, bullshit, userVote })
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'login required' }, { status: 401 })
  }

  let body: { prediction_id?: string; choice?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }

  const { prediction_id, choice } = body
  if (!prediction_id || !['correct', 'bullshit'].includes(choice ?? '')) {
    return NextResponse.json({ error: 'prediction_id and choice (correct|bullshit) required' }, { status: 400 })
  }

  const db = createServiceClient()

  const { data: prediction, error: predictionError } = await db
    .from('predictions')
    .select('status')
    .eq('id', prediction_id)
    .single()

  if (predictionError || !prediction || prediction.status !== 'community_vote') {
    return NextResponse.json({ error: 'prediction is not accepting votes' }, { status: 409 })
  }

  const { error } = await db
    .from('votes')
    .upsert(
      { prediction_id, user_id: session.user.email, choice },
      { onConflict: 'prediction_id,user_id' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: updated, error: updatedError } = await db
    .from('votes')
    .select('choice')
    .eq('prediction_id', prediction_id)

  if (updatedError) return NextResponse.json({ error: updatedError.message }, { status: 500 })

  const rows = updated ?? []
  return NextResponse.json({
    correct: rows.filter(v => v.choice === 'correct').length,
    bullshit: rows.filter(v => v.choice === 'bullshit').length,
    userVote: choice,
  })
}
