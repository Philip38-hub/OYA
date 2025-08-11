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

describe('ConfirmationScreen - Audio STT Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should display extracted audio data correctly', () => {
    const mockRoute = {
      params: {
        data: {
          'Candidate A': 145,
          'Candidate B': 125,
          'Candidate C': 85,
          'spoilt': 3,
        },
        submissionType: 'audio_stt',
      },
    } as any;

    const { getByDisplayValue, getByText } = render(
      <ConfirmationScreen navigation={mockNavigation} route={mockRoute} />
    );

    // Check that extracted data is displayed
    expect(getByDisplayValue('145')).toBeTruthy();
    expect(getByDisplayValue('125')).toBeTruthy();
    expect(getByDisplayValue('85')).toBeTruthy();
    expect(getByDisplayValue('3')).toBeTruthy();

    // Check submission type is displayed
    expect(getByText('Source: Audio Speech-to-Text')).toBeTruthy();
  });

  it('should allow manual correction of extracted audio data', () => {
    const mockRoute = {
      params: {
        data: {
          'Candidate A': 145,
          'Candidate B': 125,
          'Candidate C': 85,
          'spoilt': 3,
        },
        submissionType: 'audio_stt',
      },
    } as any;

    const { getByDisplayValue } = render(
      <ConfirmationScreen navigation={mockNavigation} route={mockRoute} />
    );

    // Find and modify the Candidate A input
    const candidateAInput = getByDisplayValue('145');
    fireEvent.changeText(candidateAInput, '150');

    // Check that the value was updated
    expect(getByDisplayValue('150')).toBeTruthy();
  });

  it('should handle STT failure with manual entry fallback', () => {
    const mockRoute = {
      params: {
        data: {}, // Empty data indicates STT failure
        submissionType: 'audio_stt',
      },
    } as any;

    const { getByText, getByPlaceholderText } = render(
      <ConfirmationScreen navigation={mockNavigation} route={mockRoute} />
    );

    // Check that failure message is displayed
    expect(getByText('Speech-to-text processing could not extract vote counts. Please enter the results manually.')).toBeTruthy();
    expect(getByText('Source: Audio Speech-to-Text (Manual Entry)')).toBeTruthy();

    // Check that all input fields are available for manual entry
    expect(getByPlaceholderText('0')).toBeTruthy();
  });

  it('should validate audio-extracted data before submission', async () => {
    const mockRoute = {
      params: {
        data: {
          'Candidate A': 145,
          'Candidate B': 125,
          'Candidate C': 85,
          'spoilt': 3,
        },
        submissionType: 'audio_stt',
      },
    } as any;

    const { getByText, getByDisplayValue } = render(
      <ConfirmationScreen navigation={mockNavigation} route={mockRoute} />
    );

    // Clear all candidate votes to trigger validation error
    const candidateAInput = getByDisplayValue('145');
    const candidateBInput = getByDisplayValue('125');
    const candidateCInput = getByDisplayValue('85');

    fireEvent.changeText(candidateAInput, '0');
    fireEvent.changeText(candidateBInput, '0');
    fireEvent.changeText(candidateCInput, '0');

    // Try to submit
    const submitButton = getByText('✅ Confirm & Submit');
    fireEvent.press(submitButton);

    // Check that validation error is shown
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Validation Error',
        'Please correct the errors before submitting.',
        [{ text: 'OK' }]
      );
    });
  });

  it('should calculate total votes correctly for audio data', () => {
    const mockRoute = {
      params: {
        data: {
          'Candidate A': 145,
          'Candidate B': 125,
          'Candidate C': 85,
          'spoilt': 3,
        },
        submissionType: 'audio_stt',
      },
    } as any;

    const { getByText } = render(
      <ConfirmationScreen navigation={mockNavigation} route={mockRoute} />
    );

    // Check total calculation
    expect(getByText('Total Votes: 358')).toBeTruthy();
  });

  it('should handle negative numbers validation for audio data', () => {
    const mockRoute = {
      params: {
        data: {
          'Candidate A': 145,
          'Candidate B': 125,
          'Candidate C': 85,
          'spoilt': 3,
        },
        submissionType: 'audio_stt',
      },
    } as any;

    const { getByDisplayValue, getByText } = render(
      <ConfirmationScreen navigation={mockNavigation} route={mockRoute} />
    );

    // Enter negative number
    const candidateAInput = getByDisplayValue('145');
    fireEvent.changeText(candidateAInput, '-10');

    // Check validation error appears
    expect(getByText('Vote count cannot be negative')).toBeTruthy();
  });

  it('should handle unusually high numbers validation for audio data', () => {
    const mockRoute = {
      params: {
        data: {
          'Candidate A': 145,
          'Candidate B': 125,
          'Candidate C': 85,
          'spoilt': 3,
        },
        submissionType: 'audio_stt',
      },
    } as any;

    const { getByDisplayValue, getByText } = render(
      <ConfirmationScreen navigation={mockNavigation} route={mockRoute} />
    );

    // Enter unusually high number
    const candidateAInput = getByDisplayValue('145');
    fireEvent.changeText(candidateAInput, '15000');

    // Check validation error appears
    expect(getByText('Vote count seems unusually high')).toBeTruthy();
  });

  it('should navigate back to audio recording screen', () => {
    const mockRoute = {
      params: {
        data: {
          'Candidate A': 145,
          'Candidate B': 125,
          'Candidate C': 85,
          'spoilt': 3,
        },
        submissionType: 'audio_stt',
      },
    } as any;

    const { getByText } = render(
      <ConfirmationScreen navigation={mockNavigation} route={mockRoute} />
    );

    // Press back button
    const backButton = getByText('← Back to Capture');
    fireEvent.press(backButton);

    // Check navigation was called
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('should submit audio data successfully', async () => {
    const mockRoute = {
      params: {
        data: {
          'Candidate A': 145,
          'Candidate B': 125,
          'Candidate C': 85,
          'spoilt': 3,
        },
        submissionType: 'audio_stt',
      },
    } as any;

    const { getByText } = render(
      <ConfirmationScreen navigation={mockNavigation} route={mockRoute} />
    );

    // Press submit button
    const submitButton = getByText('✅ Confirm & Submit');
    fireEvent.press(submitButton);

    // Confirm in alert dialog
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Confirm Submission',
        'Are you sure you want to submit these results? This action cannot be undone.',
        expect.arrayContaining([
          expect.objectContaining({ text: 'Cancel' }),
          expect.objectContaining({ text: 'Submit' }),
        ])
      );
    });

    // Simulate pressing Submit in the alert
    const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
    const submitAction = alertCall[2].find((action: any) => action.text === 'Submit');
    await submitAction.onPress();

    // Check navigation to dashboard
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('DashboardScreen');
    });
  });
});