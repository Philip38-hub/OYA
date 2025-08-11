// Core types for OYAH! mobile application

export interface WalletState {
  isConnected: boolean;
  walletAddress: string | null;
  accounts: any[]; // Will be properly typed with @polkadot/api types
  selectedAccount: any | null;
}

// Re-export navigation types
export * from './navigation';

export interface PollingResultPayload {
  walletAddress: string;
  pollingStationId: string;
  gpsCoordinates: {
    latitude: number;
    longitude: number;
  };
  timestamp: string;
  results: {
    [candidateName: string]: number;
    spoilt: number;
  };
  submissionType: 'image_ocr' | 'audio_stt';
  confidence: number;
}

export interface OCRResult {
  extractedText: string;
  confidence: number;
  candidates: { [key: string]: number };
}

export interface STTResult {
  transcription: string;
  confidence: number;
  extractedNumbers: { [key: string]: number };
}
