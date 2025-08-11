import React, { useEffect, useState } from 'react';
import { View, Text, Alert, StyleSheet } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Button, LoadingSpinner, ErrorMessage, WalletErrorHandler, ErrorBoundary } from '@/components';
import { RootStackParamList } from '@/types/navigation';
import { useWalletStore } from '@/stores/walletStore';
import { useErrorRecovery } from '@/hooks/useErrorRecovery';
import type { InjectedAccountWithMeta } from '../services/walletService';

type SplashScreenNavigationProp = StackNavigationProp<RootStackParamList, 'SplashScreen'>;

interface Props {
  navigation: SplashScreenNavigationProp;
}

export const SplashScreen: React.FC<Props> = ({ navigation }) => {
  const {
    isConnected,
    isConnecting,
    accounts,
    selectedAccount,
    error,
    initializeWallet,
    connectWallet,
    selectAccount,
    clearError,
    checkWalletAvailability,
  } = useWalletStore();

  const [showAccountSelection, setShowAccountSelection] = useState(false);
  const [walletAvailable, setWalletAvailable] = useState<boolean | null>(null);
  const [showWalletError, setShowWalletError] = useState(false);

  // Use error recovery hook
  const errorRecovery = useErrorRecovery({
    maxRetries: 3,
    showUserFriendlyMessages: false, // We'll handle UI manually
    autoRetryNetworkErrors: false,
    logErrors: true,
  });

  // Initialize wallet service on component mount
  useEffect(() => {
    const initialize = async () => {
      try {
        await initializeWallet();
        const available = await checkWalletAvailability();
        setWalletAvailable(available);
      } catch (err) {
        console.error('Failed to initialize wallet:', err);
        setWalletAvailable(false);
      }
    };

    initialize();
  }, [initializeWallet, checkWalletAvailability]);

  // Navigate to main action screen when wallet is connected and account is selected
  useEffect(() => {
    if (isConnected && selectedAccount) {
      navigation.navigate('MainActionScreen');
    }
  }, [isConnected, selectedAccount, navigation]);

  const handleConnectWallet = async () => {
    clearError();
    setShowWalletError(false);
    
    if (walletAvailable === false) {
      const walletNotFoundError = new Error('Nova Wallet not found. Please install Nova Wallet to continue.');
      await errorRecovery.handleError(walletNotFoundError, {
        component: 'SplashScreen',
        action: 'connect_wallet_not_found',
      });
      setShowWalletError(true);
      return;
    }

    try {
      await connectWallet();
      
      // If multiple accounts are available, show selection
      if (accounts.length > 1) {
        setShowAccountSelection(true);
      }
      // Single account or no accounts will be handled by the store
    } catch (err) {
      console.error('Wallet connection failed:', err);
      const walletError = err instanceof Error ? err : new Error('Wallet connection failed');
      
      await errorRecovery.handleError(walletError, {
        component: 'SplashScreen',
        action: 'connect_wallet_failed',
      });
      
      setShowWalletError(true);
    }
  };

  const handleAccountSelection = (account: InjectedAccountWithMeta) => {
    selectAccount(account);
    setShowAccountSelection(false);
  };

  const handleRetry = async () => {
    clearError();
    errorRecovery.clearError();
    setShowAccountSelection(false);
    setShowWalletError(false);
    
    // Retry wallet connection
    await handleConnectWallet();
  };

  const handleCancelError = () => {
    clearError();
    errorRecovery.clearError();
    setShowWalletError(false);
  };

  // Show loading while checking wallet availability
  if (walletAvailable === null) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>OYAH!</Text>
        <Text style={styles.subtitle}>
          Decentralized Electoral Transparency
        </Text>
        <LoadingSpinner size="large" />
        <Text style={styles.loadingText}>
          Initializing wallet service...
        </Text>
      </View>
    );
  }

  // Show account selection if multiple accounts are available
  if (showAccountSelection && accounts.length > 1) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>OYAH!</Text>
        <Text style={styles.subtitle}>
          Select Account
        </Text>
        <Text style={styles.description}>
          Choose which account to use for witnessing
        </Text>

        <View style={styles.buttonContainer}>
          {accounts.map((account, index) => (
            <Button
              key={account.address}
              title={`${account.meta.name || `Account ${index + 1}`}\n${account.address.slice(0, 8)}...${account.address.slice(-8)}`}
              variant="outline"
              onPress={() => handleAccountSelection(account)}
              style={styles.accountButton}
            />
          ))}
          
          <Button
            title="Cancel"
            variant="secondary"
            onPress={() => setShowAccountSelection(false)}
            style={styles.cancelButton}
          />
        </View>
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <View style={styles.container}>
        <Text style={styles.title}>OYAH!</Text>
        <Text style={styles.subtitle}>
          Decentralized Electoral Transparency
        </Text>
        <Text style={styles.description}>
          Connect your wallet to witness and verify polling results
        </Text>

        {/* Show wallet error handler if there's a wallet-specific error */}
        {showWalletError && errorRecovery.state.error && (
          <View style={styles.messageContainer}>
            <WalletErrorHandler
              error={errorRecovery.state.error}
              onRetry={handleRetry}
              onCancel={handleCancelError}
              context={{
                component: 'SplashScreen',
                action: 'wallet_connection',
              }}
              showInstallOption={true}
            />
          </View>
        )}

        {/* Show generic error message for other errors */}
        {error && !showWalletError && (
          <View style={styles.messageContainer}>
            <ErrorMessage 
              message={error} 
              onRetry={handleRetry}
            />
          </View>
        )}

        {/* Show wallet not available warning */}
        {walletAvailable === false && !showWalletError && (
          <View style={styles.messageContainer}>
            <View style={styles.warningBox}>
              <Text style={styles.warningText}>
                No wallet extension detected. Please install Nova Wallet or another Polkadot wallet.
              </Text>
            </View>
          </View>
        )}

        <View style={styles.buttonContainer}>
          <Button
            title={isConnecting ? "Connecting..." : "Connect Wallet to Witness"}
            variant="primary"
            onPress={handleConnectWallet}
            disabled={isConnecting || (walletAvailable === false && !showWalletError)}
            style={styles.connectButton}
          />
          
          {(isConnecting || errorRecovery.state.isRecovering) && (
            <View style={styles.loadingContainer}>
              <LoadingSpinner size="small" />
              <Text style={styles.connectingText}>
                {errorRecovery.state.isRecovering ? 'Retrying connection...' : 'Connecting to wallet...'}
              </Text>
            </View>
          )}
        </View>

        {/* Show connection status */}
        {isConnected && selectedAccount && (
          <View style={styles.messageContainer}>
            <View style={styles.successBox}>
              <Text style={styles.successText}>
                Connected as {selectedAccount.meta.name || 'Account'}
              </Text>
              <Text style={styles.addressText}>
                {selectedAccount.address.slice(0, 8)}...{selectedAccount.address.slice(-8)}
              </Text>
            </View>
          </View>
        )}
      </View>
    </ErrorBoundary>
  );
};const 
styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#1e40af',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 20,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 16,
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 320,
  },
  messageContainer: {
    width: '100%',
    maxWidth: 320,
    marginBottom: 16,
  },
  accountButton: {
    marginBottom: 12,
  },
  cancelButton: {
    marginTop: 16,
  },
  connectButton: {
    marginBottom: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  connectingText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
  },
  warningBox: {
    backgroundColor: '#fefce8',
    borderColor: '#fde047',
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
  },
  warningText: {
    color: '#a16207',
    fontSize: 14,
    textAlign: 'center',
  },
  successBox: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
  },
  successText: {
    color: '#166534',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  addressText: {
    color: '#16a34a',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
});