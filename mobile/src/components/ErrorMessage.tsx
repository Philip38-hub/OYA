import React from 'react';
import styled from 'styled-components/native';
import { theme } from '@/utils/theme';
import { StyledButton } from './StyledButton';

interface ErrorMessageProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryText?: string;
  fullScreen?: boolean;
}

const Container = styled.View<{ fullScreen?: boolean }>`
  align-items: center;
  justify-content: center;
  padding: ${theme.spacing.lg}px;
  
  ${({ fullScreen }) => fullScreen && `
    flex: 1;
    background-color: white;
  `}
`;

const ErrorIcon = styled.Text`
  font-size: ${theme.fontSize['4xl']}px;
  margin-bottom: ${theme.spacing.md}px;
`;

const ErrorTitle = styled.Text`
  font-size: ${theme.fontSize.xl}px;
  font-weight: ${theme.fontWeight.bold};
  color: ${theme.colors.error};
  text-align: center;
  margin-bottom: ${theme.spacing.sm}px;
`;

const ErrorText = styled.Text`
  font-size: ${theme.fontSize.base}px;
  color: ${theme.colors.gray[600]};
  text-align: center;
  line-height: ${theme.fontSize.base * 1.5}px;
  margin-bottom: ${theme.spacing.lg}px;
`;

const ButtonContainer = styled.View`
  width: 100%;
  max-width: 200px;
`;

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  title = 'Something went wrong',
  message,
  onRetry,
  retryText = 'Try Again',
  fullScreen = false,
}) => {
  return (
    <Container fullScreen={fullScreen}>
      <ErrorIcon>⚠️</ErrorIcon>
      <ErrorTitle>{title}</ErrorTitle>
      <ErrorText>{message}</ErrorText>
      {onRetry && (
        <ButtonContainer>
          <StyledButton
            title={retryText}
            variant="outline"
            onPress={onRetry}
          />
        </ButtonContainer>
      )}
    </Container>
  );
};