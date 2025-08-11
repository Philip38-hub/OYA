import React, { useState, useEffect } from 'react';
import { View, Text, Alert } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Button, ErrorMessage, LoadingSpinner } from '@/components';
import { RootStackParamList } from '@/types/navigation';
import { audioService, AudioRecordingResult } from '@/services/audioService';
import { speechToTextService, STTResult } from '@/services/speechToTextService';

type AudioRecordingScreenNavigationProp = StackNavigationProp<RootStackParamList, 'AudioRecordingScreen'>;

interface Props {
  navigation: AudioRecordingScreenNavigationProp;
}

export const AudioRecordingScreen: React.FC<Props> = ({ navigation }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recordingResult, setRecordingResult] = useState<AudioRecordingResult | null>(null);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      audioService.cleanup();
    };
  }, []);

  const handleStartRecording = async () => {
    try {
      setError(null);
      setIsRecording(true);
      await audioService.startRecording();
      console.log('Audio recording started successfully');
    } catch (error) {
      console.error('Failed to start recording:', error);
      setIsRecording(false);
      
      if (error instanceof Error) {
        if (error.message.includes('permission')) {
          setError('Microphone permission is required to record audio. Please enable it in your device settings.');
        } else {
          setError(`Failed to start recording: ${error.message}`);
        }
      } else {
        setError('Failed to start recording. Please try again.');
      }
    }
  };

  const handleStopRecording = async () => {
    try {
      setError(null);
      setIsProcessing(true);
      
      const result = await audioService.stopRecording();
      setRecordingResult(result);
      setIsRecording(false);
      
      console.log('Audio recording stopped:', result);
      
      // Process audio with speech-to-text
      try {
        const sttResult = await speechToTextService.processAudio(result.uri);
        console.log('STT processing completed:', sttResult);
        
        setIsProcessing(false);
        navigation.navigate('ConfirmationScreen', {
          data: sttResult.extractedNumbers,
          submissionType: 'audio_stt'
        });
      } catch (sttError) {
        console.error('STT processing failed:', sttError);
        
        // Fallback to manual entry if STT fails
        setIsProcessing(false);
        navigation.navigate('ConfirmationScreen', {
          data: {}, // Empty data for manual entry
          submissionType: 'audio_stt'
        });
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
      setIsRecording(false);
      setIsProcessing(false);
      
      if (error instanceof Error) {
        setError(`Failed to stop recording: ${error.message}`);
      } else {
        setError('Failed to stop recording. Please try again.');
      }
    }
  };

  const handleCancel = async () => {
    try {
      await audioService.cancelRecording();
      setIsRecording(false);
      setError(null);
      setRecordingResult(null);
    } catch (error) {
      console.error('Failed to cancel recording:', error);
    }
  };

  if (isProcessing) {
    return (
      <View className="flex-1 bg-white items-center justify-center p-5">
        <LoadingSpinner />
        <Text className="text-lg text-gray-600 mt-4 text-center">
          Processing audio recording...
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white items-center justify-center p-5">
      <Text className="text-2xl font-bold text-gray-800 mb-4 text-center">
        Audio Recording
      </Text>
      
      <Text className="text-base text-gray-600 text-center leading-6 mb-8">
        Record the official announcement of polling results for speech-to-text processing
      </Text>
      
      {error && (
        <ErrorMessage message={error} />
      )}
      
      <View className="w-full h-64 bg-gray-200 rounded-lg mb-8 items-center justify-center">
        <Text className="text-gray-500 text-lg">
          {isRecording ? '🔴 Recording...' : '🎤 Ready to Record'}
        </Text>
        {recordingResult && (
          <Text className="text-sm text-gray-400 mt-2">
            Last recording: {Math.round(recordingResult.size / 1024)}KB
          </Text>
        )}
      </View>
      
      <View className="w-full max-w-xs">
        {!isRecording ? (
          <Button
            title="🎤 Start Recording"
            variant="primary"
            onPress={handleStartRecording}
            className="mb-4"
          />
        ) : (
          <>
            <Button
              title="⏹️ Stop Recording"
              variant="primary"
              onPress={handleStopRecording}
              className="mb-4"
            />
            <Button
              title="❌ Cancel"
              variant="outline"
              onPress={handleCancel}
              className="mb-4"
            />
          </>
        )}
        
        <Button
          title="← Back"
          variant="outline"
          onPress={() => navigation.goBack()}
          disabled={isRecording}
        />
      </View>
    </View>
  );
};