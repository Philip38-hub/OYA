import React, { useState } from 'react';
import { View } from 'react-native';
import styled from 'styled-components/native';
import { theme } from '@/utils/theme';
import { StyledButton } from './StyledButton';
import { LoadingSpinner } from './LoadingSpinner';
import { errorHandlingService } from '@/services/errorHandlingService';

interface MLErrorHandlerProps {
  error: Error;
  processingType: 'OCR' | 'Speech-to-Text';
  onRetry?: () => Promise<void>;
  onFallbackToManual: () => void;
  onCancel?: () => void;
  context?: {
    component?: string;
    action?: string;
  };
  showConfidenceInfo?: boolean;
  lowConfidenceThreshold?: number;
}

const Container = styled.View`
  background-color: white;
  padding: ${theme.spacing.lg}px;
  border-radius: ${theme.borderRadius.lg}px;
  margin: ${theme.spacing.md}px;
  shadow-color: #000;
  shadow-offset: 0px 2px;
  shadow-opacity: 0.1;
  shadow-radius: 4px;
  elevation: 3;
`;

const ErrorIcon = styled.Text`
  font-size: 48px;
  text-align: center;
  margin-bottom: ${theme.spacing.md}px;
`;

const ErrorTitle = styled.Text`
  font-size: ${theme.fontSize.xl}px;
  font-weight: ${theme.fontWeight.bold};
  color: ${theme.colors.warning};
  text-align: center;
  margin-bottom: ${theme.spacing.sm}px;
`;

const ErrorMessage = styled.Text`
  font-size: ${theme.fontSize.base}px;
  color: ${theme.colors.gray[600]};
  text-align: center;
  line-height: ${theme.fontSize.base * 1.5}px;
  margin-bottom: ${theme.spacing.md}px;
`;

const InfoBox = styled.View`
  background-color: #eff6ff;
  border-left-width: 4px;
  border-left-color: #60a5fa;
  padding: ${theme.spacing.md}px;
  margin-bottom: ${theme.spacing.lg}px;
  border-radius: ${theme.borderRadius.md}px;
`;

const InfoText = styled.Text`
  font-size: ${theme.fontSize.sm}px;
  color: #1d4ed8;
  line-height: ${theme.fontSize.sm * 1.4}px;
`;

const ButtonContainer = styled.View`
  gap: ${theme.spacing.md}px;
`;

const LoadingContainer = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: center;
  padding: ${theme.spacing.md}px;
`;

const LoadingText = styled.Text`
  margin-left: ${theme.spacing.sm}px;
  color: ${theme.colors.gray[600]};
`;

export const MLErrorHandler: React.FC<MLErrorHandlerProps> = ({
  error,
  processingType,
  onRetry,
  onFallbackToManual,
  onCancel,
  context = {},
  showConfidenceInfo = true,
  lowConfidenceThreshold = 0.7,
}) => {
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    if (!onRetry || isRetrying) return;

    setIsRetrying(true);
    
    try {
      const result = await errorHandlingService.handleMLProcessingError(
        error,
        {
          component: context.component || 'MLErrorHandler',
          action: context.action || `${processingType.toLowerCase()}_retry`,
          timestamp: new Date().toISOString(),
        },
        onRetry
      );

      if (result.success) {
        // Success - the parent component should handle this
        console.log('ML processing retry successful');
      } else {
        console.log('ML processing retry failed, suggesting manual fallback');
      }
    } catch (retryError) {
      console.error('ML processing retry failed:', retryError);
    } finally {
      setIsRetrying(false);
    }
  };

  const handleFallbackToManual = async () => {
    // Log the fallback action
    await errorHandlingService.logError(
      new Error(`User chose manual fallback for ${processingType}`),
      {
        component: context.component || 'MLErrorHandler',
        action: `${processingType.toLowerCase()}_manual_fallback`,
        timestamp: new Date().toISOString(),
      },
      'low'
    );

    onFallbackToManual();
  };

  const getErrorMessage = () => {
    const errorMessage = error.message.toLowerCase();
    
    if (errorMessage.includes('model') || errorMessage.includes('tensorflow')) {
      return `The ${processingType} model failed to load or process your data. This might be due to device limitations or corrupted model files.`;
    } else if (errorMessage.includes('confidence') || errorMessage.includes('accuracy')) {
      return `The ${processingType} processing completed but with low confidence. The extracted data might not be accurate.`;
    } else if (errorMessage.includes('timeout')) {
      return `${processingType} processing took too long and was cancelled. This might happen with complex images or audio files.`;
    } else if (errorMessage.includes('memory')) {
      return `Not enough memory available for ${processingType} processing. Try closing other apps and retry.`;
    } else {
      return `${processingType} processing failed. You can try again or enter the data manually.`;
    }
  };

  const getIcon = () => {
    if (processingType === 'OCR') {
      return '📷';
    } else if (processingType === 'Speech-to-Text') {
      return '🎤';
    }
    return '🤖';
  };

  const getInfoMessage = () => {
    if (processingType === 'OCR') {
      return 'For better OCR results, ensure the document is well-lit, flat, and all text is clearly visible. Avoid shadows and reflections.';
    } else if (processingType === 'Speech-to-Text') {
      return 'For better speech recognition, speak clearly and ensure minimal background noise. Official announcements work best.';
    }
    return 'Machine learning processing can sometimes fail. Manual entry ensures accuracy.';
  };

  return (
    <Container>
      <ErrorIcon>{getIcon()}</ErrorIcon>
      <ErrorTitle>{processingType} Processing Failed</ErrorTitle>
      <ErrorMessage>{getErrorMessage()}</ErrorMessage>
      
      {showConfidenceInfo && (
        <InfoBox>
          <InfoText>{getInfoMessage()}</InfoText>
        </InfoBox>
      )}

      {isRetrying && (
        <LoadingContainer>
          <LoadingSpinner size="small" />
          <LoadingText>Retrying {processingType.toLowerCase()} processing...</LoadingText>
        </LoadingContainer>
      )}

      <ButtonContainer>
        {onRetry && !isRetrying && (
          <StyledButton
            title={`Retry ${processingType}`}
            onPress={handleRetry}
            variant="primary"
          />
        )}
        
        <StyledButton
          title="Enter Data Manually"
          onPress={handleFallbackToManual}
          variant="outline"
        />
        
        {onCancel && (
          <StyledButton
            title="Cancel"
            onPress={onCancel}
            variant="outline"
          />
        )}
      </ButtonContainer>
    </Container>
  );
};