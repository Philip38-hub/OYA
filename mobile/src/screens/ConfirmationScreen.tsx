import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { StyledButton, StyledInput, Card, ErrorMessage, MLErrorHandler, NetworkErrorHandler, ErrorBoundary } from '@/components';
import { RootStackParamList } from '@/types/navigation';
import { useErrorRecovery } from '@/hooks/useErrorRecovery';
import { apiService } from '@/services/apiService';

type ConfirmationScreenNavigationProp = StackNavigationProp<RootStackParamList, 'ConfirmationScreen'>;
type ConfirmationScreenRouteProp = RouteProp<RootStackParamList, 'ConfirmationScreen'>;

interface Props {
  navigation: ConfirmationScreenNavigationProp;
  route: ConfirmationScreenRouteProp;
}

interface ValidationErrors {
  [key: string]: string;
}

export const ConfirmationScreen: React.FC<Props> = ({ navigation, route }) => {
  const { data, submissionType } = route.params;
  const [editableData, setEditableData] = useState(data);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ocrFailed, setOcrFailed] = useState(false);
  const [showMLError, setShowMLError] = useState(false);
  const [showNetworkError, setShowNetworkError] = useState(false);

  // Use error recovery hook
  const errorRecovery = useErrorRecovery({
    maxRetries: 3,
    showUserFriendlyMessages: false, // We'll handle UI manually
    autoRetryNetworkErrors: false,
    logErrors: true,
  });

  // Check if this is a fallback to manual entry (OCR/STT failed)
  useEffect(() => {
    // If data is empty or has very low confidence, treat as OCR failure
    const hasData = Object.keys(data).length > 0;
    const hasValidData = Object.values(data).some(value => value > 0);
    
    if (!hasData || !hasValidData) {
      setOcrFailed(true);
      // Initialize with empty candidate fields for manual entry
      setEditableData({
        'Candidate A': 0,
        'Candidate B': 0,
        'Candidate C': 0,
        'Candidate D': 0,
        'spoilt': 0
      });
    }
  }, [data]);

  const validateInput = (key: string, value: string): string | null => {
    const numericValue = parseInt(value);
    
    if (isNaN(numericValue)) {
      return 'Please enter a valid number';
    }
    
    if (numericValue < 0) {
      return 'Vote count cannot be negative';
    }
    
    if (numericValue > 10000) {
      return 'Vote count seems unusually high';
    }
    
    return null;
  };

  const handleValueChange = (key: string, value: string) => {
    // Clear previous validation error for this field
    setValidationErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[key];
      return newErrors;
    });

    // Validate input
    const error = validateInput(key, value);
    if (error) {
      setValidationErrors(prev => ({
        ...prev,
        [key]: error
      }));
    }

    // Update the value (allow empty string for editing, convert to 0 if empty)
    const numericValue = value === '' ? 0 : parseInt(value) || 0;
    setEditableData(prev => ({
      ...prev,
      [key]: numericValue
    }));
  };

  const validateAllFields = (): boolean => {
    const errors: ValidationErrors = {};
    let hasErrors = false;

    Object.entries(editableData).forEach(([key, value]) => {
      const error = validateInput(key, value.toString());
      if (error) {
        errors[key] = error;
        hasErrors = true;
      }
    });

    // Check if at least one candidate has votes
    const candidateVotes = Object.entries(editableData)
      .filter(([key]) => key !== 'spoilt')
      .map(([, value]) => value);
    
    const totalCandidateVotes = candidateVotes.reduce((sum, votes) => sum + votes, 0);
    
    if (totalCandidateVotes === 0) {
      errors.general = 'At least one candidate must have votes';
      hasErrors = true;
    }

    setValidationErrors(errors);
    return !hasErrors;
  };

  const handleConfirmSubmit = async () => {
    if (!validateAllFields()) {
      Alert.alert(
        'Validation Error',
        'Please correct the errors before submitting.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Show confirmation dialog
    Alert.alert(
      'Confirm Submission',
      'Are you sure you want to submit these results? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Submit',
          style: 'default',
          onPress: async () => {
            await performSubmission();
          }
        }
      ]
    );
  };

  const performSubmission = async () => {
    setIsSubmitting(true);
    setShowNetworkError(false);
    
    try {
      // Create submission payload
      const payload = {
        walletAddress: 'mock-wallet-address', // This would come from wallet store
        pollingStationId: 'mock-station-001',
        gpsCoordinates: {
          latitude: -1.2921, // Mock coordinates for Nairobi
          longitude: 36.8219,
        },
        timestamp: new Date().toISOString(),
        results: {
          ...Object.fromEntries(
            Object.entries(editableData).filter(([key]) => key !== 'spoilt')
          ),
          spoilt: editableData.spoilt || 0,
        },
        submissionType,
        confidence: ocrFailed ? 1.0 : 0.85, // Manual entry has 100% confidence
      };

      console.log('Submitting payload:', payload);
      
      // Submit to API service
      const result = await apiService.submitResult(payload);
      
      if (result.success) {
        Alert.alert(
          'Submission Successful',
          'Your polling results have been submitted successfully.',
          [
            {
              text: 'View Dashboard',
              onPress: () => navigation.navigate('DashboardScreen'),
            }
          ]
        );
      } else {
        throw new Error(result.message || 'Submission failed');
      }
    } catch (error) {
      console.error('Submission failed:', error);
      const submissionError = error instanceof Error ? error : new Error('Unknown submission error');
      
      // Handle different types of errors
      if (submissionError.message.toLowerCase().includes('network') || 
          submissionError.message.toLowerCase().includes('connection')) {
        await errorRecovery.handleError(submissionError, {
          component: 'ConfirmationScreen',
          action: 'submit_results_network_error',
        });
        setShowNetworkError(true);
      } else {
        // Generic error
        Alert.alert(
          'Submission Failed',
          submissionError.message,
          [
            { text: 'Try Again', onPress: () => performSubmission() },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualEntry = () => {
    setOcrFailed(true);
    setShowMLError(false);
    // Reset to empty values for manual entry
    setEditableData({
      'Candidate A': 0,
      'Candidate B': 0,
      'Candidate C': 0,
      'Candidate D': 0,
      'spoilt': 0
    });
    setValidationErrors({});
  };

  const handleRetryProcessing = async () => {
    // This would retry OCR/STT processing
    Alert.alert(
      'Retry Processing',
      'This would retry the OCR/Speech-to-Text processing. For now, please use manual entry.',
      [{ text: 'OK' }]
    );
  };

  const handleCancelError = () => {
    setShowMLError(false);
    setShowNetworkError(false);
    errorRecovery.clearError();
  };

  const getTotalVotes = () => {
    return Object.values(editableData).reduce((sum, votes) => sum + votes, 0);
  };

  const formatFieldLabel = (key: string): string => {
    if (key === 'spoilt') return 'Spoilt Ballots';
    return key.charAt(0).toUpperCase() + key.slice(1);
  };

  return (
    <ErrorBoundary>
      <ScrollView className="flex-1 bg-white">
        <View className="p-5">
          <Text className="text-2xl font-bold text-gray-800 mb-4 text-center">
            Confirm Results
          </Text>
          
          {/* Show ML error handler if processing failed */}
          {showMLError && errorRecovery.state.error && (
            <View className="mb-6">
              <MLErrorHandler
                error={errorRecovery.state.error}
                processingType={submissionType === 'image_ocr' ? 'OCR' : 'Speech-to-Text'}
                onRetry={handleRetryProcessing}
                onFallbackToManual={handleManualEntry}
                onCancel={handleCancelError}
                context={{
                  component: 'ConfirmationScreen',
                  action: 'ml_processing_failed',
                }}
              />
            </View>
          )}

          {/* Show network error handler if submission failed */}
          {showNetworkError && errorRecovery.state.error && (
            <View className="mb-6">
              <NetworkErrorHandler
                error={errorRecovery.state.error}
                onRetry={performSubmission}
                onCancel={handleCancelError}
                context={{
                  component: 'ConfirmationScreen',
                  action: 'submit_results',
                }}
                showOfflineOption={true}
              />
            </View>
          )}
          
          {ocrFailed && !showMLError ? (
            <View className="mb-6">
              <ErrorMessage
                title="Extraction Failed"
                message={`${submissionType === 'image_ocr' ? 'OCR processing' : 'Speech-to-text processing'} could not extract vote counts. Please enter the results manually.`}
                fullScreen={false}
              />
            </View>
          ) : !showMLError && !showNetworkError && (
            <Text className="text-base text-gray-600 text-center leading-6 mb-6">
              Review and edit the extracted data before submission
            </Text>
          )}
        
        <Text className="text-sm text-gray-500 mb-4">
          Source: {submissionType === 'image_ocr' ? 'Image OCR' : 'Audio Speech-to-Text'}
          {ocrFailed && ' (Manual Entry)'}
        </Text>
        
        {validationErrors.general && (
          <View className="mb-4">
            <ErrorMessage
              message={validationErrors.general}
              fullScreen={false}
            />
          </View>
        )}
        
        <Card padding="lg">
          <Text className="text-lg font-semibold text-gray-800 mb-4">
            Vote Counts
          </Text>
          
          {Object.entries(editableData).map(([key, value]) => (
            <StyledInput
              key={key}
              label={formatFieldLabel(key)}
              value={value === 0 ? '' : value.toString()}
              onChangeText={(text) => handleValueChange(key, text)}
              keyboardType="numeric"
              placeholder="0"
              error={validationErrors[key]}
            />
          ))}
          
          <View className="mt-4 pt-4 border-t border-gray-200">
            <Text className="text-base font-semibold text-gray-700">
              Total Votes: {getTotalVotes()}
            </Text>
          </View>
        </Card>
        
        <View className="mt-8 space-y-4">
          <StyledButton
            title={isSubmitting ? "Submitting..." : "✅ Confirm & Submit"}
            variant="primary"
            onPress={handleConfirmSubmit}
            disabled={isSubmitting}
            loading={isSubmitting}
            className="mb-4"
          />
          
          {!ocrFailed && (
            <StyledButton
              title="✏️ Enter Manually Instead"
              variant="secondary"
              onPress={handleManualEntry}
              disabled={isSubmitting}
              className="mb-2"
            />
          )}
          
          <StyledButton
            title="← Back to Capture"
            variant="outline"
            onPress={() => navigation.goBack()}
            disabled={isSubmitting}
          />
        </View>
      </View>
    </ScrollView>
    </ErrorBoundary>
  );
};