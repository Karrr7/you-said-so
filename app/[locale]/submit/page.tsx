import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import SubmitForm from '@/components/SubmitForm'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '提交預言' }

interface Props {
  params: Promise<{ locale: string }>
}

export default async function SubmitPage({ params }: Props) {
  const { locale } = await params
  const session = await auth()

  if (!session) {
    redirect(`/api/auth/signin?callbackUrl=/${locale}/submit`)
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-lg font-black text-[#e6edf3] mb-1">提交預言</h1>
      <p className="text-xs text-[#6e7681] mb-6">貼上新聞連結，我們會嘗試自動擷取預言內容。</p>
      <SubmitForm locale={locale} />
    </div>
  )
}
