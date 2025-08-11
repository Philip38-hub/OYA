import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Platform } from 'react-native';

export interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  timestamp: string;
  additionalData?: any;
}

export interface ErrorReport {
  id: string;
  error: Error;
  context: ErrorContext;
  severity: 'low' | 'medium' | 'high' | 'critical';
  handled: boolean;
}

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
}

export interface RecoveryAction {
  label: string;
  action: () => Promise<void> | void;
  primary?: boolean;
}

export class ErrorHandlingService {
  private static instance: ErrorHandlingService;
  private errorReports: ErrorReport[] = [];
  private readonly ERROR_STORAGE_KEY = 'oyah_error_reports';
  private readonly MAX_STORED_ERRORS = 50;

  private constructor() {}

  static getInstance(): ErrorHandlingService {
    if (!ErrorHandlingService.instance) {
      ErrorHandlingService.instance = new ErrorHandlingService();
    }
    return ErrorHandlingService.instance;
  }

  /**
   * Handle network errors with retry mechanisms
   */
  async handleNetworkError(
    error: Error,
    context: ErrorContext,
    retryFunction?: () => Promise<any>,
    retryConfig: RetryConfig = {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffFactor: 2,
    }
  ): Promise<{ success: boolean; result?: any; error?: Error }> {
    console.log('Handling network error:', error.message, context);

    // Log the error
    await this.logError(error, context, 'medium');

    if (!retryFunction) {
      return { success: false, error };
    }

    let lastError = error;
    
    for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
      try {
        console.log(`Retry attempt ${attempt}/${retryConfig.maxAttempts}`);
        
        const result = await retryFunction();
        console.log('Retry successful');
        
        return { success: true, result };
      } catch (retryError) {
        lastError = retryError instanceof Error ? retryError : new Error(String(retryError));
        
        // Don't wait after the last attempt
        if (attempt < retryConfig.maxAttempts) {
          const delay = this.calculateRetryDelay(attempt, retryConfig);
          console.log(`Waiting ${delay}ms before next retry`);
          await this.delay(delay);
        }
      }
    }

