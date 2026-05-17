// app/api/predictions/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { createServiceClient } from '@/lib/supabase'

function isAdmin(email: string): boolean {
  const list = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim()).filter(Boolean)
  return list.includes(email)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'login required' }, { status: 401 })
  }
  const userEmail = session.user.email
  const { id } = await params

  const db = createServiceClient()

  const { data: prediction } = await db
    .from('predictions')
    .select('id, status, submitted_by, deleted_at')
    .eq('id', id)
    .single()

  if (!prediction) {
    return NextResponse.json({ error: 'prediction not found' }, { status: 404 })
  }

  if (prediction.deleted_at) {
    return NextResponse.json({ error: 'already deleted' }, { status: 409 })
  }

  const admin = isAdmin(userEmail)
  const isOwner = prediction.submitted_by === userEmail

  if (!admin && !isOwner) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  if (!admin && prediction.status !== 'pending_review') {
    return NextResponse.json(
      { error: 'can only withdraw predictions that are still pending review' },
      { status: 409 }
    )
  }

  let reason = 'User withdrew submission'
  if (admin) {
    let body: { reason?: string } = {}
    try { body = await request.json() } catch { /* no body is ok for safety */ }
    if (!body.reason?.trim()) {
      return NextResponse.json({ error: 'delete_reason required for admin deletes' }, { status: 400 })
    }
    reason = body.reason.trim()
  }

  const { error } = await db.from('predictions').update({
    deleted_at: new Date().toISOString(),
    deleted_by: userEmail,
    delete_reason: reason,
  }).eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
