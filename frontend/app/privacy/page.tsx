import Link from 'next/link';

export const metadata = { title: 'Privacy Policy — Strix Protocol' };

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto py-10 space-y-8">
      <div>
        <Link href="/" className="label text-ink-3 hover:text-ink-2 transition-colors">
          ← Back
        </Link>
        <h1 className="font-display text-2xl font-bold text-ink mt-4">Privacy Policy</h1>
        <p className="label text-ink-3 mt-1">Last updated: May 2026</p>
      </div>

      <section className="space-y-3">
        <h2 className="font-semibold text-ink">What we collect</h2>
        <p className="text-ink-2 text-sm leading-relaxed">
          Strix Protocol collects the minimum data necessary to operate:
        </p>
        <ul className="text-ink-2 text-sm leading-relaxed space-y-2 list-disc list-inside">
          <li>
            <strong className="text-ink">Stellar wallet address</strong> — your public key, read
            from Freighter when you connect. This is public information on the Stellar blockchain.
          </li>
          <li>
            <strong className="text-ink">On-chain activity</strong> — option purchases, settlements,
            and vault deposits are indexed from public blockchain events for display in your
            Positions tab.
          </li>
          <li>
            <strong className="text-ink">Feedback</strong> — if you submit feedback via the
            feedback form, your message, optional rating, and wallet address (if connected) are
            stored.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-ink">What we do not collect</h2>
        <ul className="text-ink-2 text-sm leading-relaxed space-y-2 list-disc list-inside">
          <li>No name, email address, or any personal identifying information</li>
          <li>No IP addresses stored (requests are not logged beyond in-memory rate limiting)</li>
          <li>No cookies or tracking pixels</li>
          <li>No private keys — your keys never leave Freighter</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-ink">Data storage</h2>
        <p className="text-ink-2 text-sm leading-relaxed">
          Indexed event data is stored in a SQLite database on the backend server. Feedback
          submissions are stored in the same database. This data is not shared with third parties.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-ink">Blockchain data</h2>
        <p className="text-ink-2 text-sm leading-relaxed">
          All on-chain activity is permanently and publicly recorded on the Stellar blockchain.
          This protocol cannot delete or modify your on-chain history.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-ink">Contact</h2>
        <p className="text-ink-2 text-sm leading-relaxed">
          For privacy questions, open an issue on the project&apos;s GitHub repository.
        </p>
      </section>

      <div className="pt-4 border-t border-surface-border">
        <Link href="/terms" className="label text-ink-3 hover:text-ink-2 transition-colors">
          Terms of Service →
        </Link>
      </div>
    </div>
  );
}
