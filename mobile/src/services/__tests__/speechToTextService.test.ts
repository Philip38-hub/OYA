import { SpeechToTextService } from '../speechToTextService';
import * as tf from '@tensorflow/tfjs';

// Mock TensorFlow.js
jest.mock('@tensorflow/tfjs', () => ({
  ready: jest.fn(),
}));

// Mock TensorFlow.js React Native
jest.mock('@tensorflow/tfjs-react-native', () => ({
  bundleResourceIO: jest.fn(),
}));

// Mock TensorFlow.js TFLite
jest.mock('@tensorflow/tfjs-tflite', () => ({}));

// Mock expo-file-system
jest.mock('expo-file-system', () => ({
  getInfoAsync: jest.fn(),
}));

describe('SpeechToTextService', () => {
  let sttService: SpeechToTextService;

  beforeEach(() => {
    sttService = new SpeechToTextService();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await sttService.cleanup();
  });

  describe('initialize', () => {
    it('should initialize TensorFlow and load model successfully', async () => {
      (tf.ready as jest.Mock).mockResolvedValue(undefined);

      await sttService.initialize();

      expect(tf.ready).toHaveBeenCalled();
      expect(sttService.isReady()).toBe(true);
    });

    it('should throw error when TensorFlow initialization fails', async () => {
      (tf.ready as jest.Mock).mockRejectedValue(new Error('TF init failed'));

      await expect(sttService.initialize()).rejects.toThrow(
        'STT initialization failed: TF init failed'
      );
      expect(sttService.isReady()).toBe(false);
    });
  });

  describe('processAudio', () => {
    beforeEach(() => {
      (tf.ready as jest.Mock).mockResolvedValue(undefined);
    });

    it('should process audio and return STT result', async () => {
      const mockAudioUri = 'file://test-audio.m4a';
      
      const result = await sttService.processAudio(mockAudioUri);

      expect(result).toHaveProperty('transcription');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('extractedNumbers');
      expect(typeof result.transcription).toBe('string');
      expect(typeof result.confidence).toBe('number');
      expect(typeof result.extractedNumbers).toBe('object');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should initialize model if not already loaded', async () => {
      const mockAudioUri = 'file://test-audio.m4a';
      
      await sttService.processAudio(mockAudioUri);

      expect(tf.ready).toHaveBeenCalled();
      expect(sttService.isReady()).toBe(true);
    });

    it('should extract vote counts from transcription', async () => {
      const mockAudioUri = 'file://test-audio.m4a';
      
      const result = await sttService.processAudio(mockAudioUri);

      // Should extract some candidate votes
      const extractedKeys = Object.keys(result.extractedNumbers);
      expect(extractedKeys.length).toBeGreaterThan(0);
      
      // Check if extracted numbers are valid
      Object.values(result.extractedNumbers).forEach(value => {
        expect(typeof value).toBe('number');
        expect(value).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('parseVoteCounts', () => {
    let sttService: any; // Access private method for testing

    beforeEach(() => {
      sttService = new SpeechToTextService();
    });

    it('should parse candidate votes from transcription', () => {
      const transcription = "Candidate A received 145 votes, Candidate B received 125 votes, Candidate C received 85 votes";
      
      const result = sttService.parseVoteCounts(transcription);

      expect(result['Candidate A']).toBe(145);
      expect(result['Candidate B']).toBe(125);
      expect(result['Candidate C']).toBe(85);
    });

    it('should parse spoilt ballots', () => {
      const transcription = "Candidate A 150 votes, Candidate B 120 votes, spoilt ballots 5";
      
      const result = sttService.parseVoteCounts(transcription);

      expect(result).toEqual({
        'Candidate A': 150,
        'Candidate B': 120,
        'spoilt': 5,
      });
    });

    it('should handle different candidate name formats', () => {
      const transcription = "John Smith 132 votes, Mary Johnson 108 votes, David Wilson 97 votes";
      
      const result = sttService.parseVoteCounts(transcription);

      expect(result).toEqual({
        'John Smith': 132,
        'Mary Johnson': 108,
        'David Wilson': 97,
      });
    });

    it('should handle ordinal candidate references', () => {
      const transcription = "First candidate 200 votes, second candidate 180 votes, third candidate 150 votes";
      
      const result = sttService.parseVoteCounts(transcription);

      expect(result['Candidate A']).toBe(200);
      expect(result['Candidate B']).toBe(180);
      expect(result['Candidate C']).toBe(150);
    });

    it('should handle written numbers', () => {
      const transcription = "Candidate A received two hundred votes, Candidate B received one hundred votes";
      
      const result = sttService.parseVoteCounts(transcription);

      expect(result['Candidate A']).toBe(200);
      expect(result['Candidate B']).toBe(100);
    });

    it('should fallback to extracting any numbers when no pattern matches', () => {
      const transcription = "The numbers are 150, 120, 95, 3";
      
      const result = sttService.parseVoteCounts(transcription);

      expect(result).toEqual({
        'Candidate A': 150,
        'Candidate B': 120,
        'Candidate C': 95,
        'spoilt': 3,
      });
    });

    it('should return empty object when no numbers found', () => {
      const transcription = "No numbers in this text";
      
      const result = sttService.parseVoteCounts(transcription);

      expect(result).toEqual({});
    });

    it('should handle invalid ballots terminology', () => {
      const transcription = "Candidate A 150 votes, invalid votes 7";
      
      const result = sttService.parseVoteCounts(transcription);

      expect(result).toEqual({
        'Candidate A': 150,
        'spoilt': 7,
      });
    });
  });

  describe('parseCompoundNumbers', () => {
    let sttService: any; // Access private method for testing

    beforeEach(() => {
      sttService = new SpeechToTextService();
    });

    it('should parse hundred combinations', () => {
      const text = "2 hundred 45";
      const result = sttService.parseCompoundNumbers(text);
      expect(result).toBe("245");
    });

    it('should parse standalone hundreds', () => {
      const text = "3 hundred";
      const result = sttService.parseCompoundNumbers(text);
      expect(result).toBe("300");
    });

    it('should parse thousand combinations', () => {
      const text = "2 thousand 500";
      const result = sttService.parseCompoundNumbers(text);
      expect(result).toBe("2500");
    });

    it('should parse standalone thousands', () => {
      const text = "5 thousand";
      const result = sttService.parseCompoundNumbers(text);
      expect(result).toBe("5000");
    });
  });

  describe('capitalizeWords', () => {
    let sttService: any; // Access private method for testing

    beforeEach(() => {
      sttService = new SpeechToTextService();
    });

    it('should capitalize first letter of each word', () => {
      const result = sttService.capitalizeWords("john smith");
      expect(result).toBe("John Smith");
    });

    it('should handle single word', () => {
      const result = sttService.capitalizeWords("candidate");
      expect(result).toBe("Candidate");
    });

    it('should handle already capitalized words', () => {
      const result = sttService.capitalizeWords("John SMITH");
      expect(result).toBe("John SMITH");
    });
  });

  describe('isReady', () => {
    it('should return false initially', () => {
      expect(sttService.isReady()).toBe(false);
    });

    it('should return true after initialization', async () => {
      (tf.ready as jest.Mock).mockResolvedValue(undefined);
      
      await sttService.initialize();
      
      expect(sttService.isReady()).toBe(true);
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources', async () => {
      (tf.ready as jest.Mock).mockResolvedValue(undefined);
      await sttService.initialize();
      
      await sttService.cleanup();
      
      expect(sttService.isReady()).toBe(false);
    });

    it('should handle cleanup when not initialized', async () => {
      await expect(sttService.cleanup()).resolves.not.toThrow();
    });
  });
});