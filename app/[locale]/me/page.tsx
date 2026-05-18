import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { createServiceClient } from '@/lib/supabase'
import MyPredictionList from '@/components/MyPredictionList'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '我的提交' }

interface Props {
  params: Promise<{ locale: string }>
}

export default async function MePage({ params }: Props) {
  const { locale } = await params
  const session = await auth()

  if (!session?.user?.email) {
    redirect(`/${locale}/submit`)
  }

  const db = createServiceClient()
  const { data: predictions } = await db
    .from('predictions')
    .select('id, content, status, deleted_at, deadline, slug, locale, predictor:predictors(name, slug)')
    .eq('submitted_by', session.user.email)
    .order('created_at', { ascending: false })
    .limit(100)

  const rows = (predictions ?? []).map((p: any) => ({
    ...p,
    predictor: Array.isArray(p.predictor) ? p.predictor[0] : p.predictor,
  }))

  return (
    <div>
      <h1 className="text-lg font-black text-[#e6edf3] mb-1 tracking-tight">我的提交</h1>
      <p className="text-[#6e7681] text-xs mb-5">{session.user.email}</p>
      <MyPredictionList predictions={rows as any} locale={locale} />
    </div>
  )
}
