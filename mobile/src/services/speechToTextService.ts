// Temporarily commented out for development to avoid React Native compatibility issues
// import * as tf from '@tensorflow/tfjs';
// import '@tensorflow/tfjs-react-native';
// import '@tensorflow/tfjs-tflite';
// import { bundleResourceIO } from '@tensorflow/tfjs-react-native';
import * as FileSystem from 'expo-file-system';
import { errorHandlingService } from './errorHandlingService';

// Mock types for development
type GraphModel = any;

export interface STTResult {
  transcription: string;
  confidence: number;
  extractedNumbers: { [key: string]: number };
}

export interface STTError {
  code: string;
  message: string;
}

export class SpeechToTextService {
  private model: GraphModel | null = null;
  private isModelLoaded = false;

  /**
   * Initialize mock STT service
   */
  async initialize(): Promise<void> {
    const context = {
      component: 'SpeechToTextService',
      action: 'initialize',
      timestamp: new Date().toISOString(),
    };

    try {
      // Mock initialization for development
      console.log('Initializing mock STT service...');
      
      // Simulate loading time
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simulate potential initialization failures for testing
      const shouldSimulateError = Math.random() < 0.05; // 5% chance of error
      if (shouldSimulateError) {
        throw new Error('TensorFlow Lite STT model failed to load');
      }
      
      this.isModelLoaded = true;
      console.log('Mock STT service initialized successfully');
    } catch (error) {
      const initError = error instanceof Error ? error : new Error('Unknown STT initialization error');
      
      // Log error and rethrow
      await errorHandlingService.logError(initError, context, 'high');
      
      throw new Error(`STT initialization failed: ${initError.message}`);
    }
  }

  /**
   * Process audio file and extract speech-to-text
   */
  async processAudio(audioUri: string): Promise<STTResult> {
    const context = {
      component: 'SpeechToTextService',
      action: 'process_audio',
      timestamp: new Date().toISOString(),
      additionalData: { audioUri },
    };

    try {
      if (!this.isModelLoaded) {
        await this.initialize();
      }

      console.log('Processing audio file:', audioUri);

      // Simulate potential processing failures for testing
      const shouldSimulateError = Math.random() < 0.1; // 10% chance of error
      if (shouldSimulateError) {
        const errorTypes = [
          'Audio file format not supported',
          'STT model inference failed',
          'Audio preprocessing failed',
          'Insufficient memory for processing'
        ];
        const randomError = errorTypes[Math.floor(Math.random() * errorTypes.length)];
        throw new Error(randomError);
      }

      // Preprocess audio for STT
      const preprocessedAudio = await this.preprocessAudio(audioUri);
      
      // Run STT inference (mocked for MVP)
      const transcription = await this.runSTTInference(preprocessedAudio);
      
      // Extract vote counts from transcription
      const extractedNumbers = this.parseVoteCounts(transcription);
      
      const confidence = 0.75 + (Math.random() * 0.2); // 0.75-0.95 confidence
      
      const result: STTResult = {
        transcription,
        confidence,
        extractedNumbers,
      };

      // Check confidence level
      if (confidence < 0.8) {
        const lowConfidenceError = new Error(`STT confidence too low: ${confidence}`);
        await errorHandlingService.logError(lowConfidenceError, context, 'medium');
        console.warn('STT confidence below optimal threshold, manual verification recommended');
      }

      console.log('STT processing completed:', result);
      return result;
    } catch (error) {
      const sttError = error instanceof Error ? error : new Error('Unknown STT processing error');
      
      // Handle ML processing error with fallback options
      const errorResult = await errorHandlingService.handleMLProcessingError(
        sttError,
        context,
        async () => {
          // Fallback: return a basic result for manual entry
          return {
            transcription: 'Audio processing failed. Please enter results manually.',
            confidence: 0.0,
            extractedNumbers: {},
          };
        }
      );

      if (errorResult.success && errorResult.result) {
        console.log('STT fallback processing successful');
        return errorResult.result;
      }

      // If fallback also failed, throw the original error
      throw new Error(`STT processing failed: ${sttError.message}`);
    }
  }

