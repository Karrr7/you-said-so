import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { createServiceClient } from '@/lib/supabase'
import AdminPredictionList from '@/components/AdminPredictionList'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Admin Panel' }

function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  const list = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim()).filter(Boolean)
  return list.includes(email)
}

export default async function AdminPage() {
  const session = await auth()
  if (!isAdmin(session?.user?.email)) redirect('/')

  const db = createServiceClient()
  const { data: predictions } = await db
    .from('predictions')
    .select('id, content, deadline, category, submitted_by, predictor:predictors(name), sources:prediction_sources(source_url, source_name)')
    .eq('status', 'pending_review')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(100)

  const rows = (predictions ?? []).map((p: any) => ({
    ...p,
    predictor: Array.isArray(p.predictor) ? p.predictor[0] : p.predictor,
    sources: Array.isArray(p.sources) ? p.sources : [],
  }))

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-black text-[#e6edf3]">Admin Panel</h1>
        <span className="text-xs text-[#6e7681]">{rows.length} 待審核</span>
      </div>
      <AdminPredictionList predictions={rows as any} />
    </div>
  )
}
