import { CameraService } from '../cameraService';
import { Camera } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';

// Mock expo-camera
jest.mock('expo-camera', () => ({
  Camera: {
    requestCameraPermissionsAsync: jest.fn(),
    getCameraPermissionsAsync: jest.fn(),
  },
}));

// Mock expo-media-library
jest.mock('expo-media-library', () => ({
  requestPermissionsAsync: jest.fn(),
  getPermissionsAsync: jest.fn(),
  createAssetAsync: jest.fn(),
}));

describe('CameraService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('requestPermissions', () => {
    it('should return true for both permissions when granted', async () => {
      (Camera.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      (MediaLibrary.requestPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });

      const result = await CameraService.requestPermissions();

      expect(result).toEqual({
        camera: true,
        mediaLibrary: true,
      });
    });

    it('should return false for camera permission when denied', async () => {
      (Camera.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
      });
      (MediaLibrary.requestPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });

      const result = await CameraService.requestPermissions();

      expect(result).toEqual({
        camera: false,
        mediaLibrary: true,
      });
    });

    it('should handle errors gracefully', async () => {
      (Camera.requestCameraPermissionsAsync as jest.Mock).mockRejectedValue(
        new Error('Permission request failed')
      );

      const result = await CameraService.requestPermissions();

      expect(result).toEqual({
        camera: false,
        mediaLibrary: false,
      });
    });
  });

  describe('checkPermissions', () => {
    it('should return current permission status', async () => {
      (Camera.getCameraPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      (MediaLibrary.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
      });

      const result = await CameraService.checkPermissions();

      expect(result).toEqual({
        camera: true,
        mediaLibrary: false,
      });
    });
  });

  describe('capturePhoto', () => {
    it('should capture photo with correct options', async () => {
      const mockCameraRef = {
        takePictureAsync: jest.fn().mockResolvedValue({
          uri: 'file://test-image.jpg',
          width: 1920,
          height: 1080,
        }),
      } as any;

      const result = await CameraService.capturePhoto(mockCameraRef);

      expect(mockCameraRef.takePictureAsync).toHaveBeenCalledWith({
        quality: 0.8,
        base64: false,
        skipProcessing: false,
      });

      expect(result).toEqual({
        uri: 'file://test-image.jpg',
        width: 1920,
        height: 1080,
      });
    });

    it('should throw error when capture fails', async () => {
      const mockCameraRef = {
        takePictureAsync: jest.fn().mockRejectedValue(new Error('Capture failed')),
      } as any;

      await expect(CameraService.capturePhoto(mockCameraRef)).rejects.toThrow(
        'Failed to capture photo'
      );
    });
  });

  describe('saveToMediaLibrary', () => {
    it('should save image to media library', async () => {
      (MediaLibrary.createAssetAsync as jest.Mock).mockResolvedValue({
        uri: 'content://media/external/images/media/123',
      });

      const result = await CameraService.saveToMediaLibrary('file://test-image.jpg');

      expect(MediaLibrary.createAssetAsync).toHaveBeenCalledWith('file://test-image.jpg');
      expect(result).toBe('content://media/external/images/media/123');
    });

    it('should throw error when save fails', async () => {
      (MediaLibrary.createAssetAsync as jest.Mock).mockRejectedValue(
        new Error('Save failed')
      );

      await expect(
        CameraService.saveToMediaLibrary('file://test-image.jpg')
      ).rejects.toThrow('Failed to save photo');
    });
  });
});