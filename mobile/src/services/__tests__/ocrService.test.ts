import { OCRService, OCRResult } from '../ocrService';
import * as tf from '@tensorflow/tfjs';
import * as FileSystem from 'expo-file-system';

// Mock TensorFlow.js
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

// Mock expo-file-system
jest.mock('expo-file-system', () => ({
  readAsStringAsync: jest.fn(),
  EncodingType: {
    Base64: 'base64',
  },
}));

describe('OCRService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the service state
    (OCRService as any).isInitialized = false;
    (OCRService as any).model = null;
  });

  describe('initialize', () => {
    it('should initialize TensorFlow.js and load OCR model successfully', async () => {
      const mockModel = { predict: jest.fn() };
      (tf.ready as jest.Mock).mockResolvedValue(undefined);
      (tf.loadGraphModel as jest.Mock).mockResolvedValue(mockModel);

      await OCRService.initialize();

      expect(tf.ready).toHaveBeenCalled();
      expect(tf.loadGraphModel).toHaveBeenCalled();
      expect((OCRService as any).isInitialized).toBe(true);
      expect((OCRService as any).model).toBe(mockModel);
    });

    it('should fallback to mock implementation if model loading fails', async () => {
      (tf.ready as jest.Mock).mockResolvedValue(undefined);
      (tf.loadGraphModel as jest.Mock).mockRejectedValue(new Error('Model loading failed'));

      await OCRService.initialize();

      expect(tf.ready).toHaveBeenCalled();
      expect(tf.loadGraphModel).toHaveBeenCalled();
      expect((OCRService as any).isInitialized).toBe(true);
      expect((OCRService as any).model).toBeNull();
    });

    it('should not reinitialize if already initialized', async () => {
      (tf.ready as jest.Mock).mockResolvedValue(undefined);
      (tf.loadGraphModel as jest.Mock).mockResolvedValue({ predict: jest.fn() });

      await OCRService.initialize();
      await OCRService.initialize(); // Second call

      expect(tf.ready).toHaveBeenCalledTimes(1);
      expect(tf.loadGraphModel).toHaveBeenCalledTimes(1);
    });

    it('should handle TensorFlow initialization failure', async () => {
      (tf.ready as jest.Mock).mockRejectedValue(new Error('TF initialization failed'));

      // Should still initialize with fallback
      await OCRService.initialize();
      
      expect((OCRService as any).isInitialized).toBe(true);
    });
  });

  describe('processImage', () => {
    beforeEach(async () => {
      (tf.ready as jest.Mock).mockResolvedValue(undefined);
      (tf.loadGraphModel as jest.Mock).mockResolvedValue({ predict: jest.fn() });
      await OCRService.initialize();
    });

    it('should process image with TensorFlow Lite model', async () => {
      const imageUri = 'file://test-image.jpg';
      const mockBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
      const mockTensor = { dispose: jest.fn() };
      const mockResizedTensor = { dispose: jest.fn() };
      const mockBatchedTensor = { dispose: jest.fn() };
      const mockPredictions = { 
        data: jest.fn().mockResolvedValue(new Float32Array([0.1, 0.2, 0.3])),
        dispose: jest.fn()
      };

      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(mockBase64);
      (tf.tensor3d as jest.Mock).mockReturnValue(mockTensor);
      (tf.image.resizeBilinear as jest.Mock).mockReturnValue(mockResizedTensor);
      (tf.expandDims as jest.Mock).mockReturnValue(mockBatchedTensor);
      ((OCRService as any).model.predict as jest.Mock).mockReturnValue(mockPredictions);

      const options = {
        preprocessImage: false,
        candidateNames: ['JOHN KAMAU', 'MARY WANJIKU']
      };

      const result = await OCRService.processImage(imageUri, options);

      expect(FileSystem.readAsStringAsync).toHaveBeenCalledWith(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      expect(result).toBeDefined();
      expect(result.extractedText).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.candidates).toBeDefined();
      expect(result.boundingBoxes).toBeDefined();
      expect(Array.isArray(result.boundingBoxes)).toBe(true);
      
      // Verify tensor cleanup
      expect(mockResizedTensor.dispose).toHaveBeenCalled();
      expect(mockBatchedTensor.dispose).toHaveBeenCalled();
      expect(mockPredictions.dispose).toHaveBeenCalled();
    });

    it('should process image with preprocessing', async () => {
      const imageUri = 'file://test-image.jpg';
      const mockBase64 = 'test-base64-data';
      const mockTensor = { dispose: jest.fn() };
      const mockResizedTensor = { dispose: jest.fn() };
      const mockGrayscale = {};
      const mockEnhanced = {};
      const mockNormalized = {};

      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(mockBase64);
      (tf.tensor3d as jest.Mock).mockReturnValue(mockTensor);
      (tf.image.resizeBilinear as jest.Mock).mockReturnValue(mockResizedTensor);
      (tf.tidy as jest.Mock).mockImplementation((fn) => fn());
      (tf.image.rgbToGrayscale as jest.Mock).mockReturnValue(mockGrayscale);
      (tf.mul as jest.Mock).mockReturnValue(mockEnhanced);
      (tf.clipByValue as jest.Mock).mockReturnValue(mockEnhanced);
      (tf.div as jest.Mock).mockReturnValue(mockNormalized);

      const options = {
        preprocessImage: true,
        candidateNames: ['JOHN KAMAU', 'MARY WANJIKU']
      };

      const result = await OCRService.processImage(imageUri, options);

      expect(result).toBeDefined();
      expect(result.candidates).toBeDefined();
    });

    it('should fallback to mock processing when model is not available', async () => {
      // Reset to no model
      (OCRService as any).model = null;
      
      const imageUri = 'file://test-image.jpg';
      const mockBase64 = 'test-base64-data';
      const mockTensor = { dispose: jest.fn() };
      const mockResizedTensor = { dispose: jest.fn() };

      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(mockBase64);
      (tf.tensor3d as jest.Mock).mockReturnValue(mockTensor);
      (tf.image.resizeBilinear as jest.Mock).mockReturnValue(mockResizedTensor);

      const result = await OCRService.processImage(imageUri);

      expect(result).toBeDefined();
      expect(result.candidates).toBeDefined();
      expect(mockResizedTensor.dispose).toHaveBeenCalled();
    });

    it('should handle image loading failure gracefully', async () => {
      const imageUri = 'file://invalid-image.jpg';
      
      (FileSystem.readAsStringAsync as jest.Mock).mockRejectedValue(new Error('File not found'));

      const result = await OCRService.processImage(imageUri);

      expect(result).toBeDefined();
      expect(result.candidates).toBeDefined();
    });

    it('should throw error if processing completely fails', async () => {
      const imageUri = 'file://test-image.jpg';
      
      // Mock complete failure
      (FileSystem.readAsStringAsync as jest.Mock).mockRejectedValue(new Error('File system error'));
      (tf.tensor3d as jest.Mock).mockImplementation(() => {
        throw new Error('Tensor creation failed');
      });

      await expect(OCRService.processImage(imageUri)).rejects.toThrow('Failed to process image with OCR');
    });
  });

  describe('extractVoteCounts', () => {
    it('should extract candidate vote counts from text', async () => {
      const mockText = `
        FORM 34A - PRESIDENTIAL ELECTION RESULTS
        JOHN KAMAU: 245
        MARY WANJIKU: 189
        PETER MWANGI: 156
        SPOILT BALLOTS: 12
        TOTAL VOTES: 602
      `;

      const result = await OCRService.extractVoteCounts(mockText);

      expect(result).toEqual({
        'JOHN KAMAU': 245,
        'MARY WANJIKU': 189,
        'PETER MWANGI': 156,
        spoilt: 12
      });
    });

    it('should handle text with no matches', async () => {
      const mockText = 'No candidate information found';

      const result = await OCRService.extractVoteCounts(mockText);

      expect(result).toEqual({});
    });

    it('should extract spoilt votes correctly', async () => {
      const mockText = 'SPOILT VOTES: 25';

      const result = await OCRService.extractVoteCounts(mockText);

      expect(result).toEqual({
        spoilt: 25
      });
    });
  });

  describe('validateOCRResult', () => {
    it('should validate a good OCR result', () => {
      const goodResult: OCRResult = {
        extractedText: 'Test text',
        confidence: 0.85,
        boundingBoxes: [],
        candidates: {
          'JOHN KAMAU': 245,
          'MARY WANJIKU': 189
        },
        spoilt: 12
      };

      const isValid = OCRService.validateOCRResult(goodResult);

      expect(isValid).toBe(true);
    });

    it('should reject result with no candidates', () => {
      const badResult: OCRResult = {
        extractedText: 'Test text',
        confidence: 0.85,
        boundingBoxes: [],
        candidates: {}
      };

      const isValid = OCRService.validateOCRResult(badResult);

      expect(isValid).toBe(false);
    });

    it('should reject result with low confidence', () => {
      const badResult: OCRResult = {
        extractedText: 'Test text',
        confidence: 0.5, // Below 0.7 threshold
        boundingBoxes: [],
        candidates: {
          'JOHN KAMAU': 245
        }
      };

      const isValid = OCRService.validateOCRResult(badResult);

      expect(isValid).toBe(false);
    });

    it('should reject result with negative vote counts', () => {
      const badResult: OCRResult = {
        extractedText: 'Test text',
        confidence: 0.85,
        boundingBoxes: [],
        candidates: {
          'JOHN KAMAU': -5 // Negative votes
        }
      };

      const isValid = OCRService.validateOCRResult(badResult);

      expect(isValid).toBe(false);
    });

    it('should reject result with unreasonably high vote counts', () => {
      const badResult: OCRResult = {
        extractedText: 'Test text',
        confidence: 0.85,
        boundingBoxes: [],
        candidates: {
          'JOHN KAMAU': 50000 // Too high
        }
      };

      const isValid = OCRService.validateOCRResult(badResult);

      expect(isValid).toBe(false);
    });
  });
});