import React from 'react';
import { SplashScreen } from '../SplashScreen';
import { useWalletStore } from '@/stores/walletStore';

// Mock the wallet store
jest.mock('@/stores/walletStore');
const mockUseWalletStore = useWalletStore as jest.MockedFunction<typeof useWalletStore>;

describe('SplashScreen', () => {
  const defaultWalletState = {
    isConnected: false,
    isConnecting: false,
    accounts: [],
    selectedAccount: null,
    error: null,
    initializeWallet: jest.fn(),
    connectWallet: jest.fn(),
    selectAccount: jest.fn(),
    clearError: jest.fn(),
    checkWalletAvailability: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseWalletStore.mockReturnValue(defaultWalletState);
  });

  it('should create SplashScreen component', () => {
    expect(SplashScreen).toBeDefined();
    expect(typeof SplashScreen).toBe('function');
  });

  it('should use wallet store', () => {
    // Mock navigation
    const mockNavigation = { navigate: jest.fn() } as any;
    
    // This will test that the component can be instantiated and uses the wallet store
    const component = SplashScreen({ navigation: mockNavigation });
    
    expect(mockUseWalletStore).toHaveBeenCalled();
    expect(component).toBeDefined();
  });

  it('should have proper component structure', () => {
    const mockNavigation = { navigate: jest.fn() } as any;
    const component = SplashScreen({ navigation: mockNavigation });
    
    // Component should be a valid React element
    expect(React.isValidElement(component)).toBe(true);
  });
});