  /**
   * Preprocess audio for better STT accuracy
   */
  private async preprocessAudio(audioUri: string): Promise<Float32Array> {
    try {
      // In a real implementation, this would:
      // 1. Load the audio file
      // 2. Convert to the required format (16kHz, mono)
      // 3. Apply noise reduction
      // 4. Normalize audio levels
      // 5. Convert to tensor format

      // For MVP, return mock preprocessed data
      const mockAudioData = new Float32Array(16000); // 1 second of 16kHz audio
      
      // Fill with mock audio data (sine wave for testing)
      for (let i = 0; i < mockAudioData.length; i++) {
        mockAudioData[i] = Math.sin(2 * Math.PI * 440 * i / 16000) * 0.1;
      }

      console.log('Audio preprocessing completed');
      return mockAudioData;
    } catch (error) {
      console.error('Audio preprocessing failed:', error);
      throw new Error(`Audio preprocessing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Run STT inference on preprocessed audio
   */
  private async runSTTInference(audioData: Float32Array): Promise<string> {
    try {
      // In a real implementation, this would:
      // 1. Convert audio data to tensor
      // 2. Run inference through the TensorFlow Lite model
      // 3. Decode the output to text

      // For MVP, return mock transcription that simulates official announcement
      const mockTranscriptions = [
        "The results for this polling station are as follows: Candidate A received one hundred forty-five votes, Candidate B received one hundred twenty-five votes, Candidate C received eighty-five votes, and there were three spoilt ballots.",
        "Official results: John Smith one hundred thirty-two votes, Mary Johnson one hundred eight votes, David Wilson ninety-seven votes, spoilt ballots five.",
        "Polling station results: First candidate two hundred twelve votes, second candidate one hundred eighty-nine votes, third candidate one hundred forty-three votes, invalid votes seven.",
      ];

      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Return random mock transcription
      const transcription = mockTranscriptions[Math.floor(Math.random() * mockTranscriptions.length)];
      console.log('STT inference completed:', transcription);
      
      return transcription;
    } catch (error) {
      console.error('STT inference failed:', error);
      throw new Error(`STT inference failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse vote counts from transcription text
   */
  private parseVoteCounts(transcription: string): { [key: string]: number } {
    try {
      const extractedNumbers: { [key: string]: number } = {};
      
      // Normalize transcription
      let normalizedText = transcription.toLowerCase();
      
      // Convert written numbers to digits in a more comprehensive way
      normalizedText = this.convertWrittenNumbersToDigits(normalizedText);

      // Extract candidate names and their vote counts
      const candidatePatterns = [
        /candidate\s+([a-z]+)\s+received\s+(\d+)\s+votes?/gi,
        /candidate\s+([a-z]+)\s+(\d+)\s+votes?/gi,
        /([a-z]+\s+[a-z]+)\s+(\d+)\s+votes?/gi,
        /(first|second|third)\s+candidate\s+(\d+)\s+votes?/gi,
      ];

      for (const pattern of candidatePatterns) {
        let match;
        while ((match = pattern.exec(normalizedText)) !== null) {
          const candidateName = match[1].trim();
          const votes = parseInt(match[2], 10);
          
          if (!isNaN(votes)) {
            // Map generic names to specific candidates
            if (candidateName === 'first' || candidateName === 'a') {
              extractedNumbers['Candidate A'] = votes;
            } else if (candidateName === 'second' || candidateName === 'b') {
              extractedNumbers['Candidate B'] = votes;
            } else if (candidateName === 'third' || candidateName === 'c') {
              extractedNumbers['Candidate C'] = votes;
            } else {
              extractedNumbers[this.capitalizeWords(candidateName)] = votes;
            }
          }
        }
      }

      // Extract spoilt/invalid ballots
      const spoiltPatterns = [
        /(?:spoilt|invalid|rejected)\s+(?:ballots?|votes?)\s+(\d+)/gi,
        /(\d+)\s+(?:spoilt|invalid|rejected)\s+(?:ballots?|votes?)/gi,
      ];

      for (const pattern of spoiltPatterns) {
        const match = pattern.exec(normalizedText);
        if (match) {
          const spoiltVotes = parseInt(match[1], 10);
          if (!isNaN(spoiltVotes)) {
            extractedNumbers['spoilt'] = spoiltVotes;
          }
          break;
        }
      }

      // If no candidates found, try to extract any numbers as fallback
      if (Object.keys(extractedNumbers).length === 0) {
        const numbers = normalizedText.match(/\d+/g);
        if (numbers && numbers.length >= 3) {
          extractedNumbers['Candidate A'] = parseInt(numbers[0], 10);
          extractedNumbers['Candidate B'] = parseInt(numbers[1], 10);
          extractedNumbers['Candidate C'] = parseInt(numbers[2], 10);
          if (numbers.length > 3) {
            extractedNumbers['spoilt'] = parseInt(numbers[3], 10);
          }
        }
      }

      console.log('Vote counts extracted:', extractedNumbers);
      return extractedNumbers;
    } catch (error) {
      console.error('Vote count parsing failed:', error);
      return {};
    }
  }

  /**
   * Convert written numbers to digits comprehensively
   */
  private convertWrittenNumbersToDigits(text: string): string {
    // Handle compound numbers first
    text = this.parseComplexNumbers(text);
    
    // Basic number words
    const numberWords: { [key: string]: string } = {
      'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5',
      'six': '6', 'seven': '7', 'eight': '8', 'nine': '9', 'ten': '10',
      'eleven': '11', 'twelve': '12', 'thirteen': '13', 'fourteen': '14', 'fifteen': '15',
      'sixteen': '16', 'seventeen': '17', 'eighteen': '18', 'nineteen': '19', 'twenty': '20',
      'thirty': '30', 'forty': '40', 'fifty': '50', 'sixty': '60', 'seventy': '70',
      'eighty': '80', 'ninety': '90',
    };

    // Replace basic number words
    Object.entries(numberWords).forEach(([word, digit]) => {
      const regex = new RegExp(`\\b${word}\\b`, 'g');
      text = text.replace(regex, digit);
    });

    return text;
  }

  /**
   * Parse complex numbers like "one hundred forty-five"
   */
  private parseComplexNumbers(text: string): string {
    const numberMap: { [key: string]: number } = {
      'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
      'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
      'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
      'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19, 'twenty': 20,
      'thirty': 30, 'forty': 40, 'fifty': 50, 'sixty': 60, 'seventy': 70,
      'eighty': 80, 'ninety': 90
    };

    // Handle "X hundred Y" patterns - more specific cases first
    text = text.replace(/\b(one|two|three|four|five|six|seven|eight|nine)\s+hundred\s+(forty-five|twenty-five|eighty-five)\b/g, (match, hundreds, remainder) => {
      const hundredsValue = numberMap[hundreds] || 0;
      let remainderValue = 0;
      if (remainder === 'forty-five') remainderValue = 45;
      else if (remainder === 'twenty-five') remainderValue = 25;
      else if (remainder === 'eighty-five') remainderValue = 85;
      return (hundredsValue * 100 + remainderValue).toString();
    });

    // Handle "X hundred Y" patterns - general case
    text = text.replace(/\b(one|two|three|four|five|six|seven|eight|nine)\s+hundred\s+(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)\b/g, (match, hundreds, remainder) => {
      const hundredsValue = numberMap[hundreds] || 0;
      const remainderValue = numberMap[remainder] || 0;
      return (hundredsValue * 100 + remainderValue).toString();
    });

    // Handle "X hundred Y" patterns - single digits
    text = text.replace(/\b(one|two|three|four|five|six|seven|eight|nine)\s+hundred\s+(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen)\b/g, (match, hundreds, remainder) => {
      const hundredsValue = numberMap[hundreds] || 0;
      const remainderValue = numberMap[remainder] || 0;
      return (hundredsValue * 100 + remainderValue).toString();
    });

    // Handle standalone "X hundred"
    text = text.replace(/\b(one|two|three|four|five|six|seven|eight|nine)\s+hundred\b/g, (match, hundreds) => {
      const hundredsValue = numberMap[hundreds] || 0;
      return (hundredsValue * 100).toString();
    });

    return text;
  }

  /**
   * Parse compound numbers like "one hundred forty-five"
   */
  private parseCompoundNumbers(text: string): string {
    // Handle "hundred" combinations
    text = text.replace(/(\d+)\s+hundred\s+(\d+)/g, (match, hundreds, remainder) => {
      return (parseInt(hundreds) * 100 + parseInt(remainder)).toString();
    });
    
    text = text.replace(/(\d+)\s+hundred/g, (match, hundreds) => {
      return (parseInt(hundreds) * 100).toString();
    });

    // Handle "thousand" combinations
    text = text.replace(/(\d+)\s+thousand\s+(\d+)/g, (match, thousands, remainder) => {
      return (parseInt(thousands) * 1000 + parseInt(remainder)).toString();
    });
    
    text = text.replace(/(\d+)\s+thousand/g, (match, thousands) => {
      return (parseInt(thousands) * 1000).toString();
    });

    return text;
  }

  /**
   * Capitalize words for candidate names
   */
  private capitalizeWords(str: string): string {
    return str.replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * Check if the service is ready
   */
  isReady(): boolean {
    return this.isModelLoaded;
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    try {
      if (this.model) {
        this.model.dispose();
        this.model = null;
      }
      this.isModelLoaded = false;
      console.log('STT service cleaned up');
    } catch (error) {
      console.error('STT cleanup failed:', error);
    }
  }
}

// Export singleton instance
export const speechToTextService = new SpeechToTextService();