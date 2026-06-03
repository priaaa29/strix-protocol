'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogHeader } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TransactionStatus } from '@/components/TransactionStatus';
import { formatUsdc, formatExpiry, formatUsdcDollar } from '@/lib/utils';
import { calcPremium } from '@/lib/black-scholes';
import { quoteLivePremium } from '@/lib/soroban';
import type { TxResult } from '@/lib/types';

interface BuyOptionModalProps {
  open: boolean;
  onClose: () => void;
  strike: bigint;
  spotPrice: bigint;
  expiry: number;
  optionType: 'Call' | 'Put';
  walletAddress: string | null;
  onBuy: (
    buyer: string,
    strike: bigint,
    amount: number,
    sponsored?: boolean,
    onProgress?: (next: TxResult) => void,
  ) => Promise<TxResult>;
}

export function BuyOptionModal({
  open, onClose, strike, spotPrice, expiry, optionType, walletAddress, onBuy,
}: BuyOptionModalProps) {
  const [amount, setAmount]         = useState('1');
  const [txResult, setTxResult]     = useState<TxResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sponsored, setSponsored]   = useState(true);
  const [livePremium, setLivePremium] = useState<bigint | null>(null);
  const [quoting, setQuoting]         = useState(false);

  useEffect(() => {
    if (open) {
      setAmount('1');
      setTxResult(null);
      setSubmitting(false);
      setSponsored(true);
      setLivePremium(null);
    }
  }, [open]);

  const amountNum      = Math.max(1, Math.floor(Number(amount) || 1));
  // Client-side Black-Scholes estimate — used as an instant placeholder
  // while the on-chain quote is loading and as a fallback if simulation
  // throws.
  const previewPremium = calcPremium(optionType, spotPrice, strike, expiry, amountNum);
  // Effective premium the user will pay = live quote when we have it, else
  // the client estimate. Per-contract value uses whichever is effective.
  const effectivePremium = livePremium ?? previewPremium;
  const perContract = effectivePremium / BigInt(Math.max(amountNum, 1));

  // Drift between local estimate and the on-chain quote — surfaced to the
  // user so they're not surprised when the contract charges a different
  // amount than the modal initially showed.
  const driftBps =
    livePremium && previewPremium > 0n
      ? Number(((livePremium - previewPremium) * 10_000n) / previewPremium)
      : null;
  const driftAbsBps = driftBps !== null ? Math.abs(driftBps) : 0;

  // Refresh the on-chain premium whenever the modal opens or the user
  // changes amount. Debounce by 400ms so we don't spam the RPC on
  // keystrokes.
  useEffect(() => {
    if (!open) return;
    setQuoting(true);
    const id = setTimeout(async () => {
      try {
        const q = await quoteLivePremium(optionType, strike, expiry, amountNum);
        // Only apply if the modal is still open with the same parameters
        setLivePremium(q > 0n ? q : null);
      } catch {
        setLivePremium(null);
      } finally {
        setQuoting(false);
      }
    }, 400);
    return () => { clearTimeout(id); setQuoting(false); };
  }, [open, optionType, strike, expiry, amountNum]);

  const isCallItm  = optionType === 'Call' && strike < spotPrice;
  const isPutItm   = optionType === 'Put'  && strike > spotPrice;
  const moneyness  = (isCallItm || isPutItm) ? 'ITM' : strike === spotPrice ? 'ATM' : 'OTM';
  const isCall     = optionType === 'Call';

  const handleBuy = async () => {
    if (!walletAddress) return;
    setSubmitting(true);
    setTxResult({ hash: '', status: 'pending' });
    const result = await onBuy(walletAddress, strike, amountNum, sponsored, (next) => setTxResult(next));
    setTxResult(result);
    setSubmitting(false);
    if (result.status === 'confirmed') setTimeout(onClose, 2000);
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader
        title={`Buy ${optionType} Option`}
        subtitle={`${formatExpiry(expiry)} · Strike $${formatUsdc(strike, 4)}`}
        onClose={onClose}
      />

      <div className="px-5 py-4 space-y-4">

        {/* Option summary */}
        <div className="border border-white/[0.08] rounded-2xl overflow-hidden">
          {[
            { label: 'Type',      value: optionType,              isType: true  },
            { label: 'Strike',    value: `$${formatUsdc(strike, 4)}` },
            { label: 'Spot',      value: `$${formatUsdc(spotPrice, 4)}` },
            { label: 'Moneyness', value: moneyness,               isMoney: true },
            { label: 'Expiry',    value: formatExpiry(expiry) },
          ].map(({ label, value, isType, isMoney }) => (
            <div key={label} className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06] last:border-b-0 bg-white/[0.01]">
              <span className="label">{label}</span>
              {isType ? (
                <span className={`badge ${isCall ? 'badge-itm' : 'badge-otm'}`}>{value}</span>
              ) : isMoney ? (
                <span className={`badge ${moneyness === 'ITM' ? 'badge-itm' : moneyness === 'ATM' ? 'badge-atm' : 'badge-otm'}`}>
                  {value}
                </span>
              ) : (
                <span className="font-data text-[12px] text-white/70 tabular">{value}</span>
              )}
            </div>
          ))}
        </div>

        {/* Amount input */}
        <Input
          label="Contracts (1 contract = 1 XLM)"
          type="number"
          min="1"
          step="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          hint="Each contract covers 1 XLM at the strike price"
        />

        {/* Fee sponsorship toggle */}
        <button
          type="button"
          onClick={() => setSponsored(!sponsored)}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all duration-[120ms] ${
            sponsored
              ? 'border-mint/35 bg-mint/[0.06] hover:bg-mint/[0.10]'
              : 'border-white/[0.10] bg-white/[0.02] hover:bg-white/[0.04]'
          }`}
          aria-pressed={sponsored}
        >
          <div className="flex items-center gap-2.5 text-left">
            <span className={`text-[14px] leading-none ${sponsored ? 'text-mint' : 'text-white/30'}`}>⚡</span>
            <div>
              <p className={`text-[12px] font-sans font-semibold ${sponsored ? 'text-mint' : 'text-white/55'}`}>
                Gasless · Protocol pays the fee
              </p>
              <p className="text-[10px] text-white/30 font-sans mt-0.5">
                {sponsored ? 'Sponsored by Strix · 5 / wallet / day' : 'You pay the network fee in XLM'}
              </p>
            </div>
          </div>
          <span className={`relative inline-flex w-9 h-5 rounded-full transition-colors ${sponsored ? 'bg-mint/60' : 'bg-white/[0.10]'}`}>
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${sponsored ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </span>
        </button>

        {/* Premium summary */}
        <div className="border border-gold/25 bg-gold/[0.05] rounded-xl px-4 py-3 space-y-1">
          <div className="flex items-baseline justify-between">
            <span className="label text-gold/70">
              {livePremium !== null ? 'On-Chain Premium' : 'Est. Premium'}
              {quoting && <span className="ml-1.5 text-white/30 normal-case">·loading…</span>}
            </span>
            <span className="data-val text-[22px] text-gold tabular">
              {formatUsdcDollar(effectivePremium, 4)}
            </span>
          </div>
          <p className="text-[11px] text-white/28 font-sans">
            {formatUsdcDollar(perContract, 4)} per contract
            {livePremium !== null
              ? ' · Quoted live by the PricingEngine — this is what you sign for'
              : ' · Pending live quote'}
          </p>
          {driftBps !== null && driftAbsBps >= 100 && (
            <p className={`text-[11px] font-sans pt-1 ${driftAbsBps >= 500 ? 'text-rust' : 'text-gold/80'}`}>
              {driftBps > 0 ? '↑' : '↓'} On-chain quote is {(driftAbsBps / 100).toFixed(2)}%
              {driftBps > 0 ? ' higher' : ' lower'} than the local Black-Scholes estimate
              {driftAbsBps >= 500 ? ' — review before confirming.' : '.'}
            </p>
          )}
        </div>

        {txResult && <TransactionStatus result={txResult} />}

        {!walletAddress ? (
          <p className="text-center text-[11px] text-white/25 uppercase tracking-wider py-1 font-sans">
            Connect wallet to trade
          </p>
        ) : (
          <div className="flex gap-2">
            <Button variant="ghost" size="md" onClick={onClose} disabled={submitting} className="flex-1">
              Cancel
            </Button>
            <Button
              size="md"
              onClick={handleBuy}
              loading={submitting}
              disabled={amountNum <= 0 || submitting}
              className={`flex-1 ${!isCall ? 'bg-rust border-rust text-white hover:bg-rust-dim hover:border-rust-dim' : ''}`}
            >
              Confirm {optionType}
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  );
}
