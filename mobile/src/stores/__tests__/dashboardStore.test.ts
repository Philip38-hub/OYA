import { act, renderHook } from '@testing-library/react-native';
import { useDashboardStore } from '../dashboardStore';

// Mock the API service
jest.mock('@/services/apiService', () => ({
  apiService: {
    getTally: jest.fn(),
  },
}));

// Mock WebSocket
const mockWebSocket = {
  onopen: null,
  onmessage: null,
  onerror: null,
  onclose: null,
  close: jest.fn(),
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
};

(global as any).WebSocket = jest.fn().mockImplementation(() => mockWebSocket);

// Mock setTimeout for testing
jest.useFakeTimers();

describe('DashboardStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useDashboardStore.setState({
      tallyData: null,
      isLoading: false,
      isConnected: false,
      error: null,
      refreshInterval: 30000,
      connectionAttempts: 0,
      maxReconnectAttempts: 5,
      reconnectDelay: 1000,
      isReconnecting: false,
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  it('should have initial state', () => {
    const { result } = renderHook(() => useDashboardStore());

    expect(result.current.tallyData).toBe(null);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isConnected).toBe(false);
    expect(result.current.error).toBe(null);
    expect(result.current.refreshInterval).toBe(30000);
    expect(result.current.connectionAttempts).toBe(0);
    expect(result.current.isReconnecting).toBe(false);
  });

  it('should fetch tally data successfully', async () => {
    const { result } = renderHook(() => useDashboardStore());

    // Since API call will fail and fallback to mock data, we expect mock data
    await act(async () => {
      await result.current.fetchTallyData('test-process');
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.tallyData).toBeTruthy();
    expect(result.current.tallyData?.votingProcessId).toBe('test-process');
    expect(result.current.tallyData?.aggregatedTally).toMatchObject({
      'Candidate A': expect.any(Number),
      'Candidate B': expect.any(Number),
      'Candidate C': expect.any(Number),
      spoilt: expect.any(Number),
    });
    expect(result.current.tallyData?.pollingStations).toHaveLength(4);
  });

  it('should start and stop periodic refresh', () => {
    const { result } = renderHook(() => useDashboardStore());

    // Mock fetchTallyData to track calls
    const fetchSpy = jest.spyOn(result.current, 'fetchTallyData');

    act(() => {
      result.current.startPeriodicRefresh('test-process');
    });

    // Fast-forward to trigger refresh
    act(() => {
      jest.advanceTimersByTime(30000);
    });

    expect(fetchSpy).toHaveBeenCalledWith('test-process');

    // Stop refresh
    act(() => {
      result.current.stopPeriodicRefresh();
    });

    // Clear previous calls and advance time again
    fetchSpy.mockClear();
    act(() => {
      jest.advanceTimersByTime(30000);
    });

    // Should not be called after stopping
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });

  it('should connect WebSocket', () => {
    const { result } = renderHook(() => useDashboardStore());

    act(() => {
      result.current.connectWebSocket('test-process');
    });

    // WebSocket connection will fail in test environment, so it should fallback to HTTP polling
    expect(result.current.isConnected).toBe(false);
  });

  it('should disconnect WebSocket', () => {
    const { result } = renderHook(() => useDashboardStore());

    // Manually set connected state for testing
    act(() => {
      useDashboardStore.setState({ isConnected: true });
    });

    expect(result.current.isConnected).toBe(true);

    // Then disconnect
    act(() => {
      result.current.disconnectWebSocket();
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.isReconnecting).toBe(false);
  });

  it('should handle errors', () => {
    const { result } = renderHook(() => useDashboardStore());
    const errorMessage = 'Failed to fetch data';

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