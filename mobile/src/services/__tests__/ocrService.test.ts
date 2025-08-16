import { OCRService, OCRResult } from '../ocrService';
import TextRecognition from '@react-native-ml-kit/text-recognition';

// Mock ML Kit OCR
jest.mock('@react-native-ml-kit/text-recognition', () => ({
  recognize: jest.fn(),
}));

// Mock Expo FileSystem
jest.mock('expo-file-system', () => ({
  readAsStringAsync: jest.fn(),
  EncodingType: {
    Base64: 'base64',
  },
}));

// Mock error handling service
jest.mock('../errorHandlingService', () => ({
  errorHandlingService: {
    logError: jest.fn(),
    handleMLProcessingError: jest.fn().mockImplementation(async (error, context, fallback) => {
      const result = await fallback();
      return { success: true, result };
    }),
  },
}));

describe('OCRService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the service state
    (OCRService as any).isInitialized = false;
  });

  describe('initialize', () => {
    it('should initialize ML Kit OCR service successfully', async () => {
      const mockMLKitResult = [
        {
          text: 'Test text',
          bounding: { left: 0, top: 0, right: 100, bottom: 20 },
          confidence: 0.9
        }
      ];
      (TextRecognition.recognize as jest.Mock).mockResolvedValue(mockMLKitResult);

      await OCRService.initialize();

      expect(TextRecognition.recognize).toHaveBeenCalled();
      expect((OCRService as any).isInitialized).toBe(true);
    });

    it('should fallback to mock implementation if ML Kit fails', async () => {
      (TextRecognition.recognize as jest.Mock).mockRejectedValue(new Error('ML Kit not available'));

      await OCRService.initialize();

      expect(TextRecognition.recognize).toHaveBeenCalled();
      expect((OCRService as any).isInitialized).toBe(true);
    });

    it('should not reinitialize if already initialized', async () => {
      const mockMLKitResult = [{ text: 'Test', confidence: 0.9 }];
      (TextRecognition.recognize as jest.Mock).mockResolvedValue(mockMLKitResult);

      await OCRService.initialize();
      await OCRService.initialize(); // Second call

      expect(TextRecognition.recognize).toHaveBeenCalledTimes(1);
    });
  });

  describe('processImage', () => {
    beforeEach(async () => {
      const mockMLKitResult = [{ text: 'Test', confidence: 0.9 }];
      (TextRecognition.recognize as jest.Mock).mockResolvedValue(mockMLKitResult);
      await OCRService.initialize();
    });

    it('should process image with ML Kit successfully', async () => {
      const imageUri = 'file://test-image.jpg';
      const mockMLKitResult = [
        {
          text: 'JOHN KAMAU: 245',
          bounding: { left: 10, top: 50, right: 200, bottom: 70 },
          confidence: 0.92
        },
        {
          text: 'MARY WANJIKU: 189',
          bounding: { left: 10, top: 80, right: 200, bottom: 100 },
          confidence: 0.88
        },
        {
          text: 'SPOILT BALLOTS: 12',
          bounding: { left: 10, top: 110, right: 200, bottom: 130 },
          confidence: 0.85
        }
      ];

      (TextRecognition.recognize as jest.Mock).mockResolvedValue(mockMLKitResult);

      const options = {
        preprocessImage: false,
        candidateNames: ['JOHN KAMAU', 'MARY WANJIKU']
      };

      const result = await OCRService.processImage(imageUri, options);

      expect(TextRecognition.recognize).toHaveBeenCalledWith(imageUri);
      expect(result).toBeDefined();
      expect(result.extractedText).toContain('JOHN KAMAU: 245');
      expect(result.extractedText).toContain('MARY WANJIKU: 189');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.boundingBoxes).toBeDefined();
      expect(Array.isArray(result.boundingBoxes)).toBe(true);
      expect(result.boundingBoxes).toHaveLength(3);
    });

    it('should process image with preprocessing', async () => {
      const imageUri = 'file://test-image.jpg';
      const mockMLKitResult = [
        {
          text: 'CANDIDATE A: 150',
          bounding: { left: 0, top: 0, right: 100, bottom: 20 },
          confidence: 0.9
        }
      ];

      (TextRecognition.recognize as jest.Mock).mockResolvedValue(mockMLKitResult);

      const options = {
        preprocessImage: true,
        candidateNames: ['CANDIDATE A']
      };

      const result = await OCRService.processImage(imageUri, options);

      expect(result).toBeDefined();
      expect(result.extractedText).toContain('CANDIDATE A: 150');
    });

    it('should fallback to mock processing when ML Kit fails', async () => {
      const imageUri = 'file://test-image.jpg';
      
      (TextRecognition.recognize as jest.Mock).mockRejectedValue(new Error('ML Kit processing failed'));

      const result = await OCRService.processImage(imageUri);

      expect(result).toBeDefined();
      expect(result.candidates).toBeDefined();
      expect(typeof result.confidence).toBe('number');
    });

    it('should handle empty ML Kit result gracefully', async () => {
      const imageUri = 'file://test-image.jpg';
      
      (TextRecognition.recognize as jest.Mock).mockResolvedValue([]);

      const result = await OCRService.processImage(imageUri);

      expect(result).toBeDefined();
      expect(result.extractedText).toBeDefined();
      expect(result.boundingBoxes).toEqual([]);
    });

    it('should parse Form 34A text when structured data not found', async () => {
      const imageUri = 'file://test-image.jpg';
      const mockMLKitResult = [
        {
          text: 'Some unstructured text with numbers 245 189 156 12',
          bounding: { left: 0, top: 0, right: 300, bottom: 50 },
          confidence: 0.8
        }
      ];

      (TextRecognition.recognize as jest.Mock).mockResolvedValue(mockMLKitResult);

      const options = {
        candidateNames: ['JOHN KAMAU', 'MARY WANJIKU', 'PETER MWANGI']
      };

      const result = await OCRService.processImage(imageUri, options);

      expect(result).toBeDefined();
      expect(result.candidates['JOHN KAMAU']).toBe(245);
      expect(result.candidates['MARY WANJIKU']).toBe(189);
      expect(result.candidates['PETER MWANGI']).toBe(156);
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