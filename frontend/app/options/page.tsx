'use client';

import { useWallet } from '@/hooks/useWallet';
import { OptionsChain } from '@/components/OptionsChain';
import { RiskDisclaimer } from '@/components/RiskDisclaimer';

function SparkSvg({ size = 100 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden>
      <path d="M50 0 L53.5 46.5 L100 50 L53.5 53.5 L50 100 L46.5 53.5 L0 50 L46.5 46.5 Z" fill="white" />
    </svg>
  );
}

export default function OptionsPage() {
  const { wallet } = useWallet();

  return (
    <div className="space-y-8 animate-enter">

      {/* ── Page header ─────────────────────────────────────── */}
      <section className="relative">
        {/* Accent spark */}
        <div className="pointer-events-none select-none absolute -top-4 right-0 opacity-[0.06]" aria-hidden>
          <div className="star-rotate"><SparkSvg size={80} /></div>
        </div>

        <RiskDisclaimer variant="options" />

        <div className="flex items-center gap-2 mb-4">
          <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
          <span className="label text-white/20 tracking-[0.14em]">Black-Scholes Pricing · Weekly Settlement</span>
        </div>

        <h1 className="font-display leading-[0.9] tracking-[-0.03em] text-white mb-4">
          <span className="block text-[clamp(32px,5vw,52px)] font-bold">XLM Options</span>
          <span className="block text-[clamp(32px,5vw,52px)] font-light text-white/25">Live Chain.</span>
        </h1>

        <p className="text-[12px] text-white/38 font-sans leading-relaxed max-w-md">
          European-style calls and puts. Premiums computed live from oracle + IV. Cash settled in USDC every Friday.
        </p>
      </section>

      {/* ── Options chain ───────────────────────────────────── */}
      <OptionsChain walletAddress={wallet.address} />
    </div>
  );
}
