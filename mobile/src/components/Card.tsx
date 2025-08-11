import React from 'react';
import { ViewProps } from 'react-native';
import styled from 'styled-components/native';
import { theme } from '@/utils/theme';

interface CardProps extends ViewProps {
  children: React.ReactNode;
  padding?: 'sm' | 'md' | 'lg';
  shadow?: boolean;
}

const StyledCard = styled.View<{
  padding: 'sm' | 'md' | 'lg';
  shadow?: boolean;
}>`
  background-color: white;
  border-radius: ${theme.borderRadius.lg}px;
  border-width: 1px;
  border-color: ${theme.colors.gray[200]};
  
  ${({ padding }) => {
    switch (padding) {
      case 'sm':
        return `padding: ${theme.spacing.md}px;`;
      case 'md':
        return `padding: ${theme.spacing.lg}px;`;
      case 'lg':
        return `padding: ${theme.spacing.xl}px;`;
      default:
        return `padding: ${theme.spacing.lg}px;`;
    }
  }}
  
  ${({ shadow }) => shadow && `
    shadow-color: ${theme.colors.gray[900]};
    shadow-offset: 0px 2px;
    shadow-opacity: 0.1;
    shadow-radius: 4px;
    elevation: 3;
  `}
`;

export const Card: React.FC<CardProps> = ({
  children,
  padding = 'md',
  shadow = true,
  ...props
}) => {
  return (
    <StyledCard padding={padding} shadow={shadow} {...props}>
      {children}
    </StyledCard>
  );
};