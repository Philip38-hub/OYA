import { OCRResult, BoundingBox } from '@/services/ocrService';
import { FORM_34A_CONFIG } from '@/config/ocrConfig';

export interface MockOCRScenario {
  name: string;
  description: string;
  confidence: number;
  candidates: { [key: string]: number };
  spoilt: number;
  extractedText: string;
}

export const MOCK_OCR_SCENARIOS: MockOCRScenario[] = [
  {
    name: 'typical_form',
    description: 'Typical Form 34A with clear text and reasonable vote counts',
    confidence: 0.92,
    candidates: {
      'JOHN KAMAU': 245,
      'MARY WANJIKU': 189,
      'PETER MWANGI': 156,
      'GRACE NJERI': 98
    },
    spoilt: 12,
    extractedText: `
      FORM 34A - PRESIDENTIAL ELECTION RESULTS
      POLLING STATION: KIAMBU PRIMARY SCHOOL
      
      CANDIDATE RESULTS:
      JOHN KAMAU: 245
      MARY WANJIKU: 189
      PETER MWANGI: 156
      GRACE NJERI: 98
      
      SPOILT BALLOTS: 12
      TOTAL VOTES: 700
    `
  },
  {
    name: 'low_confidence',
    description: 'Form with poor image quality resulting in lower confidence',
    confidence: 0.73,
    candidates: {
      'JOHN KAMAU': 234,
      'MARY WANJIKU': 178,
      'PETER MWANGI': 145,
      'GRACE NJERI': 87
    },
    spoilt: 8,
    extractedText: `
      FORM 34A - PRESIDENTIAL ELECTION RESULTS
      POLLING STATION: [UNCLEAR]
      
      CANDIDATE RESULTS:
      JOHN KAMAU: 234
      MARY WANJIKU: 178
      PETER MWANGI: 145
      GRACE NJERI: 87
      
      SPOILT BALLOTS: 8
      TOTAL VOTES: 652
    `
  },
  {
    name: 'high_turnout',
    description: 'Form with high voter turnout',
    confidence: 0.89,
    candidates: {
      'JOHN KAMAU': 1245,
      'MARY WANJIKU': 987,
      'PETER MWANGI': 756,
      'GRACE NJERI': 543,
      'DAVID KIPROTICH': 321,
      'SARAH ACHIENG': 198
    },
    spoilt: 45,
    extractedText: `
      FORM 34A - PRESIDENTIAL ELECTION RESULTS
      POLLING STATION: NAIROBI CENTRAL HIGH SCHOOL
      
      CANDIDATE RESULTS:
      JOHN KAMAU: 1245
      MARY WANJIKU: 987
      PETER MWANGI: 756
      GRACE NJERI: 543
      DAVID KIPROTICH: 321
      SARAH ACHIENG: 198
      
      SPOILT BALLOTS: 45
      TOTAL VOTES: 4095
    `
  },
  {
    name: 'close_race',
    description: 'Form showing a very close race between candidates',
    confidence: 0.91,
    candidates: {
      'JOHN KAMAU': 298,
      'MARY WANJIKU': 295,
      'PETER MWANGI': 287,
      'GRACE NJERI': 289
    },
    spoilt: 15,
    extractedText: `
      FORM 34A - PRESIDENTIAL ELECTION RESULTS
      POLLING STATION: MOMBASA TECHNICAL COLLEGE
      
      CANDIDATE RESULTS:
      JOHN KAMAU: 298
      MARY WANJIKU: 295
      PETER MWANGI: 287
      GRACE NJERI: 289
      
      SPOILT BALLOTS: 15
      TOTAL VOTES: 1184
    `
  }
];

export class MockOCRResponseGenerator {
  /**
   * Generate a mock OCR result based on scenario name or random selection
   */
  static generateMockResult(
    scenarioName?: string,
    candidateNames?: string[]
  ): OCRResult {
    let scenario: MockOCRScenario;
    
    if (scenarioName) {
      scenario = MOCK_OCR_SCENARIOS.find(s => s.name === scenarioName) || MOCK_OCR_SCENARIOS[0];
    } else {
      // Select random scenario
      scenario = MOCK_OCR_SCENARIOS[Math.floor(Math.random() * MOCK_OCR_SCENARIOS.length)];
    }

    // Adapt candidates if custom names provided
    let candidates = scenario.candidates;
    if (candidateNames && candidateNames.length > 0) {
      candidates = {};
      const voteValues = Object.values(scenario.candidates);
      candidateNames.forEach((name, index) => {
        if (index < voteValues.length) {
          candidates[name] = voteValues[index];
        }
      });
    }

    // Generate bounding boxes
    const boundingBoxes = this.generateBoundingBoxes(candidates, scenario.spoilt);

    return {
      extractedText: scenario.extractedText.trim(),
      confidence: scenario.confidence,
      boundingBoxes,
      candidates,
      spoilt: scenario.spoilt
    };
  }

  /**
   * Generate realistic bounding boxes for detected text
   */
  private static generateBoundingBoxes(
    candidates: { [key: string]: number },
    spoiltVotes: number
  ): BoundingBox[] {
    const { candidateRegions } = FORM_34A_CONFIG;
    const boundingBoxes: BoundingBox[] = [];

    // Add candidate bounding boxes
    Object.entries(candidates).forEach(([name, votes], index) => {
      boundingBoxes.push({
        x: candidateRegions.leftMargin,
        y: candidateRegions.startY + (index * candidateRegions.lineHeight),
        width: candidateRegions.textWidth,
        height: candidateRegions.textHeight,
        text: `${name}: ${votes}`,
        confidence: 0.85 + (Math.random() * 0.1) // 0.85-0.95
      });
    });

    // Add spoilt ballots bounding box
    boundingBoxes.push({
      x: candidateRegions.leftMargin,
      y: candidateRegions.startY + (Object.keys(candidates).length * candidateRegions.lineHeight),
      width: candidateRegions.textWidth,
      height: candidateRegions.textHeight,
      text: `SPOILT BALLOTS: ${spoiltVotes}`,
      confidence: 0.92
    });

    return boundingBoxes;
  }

  /**
   * Generate a mock result with specific confidence level
   */
  static generateResultWithConfidence(confidence: number, candidateNames?: string[]): OCRResult {
    const baseScenario = confidence < 0.8 ? 'low_confidence' : 'typical_form';
    const result = this.generateMockResult(baseScenario, candidateNames);
    
    // Adjust confidence
    result.confidence = confidence;
    
    // Adjust bounding box confidences proportionally
    result.boundingBoxes.forEach(box => {
      box.confidence = Math.min(0.95, confidence + (Math.random() * 0.1));
    });

    return result;
  }

  /**
   * Get available scenario names for testing
   */
  static getAvailableScenarios(): string[] {
    return MOCK_OCR_SCENARIOS.map(s => s.name);
  }

  /**
   * Get scenario description
   */
  static getScenarioDescription(scenarioName: string): string {
    const scenario = MOCK_OCR_SCENARIOS.find(s => s.name === scenarioName);
    return scenario?.description || 'Unknown scenario';
  }
}