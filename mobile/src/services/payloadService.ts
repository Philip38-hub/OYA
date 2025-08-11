import { PollingResultPayload } from '../types';
import { GPSCoordinates, LocationResult } from './locationService';

export interface PayloadBuilderOptions {
  walletAddress: string;
  pollingStationId: string;
  results: { [candidateName: string]: number };
  submissionType: 'image_ocr' | 'audio_stt';
  confidence: number;
  locationResult?: LocationResult;
}

export interface ValidationError {
  field: string;
  message: string;
}

export class PayloadService {
  /**
   * Build a complete polling result payload
   */
  static buildPayload(options: PayloadBuilderOptions): PollingResultPayload {
    const {
      walletAddress,
      pollingStationId,
      results,
      submissionType,
      confidence,
      locationResult,
    } = options;

    // Use provided location or default coordinates
    const gpsCoordinates = locationResult
      ? {
          latitude: locationResult.coordinates.latitude,
          longitude: locationResult.coordinates.longitude,
        }
      : {
          latitude: 0,
          longitude: 0,
        };

    // Ensure spoilt votes are included
    const processedResults = {
      ...results,
      spoilt: results.spoilt || 0,
    };

    const payload: PollingResultPayload = {
      walletAddress,
      pollingStationId,
      gpsCoordinates,
      timestamp: new Date().toISOString(),
      results: processedResults,
      submissionType,
      confidence: Math.max(0, Math.min(1, confidence)), // Clamp between 0 and 1
    };

    return payload;
  }

  /**
   * Validate a polling result payload
   */
  static validatePayload(payload: PollingResultPayload): ValidationError[] {
    const errors: ValidationError[] = [];

    // Validate wallet address
    if (!payload.walletAddress || typeof payload.walletAddress !== 'string') {
      errors.push({
        field: 'walletAddress',
        message: 'Wallet address is required and must be a string',
      });
    } else if (payload.walletAddress.trim().length === 0) {
      errors.push({
        field: 'walletAddress',
        message: 'Wallet address cannot be empty',
      });
    }

    // Validate polling station ID
    if (!payload.pollingStationId || typeof payload.pollingStationId !== 'string') {
      errors.push({
        field: 'pollingStationId',
        message: 'Polling station ID is required and must be a string',
      });
    } else if (payload.pollingStationId.trim().length === 0) {
      errors.push({
        field: 'pollingStationId',
        message: 'Polling station ID cannot be empty',
      });
    }

    // Validate GPS coordinates
    if (!payload.gpsCoordinates) {
      errors.push({
        field: 'gpsCoordinates',
        message: 'GPS coordinates are required',
      });
    } else {
      const { latitude, longitude } = payload.gpsCoordinates;

      if (typeof latitude !== 'number' || isNaN(latitude)) {
        errors.push({
          field: 'gpsCoordinates.latitude',
          message: 'Latitude must be a valid number',
        });
      } else if (latitude < -90 || latitude > 90) {
        errors.push({
          field: 'gpsCoordinates.latitude',
          message: 'Latitude must be between -90 and 90 degrees',
        });
      }

      if (typeof longitude !== 'number' || isNaN(longitude)) {
        errors.push({
          field: 'gpsCoordinates.longitude',
          message: 'Longitude must be a valid number',
        });
      } else if (longitude < -180 || longitude > 180) {
        errors.push({
          field: 'gpsCoordinates.longitude',
          message: 'Longitude must be between -180 and 180 degrees',
        });
      }
    }

    // Validate timestamp
    if (!payload.timestamp || typeof payload.timestamp !== 'string') {
      errors.push({
        field: 'timestamp',
        message: 'Timestamp is required and must be a string',
      });
    } else {
      const date = new Date(payload.timestamp);
      if (isNaN(date.getTime())) {
        errors.push({
          field: 'timestamp',
          message: 'Timestamp must be a valid ISO date string',
        });
      } else {
        // Check if timestamp is not too old (more than 8 hours)
        const now = new Date();
        const eightHoursAgo = new Date(now.getTime() - 8 * 60 * 60 * 1000);
        
        if (date < eightHoursAgo) {
          errors.push({
            field: 'timestamp',
            message: 'Timestamp cannot be older than 8 hours',
          });
        }

        // Check if timestamp is not in the future (more than 5 minutes)
        const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
        
        if (date > fiveMinutesFromNow) {
          errors.push({
            field: 'timestamp',
            message: 'Timestamp cannot be more than 5 minutes in the future',
          });
        }
      }
    }

    // Validate results
    if (!payload.results || typeof payload.results !== 'object') {
      errors.push({
        field: 'results',
        message: 'Results are required and must be an object',
      });
    } else {
      const resultEntries = Object.entries(payload.results);
      
      if (resultEntries.length === 0) {
        errors.push({
          field: 'results',
          message: 'Results cannot be empty',
        });
      }

      // Validate each result entry
      for (const [candidate, votes] of resultEntries) {
        if (typeof candidate !== 'string' || candidate.trim().length === 0) {
          errors.push({
            field: `results.${candidate}`,
            message: 'Candidate name must be a non-empty string',
          });
        }

        if (typeof votes !== 'number' || isNaN(votes) || votes < 0 || !Number.isInteger(votes)) {
          errors.push({
            field: `results.${candidate}`,
            message: 'Vote count must be a non-negative integer',
          });
        }
      }

      // Ensure spoilt votes are present
      if (!('spoilt' in payload.results)) {
        errors.push({
          field: 'results.spoilt',
          message: 'Spoilt votes count is required',
        });
      }
    }

    // Validate submission type
    if (!payload.submissionType) {
      errors.push({
        field: 'submissionType',
        message: 'Submission type is required',
      });
    } else if (!['image_ocr', 'audio_stt'].includes(payload.submissionType)) {
      errors.push({
        field: 'submissionType',
        message: 'Submission type must be either "image_ocr" or "audio_stt"',
      });
    }

    // Validate confidence
    if (typeof payload.confidence !== 'number' || isNaN(payload.confidence)) {
      errors.push({
        field: 'confidence',
        message: 'Confidence must be a number',
      });
    } else if (payload.confidence < 0 || payload.confidence > 1) {
      errors.push({
        field: 'confidence',
        message: 'Confidence must be between 0 and 1',
      });
    }

    return errors;
  }

