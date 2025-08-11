import React, { useState, useEffect } from 'react';
import { View, Alert } from 'react-native';
import styled from 'styled-components/native';
import { theme } from '@/utils/theme';
import { StyledButton } from './StyledButton';
import { LoadingSpinner } from './LoadingSpinner';
import { errorHandlingService } from '@/services/errorHandlingService';

interface NetworkErrorHandlerProps {
  error: Error;
  onRetry: () => Promise<void>;
  onCancel?: () => void;
  context?: {
    component?: string;
    action?: string;
  };
  maxRetries?: number;
  showOfflineOption?: boolean;
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

const RetryInfo = styled.Text`
  font-size: ${theme.fontSize.sm}px;
  color: ${theme.colors.gray[500]};
  text-align: center;
  margin-bottom: ${theme.spacing.md}px;
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

export const NetworkErrorHandler: React.FC<NetworkErrorHandlerProps> = ({
  error,
  onRetry,
  onCancel,
  context = {},
  maxRetries = 3,
  showOfflineOption = false,
}) => {
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [retryDelay, setRetryDelay] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (retryDelay > 0) {
      interval = setInterval(() => {
        setRetryDelay(prev => Math.max(0, prev - 1));
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [retryDelay]);

  const handleRetry = async () => {
    if (isRetrying || retryCount >= maxRetries) return;

    setIsRetrying(true);
    
    try {
      const result = await errorHandlingService.handleNetworkError(
        error,
        {
          component: context.component || 'NetworkErrorHandler',
          action: context.action || 'manual_retry',
          timestamp: new Date().toISOString(),
        },
        onRetry,
        {
          maxAttempts: 1, // Single attempt since we're handling retries manually
          baseDelay: 1000,
          maxDelay: 5000,
          backoffFactor: 2,
        }
      );

      if (result.success) {
        // Success - the parent component should handle this
        setRetryCount(0);
      } else {
        // Failed - increment retry count and set delay
        const newRetryCount = retryCount + 1;
        setRetryCount(newRetryCount);
        
        if (newRetryCount < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, newRetryCount - 1), 30000);
          setRetryDelay(Math.floor(delay / 1000));
        }
      }
    } catch (retryError) {
      console.error('Retry failed:', retryError);
      setRetryCount(prev => prev + 1);
    } finally {
      setIsRetrying(false);
    }
  };

  const handleOfflineMode = () => {
    Alert.alert(
      'Offline Mode',
      'Your data will be saved locally and submitted when connection is restored.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Continue Offline', 
          onPress: () => {
            // Parent component should handle offline mode
            if (onCancel) {
              onCancel();
            }
          }
        },
      ]
    );
  };

  const getErrorMessage = () => {
    const errorMessage = error.message.toLowerCase();
    
    if (errorMessage.includes('network') || errorMessage.includes('connection')) {
      return 'Unable to connect to the server. Please check your internet connection and try again.';
    } else if (errorMessage.includes('timeout')) {
      return 'The request timed out. The server might be busy or your connection is slow.';
    } else if (errorMessage.includes('server')) {
      return 'The server is currently unavailable. Please try again in a few moments.';
    } else {
      return 'A network error occurred. Please check your connection and try again.';
    }
  };

  const canRetry = retryCount < maxRetries && retryDelay === 0;
  const hasExceededRetries = retryCount >= maxRetries;

  return (
    <Container>
      <ErrorIcon>📡</ErrorIcon>
      <ErrorTitle>
        {hasExceededRetries ? 'Connection Failed' : 'Network Error'}
      </ErrorTitle>
      <ErrorMessage>{getErrorMessage()}</ErrorMessage>
      
      {retryCount > 0 && (
        <RetryInfo>
          Attempt {retryCount} of {maxRetries}
          {retryDelay > 0 && ` • Retrying in ${retryDelay}s`}
        </RetryInfo>
      )}

      {isRetrying && (
        <LoadingContainer>
          <LoadingSpinner size="small" />
          <LoadingText>Retrying connection...</LoadingText>
        </LoadingContainer>
      )}

      <ButtonContainer>
        {canRetry && !isRetrying && (
          <StyledButton
            title={retryCount === 0 ? 'Try Again' : `Retry (${maxRetries - retryCount} left)`}
            onPress={handleRetry}
            variant="primary"
          />
        )}
        
        {hasExceededRetries && showOfflineOption && (
          <StyledButton
            title="Continue Offline"
            onPress={handleOfflineMode}
            variant="outline"
          />
        )}
        
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