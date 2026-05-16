import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Privacy Policy | YouSaidSo' }

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12 text-sm text-[#94a3b8] space-y-6">
      <h1 className="text-2xl font-black text-[#e6edf3]">Privacy Policy</h1>
      <p className="text-xs text-[#6e7681]">Last updated: 2026-05-17</p>

      <section>
        <h2 className="text-base font-bold text-[#e6edf3] mb-2">1. What We Collect</h2>
        <p>When you sign in with Google, we receive your Google account email address. We store your email as a unique user identifier to associate your votes and prediction submissions with your account.</p>
        <p className="mt-2">We also store your votes (the predictions you voted on and your choice of &quot;correct&quot; or &quot;bullshit&quot;) and any predictions you submit.</p>
      </section>

      <section>
        <h2 className="text-base font-bold text-[#e6edf3] mb-2">2. How We Use It</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>To enforce one vote per user per prediction.</li>
          <li>To enforce the daily submission limit (5 per account).</li>
          <li>To attribute submitted predictions to your account for moderation purposes.</li>
        </ul>
        <p className="mt-2">We do not sell your personal data. We do not send marketing emails.</p>
      </section>

      <section>
        <h2 className="text-base font-bold text-[#e6edf3] mb-2">3. Third-Party Services</h2>
        <p>We use Google OAuth for authentication (governed by <a href="https://policies.google.com/privacy" className="text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">Google&apos;s Privacy Policy</a>). We use Google AdSense to serve advertisements; Google may use cookies to personalise ads based on your browsing history.</p>
        <p className="mt-2">Our database is hosted on Supabase (supabase.com), located in Northeast Asia.</p>
      </section>

      <section>
        <h2 className="text-base font-bold text-[#e6edf3] mb-2">4. Cookies</h2>
        <p>We use a session cookie (set by NextAuth.js) to keep you logged in. Google AdSense may set additional cookies for ad personalisation.</p>
      </section>

      <section>
        <h2 className="text-base font-bold text-[#e6edf3] mb-2">5. Data Deletion</h2>
        <p>To request deletion of your data, email <a href="mailto:hello@yousaidso.tw" className="text-blue-400 hover:underline">hello@yousaidso.tw</a>. We will remove your email address and vote history within 30 days.</p>
      </section>

      <section>
        <h2 className="text-base font-bold text-[#e6edf3] mb-2">6. Contact</h2>
        <p>Questions? Email <a href="mailto:hello@yousaidso.tw" className="text-blue-400 hover:underline">hello@yousaidso.tw</a>.</p>
      </section>
    </div>
  )
}
