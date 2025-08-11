import { renderHook, act } from '@testing-library/react-native';
import { useOCR } from '../useOCR';
import { OCRService } from '@/services/ocrService';

// Mock the OCR service
jest.mock('@/services/ocrService', () => ({
  OCRService: {
    processImage: jest.fn(),
    validateOCRResult: jest.fn(),
  },
}));

describe('useOCR', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useOCR());

    expect(result.current.isProcessing).toBe(false);
    expect(result.current.result).toBe(null);
    expect(result.current.error).toBe(null);
  });

  it('should process image successfully', async () => {
    const mockResult = {
      extractedText: 'Test text',
      confidence: 0.85,
      boundingBoxes: [],
      candidates: { 'JOHN KAMAU': 245 },
      spoilt: 12
    };

    (OCRService.processImage as jest.Mock).mockResolvedValue(mockResult);
    (OCRService.validateOCRResult as jest.Mock).mockReturnValue(true);

    const { result } = renderHook(() => useOCR());

    await act(async () => {
      await result.current.processImage('file://test.jpg');
    });

    expect(result.current.isProcessing).toBe(false);
    expect(result.current.result).toEqual(mockResult);
    expect(result.current.error).toBe(null);
  });

  it('should handle processing errors', async () => {
    (OCRService.processImage as jest.Mock).mockRejectedValue(
      new Error('Processing failed')
    );

    const { result } = renderHook(() => useOCR());

    await act(async () => {
      await result.current.processImage('file://test.jpg');
    });

    expect(result.current.isProcessing).toBe(false);
    expect(result.current.result).toBe(null);
    expect(result.current.error).toBe('Processing failed');
  });

  it('should handle validation failure', async () => {
    const mockResult = {
      extractedText: 'Test text',
      confidence: 0.5, // Low confidence
      boundingBoxes: [],
      candidates: {},
      spoilt: 0
    };

    (OCRService.processImage as jest.Mock).mockResolvedValue(mockResult);
    (OCRService.validateOCRResult as jest.Mock).mockReturnValue(false);

    const { result } = renderHook(() => useOCR());

    await act(async () => {
      await result.current.processImage('file://test.jpg');
    });

    expect(result.current.isProcessing).toBe(false);
    expect(result.current.result).toBe(null);
    expect(result.current.error).toBe(
      'OCR result validation failed. Please try again or enter data manually.'
    );
  });

  it('should set processing state during image processing', async () => {
    let resolveProcessing: (value: any) => void;
    const processingPromise = new Promise(resolve => {
      resolveProcessing = resolve;
    });

    (OCRService.processImage as jest.Mock).mockReturnValue(processingPromise);

    const { result } = renderHook(() => useOCR());

    act(() => {
      result.current.processImage('file://test.jpg');
    });

    expect(result.current.isProcessing).toBe(true);
    expect(result.current.error).toBe(null);

    // Resolve the processing
    const mockResult = {
      extractedText: 'Test',
      confidence: 0.85,
      boundingBoxes: [],
      candidates: { 'JOHN KAMAU': 245 }
    };

    (OCRService.validateOCRResult as jest.Mock).mockReturnValue(true);

    await act(async () => {
      resolveProcessing(mockResult);
      await processingPromise;
    });

    expect(result.current.isProcessing).toBe(false);
  });

  it('should reset state', () => {
    const { result } = renderHook(() => useOCR());

    // Set some state first
    act(() => {
      (result.current as any).setState({
        isProcessing: true,
        result: { test: 'data' },
        error: 'Some error'
      });
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.isProcessing).toBe(false);
    expect(result.current.result).toBe(null);
    expect(result.current.error).toBe(null);
  });

  it('should process image with options', async () => {
    const mockResult = {
      extractedText: 'Test text',
      confidence: 0.85,
      boundingBoxes: [],
      candidates: { 'JOHN KAMAU': 245 }
    };

    (OCRService.processImage as jest.Mock).mockResolvedValue(mockResult);
    (OCRService.validateOCRResult as jest.Mock).mockReturnValue(true);

    const { result } = renderHook(() => useOCR());

    const options = {
      preprocessImage: true,
      confidenceThreshold: 0.8,
      candidateNames: ['JOHN KAMAU', 'MARY WANJIKU']
    };

    await act(async () => {
      await result.current.processImage('file://test.jpg', options);
    });

    expect(OCRService.processImage).toHaveBeenCalledWith('file://test.jpg', options);
    expect(result.current.result).toEqual(mockResult);
  });
});