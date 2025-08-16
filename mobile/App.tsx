import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { 
  SplashScreen,
  MainActionScreen,
  ImageCaptureScreen,
  AudioRecordingScreen,
  ConfirmationScreen,
  DashboardScreen
} from './src/screens';

import { ThemeProvider } from './src/components/ThemeProvider';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { RootStackParamList } from './src/types/navigation';

const Stack = createStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <ThemeProvider>
          <NavigationContainer>
            <StatusBar style="dark" />
            <Stack.Navigator
              initialRouteName="SplashScreen"
              screenOptions={{
                headerShown: false,
                gestureEnabled: true,
                cardStyleInterpolator: ({ current, layouts }) => {
                  return {
                    cardStyle: {
                      transform: [
                        {
                          translateX: current.progress.interpolate({
                            inputRange: [0, 1],
                            outputRange: [layouts.screen.width, 0],
                          }),
                        },
                      ],
                    },
                  };
                },
              }}
            >
              <Stack.Screen name="SplashScreen" component={SplashScreen} />
              <Stack.Screen name="MainActionScreen" component={MainActionScreen} />
              <Stack.Screen name="ImageCaptureScreen" component={ImageCaptureScreen} />
              <Stack.Screen name="AudioRecordingScreen" component={AudioRecordingScreen} />
              <Stack.Screen name="ConfirmationScreen" component={ConfirmationScreen} />
              <Stack.Screen name="DashboardScreen" component={DashboardScreen} />
            </Stack.Navigator>
          </NavigationContainer>
        </ThemeProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}