'use client';

import { useState } from 'react';
import { useOptions } from '@/hooks/useOptions';
import { BuyOptionModal } from '@/components/BuyOptionModal';
import { Button } from '@/components/ui/button';
import { formatUsdc, formatExpiry, formatCountdown } from '@/lib/utils';
import type { TxResult } from '@/lib/types';

interface OptionsChainProps {
  walletAddress: string | null;
}

export function OptionsChain({ walletAddress }: OptionsChainProps) {
  const { strikes, spotPrice, expiry, settled, loading, error, buyCallOption, buyPutOption, settle } =
    useOptions();

  const [modal, setModal] = useState<{
    strike: bigint;
    optionType: 'Call' | 'Put';
  } | null>(null);

  const [settling, setSettling] = useState(false);
  const [settleResult, setSettleResult] = useState<TxResult | null>(null);

  const handleSettle = async () => {
    if (!walletAddress) return;
    setSettling(true);
    const result = await settle(walletAddress);
    setSettleResult(result);
    setSettling(false);
  };

  const handleBuy = async (buyer: string, strike: bigint, amount: number): Promise<TxResult> => {
    if (modal?.optionType === 'Call') return buyCallOption(buyer, strike, amount);
    return buyPutOption(buyer, strike, amount);
  };

  const now = Math.floor(Date.now() / 1000);
  const isExpired = expiry <= now;
  const sortedStrikes = [...strikes].sort((a, b) => Number(b.strike - a.strike));

  if (loading) {
    return (
      <div className="space-y-5 animate-enter">
        <div className="skeleton h-9 w-full rounded-2xl" />
        <div className="glass-card overflow-hidden">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_80px_1fr_100px] px-5 py-3 border-b border-white/[0.05] last:border-b-0 gap-4">
              <span className="skeleton h-4 w-20" />
              <span className="skeleton h-4 w-16 ml-auto" />
              <span className="skeleton h-4 w-12 mx-auto" />
              <span className="skeleton h-4 w-16 ml-auto" />
              <span className="skeleton h-6 w-20 ml-auto" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-rust/25 bg-rust/[0.06] rounded-2xl p-5 animate-enter">
        <p className="text-sm text-rust">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-enter">

      {/* ── Expiry bar ──────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-5 sm:gap-7">
          <div>
            <span className="label mb-1">Expiry</span>
            <p className="font-data text-[12px] text-white/70 tabular mt-0.5">{formatExpiry(expiry)}</p>
          </div>
          <div>
            <span className="label mb-1">Time Left</span>
            <p className="font-data text-[12px] text-gold tabular mt-0.5 font-semibold">
              {formatCountdown(expiry)}
            </p>
          </div>
          <div>
            <span className="label mb-1">XLM Spot</span>
            <p className="font-data text-[12px] text-white/70 tabular mt-0.5">
              {spotPrice > 0n ? `$${formatUsdc(spotPrice, 4)}` : '—'}
            </p>
          </div>
          {settled && <span className="badge badge-expired">Settled</span>}
        </div>

        {isExpired && !settled && walletAddress && (
          <Button variant="outline" size="sm" onClick={handleSettle} loading={settling}>
            Settle Epoch
          </Button>
        )}
      </div>

      {/* ── Options table ────────────────────────────────────── */}
      {strikes.length === 0 ? (
        <div className="glass-card py-16 text-center animate-enter">
          <p className="text-white/38 text-sm">No active epoch</p>
          <p className="text-white/22 text-[11px] mt-1 font-sans">Waiting for epoch creation at {formatExpiry(expiry)}</p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">

          {/* Column headers */}
          <div className="grid grid-cols-[1fr_1fr_64px_1fr_96px] lg:grid-cols-[1fr_1fr_80px_1fr_120px] bg-white/[0.03] border-b border-white/[0.07]">
            {[
              { label: 'Strike',       cls: '' },
              { label: 'Call Premium', cls: 'text-right text-mint/60' },
              { label: '',             cls: 'text-center' },
              { label: 'Put Premium',  cls: 'text-right text-rust/60' },
              { label: '',             cls: '' },
            ].map((col, i) => (
              <div key={i} className={`px-4 py-3 ${col.cls}`}>
                {col.label && <span className={`label ${col.cls.includes('mint') ? 'text-mint/60' : col.cls.includes('rust') ? 'text-rust/60' : ''}`}>{col.label}</span>}
              </div>
            ))}
          </div>

          {/* Rows */}
          {sortedStrikes.map((row) => {
            const priceDiff = spotPrice > 0n
              ? Math.abs(Number(row.strike - spotPrice)) / Number(spotPrice)
              : 1;
            const isAtm   = priceDiff < 0.005;
            const callItm = row.strike < spotPrice;
            const putItm  = row.strike > spotPrice;
            const callMono = isAtm ? 'ATM' : callItm ? 'ITM' : 'OTM';
            const putMono  = isAtm ? 'ATM' : putItm  ? 'ITM' : 'OTM';

            return (
              <div
                key={row.strike.toString()}
                className={[
                  'row-hover',
                  'grid grid-cols-[1fr_1fr_64px_1fr_96px] lg:grid-cols-[1fr_1fr_80px_1fr_120px]',
                  'border-b border-white/[0.05] last:border-b-0',
                  isAtm ? 'bg-gold/[0.03]' : '',
                ].join(' ')}
              >
                {/* Strike */}
                <div className="px-4 py-3 flex items-center gap-2">
                  <span className={`font-data text-[12px] tabular font-medium ${isAtm ? 'text-gold' : 'text-white/70'}`}>
                    ${formatUsdc(row.strike, 4)}
                  </span>
                  {isAtm && <span className="badge badge-atm hidden sm:inline-flex">ATM</span>}
                </div>

                {/* Call premium */}
                <div className="px-4 py-3 flex items-center justify-end">
                  {row.callPremium > 0n ? (
                    <span className={`font-data text-[12px] tabular ${callItm ? 'text-mint' : 'text-white/30'}`}>
                      ${formatUsdc(row.callPremium, 4)}
                    </span>
                  ) : (
                    <span className="skeleton h-4 w-14" />
                  )}
                </div>

                {/* Moneyness badge */}
                <div className="py-3 flex items-center justify-center gap-1">
                  <span className={`badge hidden sm:inline-flex ${
                    callMono === 'ITM' ? 'badge-itm' :
                    callMono === 'ATM' ? 'badge-atm' : 'badge-otm'
                  }`}>
                    C:{callMono}
                  </span>
                </div>

                {/* Put premium */}
                <div className="px-4 py-3 flex items-center justify-end">
                  {row.putPremium > 0n ? (
                    <span className={`font-data text-[12px] tabular ${putItm ? 'text-rust' : 'text-white/30'}`}>
                      ${formatUsdc(row.putPremium, 4)}
                    </span>
                  ) : (
                    <span className="skeleton h-4 w-14" />
                  )}
                </div>

                {/* Actions */}
                <div className="px-3 py-2.5 flex items-center justify-end gap-1.5">
                  {!settled && !isExpired ? (
                    <>
                      <button
                        onClick={() => setModal({ strike: row.strike, optionType: 'Call' })}
                        className="h-7 px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-mint border border-mint/35 rounded-lg hover:bg-mint/10 hover:border-mint/55 transition-all duration-[120ms] active:scale-95"
                        aria-label={`Buy call at $${formatUsdc(row.strike, 4)}`}
                      >
                        Call
                      </button>
                      <button
                        onClick={() => setModal({ strike: row.strike, optionType: 'Put' })}
                        className="h-7 px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-rust border border-rust/35 rounded-lg hover:bg-rust/10 hover:border-rust/55 transition-all duration-[120ms] active:scale-95"
                        aria-label={`Buy put at $${formatUsdc(row.strike, 4)}`}
                      >
                        Put
                      </button>
                    </>
                  ) : (
                    <span className="text-[10px] text-white/22 uppercase tracking-wider font-sans">
                      {settled ? 'Settled' : 'Expired'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {settleResult?.status === 'failed' && (
        <p className="text-[11px] text-rust">{settleResult.error}</p>
      )}

      {!walletAddress && strikes.length > 0 && !settled && !isExpired && (
        <p className="text-center text-[11px] text-white/22 uppercase tracking-wider py-2 font-sans">
          Connect wallet to trade →
        </p>
      )}

      {modal && (
        <BuyOptionModal
          open={!!modal}
          onClose={() => setModal(null)}
          strike={modal.strike}
          spotPrice={spotPrice}
          expiry={expiry}
          optionType={modal.optionType}
          walletAddress={walletAddress}
          onBuy={handleBuy}
        />
      )}
    </div>
  );
}
