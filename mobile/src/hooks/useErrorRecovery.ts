import { useState, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { errorHandlingService, RecoveryAction } from '@/services/errorHandlingService';

export interface ErrorRecoveryState {
  isRecovering: boolean;
  error: Error | null;
  recoveryActions: RecoveryAction[];
  userMessage: string;
  retryCount: number;
}

export interface ErrorRecoveryOptions {
  maxRetries?: number;
  showUserFriendlyMessages?: boolean;
  autoRetryNetworkErrors?: boolean;
  logErrors?: boolean;
}

export interface UseErrorRecoveryReturn {
  state: ErrorRecoveryState;
  handleError: (error: Error, context?: any) => Promise<void>;
  retry: (retryFunction: () => Promise<any>) => Promise<boolean>;
  clearError: () => void;
  showRecoveryOptions: () => void;
}

const defaultOptions: ErrorRecoveryOptions = {
  maxRetries: 3,
  showUserFriendlyMessages: true,
  autoRetryNetworkErrors: false,
  logErrors: true,
};

export const useErrorRecovery = (
  options: ErrorRecoveryOptions = {}
): UseErrorRecoveryReturn => {
  const opts = { ...defaultOptions, ...options };
  const retryFunctionRef = useRef<(() => Promise<any>) | null>(null);

  const [state, setState] = useState<ErrorRecoveryState>({
    isRecovering: false,
    error: null,
    recoveryActions: [],
    userMessage: '',
    retryCount: 0,
  });

  const handleError = useCallback(async (error: Error, context?: any) => {
    const errorContext = {
      component: context?.component || 'useErrorRecovery',
      action: context?.action || 'handle_error',
      timestamp: new Date().toISOString(),
      ...context,
    };

    // Log error if enabled
    if (opts.logErrors) {
      await errorHandlingService.logError(error, errorContext, 'medium');
    }

    // Determine error type and get recovery actions
    let recoveryActions: RecoveryAction[] = [];
    let userMessage = error.message;

    if (error.message.toLowerCase().includes('network') || 
        error.message.toLowerCase().includes('connection')) {
      // Network error
      const result = await errorHandlingService.handleNetworkError(error, errorContext);
      userMessage = 'Network connection failed. Please check your internet connection.';
      
      recoveryActions = [
        {
          label: 'Retry',
          action: async () => {
            if (retryFunctionRef.current) {
              await retry(retryFunctionRef.current);
            }
          },
          primary: true,
        },
        {
          label: 'Continue Offline',
          action: () => {
            // Handle offline mode
            clearError();
          },
        },
      ];
    } else if (error.message.toLowerCase().includes('wallet')) {
      // Wallet error
      const result = await errorHandlingService.handleWalletError(error, errorContext);
      userMessage = result.userMessage;
      recoveryActions = result.recoveryActions;
    } else if (error.message.toLowerCase().includes('ocr') || 
               error.message.toLowerCase().includes('speech') ||
               error.message.toLowerCase().includes('tensorflow')) {
      // ML processing error
      userMessage = 'Processing failed. You can try again or enter data manually.';
      
      recoveryActions = [
        {
          label: 'Try Again',
          action: async () => {
            if (retryFunctionRef.current) {
              await retry(retryFunctionRef.current);
            }
          },
          primary: true,
        },
        {
          label: 'Enter Manually',
          action: () => {
            // Handle manual entry
            clearError();
          },
        },
      ];
    } else {
      // Generic error
      recoveryActions = [
        {
          label: 'Try Again',
          action: async () => {
            if (retryFunctionRef.current) {
              await retry(retryFunctionRef.current);
            }
          },
          primary: true,
        },
        {
          label: 'Cancel',
          action: () => clearError(),
        },
      ];
    }

    setState({
      isRecovering: false,
      error,
      recoveryActions,
      userMessage,
      retryCount: 0,
    });

    // Show user-friendly message if enabled
    if (opts.showUserFriendlyMessages) {
      showRecoveryOptions();
    }
  }, [opts]);

  const retry = useCallback(async (retryFunction: () => Promise<any>): Promise<boolean> => {
    if (state.retryCount >= (opts.maxRetries || 3)) {
      Alert.alert(
        'Maximum Retries Exceeded',
        'The operation has failed multiple times. Please try again later or contact support.',
        [{ text: 'OK', onPress: clearError }]
      );
      return false;
    }

    setState(prev => ({
      ...prev,
      isRecovering: true,
      retryCount: prev.retryCount + 1,
    }));

    retryFunctionRef.current = retryFunction;

    try {
      await retryFunction();
      
      // Success - clear error state
      setState({
        isRecovering: false,
        error: null,
        recoveryActions: [],
        userMessage: '',
        retryCount: 0,
      });
      
      return true;
    } catch (retryError) {
      const error = retryError instanceof Error ? retryError : new Error('Retry failed');
      
      setState(prev => ({
        ...prev,
        isRecovering: false,
        error,
        userMessage: error.message,
      }));
      
      return false;
    }
  }, [state.retryCount, opts.maxRetries]);

  const clearError = useCallback(() => {
    setState({
      isRecovering: false,
      error: null,
      recoveryActions: [],
      userMessage: '',
      retryCount: 0,
    });
    retryFunctionRef.current = null;
  }, []);

  const showRecoveryOptions = useCallback(() => {
    if (!state.error || state.recoveryActions.length === 0) {
      return;
    }

    const buttons = state.recoveryActions.map(action => ({
      text: action.label,
      onPress: action.action,
      style: action.primary ? 'default' : 'cancel' as any,
    }));

    // Add cancel button if not already present
    if (!buttons.some(b => b.style === 'cancel')) {
      buttons.push({
        text: 'Cancel',
        style: 'cancel' as any,
        onPress: clearError,
      });
    }

    Alert.alert(
      'Error Occurred',
      state.userMessage,
      buttons
    );
  }, [state.error, state.recoveryActions, state.userMessage, clearError]);

  return {
    state,
    handleError,
    retry,
    clearError,
    showRecoveryOptions,
  };
};