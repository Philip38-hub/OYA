import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

export interface AudioRecordingResult {
  uri: string;
  duration: number;
  size: number;
}

export interface AudioRecordingError {
  code: string;
  message: string;
}

export class AudioService {
  private recording: Audio.Recording | null = null;
  private isRecording = false;

  /**
   * Request audio recording permissions
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error requesting audio permissions:', error);
      return false;
    }
  }

  /**
   * Start audio recording
   */
  async startRecording(): Promise<void> {
    try {
      if (this.isRecording) {
        throw new Error('Recording already in progress');
      }

      // Request permissions
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error('Audio recording permission denied');
      }

      // Set audio mode for recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      // Create new recording
      this.recording = new Audio.Recording();
      
      // Configure recording options
      const recordingOptions = Audio.RecordingOptionsPresets.HIGH_QUALITY;

      await this.recording.prepareToRecordAsync(recordingOptions);
      await this.recording.startAsync();
      
      this.isRecording = true;
      console.log('Audio recording started');
    } catch (error) {
      console.error('Error starting recording:', error);
      this.recording = null;
      this.isRecording = false;
      throw error;
    }
  }

  /**
   * Stop audio recording and return the recorded file
   */
  async stopRecording(): Promise<AudioRecordingResult> {
    try {
      if (!this.recording || !this.isRecording) {
        throw new Error('No recording in progress');
      }

      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();
      
      if (!uri) {
        throw new Error('Failed to get recording URI');
      }

      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(uri);
      
      const result: AudioRecordingResult = {
        uri,
        duration: 0, // Will be populated by the recording status if needed
        size: fileInfo.exists ? fileInfo.size || 0 : 0,
      };

      // Reset recording state
      this.recording = null;
      this.isRecording = false;

      console.log('Audio recording stopped:', result);
      return result;
    } catch (error) {
      console.error('Error stopping recording:', error);
      this.recording = null;
      this.isRecording = false;
      throw error;
    }
  }

  /**
   * Cancel current recording
   */
  async cancelRecording(): Promise<void> {
    try {
      if (this.recording && this.isRecording) {
        await this.recording.stopAndUnloadAsync();
        
        // Delete the recorded file
        const uri = this.recording.getURI();
        if (uri) {
          await FileSystem.deleteAsync(uri, { idempotent: true });
        }
      }
    } catch (error) {
      console.error('Error canceling recording:', error);
    } finally {
      this.recording = null;
      this.isRecording = false;
    }
  }

  /**
   * Get current recording status
   */
  getRecordingStatus(): { isRecording: boolean } {
    return { isRecording: this.isRecording };
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    if (this.recording) {
      try {
        await this.recording.stopAndUnloadAsync();
      } catch (error) {
        console.error('Error during cleanup:', error);
      }
      this.recording = null;
      this.isRecording = false;
    }
  }
}

// Export singleton instance
export const audioService = new AudioService();