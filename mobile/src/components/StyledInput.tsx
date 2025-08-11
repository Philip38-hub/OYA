import React from 'react';
import { TextInputProps } from 'react-native';
import styled from 'styled-components/native';
import { theme } from '@/utils/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  size?: 'sm' | 'md' | 'lg';
}

const Container = styled.View`
  margin-bottom: ${theme.spacing.md}px;
`;

const Label = styled.Text`
  font-size: ${theme.fontSize.base}px;
  font-weight: ${theme.fontWeight.semibold};
  color: ${theme.colors.gray[700]};
  margin-bottom: ${theme.spacing.sm}px;
`;

const StyledTextInput = styled.TextInput<{
  hasError?: boolean;
  size: 'sm' | 'md' | 'lg';
}>`
  border-width: 1px;
  border-color: ${({ hasError }) => 
    hasError ? theme.colors.error : theme.colors.gray[300]};
  border-radius: ${theme.borderRadius.lg}px;
  background-color: white;
  color: ${theme.colors.gray[900]};
  
  ${({ size }) => {
    switch (size) {
      case 'sm':
        return `
          padding-horizontal: ${theme.spacing.md}px;
          padding-vertical: ${theme.spacing.sm}px;
          font-size: ${theme.fontSize.sm}px;
        `;
      case 'md':
        return `
          padding-horizontal: ${theme.spacing.md}px;
          padding-vertical: ${theme.spacing.md - 4}px;
          font-size: ${theme.fontSize.base}px;
        `;
      case 'lg':
        return `
          padding-horizontal: ${theme.spacing.lg}px;
          padding-vertical: ${theme.spacing.md}px;
          font-size: ${theme.fontSize.lg}px;
        `;
      default:
        return `
          padding-horizontal: ${theme.spacing.md}px;
          padding-vertical: ${theme.spacing.md - 4}px;
          font-size: ${theme.fontSize.base}px;
        `;
    }
  }}
`;

const ErrorText = styled.Text`
  font-size: ${theme.fontSize.sm}px;
  color: ${theme.colors.error};
  margin-top: ${theme.spacing.xs}px;
`;

export const StyledInput: React.FC<InputProps> = ({
  label,
  error,
  size = 'md',
  ...props
}) => {
  return (
    <Container>
      {label && <Label>{label}</Label>}
      <StyledTextInput
        hasError={!!error}
        size={size}
        placeholderTextColor={theme.colors.gray[500]}
        {...props}
      />
      {error && <ErrorText>{error}</ErrorText>}
    </Container>
  );
};