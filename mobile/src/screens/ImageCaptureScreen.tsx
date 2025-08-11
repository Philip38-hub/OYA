import React, { useState } from 'react';
import { View, Text, Alert, StyleSheet } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Button, DocumentCamera, LoadingSpinner } from '@/components';
import { RootStackParamList } from '@/types/navigation';
import { CapturedImage } from '@/services/cameraService';
import { useOCR } from '@/hooks/useOCR';

type ImageCaptureScreenNavigationProp = StackNavigationProp<RootStackParamList, 'ImageCaptureScreen'>;

interface Props {
  navigation: ImageCaptureScreenNavigationProp;
}

export const ImageCaptureScreen: React.FC<Props> = ({ navigation }) => {
  const [showCamera, setShowCamera] = useState(false);
  const { isProcessing, result, error, processImage, reset } = useOCR();

  const handleStartCapture = () => {
    reset(); // Clear any previous results
    setShowCamera(true);
  };

  const handleImageCaptured = async (image: CapturedImage) => {
    console.log('Image captured:', image.uri);
    setShowCamera(false);
    
    try {
      // Process the captured image with OCR
      await processImage(image.uri, {
        preprocessImage: true,
        confidenceThreshold: 0.7,
        candidateNames: ['JOHN KAMAU', 'MARY WANJIKU', 'PETER MWANGI', 'GRACE NJERI']
      });
    } catch (error) {
      console.error('Failed to process image:', error);
    }
  };

  // Navigate to confirmation screen when OCR processing is complete
  React.useEffect(() => {
    if (result && !isProcessing) {
      const extractedData = {
        ...result.candidates,
        spoilt: result.spoilt || 0
      };
      
      navigation.navigate('ConfirmationScreen', {
        data: extractedData,
        submissionType: 'image_ocr'
      });
    }
  }, [result, isProcessing, navigation]);

  // Handle OCR errors
  React.useEffect(() => {
    if (error) {
      Alert.alert(
        'OCR Processing Failed',
        `${error}\n\nWould you like to try again or enter the data manually?`,
        [
          { text: 'Try Again', onPress: handleStartCapture },
          { 
            text: 'Manual Entry', 
            onPress: () => {
              // Navigate to confirmation screen with empty data for manual entry
              navigation.navigate('ConfirmationScreen', {
                data: {},
                submissionType: 'image_ocr'
              });
            }
          },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    }
  }, [error, navigation]);

  const handleCameraError = (error: string) => {
    console.error('Camera error:', error);
    Alert.alert('Camera Error', error);
    setShowCamera(false);
  };

  const handlePermissionDenied = () => {
    Alert.alert(
      'Camera Permission Required',
      'This app needs camera access to capture polling station forms. Please enable camera permissions in your device settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Go Back', onPress: () => navigation.goBack() }
      ]
    );
  };

  if (isProcessing) {
    return (
      <View style={styles.container}>
        <LoadingSpinner size="large" />
        <Text style={styles.processingTitle}>
          Processing Image
        </Text>
        <Text style={styles.processingSubtitle}>
          Extracting vote counts using OCR...
        </Text>
      </View>
    );
  }

  if (showCamera) {
    return (
      <View style={styles.cameraContainer}>
        <DocumentCamera
          onCapture={handleImageCaptured}
          onError={handleCameraError}
          onPermissionDenied={handlePermissionDenied}
        />
        
        {/* Back button overlay */}
        <View style={styles.backButtonOverlay}>
          <Button
            title="← Back"
            variant="outline"
            onPress={() => setShowCamera(false)}
            style={styles.overlayButton}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        Document Capture
      </Text>
      
      <Text style={styles.description}>
        Capture Form 34A using your camera. The app will automatically extract vote counts using OCR processing.
      </Text>
      
      <View style={styles.placeholderContainer}>
        <Text style={styles.placeholderIcon}>📄</Text>
        <Text style={styles.placeholderText}>
          Position Form 34A in good lighting{'\n'}
          for best OCR results
        </Text>
      </View>
      
      <View style={styles.buttonContainer}>
        <Button
          title="📷 Open Camera"
          variant="primary"
          onPress={handleStartCapture}
          style={styles.cameraButton}
        />
        
        <Button
          title="← Back"
          variant="outline"
          onPress={() => navigation.goBack()}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  processingTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    textAlign: 'center',
  },
  processingSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
  },
  placeholderContainer: {
    width: '100%',
    height: 256,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    marginBottom: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
  },
  placeholderIcon: {
    fontSize: 60,
    marginBottom: 16,
  },
  placeholderText: {
    color: '#6b7280',
    textAlign: 'center',
    fontSize: 14,
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 320,
  },
  cameraButton: {
    marginBottom: 16,
  },
  backButtonOverlay: {
    position: 'absolute',
    top: 48,
    left: 16,
  },
  overlayButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderColor: '#ffffff',
  },
});