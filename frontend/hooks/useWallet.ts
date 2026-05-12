'use client';

import { useState, useEffect, useCallback } from 'react';
import type { WalletState } from '@/lib/types';
import { ACTIVE_NETWORK } from '@/lib/constants';
import {
  StellarWalletsKit,
  FreighterModule,
  xBullModule,
  LobstrModule,
  HanaModule,
  AlbedoModule,
  Networks,
} from '@creit.tech/stellar-wallets-kit';

const NETWORK = ACTIVE_NETWORK === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;

function initKit() {
  StellarWalletsKit.init({
    network: NETWORK,
    modules: [
      new FreighterModule(),
      new xBullModule(),
      new LobstrModule(),
      new HanaModule(),
      new AlbedoModule(),
    ],
  });
}

export function useWallet() {
  const [wallet, setWallet] = useState<WalletState>({
    connected: false,
    address: null,
    network: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Init kit once + auto-reconnect from localStorage
  useEffect(() => {
    initKit();
    const savedAddress = localStorage.getItem('strix_wallet_address');
    if (savedAddress) {
      setWallet({ connected: true, address: savedAddress, network: ACTIVE_NETWORK });
    }
  }, []);

  const connect = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { address } = await StellarWalletsKit.authModal();
      localStorage.setItem('strix_wallet_address', address);
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
    localStorage.removeItem('strix_wallet_address');
    setWallet({ connected: false, address: null, network: null });
    setError(null);
  }, []);

  return { wallet, loading, error, connect, disconnect };
}
