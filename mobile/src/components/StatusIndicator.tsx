import React from 'react';
import styled from 'styled-components/native';
import { theme } from '@/utils/theme';

interface StatusIndicatorProps {
  status: 'pending' | 'verified' | 'error';
  text?: string;
  size?: 'sm' | 'md' | 'lg';
}

const Container = styled.View<{
  status: 'pending' | 'verified' | 'error';
  size: 'sm' | 'md' | 'lg';
}>`
  border-radius: ${theme.borderRadius.full}px;
  align-items: center;
  justify-content: center;
  flex-direction: row;
  
  ${({ status }) => {
    switch (status) {
      case 'pending':
        return `background-color: ${theme.colors.warning}20;`; // 20% opacity
      case 'verified':
        return `background-color: ${theme.colors.success}20;`;
      case 'error':
        return `background-color: ${theme.colors.error}20;`;
      default:
        return `background-color: ${theme.colors.gray[200]};`;
    }
  }}
  
  ${({ size }) => {
    switch (size) {
      case 'sm':
        return `
          padding-horizontal: ${theme.spacing.sm}px;
          padding-vertical: ${theme.spacing.xs}px;
        `;
      case 'md':
        return `
          padding-horizontal: ${theme.spacing.md - 4}px;
          padding-vertical: ${theme.spacing.xs}px;
        `;
      case 'lg':
        return `
          padding-horizontal: ${theme.spacing.md}px;
          padding-vertical: ${theme.spacing.sm}px;
        `;
      default:
        return `
          padding-horizontal: ${theme.spacing.md - 4}px;
          padding-vertical: ${theme.spacing.xs}px;
        `;
    }
  }}
`;

const StatusText = styled.Text<{
  status: 'pending' | 'verified' | 'error';
  size: 'sm' | 'md' | 'lg';
}>`
  font-weight: ${theme.fontWeight.medium};
  margin-left: ${theme.spacing.xs}px;
  
  ${({ status }) => {
    switch (status) {
      case 'pending':
        return `color: ${theme.colors.warning};`;
      case 'verified':
        return `color: ${theme.colors.success};`;
      case 'error':
        return `color: ${theme.colors.error};`;
      default:
        return `color: ${theme.colors.gray[600]};`;
    }
  }}
  
  ${({ size }) => {
    switch (size) {
      case 'sm':
        return `font-size: ${theme.fontSize.xs}px;`;
      case 'md':
        return `font-size: ${theme.fontSize.sm}px;`;
      case 'lg':
        return `font-size: ${theme.fontSize.base}px;`;
      default:
        return `font-size: ${theme.fontSize.sm}px;`;
    }
  }}
`;

const getStatusIcon = (status: 'pending' | 'verified' | 'error') => {
  switch (status) {
    case 'pending':
      return '⏳';
    case 'verified':
      return '✅';
    case 'error':
      return '❌';
    default:
      return '⚪';
  }
};

const getDefaultText = (status: 'pending' | 'verified' | 'error') => {
  switch (status) {
    case 'pending':
      return 'Pending Consensus';
    case 'verified':
      return 'Verified by Crowd';
    case 'error':
      return 'Error';
    default:
      return 'Unknown';
  }
};

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  text,
  size = 'md',
}) => {
  const displayText = text || getDefaultText(status);
  const icon = getStatusIcon(status);

  return (
    <Container status={status} size={size}>
      <StatusText status={status} size={size}>
        {icon} {displayText}
      </StatusText>
    </Container>
  );
};