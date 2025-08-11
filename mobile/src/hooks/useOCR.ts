import { useState, useCallback } from 'react';
import { OCRService, OCRResult, OCRProcessingOptions } from '@/services/ocrService';

export interface UseOCRState {
  isProcessing: boolean;
  result: OCRResult | null;
  error: string | null;
}

export interface UseOCRActions {
  processImage: (imageUri: string, options?: OCRProcessingOptions) => Promise<void>;
  reset: () => void;
}

export const useOCR = (): UseOCRState & UseOCRActions => {
  const [state, setState] = useState<UseOCRState>({
    isProcessing: false,
    result: null,
    error: null,
  });

  const processImage = useCallback(async (
    imageUri: string, 
    options?: OCRProcessingOptions
  ) => {
    setState(prev => ({
      ...prev,
      isProcessing: true,
      error: null,
    }));

    try {
      const result = await OCRService.processImage(imageUri, options);
      
      // Validate the OCR result
      if (!OCRService.validateOCRResult(result)) {
        throw new Error('OCR result validation failed. Please try again or enter data manually.');
      }

      setState(prev => ({
        ...prev,
        isProcessing: false,
        result,
      }));
    } catch (error) {
      console.error('OCR processing error:', error);
      setState(prev => ({
        ...prev,
        isProcessing: false,
        error: error instanceof Error ? error.message : 'OCR processing failed',
      }));
    }
  }, []);

  const reset = useCallback(() => {
    setState({
      isProcessing: false,
      result: null,
      error: null,
    });
  }, []);

  return {
    ...state,
    processImage,
    reset,
  };
};