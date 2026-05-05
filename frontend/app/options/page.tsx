'use client';

import { useWallet } from '@/hooks/useWallet';
import { OptionsChain } from '@/components/OptionsChain';
import { RiskDisclaimer } from '@/components/RiskDisclaimer';

export default function OptionsPage() {
  const { wallet } = useWallet();

  return (
    <div className="space-y-6 animate-enter">
      <RiskDisclaimer variant="options" />
      <div>
        <span className="label text-gold">Black-Scholes Pricing · Weekly Settlement</span>
        <h1 className="font-display text-[24px] sm:text-[30px] font-bold tracking-tight text-ink mt-2 leading-tight">
          Options Chain
        </h1>
        <p className="text-[12px] text-ink-2 mt-2">
          European-style XLM options. Premiums computed live from oracle + IV. Cash settled in USDC.
        </p>
      </div>

      <OptionsChain walletAddress={wallet.address} />
    </div>
  );
}
