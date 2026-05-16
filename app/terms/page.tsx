import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Terms of Service | YouSaidSo' }

export default function TermsPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12 text-sm text-[#94a3b8] space-y-6">
      <h1 className="text-2xl font-black text-[#e6edf3]">Terms of Service</h1>
      <p className="text-xs text-[#6e7681]">Last updated: 2026-05-17</p>

      <section>
        <h2 className="text-base font-bold text-[#e6edf3] mb-2">1. The Service</h2>
        <p>YouSaidSo（你說的哦）is a website that tracks public predictions made by public figures. All verdicts are based on publicly available data and community voting. <strong className="text-[#e6edf3]">Content is provided for entertainment and reference only and does not constitute legal, financial, or professional advice.</strong></p>
        <p className="mt-2">All verdict determinations are based on publicly available data and community votes. We do not guarantee accuracy. Subjective predictions are decided by community majority — we make no claim that any verdict represents objective truth.</p>
      </section>

      <section>
        <h2 className="text-base font-bold text-[#e6edf3] mb-2">2. User Submissions</h2>
        <p>By submitting a prediction, you confirm that:</p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li>The prediction is a real public statement made by a real person or institution.</li>
          <li>You are attributing it to the correct source (URL + predictor name).</li>
          <li>You are not submitting false, defamatory, or fabricated content.</li>
        </ul>
        <p className="mt-2">We reserve the right to remove any submission without notice.</p>
      </section>

      <section>
        <h2 className="text-base font-bold text-[#e6edf3] mb-2">3. Copyright</h2>
        <p>We store only the prediction sentence (one short quote) and attribution (author, source name, date, URL). We do not reproduce full articles. Brief factual quotations for commentary and analysis purposes are permissible under applicable fair use / fair dealing principles.</p>
      </section>

      <section>
        <h2 className="text-base font-bold text-[#e6edf3] mb-2">4. Prohibited Use</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Submitting fake or fabricated predictions.</li>
          <li>Coordinating vote manipulation.</li>
          <li>Automated scraping of our content without permission.</li>
          <li>Any use that violates applicable law.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-base font-bold text-[#e6edf3] mb-2">5. Disclaimer</h2>
        <p>本站所有判定基於公開資料與社群投票，<strong className="text-[#e6edf3]">僅供娛樂參考，不代表任何法律立場</strong>。對於因使用本站資訊而產生的任何損失，本站不承擔任何責任。</p>
      </section>

      <section>
        <h2 className="text-base font-bold text-[#e6edf3] mb-2">6. Changes</h2>
        <p>We may update these terms at any time. Continued use of the site after changes constitutes acceptance.</p>
      </section>

      <section>
        <h2 className="text-base font-bold text-[#e6edf3] mb-2">7. Contact</h2>
        <p>Questions? Email <a href="mailto:hello@yousaidso.tw" className="text-blue-400 hover:underline">hello@yousaidso.tw</a>.</p>
      </section>
    </div>
  )
}
