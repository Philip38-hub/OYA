import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import {
  SplashScreen,
  MainActionScreen,
  ImageCaptureScreen,
  AudioRecordingScreen,
  ConfirmationScreen,
  DashboardScreen,
} from '@/screens';
import { RootStackParamList } from '@/types/navigation';

const Stack = createStackNavigator<RootStackParamList>();

export const AppNavigator: React.FC = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="SplashScreen"
        screenOptions={{
          headerStyle: {
            backgroundColor: '#1e40af',
          },
          headerTintColor: '#ffffff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        <Stack.Screen
          name="SplashScreen"
          component={SplashScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="MainActionScreen"
          component={MainActionScreen}
          options={{
            title: 'OYAH! - Witness',
            headerLeft: () => null, // Prevent going back to splash
          }}
        />
        <Stack.Screen
          name="ImageCaptureScreen"
          component={ImageCaptureScreen}
          options={{
            title: 'Capture Form Image',
          }}
        />
        <Stack.Screen
          name="AudioRecordingScreen"
          component={AudioRecordingScreen}
          options={{
            title: 'Record Announcement',
          }}
        />
        <Stack.Screen
          name="ConfirmationScreen"
          component={ConfirmationScreen}
          options={{
            title: 'Confirm Results',
          }}
        />
        <Stack.Screen
          name="DashboardScreen"
          component={DashboardScreen}
          options={{
            title: 'Live Tally Dashboard',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};