import React, { useState } from 'react';
import { View, Linking, Alert, Platform } from 'react-native';
import styled from 'styled-components/native';
import { theme } from '@/utils/theme';
import { StyledButton } from './StyledButton';
import { LoadingSpinner } from './LoadingSpinner';
import { errorHandlingService, RecoveryAction } from '@/services/errorHandlingService';

interface WalletErrorHandlerProps {
  error: Error;
  onRetry: () => Promise<void>;
  onCancel?: () => void;
  context?: {
    component?: string;
    action?: string;
  };
  showInstallOption?: boolean;
}

const Container = styled.View`
  background-color: white;
  padding: ${theme.spacing.lg}px;
  border-radius: ${theme.borderRadius.lg}px;
  margin: ${theme.spacing.md}px;
  shadow-color: #000;
  shadow-offset: 0px 2px;
  shadow-opacity: 0.1;
  shadow-radius: 4px;
  elevation: 3;
`;

const ErrorIcon = styled.Text`
  font-size: 48px;
  text-align: center;
  margin-bottom: ${theme.spacing.md}px;
`;

const ErrorTitle = styled.Text`
  font-size: ${theme.fontSize.xl}px;
  font-weight: ${theme.fontWeight.bold};
  color: ${theme.colors.error};
  text-align: center;
  margin-bottom: ${theme.spacing.sm}px;
`;

const ErrorMessage = styled.Text`
  font-size: ${theme.fontSize.base}px;
  color: ${theme.colors.gray[600]};
  text-align: center;
  line-height: ${theme.fontSize.base * 1.5}px;
  margin-bottom: ${theme.spacing.lg}px;
`;

const TroubleshootingBox = styled.View`
  background-color: #fefce8;
  border-left-width: 4px;
  border-left-color: #fde047;
  padding: ${theme.spacing.md}px;
  margin-bottom: ${theme.spacing.lg}px;
  border-radius: ${theme.borderRadius.md}px;
`;

const TroubleshootingTitle = styled.Text`
  font-size: ${theme.fontSize.sm}px;
  font-weight: ${theme.fontWeight.semibold};
  color: #a16207;
  margin-bottom: ${theme.spacing.xs}px;
`;

const TroubleshootingText = styled.Text`
  font-size: ${theme.fontSize.sm}px;
  color: #ca8a04;
  line-height: ${theme.fontSize.sm * 1.4}px;
`;

const ButtonContainer = styled.View`
  gap: ${theme.spacing.md}px;
`;

const LoadingContainer = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: center;
  padding: ${theme.spacing.md}px;
`;

const LoadingText = styled.Text`
  margin-left: ${theme.spacing.sm}px;
  color: ${theme.colors.gray[600]};
