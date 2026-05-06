import Link from 'next/link';
import { ACTIVE_NETWORK } from '@/lib/constants';

export const metadata = { title: 'Terms of Service — Strix Protocol' };

export default function TermsPage() {
  const network = ACTIVE_NETWORK === 'mainnet' ? 'Mainnet' : 'Testnet';

  return (
    <div className="max-w-2xl mx-auto py-10 space-y-8">
      <div>
        <Link href="/" className="label text-ink-3 hover:text-ink-2 transition-colors">
          ← Back
        </Link>
        <h1 className="font-display text-2xl font-bold text-ink mt-4">Terms of Service</h1>
        <p className="label text-ink-3 mt-1">Last updated: May 2026 · {network}</p>
      </div>

      <section className="space-y-3">
        <h2 className="font-semibold text-ink">1. Acceptance</h2>
        <p className="text-ink-2 text-sm leading-relaxed">
          By accessing or using Strix Protocol (the &quot;Protocol&quot;) you agree to be bound by
          these Terms of Service. If you do not agree, do not use the Protocol.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-ink">2. Nature of the Protocol</h2>
        <p className="text-ink-2 text-sm leading-relaxed">
          Strix Protocol is experimental, open-source software deployed on the Stellar blockchain.
          It is provided &quot;as is&quot; and &quot;as available&quot; without warranty of any kind.
          Smart contracts are immutable once deployed; bugs or exploits cannot be patched retroactively.
        </p>
        {ACTIVE_NETWORK !== 'mainnet' && (
          <p className="text-sm leading-relaxed px-3 py-2 rounded border border-gold/30 text-gold/80 bg-gold/5">
            You are currently on <strong>Testnet</strong>. No real funds are at risk. Testnet tokens
            have no monetary value.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-ink">3. Risk Disclosure</h2>
        <ul className="text-ink-2 text-sm leading-relaxed space-y-2 list-disc list-inside">
          <li>Options can expire worthless. Premium paid to purchase an option is entirely at risk.</li>
          <li>LP capital deposited in the vault backs option positions. It may not be fully liquid during active epochs.</li>
          <li>Oracle prices used for settlement are provided by Reflector and may deviate from market prices.</li>
          <li>Smart contract bugs, oracle failures, or network congestion could result in partial or total loss of funds.</li>
          <li>Crypto assets are highly volatile. Past performance does not indicate future results.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-ink">4. Eligibility</h2>
        <p className="text-ink-2 text-sm leading-relaxed">
          You must be of legal age in your jurisdiction to use financial services. You represent that
          your use of the Protocol complies with all applicable laws and regulations in your
          jurisdiction, including any restrictions on trading derivatives.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-ink">5. No Financial Advice</h2>
        <p className="text-ink-2 text-sm leading-relaxed">
          Nothing on this platform constitutes financial, investment, legal, or tax advice.
          All trading decisions are made solely by you.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-ink">6. Limitation of Liability</h2>
        <p className="text-ink-2 text-sm leading-relaxed">
          To the maximum extent permitted by law, the developers and contributors of Strix Protocol
          shall not be liable for any direct, indirect, incidental, or consequential losses arising
          from your use of the Protocol.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-ink">7. Changes</h2>
        <p className="text-ink-2 text-sm leading-relaxed">
          These terms may be updated at any time. Continued use of the Protocol after changes
          constitutes acceptance of the revised terms.
        </p>
      </section>

      <div className="pt-4 border-t border-surface-border">
        <Link href="/privacy" className="label text-ink-3 hover:text-ink-2 transition-colors">
          Privacy Policy →
        </Link>
      </div>
    </div>
  );
}