  /**
   * Check if a payload is valid
   */
  static isValidPayload(payload: PollingResultPayload): boolean {
    return this.validatePayload(payload).length === 0;
  }

  /**
   * Calculate total votes from results
   */
  static calculateTotalVotes(results: { [candidateName: string]: number }): number {
    return Object.values(results).reduce((total, votes) => total + votes, 0);
  }

  /**
   * Format payload for display/debugging
   */
  static formatPayloadForDisplay(payload: PollingResultPayload): string {
    const totalVotes = this.calculateTotalVotes(payload.results);
    const location = `${payload.gpsCoordinates.latitude.toFixed(6)}, ${payload.gpsCoordinates.longitude.toFixed(6)}`;
    
    return [
      `Station: ${payload.pollingStationId}`,
      `Wallet: ${payload.walletAddress.substring(0, 8)}...`,
      `Location: ${location}`,
      `Type: ${payload.submissionType}`,
      `Confidence: ${(payload.confidence * 100).toFixed(1)}%`,
      `Total Votes: ${totalVotes}`,
      `Timestamp: ${new Date(payload.timestamp).toLocaleString()}`,
    ].join('\n');
  }

  /**
   * Create a payload from OCR results
   */
  static createFromOCRResults(
    walletAddress: string,
    pollingStationId: string,
    ocrResults: { [key: string]: number },
    confidence: number,
    locationResult?: LocationResult
  ): PollingResultPayload {
    return this.buildPayload({
      walletAddress,
      pollingStationId,
      results: ocrResults,
      submissionType: 'image_ocr',
      confidence,
      locationResult,
    });
  }

  /**
   * Create a payload from speech-to-text results
   */
  static createFromSTTResults(
    walletAddress: string,
    pollingStationId: string,
    sttResults: { [key: string]: number },
    confidence: number,
    locationResult?: LocationResult
  ): PollingResultPayload {
    return this.buildPayload({
      walletAddress,
      pollingStationId,
      results: sttResults,
      submissionType: 'audio_stt',
      confidence,
      locationResult,
    });
  }

  /**
   * Sanitize results to ensure they are valid
   */
  static sanitizeResults(results: { [key: string]: number }): { [key: string]: number } {
    const sanitized: { [key: string]: number } = {};

    for (const [candidate, votes] of Object.entries(results)) {
      // Clean candidate name
      const cleanCandidate = candidate.trim();
      if (cleanCandidate.length === 0) continue;

      // Ensure votes is a valid non-negative integer
      const cleanVotes = Math.max(0, Math.floor(Number(votes) || 0));
      sanitized[cleanCandidate] = cleanVotes;
    }

    // Ensure spoilt votes are present
    if (!('spoilt' in sanitized)) {
      sanitized.spoilt = 0;
    }

    return sanitized;
  }
}