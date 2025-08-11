// Temporarily commented out for development to avoid React Native compatibility issues
// import * as tf from '@tensorflow/tfjs';

// Mock types for development
type Tensor3D = any;

export interface ImagePreprocessingOptions {
  targetWidth?: number;
  targetHeight?: number;
  enhanceContrast?: boolean;
  normalizePixels?: boolean;
}

export class ImageProcessingUtils {
  /**
   * Preprocess image tensor for better OCR accuracy
   */
  static preprocessImageTensor(
    imageTensor: Tensor3D,
    options: ImagePreprocessingOptions = {}
  ): Tensor3D {
    // Mock preprocessing for development
    console.log('Mock preprocessing image tensor with options:', options);
    return imageTensor;
  }

  /**
   * Convert base64 image data to tensor (mock)
   */
  static base64ToImageTensor(base64Data: string, channels: number = 3): Tensor3D {
    // Mock tensor creation for development
    console.log('Mock converting base64 to tensor, channels:', channels);
    return {} as Tensor3D;
  }

  /**
   * Create a dummy image tensor for testing/fallback (mock)
   */
  static createDummyImageTensor(
    seed: string,
    width: number = 224,
    height: number = 224,
    channels: number = 3
  ): Tensor3D {
    // Mock tensor creation for development
    console.log('Mock creating dummy tensor:', { seed, width, height, channels });
    return {} as Tensor3D;
  }

  private static hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}