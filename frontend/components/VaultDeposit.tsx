'use client';

import { useState } from 'react';
import { useVault } from '@/hooks/useVault';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TransactionStatus } from '@/components/TransactionStatus';
import { parseUsdc, formatUsdc, formatSharePrice } from '@/lib/utils';
import type { TxResult } from '@/lib/types';

interface VaultDepositProps {
  walletAddress: string | null;
}

export function VaultDeposit({ walletAddress }: VaultDepositProps) {
  const { vaultInfo, deposit } = useVault(walletAddress);
  const [amount, setAmount]   = useState('');
  const [txResult, setTxResult] = useState<TxResult | null>(null);
  const [loading, setLoading]   = useState(false);

  const amountBigint = parseUsdc(amount);

  let sharesPreview = 0n;
  if (vaultInfo && amountBigint > 0n) {
    sharesPreview = vaultInfo.totalShares === 0n
      ? amountBigint
      : (amountBigint * vaultInfo.totalShares) / vaultInfo.tvl;
  }

  const handleDeposit = async () => {
    if (!walletAddress || amountBigint <= 0n) return;
    setLoading(true);
    setTxResult({ hash: '', status: 'pending' });
    const result = await deposit(amountBigint);
    setTxResult(result);
    setLoading(false);
    if (result.status === 'confirmed') setAmount('');
  };

  return (
    <div className="space-y-4">
      {vaultInfo && (
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Share Price',  value: `$${formatSharePrice(vaultInfo.sharePrice)}` },
            { label: 'Available',    value: `$${formatUsdc(vaultInfo.available, 2)}` },
          ].map((item) => (
            <div key={item.label} className="bg-surface-over border border-surface-border rounded-sm px-3 py-2.5">
              <span className="label">{item.label}</span>
              <p className="font-mono text-sm text-ink mt-1 tabular">{item.value}</p>
            </div>
          ))}
        </div>
      )}

      <Input
        label="Amount (USDC)"
        type="number"
        placeholder="0.00"
        min="0"
        step="0.01"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        hint="You receive vault shares proportional to your deposit"
      />

      {sharesPreview > 0n && (
        <div className="flex items-center justify-between border border-gold/30 bg-gold/[0.06] rounded-sm px-4 py-2.5">
          <span className="label text-gold/80">You Receive</span>
          <span className="font-mono text-sm text-gold tabular font-semibold">
            {formatUsdc(sharesPreview, 4)} shares
          </span>
        </div>
      )}

      <TransactionStatus result={txResult} />

      {!walletAddress ? (
        <p className="text-center text-[11px] text-ink-3 uppercase tracking-wider py-2">
          Connect wallet to deposit
        </p>
      ) : (
        <Button
          className="w-full"
          onClick={handleDeposit}
          loading={loading}
          disabled={amountBigint <= 0n || loading}
        >
          Deposit USDC
        </Button>
      )}
    </div>
  );
}
