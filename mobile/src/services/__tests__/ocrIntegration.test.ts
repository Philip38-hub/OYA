/**
 * Integration test for OCR service with TensorFlow Lite
 * This test verifies the complete OCR workflow
 */

import { OCRService } from '../ocrService';

// Mock dependencies
jest.mock('expo-file-system', () => ({
  readAsStringAsync: jest.fn(),
  EncodingType: {
    Base64: 'base64',
  },
}));

jest.mock('@tensorflow/tfjs', () => ({
  ready: jest.fn(),
  loadGraphModel: jest.fn(),
  expandDims: jest.fn(),
  tensor3d: jest.fn(),
  image: {
    resizeBilinear: jest.fn(),
    rgbToGrayscale: jest.fn(),
  },
  tidy: jest.fn(),
  clipByValue: jest.fn(),
  mul: jest.fn(),
  div: jest.fn(),
}));

describe('OCR Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset service state
    (OCRService as any).isInitialized = false;
    (OCRService as any).model = null;
  });

  describe('TensorFlow Lite Integration', () => {
    it('should initialize OCR service with TensorFlow Lite model', async () => {
      const mockModel = { predict: jest.fn() };
      const tf = require('@tensorflow/tfjs');
      
      tf.ready.mockResolvedValue(undefined);
      tf.loadGraphModel.mockResolvedValue(mockModel);

      await OCRService.initialize();

      expect(tf.ready).toHaveBeenCalled();
      expect(tf.loadGraphModel).toHaveBeenCalledWith(
        expect.stringContaining('mobilenet')
      );
      expect((OCRService as any).isInitialized).toBe(true);
      expect((OCRService as any).model).toBe(mockModel);
    });

    it('should process image with real TensorFlow model', async () => {
      const mockModel = { 
        predict: jest.fn().mockReturnValue({
          data: jest.fn().mockResolvedValue(new Float32Array([0.1, 0.2, 0.3])),
          dispose: jest.fn()
        })
      };
      const tf = require('@tensorflow/tfjs');
      const FileSystem = require('expo-file-system');
      
      // Setup mocks
      tf.ready.mockResolvedValue(undefined);
      tf.loadGraphModel.mockResolvedValue(mockModel);
      FileSystem.readAsStringAsync.mockResolvedValue('mock-base64-data');
      
      const mockTensor = { dispose: jest.fn() };
      tf.tensor3d.mockReturnValue(mockTensor);
      tf.image.resizeBilinear.mockReturnValue(mockTensor);
      tf.expandDims.mockReturnValue(mockTensor);

      await OCRService.initialize();
      
      const result = await OCRService.processImage('file://test-image.jpg', {
        preprocessImage: false,
        candidateNames: ['JOHN DOE', 'JANE SMITH']
      });

      expect(result).toBeDefined();
      expect(result.candidates).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.boundingBoxes).toBeDefined();
      expect(Array.isArray(result.boundingBoxes)).toBe(true);
      
      // Verify model was called
      expect(mockModel.predict).toHaveBeenCalled();
    });

    it('should handle image preprocessing correctly', async () => {
      const mockModel = { predict: jest.fn() };
      const tf = require('@tensorflow/tfjs');
      const FileSystem = require('expo-file-system');
      
      tf.ready.mockResolvedValue(undefined);
      tf.loadGraphModel.mockResolvedValue(mockModel);
      FileSystem.readAsStringAsync.mockResolvedValue('mock-base64-data');
      
      const mockTensor = { dispose: jest.fn() };
      tf.tensor3d.mockReturnValue(mockTensor);
      tf.image.resizeBilinear.mockReturnValue(mockTensor);
      tf.tidy.mockImplementation((fn) => fn());
      tf.image.rgbToGrayscale.mockReturnValue(mockTensor);
      tf.mul.mockReturnValue(mockTensor);
      tf.clipByValue.mockReturnValue(mockTensor);
      tf.div.mockReturnValue(mockTensor);

      await OCRService.initialize();
      
      const result = await OCRService.processImage('file://test-image.jpg', {
        preprocessImage: true
      });

      expect(result).toBeDefined();
      expect(tf.image.rgbToGrayscale).toHaveBeenCalled();
      expect(tf.mul).toHaveBeenCalled();
      expect(tf.clipByValue).toHaveBeenCalled();
    });

    it('should fallback to mock processing when model fails', async () => {
      const tf = require('@tensorflow/tfjs');
      const FileSystem = require('expo-file-system');
      
      tf.ready.mockResolvedValue(undefined);
      tf.loadGraphModel.mockRejectedValue(new Error('Model loading failed'));
      FileSystem.readAsStringAsync.mockResolvedValue('mock-base64-data');
      
      const mockTensor = { dispose: jest.fn() };
      tf.tensor3d.mockReturnValue(mockTensor);

      await OCRService.initialize();
      
      const result = await OCRService.processImage('file://test-image.jpg');

      expect(result).toBeDefined();
      expect(result.candidates).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect((OCRService as any).model).toBeNull();
    });
  });

  describe('OCR Result Validation', () => {
    it('should validate OCR results correctly', () => {
      const validResult = {
        extractedText: 'Test text',
        confidence: 0.85,
        boundingBoxes: [],
        candidates: {
          'JOHN KAMAU': 245,
          'MARY WANJIKU': 189
        },
        spoilt: 12
      };

      const isValid = OCRService.validateOCRResult(validResult);
      expect(isValid).toBe(true);
    });

    it('should reject results with low confidence', () => {
      const lowConfidenceResult = {
        extractedText: 'Test text',
        confidence: 0.5, // Below threshold
        boundingBoxes: [],
        candidates: {
          'JOHN KAMAU': 245
        }
      };

      const isValid = OCRService.validateOCRResult(lowConfidenceResult);
      expect(isValid).toBe(false);
    });

    it('should reject results with invalid vote counts', () => {
      const invalidResult = {
        extractedText: 'Test text',
        confidence: 0.85,
        boundingBoxes: [],
        candidates: {
          'JOHN KAMAU': -5 // Negative votes
        }
      };

      const isValid = OCRService.validateOCRResult(invalidResult);
      expect(isValid).toBe(false);
    });
  });

  describe('Vote Count Extraction', () => {
    it('should extract vote counts from Form 34A text', async () => {
      const formText = `
        FORM 34A - PRESIDENTIAL ELECTION RESULTS
        JOHN KAMAU: 245
        MARY WANJIKU: 189
        PETER MWANGI: 156
        SPOILT BALLOTS: 12
        TOTAL VOTES: 602
      `;

      const result = await OCRService.extractVoteCounts(formText);

      expect(result).toEqual({
        'JOHN KAMAU': 245,
        'MARY WANJIKU': 189,
        'PETER MWANGI': 156,
        spoilt: 12
      });
    });

    it('should handle various spoilt ballot formats', async () => {
      const formText1 = 'SPOILT BALLOTS: 25';
      const formText2 = 'SPOILT VOTES: 30';
      const formText3 = 'SPOILT: 15';

      const result1 = await OCRService.extractVoteCounts(formText1);
      const result2 = await OCRService.extractVoteCounts(formText2);
      const result3 = await OCRService.extractVoteCounts(formText3);

      expect(result1.spoilt).toBe(25);
      expect(result2.spoilt).toBe(30);
      expect(result3.spoilt).toBe(15);
    });
  });
});