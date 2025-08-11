import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { AppNavigator } from './src/navigation';
import { ThemeProvider } from './src/components';
import './global.css';

export default function App() {
  return (
    <ThemeProvider>
      <AppNavigator />
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
