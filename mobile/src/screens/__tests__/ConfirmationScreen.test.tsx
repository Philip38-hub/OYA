import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { ConfirmationScreen } from '../ConfirmationScreen';

// Mock navigation
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockNavigation = {
  navigate: mockNavigate,
  goBack: mockGoBack,
} as any;

// Mock Alert
jest.spyOn(Alert, 'alert');

describe('ConfirmationScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const defaultRoute = {
    params: {
      data: {
        'Candidate A': 245,
        'Candidate B': 189,
        'Candidate C': 156,
        'spoilt': 12
      },
      submissionType: 'image_ocr' as const
    }
  } as any;

  it('renders confirmation screen with extracted data', () => {
    const { getByText, getByDisplayValue } = render(
      <ConfirmationScreen navigation={mockNavigation} route={defaultRoute} />
    );

    expect(getByText('Confirm Results')).toBeTruthy();
    expect(getByText('Source: Image OCR')).toBeTruthy();
    expect(getByDisplayValue('245')).toBeTruthy();
    expect(getByDisplayValue('189')).toBeTruthy();
    expect(getByDisplayValue('156')).toBeTruthy();
    expect(getByDisplayValue('12')).toBeTruthy();
  });

  it('allows manual correction of vote counts', () => {
    const { getByDisplayValue } = render(
      <ConfirmationScreen navigation={mockNavigation} route={defaultRoute} />
    );

    const candidateAInput = getByDisplayValue('245');
    fireEvent.changeText(candidateAInput, '250');
    
    expect(getByDisplayValue('250')).toBeTruthy();
  });

  it('validates numerical inputs', () => {
    const { getByDisplayValue, getByText } = render(
      <ConfirmationScreen navigation={mockNavigation} route={defaultRoute} />
    );

    const candidateAInput = getByDisplayValue('245');
    fireEvent.changeText(candidateAInput, 'invalid');
    
    expect(getByText('Please enter a valid number')).toBeTruthy();
  });

  it('prevents negative vote counts', () => {
    const { getByDisplayValue, getByText } = render(
      <ConfirmationScreen navigation={mockNavigation} route={defaultRoute} />
    );

    const candidateAInput = getByDisplayValue('245');
    fireEvent.changeText(candidateAInput, '-10');
    
    expect(getByText('Vote count cannot be negative')).toBeTruthy();
  });

  it('warns about unusually high vote counts', () => {
    const { getByDisplayValue, getByText } = render(
      <ConfirmationScreen navigation={mockNavigation} route={defaultRoute} />
    );

    const candidateAInput = getByDisplayValue('245');
    fireEvent.changeText(candidateAInput, '15000');
    
    expect(getByText('Vote count seems unusually high')).toBeTruthy();
  });

  it('calculates total votes correctly', () => {
    const { getByText } = render(
      <ConfirmationScreen navigation={mockNavigation} route={defaultRoute} />
    );

    // 245 + 189 + 156 + 12 = 602
    expect(getByText('Total Votes: 602')).toBeTruthy();
  });

  it('shows confirmation dialog on submit', async () => {
    const { getByText } = render(
      <ConfirmationScreen navigation={mockNavigation} route={defaultRoute} />
    );

    const submitButton = getByText('✅ Confirm & Submit');
    fireEvent.press(submitButton);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Confirm Submission',
        'Are you sure you want to submit these results? This action cannot be undone.',
        expect.any(Array)
      );
    });
  });

  it('handles OCR failure fallback to manual entry', () => {
    const emptyDataRoute = {
      params: {
        data: {},
        submissionType: 'image_ocr' as const
      }
    } as any;

    const { getByText } = render(
      <ConfirmationScreen navigation={mockNavigation} route={emptyDataRoute} />
    );

    expect(getByText('Extraction Failed')).toBeTruthy();
    expect(getByText('OCR processing could not extract vote counts. Please enter the results manually.')).toBeTruthy();
    expect(getByText('Source: Image OCR (Manual Entry)')).toBeTruthy();
  });

  it('allows switching to manual entry mode', () => {
    const { getByText } = render(
      <ConfirmationScreen navigation={mockNavigation} route={defaultRoute} />
    );

    const manualEntryButton = getByText('✏️ Enter Manually Instead');
    fireEvent.press(manualEntryButton);

    expect(getByText('Source: Image OCR (Manual Entry)')).toBeTruthy();
  });

  it('validates that at least one candidate has votes', async () => {
    const zeroDataRoute = {
      params: {
        data: {
          'Candidate A': 0,
          'Candidate B': 0,
          'Candidate C': 0,
          'spoilt': 0
        },
        submissionType: 'image_ocr' as const
      }
    } as any;

    const { getByText } = render(
      <ConfirmationScreen navigation={mockNavigation} route={zeroDataRoute} />
    );

    const submitButton = getByText('✅ Confirm & Submit');
    fireEvent.press(submitButton);

    await waitFor(() => {
      expect(getByText('At least one candidate must have votes')).toBeTruthy();
    });
  });

  it('handles audio submission type correctly', () => {
    const audioRoute = {
      params: {
        data: {
          'Candidate A': 100,
          'Candidate B': 80,
          'spoilt': 5
        },
        submissionType: 'audio_stt' as const
      }
    } as any;

    const { getByText } = render(
      <ConfirmationScreen navigation={mockNavigation} route={audioRoute} />
    );

    expect(getByText('Source: Audio Speech-to-Text')).toBeTruthy();
  });

  it('navigates back when back button is pressed', () => {
    const { getByText } = render(
      <ConfirmationScreen navigation={mockNavigation} route={defaultRoute} />
    );

    const backButton = getByText('← Back to Capture');
    fireEvent.press(backButton);

    expect(mockGoBack).toHaveBeenCalled();
  });

  it('disables buttons during submission', async () => {
    const { getByText } = render(
      <ConfirmationScreen navigation={mockNavigation} route={defaultRoute} />
    );

    const submitButton = getByText('✅ Confirm & Submit');
    fireEvent.press(submitButton);

    // Simulate user confirming the alert
    const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
    const confirmCallback = alertCall[2][1].onPress;
    confirmCallback();

    await waitFor(() => {
      expect(getByText('Submitting...')).toBeTruthy();
    });
  });
});