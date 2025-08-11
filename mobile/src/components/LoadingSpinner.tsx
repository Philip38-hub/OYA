import React from 'react';
import { ActivityIndicator } from 'react-native';
import styled from 'styled-components/native';
import { theme } from '@/utils/theme';

interface LoadingSpinnerProps {
  size?: 'small' | 'large';
  color?: string;
  text?: string;
  fullScreen?: boolean;
}

const Container = styled.View<{ fullScreen?: boolean }>`
  align-items: center;
  justify-content: center;
  
  ${({ fullScreen }) => fullScreen && `
    flex: 1;
    background-color: rgba(255, 255, 255, 0.9);
  `}
`;

const LoadingText = styled.Text`
  font-size: ${theme.fontSize.base}px;
  color: ${theme.colors.gray[600]};
  margin-top: ${theme.spacing.md}px;
  text-align: center;
`;

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'large',
  color = theme.colors.primary[600],
  text,
  fullScreen = false,
}) => {
  return (
    <Container fullScreen={fullScreen}>
      <ActivityIndicator size={size} color={color} />
      {text && <LoadingText>{text}</LoadingText>}
    </Container>
  );
};