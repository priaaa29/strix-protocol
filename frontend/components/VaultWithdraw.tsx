'use client';

import { useState } from 'react';
import { useVault } from '@/hooks/useVault';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TransactionStatus } from '@/components/TransactionStatus';
import { parseUsdc, formatUsdc } from '@/lib/utils';
import { SCALE } from '@/lib/constants';
import type { TxResult } from '@/lib/types';

interface VaultWithdrawProps {
  walletAddress: string | null;
}

export function VaultWithdraw({ walletAddress }: VaultWithdrawProps) {
  const { vaultInfo, lpInfo, withdraw } = useVault(walletAddress);
  const [shareAmount, setShareAmount] = useState('');
  const [txResult, setTxResult]       = useState<TxResult | null>(null);
  const [loading, setLoading]         = useState(false);

  const sharesBigint = parseUsdc(shareAmount);

  let usdcPreview = 0n;
  if (vaultInfo && sharesBigint > 0n && vaultInfo.totalShares > 0n) {
    usdcPreview = (sharesBigint * vaultInfo.tvl) / vaultInfo.totalShares;
  }

  // Max withdrawable in shares:
  //   - vault can release at most `available` USDC of unlocked capital
  //   - which equals `available * totalShares / tvl` shares
  //   - and the user can't withdraw more than they own
  const userShares = lpInfo?.shares ?? 0n;
  const availableInShares =
    vaultInfo && vaultInfo.tvl > 0n
      ? (vaultInfo.available * vaultInfo.totalShares) / vaultInfo.tvl
      : 0n;
  const availableToWithdraw =
    userShares < availableInShares ? userShares : availableInShares;

  const wouldExceedAvailable = usdcPreview > (vaultInfo?.available ?? 0n);

  const handleWithdraw = async () => {
    if (!walletAddress || sharesBigint <= 0n) return;
    setLoading(true);
    setTxResult({ hash: '', status: 'pending' });
    const result = await withdraw(sharesBigint, (next) => setTxResult(next));
    setTxResult(result);
    setLoading(false);
    if (result.status === 'confirmed') setShareAmount('');
  };

  const handleMax = () => {
    if (lpInfo?.shares) {
      setShareAmount((Number(lpInfo.shares) / Number(SCALE)).toString());
    }
  };

  if (!walletAddress || (lpInfo?.shares ?? 0n) === 0n) {
    return (
      <div className="py-8 text-center space-y-1">
        <p className="text-white/40 text-sm font-sans">
          {!walletAddress ? 'Connect wallet to withdraw' : 'No vault shares to withdraw'}
        </p>
        {walletAddress && (
          <p className="text-[11px] text-white/22 font-sans">Deposit USDC first to receive shares</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {lpInfo && lpInfo.shares > 0n && (
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Your Shares', value: formatUsdc(lpInfo.shares, 4) },
            { label: 'USDC Value',  value: `$${formatUsdc(lpInfo.usdcValue, 2)}` },
          ].map((item) => (
            <div key={item.label} className="bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-3">
              <span className="label mb-1">{item.label}</span>
              <p className="font-data text-[13px] text-white/75 tabular mt-1">{item.value}</p>
            </div>
          ))}
        </div>
      )}

      <Input
        label="Shares to Redeem"
        type="number"
        placeholder="0.0000"
        min="0"
        step="0.01"
        value={shareAmount}
        onChange={(e) => setShareAmount(e.target.value)}
        error={wouldExceedAvailable ? 'Exceeds available unlocked capital' : undefined}
        hint={`Max withdrawable: ${formatUsdc(availableToWithdraw, 4)} shares`}
        suffix={
          <button
            onClick={handleMax}
            className="text-[10px] font-semibold uppercase tracking-wider text-gold hover:text-gold-bright transition-colors"
          >
            MAX
          </button>
        }
      />

      {usdcPreview > 0n && !wouldExceedAvailable && (
        <div className="flex items-center justify-between border border-gold/25 bg-gold/[0.05] rounded-xl px-4 py-3">
          <span className="label text-gold/70">You Receive</span>
          <span className="font-data text-[13px] text-gold tabular font-semibold">
            ${formatUsdc(usdcPreview, 4)} USDC
          </span>
        </div>
      )}

      {wouldExceedAvailable && (
        <div className="border border-gold/25 bg-gold/[0.05] rounded-xl px-4 py-3 text-[11px] text-gold/75 leading-relaxed font-sans">
          Some capital is locked backing active options. Reduce withdrawal or wait for expiry.
        </div>
      )}

      <TransactionStatus result={txResult} />

      <Button
        className="w-full"
        onClick={handleWithdraw}
        loading={loading}
        disabled={sharesBigint <= 0n || wouldExceedAvailable || loading}
      >
        Withdraw USDC
      </Button>
    </div>
  );
}
