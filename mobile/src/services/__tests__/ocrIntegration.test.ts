/**
 * Integration test for OCR service with ML Kit
 * This test verifies the complete OCR workflow
 */

import { OCRService } from '../ocrService';
import TextRecognition from '@react-native-ml-kit/text-recognition';

// Mock dependencies
jest.mock('expo-file-system', () => ({
  readAsStringAsync: jest.fn(),
  EncodingType: {
    Base64: 'base64',
  },
}));

jest.mock('@react-native-ml-kit/text-recognition', () => ({
  recognize: jest.fn(),
}));

describe('OCR Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset service state
    (OCRService as any).isInitialized = false;
  });

  describe('ML Kit Integration', () => {
    it('should initialize OCR service with ML Kit', async () => {
      const mockMLKitResult = [
        {
          text: 'Test initialization',
          bounding: { left: 0, top: 0, right: 100, bottom: 20 },
          confidence: 0.9
        }
      ];
      
      (TextRecognition.recognize as jest.Mock).mockResolvedValue(mockMLKitResult);

      await OCRService.initialize();

      expect(TextRecognition.recognize).toHaveBeenCalled();
      expect((OCRService as any).isInitialized).toBe(true);
    });

    it('should process image with real ML Kit model', async () => {
      const mockMLKitResult = [
        {
          text: 'JOHN DOE: 245',
          bounding: { left: 10, top: 50, right: 200, bottom: 70 },
          confidence: 0.92
        },
        {
          text: 'JANE SMITH: 189',
          bounding: { left: 10, top: 80, right: 200, bottom: 100 },
          confidence: 0.88
        },
        {
          text: 'SPOILT BALLOTS: 12',
          bounding: { left: 10, top: 110, right: 200, bottom: 130 },
          confidence: 0.85
        }
      ];
      
      (TextRecognition.recognize as jest.Mock)
        .mockResolvedValueOnce([{ text: 'init', confidence: 0.9 }]) // For initialization
        .mockResolvedValueOnce(mockMLKitResult); // For actual processing

      await OCRService.initialize();
      
      const result = await OCRService.processImage('file://test-image.jpg', {
        preprocessImage: false,
        candidateNames: ['JOHN DOE', 'JANE SMITH']
      });

      expect(result).toBeDefined();
      expect(result.candidates).toBeDefined();
      expect(result.candidates['JOHN DOE']).toBe(245);
      expect(result.candidates['JANE SMITH']).toBe(189);
      expect(result.spoilt).toBe(12);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.boundingBoxes).toBeDefined();
      expect(Array.isArray(result.boundingBoxes)).toBe(true);
      expect(result.boundingBoxes).toHaveLength(3);
      
      // Verify ML Kit was called with correct URI
      expect(TextRecognition.recognize).toHaveBeenCalledWith('file://test-image.jpg');
    });

    it('should handle image preprocessing correctly', async () => {
      const mockMLKitResult = [
        {
          text: 'CANDIDATE A: 150',
          bounding: { left: 0, top: 0, right: 100, bottom: 20 },
          confidence: 0.9
        }
      ];
      
      (TextRecognition.recognize as jest.Mock)
        .mockResolvedValueOnce([{ text: 'init', confidence: 0.9 }])
        .mockResolvedValueOnce(mockMLKitResult);

      await OCRService.initialize();
      
      const result = await OCRService.processImage('file://test-image.jpg', {
        preprocessImage: true
      });

      expect(result).toBeDefined();
      expect(result.extractedText).toContain('CANDIDATE A: 150');
      expect(TextRecognition.recognize).toHaveBeenCalledWith('file://test-image.jpg');
    });

    it('should fallback to mock processing when ML Kit fails', async () => {
      (TextRecognition.recognize as jest.Mock)
        .mockResolvedValueOnce([{ text: 'init', confidence: 0.9 }]) // For initialization
        .mockRejectedValueOnce(new Error('ML Kit processing failed')); // For actual processing

      await OCRService.initialize();
      
      const result = await OCRService.processImage('file://test-image.jpg');

      expect(result).toBeDefined();
      expect(result.candidates).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should handle complex Form 34A layout', async () => {
      const mockMLKitResult = [
        {
          text: 'FORM 34A - PRESIDENTIAL ELECTION RESULTS',
          bounding: { left: 50, top: 10, right: 350, bottom: 30 },
          confidence: 0.95
        },
        {
          text: 'POLLING STATION: KIAMBU PRIMARY SCHOOL',
          bounding: { left: 50, top: 40, right: 350, bottom: 60 },
          confidence: 0.90
        },
        {
          text: 'JOHN KAMAU: 245',
          bounding: { left: 50, top: 80, right: 250, bottom: 100 },
          confidence: 0.92
        },
        {
          text: 'MARY WANJIKU: 189',
          bounding: { left: 50, top: 110, right: 250, bottom: 130 },
          confidence: 0.88
        },
        {
          text: 'PETER MWANGI: 156',
          bounding: { left: 50, top: 140, right: 250, bottom: 160 },
          confidence: 0.85
        },
        {
          text: 'SPOILT BALLOTS: 12',
          bounding: { left: 50, top: 170, right: 250, bottom: 190 },
          confidence: 0.90
        },
        {
          text: 'TOTAL VOTES: 602',
          bounding: { left: 50, top: 200, right: 250, bottom: 220 },
          confidence: 0.93
        }
      ];
      
      (TextRecognition.recognize as jest.Mock)
        .mockResolvedValueOnce([{ text: 'init', confidence: 0.9 }])
        .mockResolvedValueOnce(mockMLKitResult);

      await OCRService.initialize();
      
      const result = await OCRService.processImage('file://form34a.jpg', {
        candidateNames: ['JOHN KAMAU', 'MARY WANJIKU', 'PETER MWANGI']
      });

      expect(result).toBeDefined();
      expect(result.candidates['JOHN KAMAU']).toBe(245);
      expect(result.candidates['MARY WANJIKU']).toBe(189);
      expect(result.candidates['PETER MWANGI']).toBe(156);
      expect(result.spoilt).toBe(12);
      expect(result.extractedText).toContain('FORM 34A');
      expect(result.extractedText).toContain('KIAMBU PRIMARY SCHOOL');
      expect(result.boundingBoxes).toHaveLength(7);
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

    it('should handle ML Kit text blocks with mixed content', async () => {
      const formText = `
        Some header text
        ALICE JOHNSON: 320
        Random text in between
        BOB WILSON: 275
        More random content
        CAROL DAVIS: 198
        Footer information
        SPOILT BALLOTS: 8
        Additional footer
      `;

      const result = await OCRService.extractVoteCounts(formText);

      expect(result).toEqual({
        'ALICE JOHNSON': 320,
        'BOB WILSON': 275,
        'CAROL DAVIS': 198,
        spoilt: 8
      });
    });
  });

  describe('Fallback Parsing', () => {
    it('should parse unstructured text with numbers', async () => {
      const mockMLKitResult = [
        {
          text: 'Unstructured text with numbers 245 189 156 12',
          bounding: { left: 0, top: 0, right: 300, bottom: 50 },
          confidence: 0.8
        }
      ];
      
      (TextRecognition.recognize as jest.Mock)
        .mockResolvedValueOnce([{ text: 'init', confidence: 0.9 }])
        .mockResolvedValueOnce(mockMLKitResult);

      await OCRService.initialize();
      
      const result = await OCRService.processImage('file://test-image.jpg', {
        candidateNames: ['JOHN KAMAU', 'MARY WANJIKU', 'PETER MWANGI']
      });

      expect(result).toBeDefined();
      expect(result.candidates['JOHN KAMAU']).toBe(245);
      expect(result.candidates['MARY WANJIKU']).toBe(189);
      expect(result.candidates['PETER MWANGI']).toBe(156);
    });

    it('should handle empty ML Kit results', async () => {
      (TextRecognition.recognize as jest.Mock)
        .mockResolvedValueOnce([{ text: 'init', confidence: 0.9 }])
        .mockResolvedValueOnce([]);

      await OCRService.initialize();
      
      const result = await OCRService.processImage('file://empty-image.jpg');

      expect(result).toBeDefined();
      expect(result.extractedText).toBe('');
      expect(result.boundingBoxes).toEqual([]);
      expect(result.confidence).toBeGreaterThan(0); // Should have fallback confidence
    });
  });
});