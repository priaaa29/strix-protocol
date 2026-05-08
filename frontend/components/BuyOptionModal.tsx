'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogHeader } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TransactionStatus } from '@/components/TransactionStatus';
import { formatUsdc, formatExpiry, formatUsdcDollar } from '@/lib/utils';
import { calcPremium } from '@/lib/black-scholes';
import type { TxResult } from '@/lib/types';

interface BuyOptionModalProps {
  open: boolean;
  onClose: () => void;
  strike: bigint;
  spotPrice: bigint;
  expiry: number;
  optionType: 'Call' | 'Put';
  walletAddress: string | null;
  onBuy: (buyer: string, strike: bigint, amount: number) => Promise<TxResult>;
}

export function BuyOptionModal({
  open, onClose, strike, spotPrice, expiry, optionType, walletAddress, onBuy,
}: BuyOptionModalProps) {
  const [amount, setAmount]         = useState('1');
  const [txResult, setTxResult]     = useState<TxResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) { setAmount('1'); setTxResult(null); setSubmitting(false); }
  }, [open]);

  const amountNum      = Math.max(1, Math.floor(Number(amount) || 1));
  const previewPremium = calcPremium(optionType, spotPrice, strike, expiry, amountNum);
  const perContract    = previewPremium / BigInt(Math.max(amountNum, 1));

  const isCallItm  = optionType === 'Call' && strike < spotPrice;
  const isPutItm   = optionType === 'Put'  && strike > spotPrice;
  const moneyness  = (isCallItm || isPutItm) ? 'ITM' : strike === spotPrice ? 'ATM' : 'OTM';
  const isCall     = optionType === 'Call';

  const handleBuy = async () => {
    if (!walletAddress) return;
    setSubmitting(true);
    setTxResult({ hash: '', status: 'pending' });
    const result = await onBuy(walletAddress, strike, amountNum);
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

        {/* Premium summary */}
        <div className="border border-gold/25 bg-gold/[0.05] rounded-xl px-4 py-3 space-y-1">
          <div className="flex items-baseline justify-between">
            <span className="label text-gold/70">Est. Total Premium</span>
            <span className="data-val text-[22px] text-gold tabular">
              {formatUsdcDollar(previewPremium, 4)}
            </span>
          </div>
          <p className="text-[11px] text-white/28 font-sans">
            {formatUsdcDollar(perContract, 4)} per contract · Actual price computed on-chain
          </p>
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
