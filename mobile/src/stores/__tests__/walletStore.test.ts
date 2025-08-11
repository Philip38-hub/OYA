import { useWalletStore } from '../walletStore';
import { walletService, type InjectedAccountWithMeta } from '../../services/walletService';

// Mock the wallet service
jest.mock('../../services/walletService');

const mockWalletService = walletService as jest.Mocked<typeof walletService>;

describe('WalletStore', () => {
  beforeEach(() => {
    // Reset store state
    useWalletStore.setState({
      isConnected: false,
      walletAddress: null,
      accounts: [],
      selectedAccount: null,
      isConnecting: false,
      error: null,
      isInitialized: false,
    });
    
    jest.clearAllMocks();
  });

  describe('initializeWallet', () => {
    it('should initialize wallet successfully', async () => {
      mockWalletService.initializeApi.mockResolvedValue();

      const { initializeWallet } = useWalletStore.getState();
      await initializeWallet();

      const state = useWalletStore.getState();
      expect(state.isInitialized).toBe(true);
      expect(state.error).toBeNull();
      expect(mockWalletService.initializeApi).toHaveBeenCalled();
    });

    it('should handle initialization failure', async () => {
      const error = new Error('API initialization failed');
      mockWalletService.initializeApi.mockRejectedValue(error);

      const { initializeWallet } = useWalletStore.getState();
      await initializeWallet();

      const state = useWalletStore.getState();
      expect(state.isInitialized).toBe(false);
      expect(state.error).toBe('API initialization failed');
    });
  });

  describe('connectWallet', () => {
    const mockAccounts: InjectedAccountWithMeta[] = [
      {
        address: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        meta: { name: 'Account 1', source: 'Nova Wallet' },
      },
      {
        address: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty',
        meta: { name: 'Account 2', source: 'Nova Wallet' },
      },
    ];

    it('should connect wallet successfully with multiple accounts', async () => {
      mockWalletService.getApi.mockReturnValue({} as any);
      mockWalletService.connectWallet.mockResolvedValue({
        success: true,
        accounts: mockAccounts,
      });

      const { connectWallet } = useWalletStore.getState();
      await connectWallet();

      const state = useWalletStore.getState();
      expect(state.isConnected).toBe(true);
      expect(state.accounts).toEqual(mockAccounts);
      expect(state.selectedAccount).toBeNull(); // No auto-selection with multiple accounts
      expect(state.walletAddress).toBeNull();
      expect(state.isConnecting).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should connect wallet and auto-select single account', async () => {
      const singleAccount = [mockAccounts[0]];
      
      mockWalletService.getApi.mockReturnValue({} as any);
      mockWalletService.connectWallet.mockResolvedValue({
        success: true,
        accounts: singleAccount,
      });

      const { connectWallet } = useWalletStore.getState();
      await connectWallet();

      const state = useWalletStore.getState();
      expect(state.isConnected).toBe(true);
      expect(state.accounts).toEqual(singleAccount);
      expect(state.selectedAccount).toEqual(singleAccount[0]);
      expect(state.walletAddress).toBe(singleAccount[0].address);
      expect(state.isConnecting).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should initialize API if not already initialized', async () => {
      mockWalletService.getApi.mockReturnValue(null);
      mockWalletService.initializeApi.mockResolvedValue();
      mockWalletService.connectWallet.mockResolvedValue({
        success: true,
        accounts: mockAccounts,
      });

      const { connectWallet } = useWalletStore.getState();
      await connectWallet();

      expect(mockWalletService.initializeApi).toHaveBeenCalled();
      
      const state = useWalletStore.getState();
      expect(state.isInitialized).toBe(true);
    });

    it('should handle connection failure', async () => {
      mockWalletService.getApi.mockReturnValue({} as any);
      mockWalletService.connectWallet.mockResolvedValue({
        success: false,
        error: 'No wallet found',
      });

      const { connectWallet } = useWalletStore.getState();
      await connectWallet();

      const state = useWalletStore.getState();
      expect(state.isConnected).toBe(false);
      expect(state.isConnecting).toBe(false);
      expect(state.error).toBe('No wallet found');
    });

    it('should handle connection exception', async () => {
      mockWalletService.getApi.mockReturnValue({} as any);
      mockWalletService.connectWallet.mockRejectedValue(new Error('Connection failed'));

      const { connectWallet } = useWalletStore.getState();
      await connectWallet();

      const state = useWalletStore.getState();
      expect(state.isConnected).toBe(false);
      expect(state.isConnecting).toBe(false);
      expect(state.error).toBe('Connection failed');
    });

    it('should set connecting state during connection', async () => {
      let resolveConnection: (value: any) => void;
      const connectionPromise = new Promise(resolve => {
        resolveConnection = resolve;
      });

      mockWalletService.getApi.mockReturnValue({} as any);
      mockWalletService.connectWallet.mockReturnValue(connectionPromise as any);

      const { connectWallet } = useWalletStore.getState();
      const connectionCall = connectWallet();

      // Check connecting state
      const connectingState = useWalletStore.getState();
      expect(connectingState.isConnecting).toBe(true);
      expect(connectingState.error).toBeNull();

      // Resolve connection
      resolveConnection!({
        success: true,
        accounts: mockAccounts,
      });

      await connectionCall;

      const finalState = useWalletStore.getState();
      expect(finalState.isConnecting).toBe(false);
    });
  });

  describe('disconnectWallet', () => {
    it('should disconnect wallet successfully', async () => {
      // Set up connected state
      useWalletStore.setState({
        isConnected: true,
        walletAddress: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        accounts: [
          {
            address: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
            meta: { name: 'Account 1', source: 'Nova Wallet' },
          },
        ],
        selectedAccount: {
          address: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
          meta: { name: 'Account 1', source: 'Nova Wallet' },
        },
        isInitialized: true,
      });

      mockWalletService.disconnect.mockResolvedValue();

      const { disconnectWallet } = useWalletStore.getState();
      await disconnectWallet();

      const state = useWalletStore.getState();
      expect(state.isConnected).toBe(false);
      expect(state.walletAddress).toBeNull();
      expect(state.accounts).toEqual([]);
      expect(state.selectedAccount).toBeNull();
      expect(state.isInitialized).toBe(false);
      expect(state.error).toBeNull();
      expect(mockWalletService.disconnect).toHaveBeenCalled();
    });

    it('should reset state even if disconnect fails', async () => {
      // Set up connected state
      useWalletStore.setState({
        isConnected: true,
        walletAddress: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        isInitialized: true,
      });

      const error = new Error('Disconnect failed');
      mockWalletService.disconnect.mockRejectedValue(error);

      const { disconnectWallet } = useWalletStore.getState();
      await disconnectWallet();

      const state = useWalletStore.getState();
      expect(state.isConnected).toBe(false);
      expect(state.walletAddress).toBeNull();
      expect(state.isInitialized).toBe(false);
      expect(state.error).toBe('Disconnect failed');
    });
  });

  describe('selectAccount', () => {
    it('should select account and update wallet address', () => {
      const account: InjectedAccountWithMeta = {
        address: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        meta: { name: 'Account 1', source: 'Nova Wallet' },
      };

      const { selectAccount } = useWalletStore.getState();
      selectAccount(account);

      const state = useWalletStore.getState();
      expect(state.selectedAccount).toEqual(account);
      expect(state.walletAddress).toBe(account.address);
    });
  });

  describe('error handling', () => {
    it('should set error', () => {
      const { setError } = useWalletStore.getState();
      setError('Test error');

      const state = useWalletStore.getState();
      expect(state.error).toBe('Test error');
    });

    it('should clear error', () => {
      useWalletStore.setState({ error: 'Test error' });

      const { clearError } = useWalletStore.getState();
      clearError();

      const state = useWalletStore.getState();
      expect(state.error).toBeNull();
    });
  });

  describe('checkWalletAvailability', () => {
    it('should return true when wallet is available', async () => {
      mockWalletService.isWalletAvailable.mockResolvedValue(true);

      const { checkWalletAvailability } = useWalletStore.getState();
      const result = await checkWalletAvailability();

      expect(result).toBe(true);
      expect(mockWalletService.isWalletAvailable).toHaveBeenCalled();
    });

    it('should return false when wallet is not available', async () => {
      mockWalletService.isWalletAvailable.mockResolvedValue(false);

      const { checkWalletAvailability } = useWalletStore.getState();
      const result = await checkWalletAvailability();

      expect(result).toBe(false);
    });

    it('should return false when check throws error', async () => {
      mockWalletService.isWalletAvailable.mockRejectedValue(new Error('Check failed'));

      const { checkWalletAvailability } = useWalletStore.getState();
      const result = await checkWalletAvailability();

      expect(result).toBe(false);
    });
  });
});