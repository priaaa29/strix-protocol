'use client';

import { useState, useEffect, useCallback } from 'react';
import type { WalletState } from '@/lib/types';
import { ACTIVE_NETWORK } from '@/lib/constants';
import { StellarWalletsKit } from '@creit.tech/stellar-wallets-kit/sdk';
import { defaultModules } from '@creit.tech/stellar-wallets-kit/modules/utils';
import { Networks, KitEventType } from '@creit.tech/stellar-wallets-kit/types';

const NETWORK = ACTIVE_NETWORK === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;
const ADDRESS_KEY = 'strix_wallet_address';
const WALLET_ID_KEY = 'strix_wallet_id';

let kitReady = false;

function ensureKit() {
  if (kitReady || typeof window === 'undefined') return;
  StellarWalletsKit.init({
    network: NETWORK,
    modules: defaultModules(),
  });
  StellarWalletsKit.on(KitEventType.WALLET_SELECTED, (event) => {
    if (event?.payload?.id) {
      localStorage.setItem(WALLET_ID_KEY, event.payload.id);
    }
  });
  const savedWalletId = localStorage.getItem(WALLET_ID_KEY);
  if (savedWalletId) {
    try {
      StellarWalletsKit.setWallet(savedWalletId);
    } catch {
      localStorage.removeItem(WALLET_ID_KEY);
    }
  }
  kitReady = true;
}

export function useWallet() {
  const [wallet, setWallet] = useState<WalletState>({
    connected: false,
    address: null,
    network: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ensureKit();
    const savedAddress = localStorage.getItem(ADDRESS_KEY);
    if (savedAddress) {
      setWallet({ connected: true, address: savedAddress, network: ACTIVE_NETWORK });
    }
  }, []);

  const connect = useCallback(async () => {
    ensureKit();
    setLoading(true);
    setError(null);
    try {
      const { address } = await StellarWalletsKit.authModal();
      localStorage.setItem(ADDRESS_KEY, address);
      setWallet({ connected: true, address, network: ACTIVE_NETWORK });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('cancel') && !msg.includes('closed')) {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    localStorage.removeItem(ADDRESS_KEY);
    localStorage.removeItem(WALLET_ID_KEY);
    setWallet({ connected: false, address: null, network: null });
    setError(null);
  }, []);

  return { wallet, loading, error, connect, disconnect };
}
