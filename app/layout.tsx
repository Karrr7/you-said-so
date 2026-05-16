import type { Metadata } from 'next'
import { Noto_Sans_TC, Inter } from 'next/font/google'
import './globals.css'

const notoSansTC = Noto_Sans_TC({
  subsets: ['latin'],
  weight: ['400', '500', '700', '900'],
  variable: '--font-noto',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: { default: 'YouSaidSo 你說的哦', template: '%s | YouSaidSo' },
  description: '追蹤各路大師預言準確率，是智慧還是嘴炮？',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html suppressHydrationWarning>
      <body className={`${notoSansTC.variable} ${inter.variable} bg-[#0d1117] text-[#e6edf3] antialiased`}>
        {/* Hidden SVG filter — referenced by comic bubble components */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="absolute w-0 h-0 overflow-hidden"
          aria-hidden="true"
        >
          <defs>
            <filter id="wobble" x="-6%" y="-10%" width="116%" height="128%">
              <feTurbulence type="fractalNoise" baseFrequency="0.028" numOctaves="4" seed="7" result="noise" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.2" xChannelSelector="R" yChannelSelector="G" />
            </filter>
            <filter id="wobble-strong" x="-8%" y="-12%" width="120%" height="132%">
              <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="5" seed="12" result="noise" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="3.5" xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </defs>
        </svg>
        {children}
      </body>
    </html>
  )
}
