// app/[locale]/layout.tsx
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { routing } from '@/i18n/routing'
import NavBar from '@/components/NavBar'

interface Props {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params

  if (!(routing.locales as readonly string[]).includes(locale)) notFound()

  const messages = await getMessages()

  return (
    <NextIntlClientProvider messages={messages}>
      <NavBar locale={locale} />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-20">
        {children}
      </main>
      <footer className="max-w-2xl mx-auto px-4 pb-8 pt-2 text-center">
        <div className="flex items-center justify-center gap-4 text-[10px] text-[#6e7681]">
          <a href="/privacy" className="hover:text-[#e6edf3]">Privacy Policy</a>
          <span>·</span>
          <a href="/terms" className="hover:text-[#e6edf3]">Terms of Service</a>
          <span>·</span>
          <span>本站判定僅供娛樂參考</span>
        </div>
      </footer>
    </NextIntlClientProvider>
  )
}
