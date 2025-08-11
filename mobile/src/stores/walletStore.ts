import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { InjectedAccountWithMeta } from '../services/walletService';
import { walletService, WalletConnectionResult } from '../services/walletService';

export interface WalletState {
  isConnected: boolean;
  walletAddress: string | null;
  accounts: InjectedAccountWithMeta[];
  selectedAccount: InjectedAccountWithMeta | null;
  isConnecting: boolean;
  error: string | null;
  isInitialized: boolean;
}

export interface WalletActions {
  initializeWallet: () => Promise<void>;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
  selectAccount: (account: InjectedAccountWithMeta) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  checkWalletAvailability: () => Promise<boolean>;
}

export type WalletStore = WalletState & WalletActions;

const initialState: WalletState = {
  isConnected: false,
  walletAddress: null,
  accounts: [],
  selectedAccount: null,
  isConnecting: false,
  error: null,
  isInitialized: false,
};

export const useWalletStore = create<WalletStore>()(
  devtools(
    (set) => ({
      ...initialState,

      initializeWallet: async () => {
        try {
          await walletService.initializeApi();
          set({ isInitialized: true });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to initialize wallet service',
            isInitialized: false,
          });
        }
      },

      connectWallet: async () => {
        set({ isConnecting: true, error: null });

        try {
          // Initialize API if not already done
          if (!walletService.getApi()) {
            await walletService.initializeApi();
            set({ isInitialized: true });
          }

          // Connect to wallet
          const result: WalletConnectionResult = await walletService.connectWallet();

          if (result.success && result.accounts) {
            // Auto-select first account if only one available
            const selectedAccount = result.accounts.length === 1 ? result.accounts[0] : null;
            
            set({
              isConnected: true,
              accounts: result.accounts,
              selectedAccount,
              walletAddress: selectedAccount?.address || null,
              isConnecting: false,
              error: null,
            });
          } else {
            set({
              isConnecting: false,
              error: result.error || 'Failed to connect wallet',
            });
          }
        } catch (error) {
          set({
            isConnecting: false,
            error: error instanceof Error ? error.message : 'Failed to connect wallet',
          });
        }
      },

      disconnectWallet: async () => {
        try {
          await walletService.disconnect();
          set({
            ...initialState,
            isInitialized: false,
          });
        } catch (error) {
          // Even if disconnect fails, reset the state
          set({
            ...initialState,
            isInitialized: false,
            error: error instanceof Error ? error.message : 'Error during disconnect',
          });
        }
      },

      selectAccount: (account: InjectedAccountWithMeta) => {
        set({
          selectedAccount: account,
          walletAddress: account.address,
        });
      },

      setError: (error: string | null) => {
        set({ error });
      },

      clearError: () => {
        set({ error: null });
      },

      checkWalletAvailability: async (): Promise<boolean> => {
        try {
          return await walletService.isWalletAvailable();
        } catch {
          return false;
        }
      },
    }),
    {
      name: 'wallet-store',
    }
  )
);