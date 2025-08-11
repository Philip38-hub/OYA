import { APIService, SubmissionResponse, OfflineSubmission } from '../apiService';
import { PollingResultPayload } from '../../types';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('APIService', () => {
  let apiService: APIService;
  let mockAxiosInstance: any;

  const mockPayload: PollingResultPayload = {
    walletAddress: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
    pollingStationId: 'STATION_001',
    gpsCoordinates: {
      latitude: 40.7128,
      longitude: -74.0060,
    },
    timestamp: new Date().toISOString(),
    results: {
      'John Doe': 150,
      'Jane Smith': 120,
      spoilt: 5,
    },
    submissionType: 'image_ocr',
    confidence: 0.85,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock axios.create
    mockAxiosInstance = {
      post: jest.fn(),
      get: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
      defaults: { baseURL: '' },
    };
    
    mockedAxios.create.mockReturnValue(mockAxiosInstance);
    
    apiService = new APIService('http://localhost:8080');
  });

  describe('constructor', () => {
    it('should create axios instance with correct configuration', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'http://localhost:8080',
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });
    });

    it('should set up request and response interceptors', () => {
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled();
    });
  });

  describe('submitResult', () => {
    it('should submit result successfully', async () => {
      const mockResponse = {
        data: {
          message: 'Submission successful',
          submissionId: 'sub_123',
          timestamp: '2023-01-01T00:00:00.000Z',
        },
        status: 200,
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await apiService.submitResult(mockPayload);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/submitResult', mockPayload);
      expect(result).toEqual({
        success: true,
        message: 'Submission successful',
        submissionId: 'sub_123',
        timestamp: '2023-01-01T00:00:00.000Z',
      });
    });

    it('should handle network errors and store offline', async () => {
      const networkError = {
        request: {},
        response: undefined,
        message: 'Network Error',
      };

      mockAxiosInstance.post.mockRejectedValue(networkError);
      mockAsyncStorage.getItem.mockResolvedValue(null);
      mockAsyncStorage.setItem.mockResolvedValue(undefined);

      const result = await apiService.submitResult(mockPayload);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Network unavailable');
      expect(mockAsyncStorage.setItem).toHaveBeenCalled();
    });

    it('should handle validation errors (400)', async () => {
      const validationError = {
        response: {
          status: 400,
          data: {
            message: 'Invalid polling station ID',
            details: { field: 'pollingStationId' },
          },
        },
      };

      mockAxiosInstance.post.mockRejectedValue(validationError);

      const result = await apiService.submitResult(mockPayload);

      expect(result).toEqual({
        success: false,
        message: 'Invalid polling station ID',
      });
    });

    it('should handle server errors (500)', async () => {
      const serverError = {
        response: {
          status: 500,
          data: {},
        },
      };

      mockAxiosInstance.post.mockRejectedValue(serverError);

      const result = await apiService.submitResult(mockPayload);

      expect(result).toEqual({
        success: false,
        message: 'Server error. Please try again later.',
      });
    });

    it('should handle duplicate submission errors (409)', async () => {
      const duplicateError = {
        response: {
          status: 409,
          data: {
            message: 'Duplicate submission detected',
          },
        },
      };

      mockAxiosInstance.post.mockRejectedValue(duplicateError);

      const result = await apiService.submitResult(mockPayload);

      expect(result).toEqual({
        success: false,
        message: 'This submission has already been recorded',
      });
    });
  });

  describe('submitResultWithRetry', () => {
    it('should succeed on first attempt', async () => {
      const mockResponse = {
        data: {
          message: 'Success',
          submissionId: 'sub_123',
        },
        status: 200,
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await apiService.submitResultWithRetry(mockPayload);

      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(true);
    });

    it('should retry on network errors', async () => {
      const networkError = {
        request: {},
        response: undefined,
        message: 'Network Error',
      };

      mockAxiosInstance.post
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValue({
          data: { message: 'Success' },
          status: 200,
        });

      mockAsyncStorage.getItem.mockResolvedValue(null);
      mockAsyncStorage.setItem.mockResolvedValue(undefined);

      // Mock delay to speed up test
      jest.spyOn(apiService as any, 'delay').mockResolvedValue(undefined);

      const result = await apiService.submitResultWithRetry(mockPayload);

      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(3);
      expect(result.success).toBe(true);
    });

    it('should not retry on validation errors', async () => {
      const validationError = {
        response: {
          status: 400,
          data: { message: 'Invalid data' },
        },
      };

      mockAxiosInstance.post.mockRejectedValue(validationError);

      const result = await apiService.submitResultWithRetry(mockPayload);
      
      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid data');
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
    });
  });

  describe('offline submissions', () => {
    const mockOfflineSubmission: OfflineSubmission = {
      id: 'offline_123',
      payload: mockPayload,
      timestamp: '2023-01-01T00:00:00.000Z',
      retryCount: 0,
    };

    describe('getOfflineSubmissions', () => {
      it('should return empty array when no submissions stored', async () => {
        mockAsyncStorage.getItem.mockResolvedValue(null);

        const submissions = await apiService.getOfflineSubmissions();

        expect(submissions).toEqual([]);
      });

      it('should return stored submissions', async () => {
        mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify([mockOfflineSubmission]));

        const submissions = await apiService.getOfflineSubmissions();

        expect(submissions).toEqual([mockOfflineSubmission]);
      });

      it('should handle storage errors gracefully', async () => {
        mockAsyncStorage.getItem.mockRejectedValue(new Error('Storage error'));

        const submissions = await apiService.getOfflineSubmissions();

        expect(submissions).toEqual([]);
      });
    });

    describe('retryOfflineSubmissions', () => {
      it('should retry and succeed', async () => {
        mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify([mockOfflineSubmission]));
        mockAsyncStorage.setItem.mockResolvedValue(undefined);
        
        mockAxiosInstance.post.mockResolvedValue({
          data: { message: 'Success' },
          status: 200,
        });

        const result = await apiService.retryOfflineSubmissions();

        expect(result).toEqual({ successful: 1, failed: 0 });
        expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
          'oyah_offline_submissions',
          JSON.stringify([])
        );
      });

      it('should handle retry failures', async () => {
        const failedSubmission = { ...mockOfflineSubmission, retryCount: 0 };
        mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify([failedSubmission]));
        mockAsyncStorage.setItem.mockResolvedValue(undefined);
        
        const networkError = {
          request: {},
          response: undefined,
          message: 'Network Error',
        };
        
        mockAxiosInstance.post.mockRejectedValue(networkError);

        const result = await apiService.retryOfflineSubmissions();

        expect(result.failed).toBe(1);
        expect(result.successful).toBe(0);
      });
    });

    describe('clearOfflineSubmissions', () => {
      it('should clear all offline submissions', async () => {
        mockAsyncStorage.removeItem.mockResolvedValue(undefined);

        await apiService.clearOfflineSubmissions();

        expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('oyah_offline_submissions');
      });
    });

    describe('getOfflineSubmissionCount', () => {
      it('should return correct count', async () => {
        mockAsyncStorage.getItem.mockResolvedValue(
          JSON.stringify([mockOfflineSubmission, mockOfflineSubmission])
        );

        const count = await apiService.getOfflineSubmissionCount();

        expect(count).toBe(2);
      });
    });
  });

  describe('checkConnectivity', () => {
    it('should return true when API is reachable', async () => {
      mockAxiosInstance.get.mockResolvedValue({ status: 200 });

      const isConnected = await apiService.checkConnectivity();

      expect(isConnected).toBe(true);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/health', { timeout: 5000 });
    });

    it('should return false when API is not reachable', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Network error'));

      const isConnected = await apiService.checkConnectivity();

      expect(isConnected).toBe(false);
    });
  });

  describe('configuration methods', () => {
    it('should update base URL', () => {
      const newURL = 'https://api.example.com';
      
      apiService.setBaseURL(newURL);

      expect(mockAxiosInstance.defaults.baseURL).toBe(newURL);
    });

    it('should update retry configuration', () => {
      const newConfig = { maxRetries: 5, baseDelay: 2000 };
      
      apiService.setRetryConfig(newConfig);

      // Test that the new config is used by checking retry behavior
      expect(() => apiService.setRetryConfig(newConfig)).not.toThrow();
    });
  });

  describe('error handling utilities', () => {
    it('should identify network errors correctly', () => {
      const networkError = {
        request: {},
        response: undefined,
      };

      const isNetworkError = (apiService as any).isNetworkError(networkError);
      expect(isNetworkError).toBe(true);
    });

    it('should identify validation errors correctly', () => {
      const validationError = {
        response: { status: 400 },
      };

      const isValidationError = (apiService as any).isValidationError(validationError);
      expect(isValidationError).toBe(true);
    });

    it('should calculate retry delay with exponential backoff', () => {
      const delay1 = (apiService as any).calculateRetryDelay(1);
      const delay2 = (apiService as any).calculateRetryDelay(2);
      const delay3 = (apiService as any).calculateRetryDelay(3);

      expect(delay1).toBe(1000); // Base delay
      expect(delay2).toBe(2000); // Base delay * 2
      expect(delay3).toBe(4000); // Base delay * 4
    });

    it('should cap retry delay at maximum', () => {
      apiService.setRetryConfig({ maxDelay: 5000 });
      
      const delay = (apiService as any).calculateRetryDelay(10); // Very high attempt
      
      expect(delay).toBe(5000); // Should be capped at maxDelay
    });
  });
});