    // All retries failed
    await this.logError(lastError, { ...context, action: `${context.action}_retry_failed` }, 'high');
    return { success: false, error: lastError };
  }

  /**
   * Handle ML processing failures with fallbacks
   */
  async handleMLProcessingError(
    error: Error,
    context: ErrorContext,
    fallbackFunction?: () => Promise<any>
  ): Promise<{ success: boolean; result?: any; usedFallback: boolean }> {
    console.log('Handling ML processing error:', error.message, context);

    // Log the error
    await this.logError(error, context, 'medium');

    if (fallbackFunction) {
      try {
        console.log('Attempting fallback processing');
        const result = await fallbackFunction();
        console.log('Fallback processing successful');
        
        return { success: true, result, usedFallback: true };
      } catch (fallbackError) {
        const fallbackErr = fallbackError instanceof Error ? fallbackError : new Error(String(fallbackError));
        await this.logError(fallbackErr, { ...context, action: `${context.action}_fallback_failed` }, 'high');
        return { success: false, usedFallback: true };
      }
    }

    return { success: false, usedFallback: false };
  }

  /**
   * Handle wallet connection errors with recovery options
   */
  async handleWalletError(
    error: Error,
    context: ErrorContext
  ): Promise<{ 
    success: boolean; 
    recoveryActions: RecoveryAction[];
    userMessage: string;
  }> {
    console.log('Handling wallet error:', error.message, context);

    // Log the error
    await this.logError(error, context, 'high');

    const recoveryActions: RecoveryAction[] = [];
    let userMessage = 'Wallet connection failed. Please try again.';

    // Analyze error type and provide specific recovery actions
    const errorMessage = error.message.toLowerCase();

    if (errorMessage.includes('not found') || errorMessage.includes('not installed')) {
      userMessage = 'Nova Wallet not found. Please install Nova Wallet to continue.';
      recoveryActions.push({
        label: 'Install Nova Wallet',
        action: () => this.openWalletInstallation(),
        primary: true,
      });
    } else if (errorMessage.includes('rejected') || errorMessage.includes('cancelled')) {
      userMessage = 'Connection was cancelled. Please approve the connection request.';
      recoveryActions.push({
        label: 'Try Again',
        action: () => Promise.resolve(),
        primary: true,
      });
    } else if (errorMessage.includes('timeout')) {
      userMessage = 'Connection timed out. Please ensure Nova Wallet is running and try again.';
      recoveryActions.push({
        label: 'Retry Connection',
        action: () => Promise.resolve(),
        primary: true,
      });
    } else if (errorMessage.includes('network')) {
      userMessage = 'Network connection failed. Please check your internet connection.';
      recoveryActions.push({
        label: 'Check Connection',
        action: () => this.checkNetworkConnection(),
      });
      recoveryActions.push({
        label: 'Retry',
        action: () => Promise.resolve(),
        primary: true,
      });
    } else {
      // Generic error
      recoveryActions.push({
        label: 'Try Again',
        action: () => Promise.resolve(),
        primary: true,
      });
      recoveryActions.push({
        label: 'Report Issue',
        action: () => this.reportIssue(error, context),
      });
    }

    return {
      success: false,
      recoveryActions,
      userMessage,
    };
  }

  /**
   * Show user-friendly error message with recovery options
   */
  showUserFriendlyError(
    title: string,
    message: string,
    recoveryActions: RecoveryAction[] = []
  ): void {
    if (recoveryActions.length === 0) {
      Alert.alert(title, message, [{ text: 'OK' }]);
      return;
    }

    const buttons = recoveryActions.map(action => ({
      text: action.label,
      onPress: action.action,
      style: action.primary ? 'default' : 'cancel' as any,
    }));

    // Add cancel button if not already present
    if (!buttons.some(b => b.style === 'cancel')) {
      buttons.push({ 
        text: 'Cancel', 
        style: 'cancel' as any,
        onPress: () => {} // Empty function for cancel
      });
    }

    Alert.alert(title, message, buttons);
  }

  /**
   * Log error for debugging and analytics
   */
  async logError(
    error: Error,
    context: ErrorContext,
    severity: 'low' | 'medium' | 'high' | 'critical'
  ): Promise<void> {
    const errorReport: ErrorReport = {
      id: this.generateErrorId(),
      error,
      context: {
        ...context,
        timestamp: new Date().toISOString(),
      },
      severity,
      handled: true,
    };

    // Add to in-memory collection
    this.errorReports.unshift(errorReport);
    
    // Keep only the most recent errors
    if (this.errorReports.length > this.MAX_STORED_ERRORS) {
      this.errorReports = this.errorReports.slice(0, this.MAX_STORED_ERRORS);
    }

    // Persist to storage
    try {
      await AsyncStorage.setItem(
        this.ERROR_STORAGE_KEY,
        JSON.stringify(this.errorReports.map(report => ({
          ...report,
          error: {
            name: report.error.name,
            message: report.error.message,
            stack: report.error.stack,
          },
        })))
      );
    } catch (storageError) {
      console.error('Failed to persist error report:', storageError);
    }

    // Log to console for development
    console.error(`[${severity.toUpperCase()}] Error in ${context.component || 'Unknown'}:`, {
      error: error.message,
      context,
      stack: error.stack,
    });
  }

  /**
   * Get error reports for debugging
   */
  async getErrorReports(): Promise<ErrorReport[]> {
    try {
      const stored = await AsyncStorage.getItem(this.ERROR_STORAGE_KEY);
      if (stored) {
        const parsedReports = JSON.parse(stored);
        return parsedReports.map((report: any) => ({
          ...report,
          error: new Error(report.error.message),
        }));
      }
    } catch (error) {
      console.error('Failed to load error reports:', error);
    }
    
    return this.errorReports;
  }

  /**
   * Clear error reports
   */
  async clearErrorReports(): Promise<void> {
    try {
      this.errorReports = [];
      await AsyncStorage.removeItem(this.ERROR_STORAGE_KEY);
      console.log('Error reports cleared');
    } catch (error) {
      console.error('Failed to clear error reports:', error);
    }
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attempt: number, config: RetryConfig): number {
    const delay = config.baseDelay * Math.pow(config.backoffFactor, attempt - 1);
    return Math.min(delay, config.maxDelay);
  }

  /**
   * Delay utility function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate unique error ID
   */
  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Open wallet installation guide
   */
  private async openWalletInstallation(): Promise<void> {
    // In a real app, this would open the app store or wallet website
    Alert.alert(
      'Install Nova Wallet',
      'Please visit the app store to install Nova Wallet, then return to this app.',
      [{ text: 'OK' }]
    );
  }

  /**
   * Check network connection
   */
  private async checkNetworkConnection(): Promise<void> {
    // In a real app, this would check actual network connectivity
    Alert.alert(
      'Network Check',
      'Please ensure you have a stable internet connection and try again.',
      [{ text: 'OK' }]
    );
  }

  /**
   * Report issue to support
   */
  async reportIssue(error: Error, context: ErrorContext): Promise<void> {
    // In a real app, this would send error report to support system
    Alert.alert(
      'Report Issue',
      'Error details have been logged. Please contact support if the issue persists.',
      [{ text: 'OK' }]
    );
  }
}

// Export singleton instance
export const errorHandlingService = ErrorHandlingService.getInstance();