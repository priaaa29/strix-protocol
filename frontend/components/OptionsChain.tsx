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
  const sortedStrikes = [...strikes].sort((a, b) => Number(b.strike - a.strike)); // highest strike first

  /* ── Loading skeleton ──────────────────────────────────── */
  if (loading) {
    return (
      <div className="space-y-5 animate-enter">
        <div className="skeleton h-9 w-full rounded-sm" />
        <div className="border border-surface-border rounded-sm overflow-hidden">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_80px_1fr_100px] px-5 py-3 border-b border-surface-border last:border-b-0 gap-4">
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
      <div className="border border-rust-border bg-rust-bg rounded-sm p-5 animate-enter">
        <p className="text-sm text-rust">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-enter">

      {/* ── Expiry bar ──────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <div>
            <span className="label">Expiry</span>
            <p className="text-sm text-ink font-mono mt-0.5 tabular">{formatExpiry(expiry)}</p>
          </div>
          <div>
            <span className="label">Time Left</span>
            <p className="text-sm text-gold font-mono mt-0.5 tabular font-semibold">
              {formatCountdown(expiry)}
            </p>
          </div>
          <div>
            <span className="label">XLM Spot</span>
            <p className="text-sm text-ink font-mono mt-0.5 tabular">
              {spotPrice > 0n ? `$${formatUsdc(spotPrice, 4)}` : '—'}
            </p>
          </div>
          {settled && (
            <span className="badge badge-expired">Settled</span>
          )}
        </div>

        {isExpired && !settled && walletAddress && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleSettle}
            loading={settling}
          >
            Settle Epoch
          </Button>
        )}
      </div>

      {/* ── Options table ────────────────────────────────── */}
      {strikes.length === 0 ? (
        <div className="border border-surface-border rounded-sm py-16 text-center animate-enter">
          <p className="text-ink-2 text-sm">No active epoch</p>
          <p className="text-ink-3 text-[11px] mt-1">Waiting for epoch creation at {formatExpiry(expiry)}</p>
        </div>
      ) : (
        <div className="border border-surface-border rounded-sm overflow-hidden">

          {/* Column headers */}
          <div className="grid grid-cols-[1fr_1fr_64px_1fr_96px] lg:grid-cols-[1fr_1fr_80px_1fr_120px] bg-surface-over border-b border-surface-border">
            {[
              { label: 'Strike',       cls: '' },
              { label: 'Call Premium', cls: 'text-right text-mint' },
              { label: '',             cls: 'text-center' },
              { label: 'Put Premium',  cls: 'text-right text-rust' },
              { label: '',             cls: '' },
            ].map((col, i) => (
              <div key={i} className={`px-4 py-2.5 ${col.cls}`}>
                {col.label && <span className="label">{col.label}</span>}
              </div>
            ))}
          </div>

          {/* Rows */}
          {sortedStrikes.map((row) => {
            const priceDiff = spotPrice > 0n
              ? Math.abs(Number(row.strike - spotPrice)) / Number(spotPrice)
              : 1;
            const isAtm    = priceDiff < 0.005;
            const callItm  = row.strike < spotPrice;
            const putItm   = row.strike > spotPrice;
            const callMono = isAtm ? 'ATM' : callItm ? 'ITM' : 'OTM';
            const putMono  = isAtm ? 'ATM' : putItm  ? 'ITM' : 'OTM';

            return (
              <div
                key={row.strike.toString()}
                className={[
                  'row-hover',
                  'grid grid-cols-[1fr_1fr_64px_1fr_96px] lg:grid-cols-[1fr_1fr_80px_1fr_120px]',
                  'border-b border-surface-border last:border-b-0',
                  isAtm ? 'bg-gold/[0.035]' : '',
                ].join(' ')}
              >
                {/* Strike */}
                <div className="px-4 py-3 flex items-center gap-2">
                  <span className={`font-mono text-sm tabular font-medium ${isAtm ? 'text-gold' : 'text-ink'}`}>
                    ${formatUsdc(row.strike, 4)}
                  </span>
                  {isAtm && (
                    <span className="badge badge-atm hidden sm:inline-flex">ATM</span>
                  )}
                </div>

                {/* Call premium */}
                <div className="px-4 py-3 flex items-center justify-end">
                  {row.callPremium > 0n ? (
                    <span className={`font-mono text-sm tabular ${callItm ? 'text-mint' : 'text-ink-2'}`}>
                      ${formatUsdc(row.callPremium, 4)}
                    </span>
                  ) : (
                    <span className="skeleton h-4 w-14" />
                  )}
                </div>

                {/* Moneyness */}
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
                    <span className={`font-mono text-sm tabular ${putItm ? 'text-rust' : 'text-ink-2'}`}>
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
                        className="h-7 px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-mint border border-mint/40 rounded-sm hover:bg-mint/10 hover:border-mint/60 transition-all duration-[120ms] active:scale-95"
                        aria-label={`Buy call at $${formatUsdc(row.strike, 4)}`}
                      >
                        Call
                      </button>
                      <button
                        onClick={() => setModal({ strike: row.strike, optionType: 'Put' })}
                        className="h-7 px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-rust border border-rust/40 rounded-sm hover:bg-rust/10 hover:border-rust/60 transition-all duration-[120ms] active:scale-95"
                        aria-label={`Buy put at $${formatUsdc(row.strike, 4)}`}
                      >
                        Put
                      </button>
                    </>
                  ) : (
                    <span className="text-[10px] text-ink-3 uppercase tracking-wider">
                      {settled ? 'Settled' : 'Expired'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Settle error feedback */}
      {settleResult?.status === 'failed' && (
        <p className="text-[11px] text-rust">{settleResult.error}</p>
      )}

      {/* Connect prompt */}
      {!walletAddress && strikes.length > 0 && !settled && !isExpired && (
        <p className="text-center text-[11px] text-ink-3 uppercase tracking-wider py-2">
          Connect wallet to trade →
        </p>
      )}

      {/* ── Buy modal ──────────────────────────────────── */}
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
