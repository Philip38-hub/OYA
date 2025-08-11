export interface OCRConfig {
  modelUrl: string;
  inputSize: number;
  confidenceThreshold: number;
  maxRetries: number;
  processingTimeout: number;
  fallbackToMock: boolean;
}

export const OCR_CONFIG: OCRConfig = {
  // For MVP, using MobileNet as base model
  // In production, replace with specialized OCR model URL
  modelUrl: 'https://storage.googleapis.com/tfjs-models/savedmodel/mobilenet_v2_1.0_224/model.json',
  
  // Standard input size for most vision models
  inputSize: 224,
  
  // Minimum confidence threshold for accepting OCR results
  confidenceThreshold: 0.7,
  
  // Maximum number of retry attempts for failed processing
  maxRetries: 3,
  
  // Processing timeout in milliseconds
  processingTimeout: 30000, // 30 seconds
  
  // Whether to fallback to mock implementation on model loading failure
  fallbackToMock: true,
};

export const FORM_34A_CONFIG = {
  // Expected candidate names for Form 34A
  defaultCandidateNames: [
    'JOHN KAMAU',
    'MARY WANJIKU',
    'PETER MWANGI',
    'GRACE NJERI',
    'DAVID KIPROTICH',
    'SARAH ACHIENG'
  ],
  
  // Text patterns for extracting vote counts
  candidatePattern: /([A-Z\s]+):\s*(\d+)/g,
  spoiltPattern: /SPOILT.*?:\s*(\d+)/i,
  totalPattern: /TOTAL.*?:\s*(\d+)/i,
  
  // Validation rules
  maxVotesPerCandidate: 10000,
  minVotesPerCandidate: 0,
  maxSpoiltVotes: 1000,
  
  // Bounding box layout for Form 34A
  candidateRegions: {
    startY: 100,
    lineHeight: 40,
    textWidth: 200,
    textHeight: 30,
    leftMargin: 50
  }
};