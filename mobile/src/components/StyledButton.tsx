import React from 'react';
import { TouchableOpacityProps } from 'react-native';
import styled from 'styled-components/native';
import { theme } from '@/utils/theme';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

const StyledTouchableOpacity = styled.TouchableOpacity<{
  variant: 'primary' | 'secondary' | 'outline';
  size: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
}>`
  border-radius: ${theme.borderRadius.lg}px;
  align-items: center;
  justify-content: center;
  
  ${({ variant }) => {
    switch (variant) {
      case 'primary':
        return `
          background-color: ${theme.colors.primary[600]};
        `;
      case 'secondary':
        return `
          background-color: ${theme.colors.gray[200]};
        `;
      case 'outline':
        return `
          background-color: transparent;
          border-width: 2px;
          border-color: ${theme.colors.primary[600]};
        `;
      default:
        return `
          background-color: ${theme.colors.primary[600]};
        `;
    }
  }}
  
  ${({ size }) => {
    switch (size) {
      case 'sm':
        return `
          padding-horizontal: ${theme.spacing.md}px;
          padding-vertical: ${theme.spacing.sm}px;
        `;
      case 'md':
        return `
          padding-horizontal: ${theme.spacing.lg}px;
          padding-vertical: ${theme.spacing.md - 4}px;
        `;
      case 'lg':
        return `
          padding-horizontal: ${theme.spacing.xl}px;
          padding-vertical: ${theme.spacing.md}px;
        `;
      default:
        return `
          padding-horizontal: ${theme.spacing.lg}px;
          padding-vertical: ${theme.spacing.md - 4}px;
        `;
    }
  }}
  
  ${({ disabled, loading }) => (disabled || loading) && `
    opacity: 0.5;
  `}
`;

const StyledText = styled.Text<{
  variant: 'primary' | 'secondary' | 'outline';
  size: 'sm' | 'md' | 'lg';
}>`
  font-weight: ${theme.fontWeight.semibold};
  
  ${({ variant }) => {
    switch (variant) {
      case 'primary':
        return `color: white;`;
      case 'secondary':
        return `color: ${theme.colors.gray[800]};`;
      case 'outline':
        return `color: ${theme.colors.primary[600]};`;
      default:
        return `color: white;`;
    }
  }}
  
  ${({ size }) => {
    switch (size) {
      case 'sm':
        return `font-size: ${theme.fontSize.sm}px;`;
      case 'md':
        return `font-size: ${theme.fontSize.base}px;`;
      case 'lg':
        return `font-size: ${theme.fontSize.lg}px;`;
      default:
        return `font-size: ${theme.fontSize.base}px;`;
    }
  }}
`;

export const StyledButton: React.FC<ButtonProps> = ({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  ...props
}) => {
  return (
    <StyledTouchableOpacity
      variant={variant}
      size={size}
      disabled={disabled || loading}
      loading={loading}
      {...props}
    >
      <StyledText variant={variant} size={size}>
        {loading ? 'Loading...' : title}
      </StyledText>
    </StyledTouchableOpacity>
  );
};