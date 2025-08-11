import { AudioService } from '../audioService';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

// Mock expo-av
jest.mock('expo-av', () => ({
  Audio: {
    requestPermissionsAsync: jest.fn(),
    setAudioModeAsync: jest.fn(),
    Recording: jest.fn(),
    RecordingOptionsPresets: {
      HIGH_QUALITY: {
        android: {
          extension: '.m4a',
          outputFormat: 'mpeg4',
          audioEncoder: 'aac',
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: 'mpeg4aac',
          audioQuality: 'high',
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
        },
      },
    },
  },
}));

// Mock expo-file-system
jest.mock('expo-file-system', () => ({
  getInfoAsync: jest.fn(),
  deleteAsync: jest.fn(),
}));

describe('AudioService', () => {
  let audioService: AudioService;
  let mockRecording: any;

  beforeEach(() => {
    audioService = new AudioService();
    
    // Mock Recording instance
    mockRecording = {
      prepareToRecordAsync: jest.fn(),
      startAsync: jest.fn(),
      stopAndUnloadAsync: jest.fn(),
      getURI: jest.fn(),
    };
    
    (Audio.Recording as unknown as jest.Mock).mockImplementation(() => mockRecording);
    
    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await audioService.cleanup();
  });

  describe('requestPermissions', () => {
    it('should return true when permission is granted', async () => {
      (Audio.requestPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });

      const result = await audioService.requestPermissions();
      expect(result).toBe(true);
    });

    it('should return false when permission is denied', async () => {
      (Audio.requestPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
      });

      const result = await audioService.requestPermissions();
      expect(result).toBe(false);
    });

    it('should return false when permission request fails', async () => {
      (Audio.requestPermissionsAsync as jest.Mock).mockRejectedValue(
        new Error('Permission request failed')
      );

      const result = await audioService.requestPermissions();
      expect(result).toBe(false);
    });
  });

  describe('startRecording', () => {
    beforeEach(() => {
      (Audio.requestPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      (Audio.setAudioModeAsync as jest.Mock).mockResolvedValue(undefined);
      mockRecording.prepareToRecordAsync.mockResolvedValue(undefined);
      mockRecording.startAsync.mockResolvedValue(undefined);
    });

    it('should start recording successfully', async () => {
      await audioService.startRecording();

      expect(Audio.requestPermissionsAsync).toHaveBeenCalled();
      expect(Audio.setAudioModeAsync).toHaveBeenCalledWith({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      expect(mockRecording.prepareToRecordAsync).toHaveBeenCalled();
      expect(mockRecording.startAsync).toHaveBeenCalled();
      expect(audioService.getRecordingStatus().isRecording).toBe(true);
    });

    it('should throw error when permission is denied', async () => {
      (Audio.requestPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
      });

      await expect(audioService.startRecording()).rejects.toThrow(
        'Audio recording permission denied'
      );
      expect(audioService.getRecordingStatus().isRecording).toBe(false);
    });

    it('should throw error when already recording', async () => {
      await audioService.startRecording();

      await expect(audioService.startRecording()).rejects.toThrow(
        'Recording already in progress'
      );
    });

    it('should handle recording preparation failure', async () => {
      mockRecording.prepareToRecordAsync.mockRejectedValue(
        new Error('Failed to prepare recording')
      );

      await expect(audioService.startRecording()).rejects.toThrow(
        'Failed to prepare recording'
      );
      expect(audioService.getRecordingStatus().isRecording).toBe(false);
    });
  });

  describe('stopRecording', () => {
    beforeEach(async () => {
      (Audio.requestPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      (Audio.setAudioModeAsync as jest.Mock).mockResolvedValue(undefined);
      mockRecording.prepareToRecordAsync.mockResolvedValue(undefined);
      mockRecording.startAsync.mockResolvedValue(undefined);
      mockRecording.stopAndUnloadAsync.mockResolvedValue(undefined);
      mockRecording.getURI.mockReturnValue('file://test-recording.m4a');
      
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: true,
        size: 12345,
      });
    });

    it('should stop recording and return result', async () => {
      await audioService.startRecording();
      const result = await audioService.stopRecording();

      expect(mockRecording.stopAndUnloadAsync).toHaveBeenCalled();
      expect(mockRecording.getURI).toHaveBeenCalled();
      expect(FileSystem.getInfoAsync).toHaveBeenCalledWith('file://test-recording.m4a');
      expect(result).toEqual({
        uri: 'file://test-recording.m4a',
        duration: 0,
        size: 12345,
      });
      expect(audioService.getRecordingStatus().isRecording).toBe(false);
    });

    it('should throw error when no recording in progress', async () => {
      await expect(audioService.stopRecording()).rejects.toThrow(
        'No recording in progress'
      );
    });

    it('should throw error when URI is not available', async () => {
      await audioService.startRecording();
      mockRecording.getURI.mockReturnValue(null);

      await expect(audioService.stopRecording()).rejects.toThrow(
        'Failed to get recording URI'
      );
      expect(audioService.getRecordingStatus().isRecording).toBe(false);
    });

    it('should handle file info failure gracefully', async () => {
      await audioService.startRecording();
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: false,
      });

      const result = await audioService.stopRecording();
      expect(result.size).toBe(0);
    });
  });

  describe('cancelRecording', () => {
    beforeEach(async () => {
      (Audio.requestPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      (Audio.setAudioModeAsync as jest.Mock).mockResolvedValue(undefined);
      mockRecording.prepareToRecordAsync.mockResolvedValue(undefined);
      mockRecording.startAsync.mockResolvedValue(undefined);
      mockRecording.stopAndUnloadAsync.mockResolvedValue(undefined);
      mockRecording.getURI.mockReturnValue('file://test-recording.m4a');
      (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);
    });

    it('should cancel recording and delete file', async () => {
      await audioService.startRecording();
      await audioService.cancelRecording();

      expect(mockRecording.stopAndUnloadAsync).toHaveBeenCalled();
      expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
        'file://test-recording.m4a',
        { idempotent: true }
      );
      expect(audioService.getRecordingStatus().isRecording).toBe(false);
    });

    it('should handle cancellation when not recording', async () => {
      await audioService.cancelRecording();
      
      expect(mockRecording.stopAndUnloadAsync).not.toHaveBeenCalled();
      expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
    });

    it('should handle cancellation errors gracefully', async () => {
      await audioService.startRecording();
      mockRecording.stopAndUnloadAsync.mockRejectedValue(
        new Error('Stop failed')
      );

      await audioService.cancelRecording();
      expect(audioService.getRecordingStatus().isRecording).toBe(false);
    });
  });

  describe('getRecordingStatus', () => {
    it('should return correct recording status', async () => {
      expect(audioService.getRecordingStatus().isRecording).toBe(false);

      (Audio.requestPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      (Audio.setAudioModeAsync as jest.Mock).mockResolvedValue(undefined);
      mockRecording.prepareToRecordAsync.mockResolvedValue(undefined);
      mockRecording.startAsync.mockResolvedValue(undefined);

      await audioService.startRecording();
      expect(audioService.getRecordingStatus().isRecording).toBe(true);
    });
  });

  describe('cleanup', () => {
    it('should cleanup recording resources', async () => {
      (Audio.requestPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      (Audio.setAudioModeAsync as jest.Mock).mockResolvedValue(undefined);
      mockRecording.prepareToRecordAsync.mockResolvedValue(undefined);
      mockRecording.startAsync.mockResolvedValue(undefined);
      mockRecording.stopAndUnloadAsync.mockResolvedValue(undefined);

      await audioService.startRecording();
      await audioService.cleanup();

      expect(mockRecording.stopAndUnloadAsync).toHaveBeenCalled();
      expect(audioService.getRecordingStatus().isRecording).toBe(false);
    });

    it('should handle cleanup errors gracefully', async () => {
      (Audio.requestPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      (Audio.setAudioModeAsync as jest.Mock).mockResolvedValue(undefined);
      mockRecording.prepareToRecordAsync.mockResolvedValue(undefined);
      mockRecording.startAsync.mockResolvedValue(undefined);
      mockRecording.stopAndUnloadAsync.mockRejectedValue(
        new Error('Cleanup failed')
      );

      await audioService.startRecording();
      await audioService.cleanup();

      expect(audioService.getRecordingStatus().isRecording).toBe(false);
    });
  });
});