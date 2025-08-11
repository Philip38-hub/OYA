import { PayloadService, PayloadBuilderOptions, ValidationError } from '../payloadService';
import { PollingResultPayload } from '../../types';
import { LocationResult } from '../locationService';

describe('PayloadService', () => {
  const mockLocationResult: LocationResult = {
    coordinates: {
      latitude: 40.7128,
      longitude: -74.0060,
      accuracy: 10,
    },
    timestamp: Date.now(),
    accuracy: 10,
  };

  const validPayloadOptions: PayloadBuilderOptions = {
    walletAddress: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
    pollingStationId: 'STATION_001',
    results: {
      'John Doe': 150,
      'Jane Smith': 120,
      'Bob Johnson': 80,
      spoilt: 5,
    },
    submissionType: 'image_ocr',
    confidence: 0.85,
    locationResult: mockLocationResult,
  };

  describe('buildPayload', () => {
    it('should build a valid payload with all required fields', () => {
      const payload = PayloadService.buildPayload(validPayloadOptions);

      expect(payload).toEqual({
        walletAddress: validPayloadOptions.walletAddress,
        pollingStationId: validPayloadOptions.pollingStationId,
        gpsCoordinates: {
          latitude: 40.7128,
          longitude: -74.0060,
        },
        timestamp: expect.any(String),
        results: validPayloadOptions.results,
        submissionType: 'image_ocr',
        confidence: 0.85,
      });

      // Verify timestamp is valid ISO string
      expect(new Date(payload.timestamp).toISOString()).toBe(payload.timestamp);
    });

    it('should use default GPS coordinates when location is not provided', () => {
      const optionsWithoutLocation = { ...validPayloadOptions };
      delete optionsWithoutLocation.locationResult;

      const payload = PayloadService.buildPayload(optionsWithoutLocation);

      expect(payload.gpsCoordinates).toEqual({
        latitude: 0,
        longitude: 0,
      });
    });

    it('should ensure spoilt votes are included', () => {
      const optionsWithoutSpoilt = {
        ...validPayloadOptions,
        results: {
          'John Doe': 150,
          'Jane Smith': 120,
        },
      };

      const payload = PayloadService.buildPayload(optionsWithoutSpoilt);

      expect(payload.results.spoilt).toBe(0);
    });

    it('should clamp confidence values between 0 and 1', () => {
      const highConfidenceOptions = { ...validPayloadOptions, confidence: 1.5 };
      const lowConfidenceOptions = { ...validPayloadOptions, confidence: -0.5 };

      const highPayload = PayloadService.buildPayload(highConfidenceOptions);
      const lowPayload = PayloadService.buildPayload(lowConfidenceOptions);

      expect(highPayload.confidence).toBe(1);
      expect(lowPayload.confidence).toBe(0);
    });
  });

  describe('validatePayload', () => {
    let validPayload: PollingResultPayload;

    beforeEach(() => {
      validPayload = PayloadService.buildPayload(validPayloadOptions);
    });

    it('should return no errors for a valid payload', () => {
      const errors = PayloadService.validatePayload(validPayload);
      expect(errors).toEqual([]);
    });

    it('should validate wallet address', () => {
      const invalidPayloads = [
        { ...validPayload, walletAddress: '' },
        { ...validPayload, walletAddress: '   ' },
        { ...validPayload, walletAddress: null as any },
        { ...validPayload, walletAddress: undefined as any },
      ];

      invalidPayloads.forEach((payload) => {
        const errors = PayloadService.validatePayload(payload);
        expect(errors.some(e => e.field === 'walletAddress')).toBe(true);
      });
    });

    it('should validate polling station ID', () => {
      const invalidPayloads = [
        { ...validPayload, pollingStationId: '' },
        { ...validPayload, pollingStationId: '   ' },
        { ...validPayload, pollingStationId: null as any },
        { ...validPayload, pollingStationId: undefined as any },
      ];

      invalidPayloads.forEach((payload) => {
        const errors = PayloadService.validatePayload(payload);
        expect(errors.some(e => e.field === 'pollingStationId')).toBe(true);
      });
    });

    it('should validate GPS coordinates', () => {
      const invalidCoordinates = [
        { latitude: 91, longitude: 0 }, // Invalid latitude
        { latitude: -91, longitude: 0 }, // Invalid latitude
        { latitude: 0, longitude: 181 }, // Invalid longitude
        { latitude: 0, longitude: -181 }, // Invalid longitude
        { latitude: NaN, longitude: 0 }, // Invalid latitude
        { latitude: 0, longitude: NaN }, // Invalid longitude
      ];

      invalidCoordinates.forEach((coords) => {
        const payload = { ...validPayload, gpsCoordinates: coords };
        const errors = PayloadService.validatePayload(payload);
        expect(errors.some(e => e.field.startsWith('gpsCoordinates'))).toBe(true);
      });
    });

    it('should validate timestamp', () => {
      const now = new Date();
      const invalidTimestamps = [
        '', // Empty string
        'invalid-date', // Invalid date string
        new Date(now.getTime() - 9 * 60 * 60 * 1000).toISOString(), // Too old (9 hours)
        new Date(now.getTime() + 10 * 60 * 1000).toISOString(), // Too far in future (10 minutes)
      ];

      invalidTimestamps.forEach((timestamp) => {
        const payload = { ...validPayload, timestamp };
        const errors = PayloadService.validatePayload(payload);
        expect(errors.some(e => e.field === 'timestamp')).toBe(true);
      });
    });

    it('should validate results object', () => {
      const invalidResults = [
        null, // Null results
        undefined, // Undefined results
        {}, // Empty results
        { 'John Doe': -5, spoilt: 0 }, // Negative votes
        { 'John Doe': 1.5, spoilt: 0 }, // Non-integer votes
        { 'John Doe': 'invalid', spoilt: 0 }, // Non-numeric votes
        { '': 10, spoilt: 0 }, // Empty candidate name
        { 'John Doe': 10 }, // Missing spoilt votes
      ];

      invalidResults.forEach((results) => {
        const payload = { ...validPayload, results: results as any };
        const errors = PayloadService.validatePayload(payload);
        expect(errors.some(e => e.field.startsWith('results'))).toBe(true);
      });
    });

    it('should validate submission type', () => {
      const invalidTypes = [
        '', // Empty string
        'invalid_type', // Invalid type
        null, // Null
        undefined, // Undefined
      ];

      invalidTypes.forEach((submissionType) => {
        const payload = { ...validPayload, submissionType: submissionType as any };
        const errors = PayloadService.validatePayload(payload);
        expect(errors.some(e => e.field === 'submissionType')).toBe(true);
      });
    });

    it('should validate confidence', () => {
      const invalidConfidences = [
        -0.1, // Below 0
        1.1, // Above 1
        NaN, // NaN
        'invalid', // Non-numeric
      ];

      invalidConfidences.forEach((confidence) => {
        const payload = { ...validPayload, confidence: confidence as any };
        const errors = PayloadService.validatePayload(payload);
        expect(errors.some(e => e.field === 'confidence')).toBe(true);
      });
    });
  });

  describe('isValidPayload', () => {
    it('should return true for valid payload', () => {
      const payload = PayloadService.buildPayload(validPayloadOptions);
      expect(PayloadService.isValidPayload(payload)).toBe(true);
    });

    it('should return false for invalid payload', () => {
      const invalidPayload = {
        ...PayloadService.buildPayload(validPayloadOptions),
        walletAddress: '',
      };
      expect(PayloadService.isValidPayload(invalidPayload)).toBe(false);
    });
  });

  describe('calculateTotalVotes', () => {
    it('should calculate total votes correctly', () => {
      const results = {
        'John Doe': 150,
        'Jane Smith': 120,
        'Bob Johnson': 80,
        spoilt: 5,
      };

      const total = PayloadService.calculateTotalVotes(results);
      expect(total).toBe(355);
    });

    it('should handle empty results', () => {
      const total = PayloadService.calculateTotalVotes({});
      expect(total).toBe(0);
    });
  });

  describe('formatPayloadForDisplay', () => {
    it('should format payload for display', () => {
      const payload = PayloadService.buildPayload(validPayloadOptions);
      const formatted = PayloadService.formatPayloadForDisplay(payload);

      expect(formatted).toContain('Station: STATION_001');
      expect(formatted).toContain('Wallet: 5GrwvaEF...');
      expect(formatted).toContain('Location: 40.712800, -74.006000');
      expect(formatted).toContain('Type: image_ocr');
      expect(formatted).toContain('Confidence: 85.0%');
      expect(formatted).toContain('Total Votes: 355');
    });
  });

  describe('createFromOCRResults', () => {
    it('should create payload from OCR results', () => {
      const ocrResults = {
        'John Doe': 150,
        'Jane Smith': 120,
        spoilt: 5,
      };

      const payload = PayloadService.createFromOCRResults(
        'wallet123',
        'STATION_001',
        ocrResults,
        0.9,
        mockLocationResult
      );

      expect(payload.submissionType).toBe('image_ocr');
      expect(payload.results).toEqual(ocrResults);
      expect(payload.confidence).toBe(0.9);
    });
  });

  describe('createFromSTTResults', () => {
    it('should create payload from STT results', () => {
      const sttResults = {
        'John Doe': 150,
        'Jane Smith': 120,
        spoilt: 5,
      };

      const payload = PayloadService.createFromSTTResults(
        'wallet123',
        'STATION_001',
        sttResults,
        0.8,
        mockLocationResult
      );

      expect(payload.submissionType).toBe('audio_stt');
      expect(payload.results).toEqual(sttResults);
      expect(payload.confidence).toBe(0.8);
    });
  });

  describe('sanitizeResults', () => {
    it('should sanitize results correctly', () => {
      const dirtyResults = {
        'John Doe': 150.7, // Should be floored
        '  Jane Smith  ': 120, // Should be trimmed
        'Bob Johnson': -5, // Should be set to 0
        '': 10, // Should be removed (empty name)
        'Alice Brown': 'invalid' as any, // Should be set to 0
      };

      const sanitized = PayloadService.sanitizeResults(dirtyResults);

      expect(sanitized).toEqual({
        'John Doe': 150,
        'Jane Smith': 120,
        'Bob Johnson': 0,
        'Alice Brown': 0,
        spoilt: 0, // Should be added
      });
    });

    it('should preserve existing spoilt votes', () => {
      const results = {
        'John Doe': 150,
        spoilt: 10,
      };

      const sanitized = PayloadService.sanitizeResults(results);

      expect(sanitized.spoilt).toBe(10);
    });
  });
});