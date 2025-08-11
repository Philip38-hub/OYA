import { errorHandlingService } from '../errorHandlingService';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

// Mock Alert
jest.mock('react-native', () => ({
  Alert: {
    alert: jest.fn(),
  },
  Platform: {
    OS: 'ios',
  },
}));

describe('ErrorHandlingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('handleNetworkError', () => {
    it('should handle network errors with retry mechanism', async () => {
      const error = new Error('Network connection failed');
      const context = {
        component: 'TestComponent',
        action: 'test_action',
        timestamp: new Date().toISOString(),
      };

      let retryCount = 0;
      const retryFunction = jest.fn().mockImplementation(() => {
        retryCount++;
        if (retryCount < 3) {
          throw new Error('Still failing');
        }
        return Promise.resolve('success');
      });

      const result = await errorHandlingService.handleNetworkError(
        error,
        context,
        retryFunction,
        {
          maxAttempts: 3,
          baseDelay: 100,
          maxDelay: 1000,
          backoffFactor: 2,
        }
      );

      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(retryFunction).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries', async () => {
      const error = new Error('Network connection failed');
      const context = {
        component: 'TestComponent',
        action: 'test_action',
        timestamp: new Date().toISOString(),
      };

      const retryFunction = jest.fn().mockRejectedValue(new Error('Always fails'));

      const result = await errorHandlingService.handleNetworkError(
        error,
        context,
        retryFunction,
        {
          maxAttempts: 2,
          baseDelay: 10,
          maxDelay: 100,
          backoffFactor: 2,
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect(retryFunction).toHaveBeenCalledTimes(2);
    });
  });

  describe('handleMLProcessingError', () => {
    it('should handle ML processing errors with fallback', async () => {
      const error = new Error('OCR processing failed');
      const context = {
        component: 'OCRService',
        action: 'process_image',
        timestamp: new Date().toISOString(),
      };

      const fallbackFunction = jest.fn().mockResolvedValue('fallback result');

      const result = await errorHandlingService.handleMLProcessingError(
        error,
        context,
        fallbackFunction
      );

      expect(result.success).toBe(true);
      expect(result.result).toBe('fallback result');
      expect(result.usedFallback).toBe(true);
      expect(fallbackFunction).toHaveBeenCalledTimes(1);
    });

    it('should handle ML processing errors without fallback', async () => {
      const error = new Error('STT processing failed');
      const context = {
        component: 'STTService',
        action: 'process_audio',
        timestamp: new Date().toISOString(),
      };

      const result = await errorHandlingService.handleMLProcessingError(
        error,
        context
      );

      expect(result.success).toBe(false);
      expect(result.usedFallback).toBe(false);
    });
  });

  describe('handleWalletError', () => {
    it('should provide recovery actions for wallet not found error', async () => {
      const error = new Error('Nova Wallet not found');
      const context = {
        component: 'WalletService',
        action: 'connect_wallet',
        timestamp: new Date().toISOString(),
      };

      const result = await errorHandlingService.handleWalletError(error, context);

      expect(result.success).toBe(false);
      expect(result.userMessage).toContain('Nova Wallet not found');
      expect(result.recoveryActions).toHaveLength(1);
      expect(result.recoveryActions[0].label).toBe('Install Nova Wallet');
      expect(result.recoveryActions[0].primary).toBe(true);
    });

    it('should provide recovery actions for connection rejected error', async () => {
      const error = new Error('Connection rejected by user');
      const context = {
        component: 'WalletService',
        action: 'connect_wallet',
        timestamp: new Date().toISOString(),
      };

      const result = await errorHandlingService.handleWalletError(error, context);

      expect(result.success).toBe(false);
      expect(result.userMessage).toContain('cancelled');
      expect(result.recoveryActions).toHaveLength(1);
      expect(result.recoveryActions[0].label).toBe('Try Again');
    });
  });

  describe('logError', () => {
    it('should log errors with context', async () => {
      const error = new Error('Test error');
      const context = {
        component: 'TestComponent',
        action: 'test_action',
        timestamp: new Date().toISOString(),
      };

      await errorHandlingService.logError(error, context, 'medium');

      const reports = await errorHandlingService.getErrorReports();
      expect(reports).toHaveLength(1);
      expect(reports[0].error.message).toBe('Test error');
      expect(reports[0].context.component).toBe('TestComponent');
      expect(reports[0].severity).toBe('medium');
    });
  });

  describe('error report management', () => {
    it('should clear error reports', async () => {
      const error = new Error('Test error');
      const context = {
        component: 'TestComponent',
        action: 'test_action',
        timestamp: new Date().toISOString(),
      };

      await errorHandlingService.logError(error, context, 'low');
      let reports = await errorHandlingService.getErrorReports();
      expect(reports).toHaveLength(1);

      await errorHandlingService.clearErrorReports();
      reports = await errorHandlingService.getErrorReports();
      expect(reports).toHaveLength(0);
    });
  });
});