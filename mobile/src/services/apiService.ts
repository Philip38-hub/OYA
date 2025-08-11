import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PollingResultPayload } from '../types';
import { errorHandlingService } from './errorHandlingService';

export interface SubmissionResponse {
  success: boolean;
  message: string;
  submissionId?: string;
  timestamp?: string;
}

export interface TallyResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export interface SubmissionError {
  code: string;
  message: string;
  details?: any;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number; // Base delay in milliseconds
  maxDelay: number; // Maximum delay in milliseconds
  backoffFactor: number; // Exponential backoff multiplier
}

export interface OfflineSubmission {
  id: string;
  payload: PollingResultPayload;
  timestamp: string;
  retryCount: number;
  lastAttempt?: string;
}

export class APIService {
  private client: AxiosInstance;
  private baseURL: string;
  private retryConfig: RetryConfig;
  private readonly OFFLINE_STORAGE_KEY = 'oyah_offline_submissions';

  constructor(baseURL: string = 'http://localhost:8080') {
    this.baseURL = baseURL;
    this.retryConfig = {
      maxRetries: 3,
      baseDelay: 1000, // 1 second
      maxDelay: 30000, // 30 seconds
      backoffFactor: 2,
    };

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000, // 30 seconds
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        console.log(`API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        console.error('API Response Error:', error.response?.status, error.message);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Submit polling results to the backend
   */
  async submitResult(payload: PollingResultPayload): Promise<SubmissionResponse> {
    const context = {
      component: 'APIService',
      action: 'submit_result',
      timestamp: new Date().toISOString(),
      additionalData: { pollingStationId: payload.pollingStationId },
    };

    try {
      const response: AxiosResponse<SubmissionResponse> = await this.client.post(
        '/api/v1/submitResult',
        payload
      );

      return {
        success: true,
        message: response.data.message || 'Submission successful',
        submissionId: response.data.submissionId,
        timestamp: response.data.timestamp || new Date().toISOString(),
      };
    } catch (error) {
      const submissionError = this.handleSubmissionError(error);
      
      // Log the error with context
      const apiError = error instanceof Error ? error : new Error('Unknown API error');
      await errorHandlingService.logError(apiError, context, 'medium');
      
      // Store for offline retry if it's a network error
      if (this.isNetworkError(error)) {
        await this.storeOfflineSubmission(payload);
        return {
          success: false,
          message: 'Network unavailable. Submission stored for retry when connection is restored.',
        };
      }

      return {
        success: false,
        message: submissionError.message,
      };
    }
  }

  /**
   * Submit result with retry logic
   */
  async submitResultWithRetry(payload: PollingResultPayload): Promise<SubmissionResponse> {
    let lastError: any;

    for (let attempt = 1; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        const result = await this.submitResult(payload);
        
        if (result.success) {
          return result;
        }

        // If it's not a network error, don't retry
        if (!result.message.includes('Network unavailable')) {
          return result;
        }

        lastError = new Error(result.message);
      } catch (error) {
        lastError = error;
        
        // Don't retry on validation errors (4xx status codes)
        if (this.isValidationError(error)) {
          throw error;
        }
      }

      // Wait before retry (except on last attempt)
      if (attempt < this.retryConfig.maxRetries) {
        const delay = this.calculateRetryDelay(attempt);
        console.log(`Retrying submission in ${delay}ms (attempt ${attempt + 1}/${this.retryConfig.maxRetries})`);
        await this.delay(delay);
      }
    }

    // All retries failed
    throw lastError || new Error('All retry attempts failed');
  }

  /**
   * Store submission for offline retry
   */
  private async storeOfflineSubmission(payload: PollingResultPayload): Promise<void> {
    try {
      const existingSubmissions = await this.getOfflineSubmissions();
      
      const offlineSubmission: OfflineSubmission = {
        id: this.generateSubmissionId(),
        payload,
        timestamp: new Date().toISOString(),
        retryCount: 0,
      };

      const updatedSubmissions = [...existingSubmissions, offlineSubmission];
      
      await AsyncStorage.setItem(
        this.OFFLINE_STORAGE_KEY,
        JSON.stringify(updatedSubmissions)
      );

      console.log(`Stored offline submission: ${offlineSubmission.id}`);
    } catch (error) {
      console.error('Failed to store offline submission:', error);
    }
  }

  /**
   * Get all offline submissions
   */
  async getOfflineSubmissions(): Promise<OfflineSubmission[]> {
    try {
      const stored = await AsyncStorage.getItem(this.OFFLINE_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to get offline submissions:', error);
      return [];
    }
  }

  /**
   * Retry all offline submissions
   */
  async retryOfflineSubmissions(): Promise<{ successful: number; failed: number }> {
    const offlineSubmissions = await this.getOfflineSubmissions();
    let successful = 0;
    let failed = 0;
    const remainingSubmissions: OfflineSubmission[] = [];

    for (const submission of offlineSubmissions) {
      try {
        const result = await this.submitResult(submission.payload);
        
        if (result.success) {
          successful++;
          console.log(`Successfully submitted offline submission: ${submission.id}`);
        } else {
          // Update retry count and keep for later
          submission.retryCount++;
          submission.lastAttempt = new Date().toISOString();
          
          // Remove submissions that have exceeded max retries
          if (submission.retryCount < this.retryConfig.maxRetries) {
            remainingSubmissions.push(submission);
          }
          
          failed++;
        }
      } catch (error) {
        submission.retryCount++;
        submission.lastAttempt = new Date().toISOString();
        
        if (submission.retryCount < this.retryConfig.maxRetries) {
          remainingSubmissions.push(submission);
        }
        
        failed++;
        console.error(`Failed to retry offline submission ${submission.id}:`, error);
      }
    }

    // Update stored submissions
    await AsyncStorage.setItem(
      this.OFFLINE_STORAGE_KEY,
      JSON.stringify(remainingSubmissions)
    );

    return { successful, failed };
  }

  /**
   * Clear all offline submissions
   */
  async clearOfflineSubmissions(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.OFFLINE_STORAGE_KEY);
      console.log('Cleared all offline submissions');
    } catch (error) {
      console.error('Failed to clear offline submissions:', error);
    }
  }

  /**
   * Get the count of pending offline submissions
   */
  async getOfflineSubmissionCount(): Promise<number> {
    const submissions = await this.getOfflineSubmissions();
    return submissions.length;
  }

  /**
   * Get tally data for a voting process
   */
  async getTally(votingProcessId: string): Promise<TallyResponse> {
    try {
      const response = await this.client.get(`/api/v1/getTally/${votingProcessId}`);
      
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error('Failed to fetch tally data:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch tally data',
      };
    }
  }

  /**
   * Check if the API is reachable
   */
  async checkConnectivity(): Promise<boolean> {
    try {
      const response = await this.client.get('/api/v1/health', { timeout: 5000 });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  /**
   * Handle submission errors and convert to user-friendly messages
   */
  private handleSubmissionError(error: any): SubmissionError {
    if (error?.response) {
      // Server responded with error status
      const status = error.response.status;
      const data = error.response.data as any;
      
      switch (status) {
        case 400:
          return {
            code: 'VALIDATION_ERROR',
            message: data?.message || 'Invalid submission data',
            details: data?.details,
          };
        case 401:
          return {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          };
        case 403:
          return {
            code: 'FORBIDDEN',
            message: 'Access denied',
          };
        case 409:
          return {
            code: 'DUPLICATE_SUBMISSION',
            message: 'This submission has already been recorded',
          };
        case 429:
          return {
            code: 'RATE_LIMITED',
            message: 'Too many requests. Please try again later.',
          };
        case 500:
          return {
            code: 'SERVER_ERROR',
            message: 'Server error. Please try again later.',
          };
        default:
          return {
            code: 'HTTP_ERROR',
            message: `Server error (${status}). Please try again later.`,
          };
      }
    } else if (error?.request) {
      // Network error
      return {
        code: 'NETWORK_ERROR',
        message: 'Network connection failed. Please check your internet connection.',
      };
    }

    return {
      code: 'UNKNOWN_ERROR',
      message: 'An unexpected error occurred. Please try again.',
    };
  }

  /**
   * Check if error is a network error
   */
  private isNetworkError(error: any): boolean {
    // Check for axios error structure
    return error && error.request && !error.response;
  }

  /**
   * Check if error is a validation error (4xx status)
   */
  private isValidationError(error: any): boolean {
    const status = error?.response?.status;
    return status !== undefined && status >= 400 && status < 500;
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attempt: number): number {
    const delay = this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffFactor, attempt - 1);
    return Math.min(delay, this.retryConfig.maxDelay);
  }

  /**
   * Generate a unique submission ID
   */
  private generateSubmissionId(): string {
    return `submission_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Delay utility function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Update base URL
   */
  setBaseURL(baseURL: string): void {
    this.baseURL = baseURL;
    this.client.defaults.baseURL = baseURL;
  }

  /**
   * Update retry configuration
   */
  setRetryConfig(config: Partial<RetryConfig>): void {
    this.retryConfig = { ...this.retryConfig, ...config };
  }
}

// Create and export a default instance
export const apiService = new APIService();