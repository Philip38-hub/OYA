import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { ActionButton, Button } from '@/components';
import { RootStackParamList } from '@/types/navigation';

type MainActionScreenNavigationProp = StackNavigationProp<RootStackParamList, 'MainActionScreen'>;

interface Props {
  navigation: MainActionScreenNavigationProp;
}

export const MainActionScreen: React.FC<Props> = ({ navigation }) => {
  const handleCaptureImage = () => {
    navigation.navigate('ImageCaptureScreen');
  };

  const handleRecordAudio = () => {
    navigation.navigate('AudioRecordingScreen');
  };

  const handleViewDashboard = () => {
    navigation.navigate('DashboardScreen');
  };

  return (
    <ScrollView style={styles.scrollView}>
      <View style={styles.container}>
        {/* Header Section */}
        <View style={styles.header}>
          <Text style={styles.title}>
            Choose Your Action
          </Text>
          <Text style={styles.subtitle}>
            Select how you'd like to submit polling station results
          </Text>
        </View>
        
        {/* Main Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          <ActionButton
            title="Capture Form Image"
            subtitle="Scan Form 34A with camera"
            iconName="camera"
            onPress={handleCaptureImage}
            variant="primary"
            testID="capture-image-button"
            style={styles.actionButton}
          />
          
          <ActionButton
            title="Record Announcement"
            subtitle="Record official results audio"
            iconName="mic"
            onPress={handleRecordAudio}
            variant="primary"
            testID="record-audio-button"
            style={styles.actionButton}
          />
        </View>
        
        {/* Secondary Action */}
        <View style={styles.secondaryContainer}>
          <Button
            title="📊 View Live Tally Dashboard"
            variant="outline"
            onPress={handleViewDashboard}
            style={styles.dashboardButton}
          />
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    minHeight: '100%',
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    maxWidth: 320,
  },
  actionButtonsContainer: {
    width: '100%',
    maxWidth: 320,
    marginBottom: 32,
  },
  actionButton: {
    marginBottom: 16,
  },
  secondaryContainer: {
    width: '100%',
    maxWidth: 320,
  },
  dashboardButton: {
    paddingVertical: 16,
  },
});