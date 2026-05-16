// components/NavBar.tsx
import Link from 'next/link'
import { auth } from '@/auth'

interface Props { locale: string }

export default async function NavBar({ locale }: Props) {
  const session = await auth()

  return (
    <header className="sticky top-0 z-50 bg-[#0d1117]/90 backdrop-blur border-b border-[#21262d]">
      <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">

        {/* Logo */}
        <Link href={`/${locale}`} className="flex items-center gap-2.5 group">
          <div
            className="relative w-8 h-8 flex items-center justify-center"
            style={{ filter: 'url(#wobble)' }}
          >
            {/* Yellow shadow layer */}
            <div className="absolute inset-0 translate-x-[2px] translate-y-[2px] bg-[#f5a623] border-2 border-[#0a0c10] rounded-lg" />
            {/* White bubble */}
            <div className="relative bg-[#fffef0] border-2 border-[#0a0c10] rounded-lg w-full h-full flex items-center justify-center">
              <span className="font-black text-[#0a0c10] text-sm leading-none" style={{ fontFamily: 'var(--font-inter)' }}>Y</span>
            </div>
          </div>
          <div>
            <div className="font-black text-[#e6edf3] text-lg leading-none tracking-wide">
              YouSaidSo
            </div>
            <div className="text-[10px] text-[#6e7681] leading-none mt-0.5">你說的哦</div>
          </div>
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-4">
          <Link href={`/${locale}/leaderboard`} className="text-sm text-[#6e7681] hover:text-[#e6edf3] transition-colors">
            排行榜
          </Link>
          {session ? (
            <>
              <Link href={`/${locale}/submit`} className="text-sm text-[#6e7681] hover:text-[#e6edf3] transition-colors">
                提交預言
              </Link>
              <form action={async () => {
                'use server'
                const { signOut } = await import('@/auth')
                await signOut()
              }}>
                <button type="submit" className="text-sm text-[#6e7681] hover:text-[#e6edf3] transition-colors">
                  登出
                </button>
              </form>
            </>
          ) : (
            <form action={async () => {
              'use server'
              const { signIn } = await import('@/auth')
              await signIn('google')
            }}>
              <button
                type="submit"
                className="text-xs font-bold px-3 py-1.5 bg-[#fffef0] text-[#0a0c10] border-2 border-[#0a0c10] rounded-md"
                style={{ boxShadow: '2px 2px 0 #f5a623, 2px 2px 0 1px #0a0c10' }}
              >
                登入
              </button>
            </form>
          )}
        </nav>

      </div>
    </header>
  )
}
