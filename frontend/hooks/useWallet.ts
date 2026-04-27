'use client';

import { useState, useEffect, useCallback } from 'react';
import type { WalletState } from '@/lib/types';
import { ACTIVE_NETWORK } from '@/lib/constants';

export function useWallet() {
  const [wallet, setWallet] = useState<WalletState>({
    connected: false,
    address: null,
    network: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [freighterInstalled, setFreighterInstalled] = useState<boolean | null>(null);

  // Check if Freighter is installed
  useEffect(() => {
    const checkFreighter = async () => {
      try {
        const { isConnected } = await import('@stellar/freighter-api');
        // In freighter-api v2.x, isConnected() returns a boolean
        const connected = await isConnected();
        setFreighterInstalled(connected as unknown as boolean);
      } catch {
        setFreighterInstalled(false);
      }
    };
    checkFreighter();
  }, []);

  // Auto-reconnect if previously connected
  useEffect(() => {
    const savedAddress = localStorage.getItem('strix_wallet_address');
    if (savedAddress && freighterInstalled) {
      setWallet({ connected: true, address: savedAddress, network: ACTIVE_NETWORK });
    }
  }, [freighterInstalled]);

  const connect = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { isConnected, requestAccess, getNetworkDetails, getPublicKey } =
        await import('@stellar/freighter-api');

      // Check installed
      const installed = await isConnected();
      if (!installed) {
        setError('Freighter wallet not installed. Please install it from freighter.app');
        setLoading(false);
        return;
      }

      // Request access
      await requestAccess();

      // Get address
      const address = await getPublicKey();
      if (!address) {
        setError('Could not get wallet address. Please unlock Freighter and try again.');
        setLoading(false);
        return;
      }

      // Check network
      const networkDetails = await getNetworkDetails();
      const networkPassphrase = networkDetails?.networkPassphrase ?? '';
      const isMainnet = networkPassphrase === 'Public Global Stellar Network ; September 2015';
      const networkName = isMainnet ? 'mainnet' : 'testnet';

      if (networkName !== ACTIVE_NETWORK) {
        setError(
          `Wrong network! Switch Freighter to ${ACTIVE_NETWORK.toUpperCase()}. ` +
          `Currently on: ${networkName.toUpperCase()}`
        );
        setLoading(false);
        return;
      }

      localStorage.setItem('strix_wallet_address', address);
      setWallet({ connected: true, address, network: networkName });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('User declined') || message.includes('canceled')) {
        setError('Connection cancelled.');
      } else {
        setError(`Connection failed: ${message}`);
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

  return {
    wallet,
    loading,
    error,
    freighterInstalled,
    connect,
    disconnect,
  };
}