`;

export const WalletErrorHandler: React.FC<WalletErrorHandlerProps> = ({
  error,
  onRetry,
  onCancel,
  context = {},
  showInstallOption = true,
}) => {
  const [isRetrying, setIsRetrying] = useState(false);
  const [recoveryActions, setRecoveryActions] = useState<RecoveryAction[]>([]);
  const [userMessage, setUserMessage] = useState('');

  React.useEffect(() => {
    const analyzeError = async () => {
      const result = await errorHandlingService.handleWalletError(
        error,
        {
          component: context.component || 'WalletErrorHandler',
          action: context.action || 'wallet_connection_failed',
          timestamp: new Date().toISOString(),
        }
      );

      setRecoveryActions(result.recoveryActions);
      setUserMessage(result.userMessage);
    };

    analyzeError();
  }, [error, context]);

  const handleRetry = async () => {
    if (isRetrying) return;

    setIsRetrying(true);
    
    try {
      await onRetry();
    } catch (retryError) {
      console.error('Wallet connection retry failed:', retryError);
    } finally {
      setIsRetrying(false);
    }
  };

  const handleInstallWallet = async () => {
    try {
      // Try to open Nova Wallet in app store
      const appStoreUrl = 'https://apps.apple.com/app/nova-polkadot-kusama-wallet/id1597119355';
      const playStoreUrl = 'https://play.google.com/store/apps/details?id=io.novafoundation.nova.android';
      
      Alert.alert(
        'Install Nova Wallet',
        'Nova Wallet is required to use this app. Would you like to install it?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Install',
            onPress: async () => {
              try {
                // Try to open the appropriate app store
                const url = Platform.OS === 'ios' ? appStoreUrl : playStoreUrl;
                const supported = await Linking.canOpenURL(url);
                
                if (supported) {
                  await Linking.openURL(url);
                } else {
                  Alert.alert(
                    'Unable to Open Store',
                    'Please search for "Nova Wallet" in your app store.',
                    [{ text: 'OK' }]
                  );
                }
              } catch (linkError) {
                console.error('Failed to open app store:', linkError);
                Alert.alert(
                  'Unable to Open Store',
                  'Please search for "Nova Wallet" in your app store.',
                  [{ text: 'OK' }]
                );
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Install wallet error:', error);
    }
  };

  const handleCheckWalletStatus = () => {
    Alert.alert(
      'Check Nova Wallet',
      'Please ensure Nova Wallet is:\n\n• Installed on your device\n• Running in the background\n• Has at least one account created\n• Is not locked',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Try Again', onPress: handleRetry },
      ]
    );
  };

  const getErrorIcon = () => {
    const errorMessage = error.message.toLowerCase();
    
    if (errorMessage.includes('not found') || errorMessage.includes('not installed')) {
      return '📱';
    } else if (errorMessage.includes('rejected') || errorMessage.includes('cancelled')) {
      return '🚫';
    } else if (errorMessage.includes('timeout')) {
      return '⏱️';
    } else if (errorMessage.includes('network')) {
      return '📡';
    } else {
      return '🔗';
    }
  };

  const getTroubleshootingSteps = () => {
    const errorMessage = error.message.toLowerCase();
    
    if (errorMessage.includes('not found') || errorMessage.includes('not installed')) {
      return 'Make sure Nova Wallet is installed and running on your device.';
    } else if (errorMessage.includes('rejected') || errorMessage.includes('cancelled')) {
      return 'Please approve the connection request in Nova Wallet when prompted.';
    } else if (errorMessage.includes('timeout')) {
      return 'Ensure Nova Wallet is running and not locked. The connection request may have expired.';
    } else if (errorMessage.includes('network')) {
      return 'Check your internet connection and ensure Nova Wallet can connect to the Polkadot network.';
    } else {
      return 'Try restarting Nova Wallet and ensure it has at least one account created.';
    }
  };

  return (
    <Container>
      <ErrorIcon>{getErrorIcon()}</ErrorIcon>
      <ErrorTitle>Wallet Connection Failed</ErrorTitle>
      <ErrorMessage>
        {userMessage || 'Unable to connect to Nova Wallet. Please check your wallet setup and try again.'}
      </ErrorMessage>
      
      <TroubleshootingBox>
        <TroubleshootingTitle>Troubleshooting Steps:</TroubleshootingTitle>
        <TroubleshootingText>{getTroubleshootingSteps()}</TroubleshootingText>
      </TroubleshootingBox>

      {isRetrying && (
        <LoadingContainer>
          <LoadingSpinner size="small" />
          <LoadingText>Attempting to connect...</LoadingText>
        </LoadingContainer>
      )}

      <ButtonContainer>
        {!isRetrying && (
          <StyledButton
            title="Try Again"
            onPress={handleRetry}
            variant="primary"
          />
        )}
        
        {showInstallOption && error.message.toLowerCase().includes('not found') && (
          <StyledButton
            title="Install Nova Wallet"
            onPress={handleInstallWallet}
            variant="outline"
          />
        )}
        
        <StyledButton
          title="Check Wallet Status"
          onPress={handleCheckWalletStatus}
          variant="outline"
        />
        
        {onCancel && (
          <StyledButton
            title="Cancel"
            onPress={onCancel}
            variant="outline"
          />
        )}
      </ButtonContainer>
    </Container>
  );
};