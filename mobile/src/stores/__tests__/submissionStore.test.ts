import { act, renderHook } from '@testing-library/react-native';
import { useSubmissionStore, SubmissionData } from '../submissionStore';

// Mock setTimeout for testing
jest.useFakeTimers();

describe('SubmissionStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useSubmissionStore.setState({
      currentSubmission: null,
      isSubmitting: false,
      submissionHistory: [],
      error: null,
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  it('should have initial state', () => {
    const { result } = renderHook(() => useSubmissionStore());

    expect(result.current.currentSubmission).toBe(null);
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.submissionHistory).toEqual([]);
    expect(result.current.error).toBe(null);
  });

  it('should set submission data', () => {
    const { result } = renderHook(() => useSubmissionStore());
    const submissionData: Partial<SubmissionData> = {
      pollingStationId: 'PS001',
      results: {
        'Candidate A': 150,
        'Candidate B': 120,
        spoilt: 5,
      },
      submissionType: 'image_ocr',
      confidence: 0.95,
    };

    act(() => {
      result.current.setSubmissionData(submissionData);
    });

    expect(result.current.currentSubmission).toMatchObject(submissionData);
  });

  it('should submit results successfully', async () => {
    const { result } = renderHook(() => useSubmissionStore());
    const submissionData: Partial<SubmissionData> = {
      pollingStationId: 'PS001',
      results: {
        'Candidate A': 150,
        'Candidate B': 120,
        spoilt: 5,
      },
      submissionType: 'image_ocr',
      confidence: 0.95,
    };

    // Set submission data first
    act(() => {
      result.current.setSubmissionData(submissionData);
    });

    // Submit results
    act(() => {
      result.current.submitResults();
    });

    expect(result.current.isSubmitting).toBe(true);
    expect(result.current.error).toBe(null);

    // Fast-forward timers to complete the mock submission
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.currentSubmission).toBe(null);
    expect(result.current.submissionHistory).toHaveLength(1);
    expect(result.current.submissionHistory[0]).toMatchObject({
      ...submissionData,
      timestamp: expect.any(String),
      gpsCoordinates: expect.objectContaining({
        latitude: expect.any(Number),
        longitude: expect.any(Number),
      }),
    });
  });

  it('should handle submission without data', async () => {
    const { result } = renderHook(() => useSubmissionStore());

    act(() => {
      result.current.submitResults();
    });

    expect(result.current.error).toBe('No submission data available');
  });

  it('should clear current submission', () => {
    const { result } = renderHook(() => useSubmissionStore());

    // Set some data first
    act(() => {
      result.current.setSubmissionData({
        pollingStationId: 'PS001',
        results: { 'Candidate A': 150, spoilt: 5 },
        submissionType: 'image_ocr',
        confidence: 0.95,
      });
    });

    expect(result.current.currentSubmission).toBeTruthy();

    // Clear submission
    act(() => {
      result.current.clearCurrentSubmission();
    });

    expect(result.current.currentSubmission).toBe(null);
  });

  it('should handle errors', () => {
    const { result } = renderHook(() => useSubmissionStore());
    const errorMessage = 'Submission failed';

    act(() => {
      result.current.setError(errorMessage);
    });

    expect(result.current.error).toBe(errorMessage);

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBe(null);
  });
});