import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { createServiceClient } from '@/lib/supabase'

function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  const list = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim()).filter(Boolean)
  return list.includes(email)
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!isAdmin(session?.user?.email)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { id } = await params
  const db = createServiceClient()

  const { error } = await db
    .from('predictions')
    .update({ status: 'active' })
    .eq('id', id)
    .eq('status', 'pending_review')

  if (error) return NextResponse.json({ error: 'update failed' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
