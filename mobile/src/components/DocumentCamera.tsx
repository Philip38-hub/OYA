import React, { useRef, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { CameraService, CapturedImage } from '@/services/cameraService';
import { LoadingSpinner } from './LoadingSpinner';
import { ErrorMessage } from './ErrorMessage';

interface DocumentCameraProps {
  onCapture: (image: CapturedImage) => void;
  onError: (error: string) => void;
  onPermissionDenied: () => void;
  showImagePicker?: boolean;
}

export const DocumentCamera: React.FC<DocumentCameraProps> = ({
  onCapture,
  onError,
  onPermissionDenied,
  showImagePicker = true,
}) => {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [isCapturing, setIsCapturing] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [flashMode, setFlashMode] = useState<'off' | 'on' | 'auto'>('off');

  useEffect(() => {
    if (!permission) {
      return; // Still loading
    }
    
    if (!permission.granted) {
      requestPermission().then((result) => {
        if (!result.granted) {
          onPermissionDenied();
        }
      });
    }
  }, [permission, requestPermission, onPermissionDenied]);

  const handleCapture = async () => {
    if (!cameraRef.current || !cameraReady || isCapturing) {
      return;
    }

    setIsCapturing(true);

    try {
      console.log('📷 Photo taken: Starting capture...');
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        base64: false,
        skipProcessing: false,
        flash: flashMode,
      });
      
      console.log('📷 Photo taken:', photo.uri);
      
      const image: CapturedImage = {
        uri: photo.uri,
        width: photo.width || 1920,
        height: photo.height || 1080,
      };
      
      onCapture(image);
    } catch (error) {
      console.error('Capture failed:', error);
      onError('Failed to capture image. Please try again.');
    } finally {
      setIsCapturing(false);
    }
  };

  const handlePickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert(
          'Permission Required',
          'Please allow access to your photo library to select images.',
          [{ text: 'OK' }]
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        console.log('📷 Image selected from library:', asset.uri);
        
        const image: CapturedImage = {
          uri: asset.uri,
          width: asset.width || 1920,
          height: asset.height || 1080,
        };
        
        onCapture(image);
      }
    } catch (error) {
      console.error('Image picker failed:', error);
      onError('Failed to select image. Please try again.');
    }
  };

  const onCameraReady = () => {
    setCameraReady(true);
  };

  if (!permission) {
    return (
      <View style={styles.centerContainer}>
        <LoadingSpinner />
        <Text style={styles.loadingText}>Requesting camera permissions...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centerContainer}>
        <ErrorMessage message="Camera permission is required to capture documents" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        onCameraReady={onCameraReady}
      >
        {/* Document scanning overlay */}
        <View style={styles.overlay}>
          <View style={styles.scanArea}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>
          
          <View style={styles.instructionContainer}>
            <Text style={styles.instructionText}>
              Position Form 34A within the frame
            </Text>
            <Text style={styles.subInstructionText}>
              Ensure good lighting and all text is visible
            </Text>
          </View>
        </View>

        {/* Camera controls */}
        <View style={styles.controlsContainer}>
          {/* Image picker button */}
          {showImagePicker && (
            <TouchableOpacity
              style={styles.imagePickerButton}
              onPress={handlePickImage}
            >
              <Text style={styles.imagePickerIcon}>📁</Text>
              <Text style={styles.imagePickerText}>Gallery</Text>
            </TouchableOpacity>
          )}

          {/* Capture button */}
          <TouchableOpacity
            style={[
              styles.captureButton,
              (!cameraReady || isCapturing) && styles.captureButtonDisabled
            ]}
            onPress={handleCapture}
            disabled={!cameraReady || isCapturing}
          >
            {isCapturing ? (
              <LoadingSpinner size="small" color="#fff" />
            ) : (
              <View style={styles.captureButtonInner} />
            )}
          </TouchableOpacity>

          {/* Flash toggle */}
          <TouchableOpacity 
            style={styles.flashButton}
            onPress={() => {
              const modes: ('off' | 'on' | 'auto')[] = ['off', 'on', 'auto'];
              const currentIndex = modes.indexOf(flashMode);
              const nextIndex = (currentIndex + 1) % modes.length;
              setFlashMode(modes[nextIndex]);
            }}
          >
            <Text style={styles.flashIcon}>
              {flashMode === 'off' ? '⚡' : flashMode === 'on' ? '💡' : '🔆'}
            </Text>
            <Text style={styles.flashText}>
              {flashMode === 'off' ? 'Off' : flashMode === 'on' ? 'On' : 'Auto'}
            </Text>
          </TouchableOpacity>
        </View>
      </CameraView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  loadingText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 16,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scanArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 40,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#fff',
    borderWidth: 3,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  instructionContainer: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  instructionText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  subInstructionText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  imagePickerButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  imagePickerIcon: {
    fontSize: 24,
    marginBottom: 2,
  },
  imagePickerText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '500',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderWidth: 4,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
  },
  flashButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  flashIcon: {
    fontSize: 24,
    marginBottom: 2,
  },
  flashText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '500',
  },
});