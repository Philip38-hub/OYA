import React from 'react';
import { ThemeProvider as StyledThemeProvider } from 'styled-components/native';
import { theme } from '@/utils/theme';

interface Props {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<Props> = ({ children }) => {
  return (
    <StyledThemeProvider theme={theme}>
      {children}
    </StyledThemeProvider>
  );
};