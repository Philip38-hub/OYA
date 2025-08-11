import { Camera } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';

export interface CameraPermissions {
  camera: boolean;
  mediaLibrary: boolean;
}

export interface CapturedImage {
  uri: string;
  width: number;
  height: number;
}

export class CameraService {
  static async requestPermissions(): Promise<CameraPermissions> {
    try {
      const cameraPermission = await Camera.requestCameraPermissionsAsync();
      const mediaLibraryPermission = await MediaLibrary.requestPermissionsAsync();

      return {
        camera: cameraPermission.status === 'granted',
        mediaLibrary: mediaLibraryPermission.status === 'granted',
      };
    } catch (error) {
      console.error('Error requesting camera permissions:', error);
      return {
        camera: false,
        mediaLibrary: false,
      };
    }
  }

  static async checkPermissions(): Promise<CameraPermissions> {
    try {
      const cameraPermission = await Camera.getCameraPermissionsAsync();
      const mediaLibraryPermission = await MediaLibrary.getPermissionsAsync();

      return {
        camera: cameraPermission.status === 'granted',
        mediaLibrary: mediaLibraryPermission.status === 'granted',
      };
    } catch (error) {
      console.error('Error checking camera permissions:', error);
      return {
        camera: false,
        mediaLibrary: false,
      };
    }
  }

  static async capturePhoto(cameraRef: any): Promise<CapturedImage> {
    try {
      const photo = await cameraRef.takePictureAsync({
        quality: 0.8,
        base64: false,
        skipProcessing: false,
      });

      return {
        uri: photo.uri,
        width: photo.width,
        height: photo.height,
      };
    } catch (error) {
      console.error('Error capturing photo:', error);
      throw new Error('Failed to capture photo');
    }
  }

  static async saveToMediaLibrary(uri: string): Promise<string> {
    try {
      const asset = await MediaLibrary.createAssetAsync(uri);
      return asset.uri;
    } catch (error) {
      console.error('Error saving to media library:', error);
      throw new Error('Failed to save photo');
    }
  }
}