import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { apiService } from '@/services/apiService';

export interface PollingStationStatus {
  id: string;
  status: 'Pending' | 'Verified';
  results?: {
    [candidateName: string]: number;
    spoilt: number;
  };
  confidence?: number;
}

export interface TallyData {
  votingProcessId: string;
  title: string;
  aggregatedTally: {
    [candidateName: string]: number;
    spoilt: number;
  };
  pollingStations: PollingStationStatus[];
  lastUpdated: string;
}

export interface DashboardState {
  tallyData: TallyData | null;
  isLoading: boolean;
  isConnected: boolean;
  error: string | null;
  refreshInterval: number; // in milliseconds
  connectionAttempts: number;
  maxReconnectAttempts: number;
  reconnectDelay: number; // in milliseconds
  isReconnecting: boolean;
}

export interface DashboardActions {
  fetchTallyData: (votingProcessId?: string) => Promise<void>;
  startPeriodicRefresh: (votingProcessId?: string) => void;
  stopPeriodicRefresh: () => void;
  connectWebSocket: (votingProcessId?: string) => void;
  disconnectWebSocket: () => void;
  handleWebSocketMessage: (data: any) => void;
  handleWebSocketError: (error: Event) => void;
  handleWebSocketClose: (event: CloseEvent) => void;
  attemptReconnection: (votingProcessId?: string) => void;
  resetConnectionState: () => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

export type DashboardStore = DashboardState & DashboardActions;

const initialState: DashboardState = {
  tallyData: null,
  isLoading: false,
  isConnected: false,
  error: null,
  refreshInterval: 30000, // 30 seconds
  connectionAttempts: 0,
  maxReconnectAttempts: 5,
  reconnectDelay: 1000, // Start with 1 second
  isReconnecting: false,
};

let refreshTimer: NodeJS.Timeout | null = null;
let websocket: WebSocket | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let currentVotingProcessId: string = 'default';

export const useDashboardStore = create<DashboardStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      fetchTallyData: async (votingProcessId = 'default') => {
        set({ isLoading: true, error: null });

        try {
          // Try to fetch from API first
          const response = await apiService.getTally(votingProcessId);
          
          if (response.success && response.data) {
            set({
              tallyData: response.data,
              isLoading: false,
            });
          } else {
            throw new Error(response.error || 'Failed to fetch tally data');
          }
        } catch (error) {
          // Fallback to mock data for development
          console.warn('API call failed, using mock data:', error);
          
          const mockTallyData: TallyData = {
            votingProcessId,
            title: 'Presidential Election 2024',
            aggregatedTally: {
              'Candidate A': 1250,
              'Candidate B': 980,
              'Candidate C': 750,
              spoilt: 45,
            },
            pollingStations: [
              {
                id: 'PS001',
                status: 'Verified',
                results: { 'Candidate A': 150, 'Candidate B': 120, 'Candidate C': 80, spoilt: 5 },
                confidence: 0.95,
              },
              {
                id: 'PS002',
                status: 'Verified',
                results: { 'Candidate A': 200, 'Candidate B': 180, 'Candidate C': 100, spoilt: 8 },
                confidence: 0.92,
              },
              {
                id: 'PS003',
                status: 'Pending',
              },
              {
                id: 'PS004',
                status: 'Verified',
                results: { 'Candidate A': 175, 'Candidate B': 160, 'Candidate C': 90, spoilt: 7 },
                confidence: 0.88,
              },
            ],
            lastUpdated: new Date().toISOString(),
          };

          set({
            tallyData: mockTallyData,
            isLoading: false,
            error: null, // Clear error since we have fallback data
          });
        }
      },

      startPeriodicRefresh: (votingProcessId = 'default') => {
        const { refreshInterval, fetchTallyData } = get();
        
        // Clear existing timer
        if (refreshTimer) {
          clearInterval(refreshTimer);
        }

        // Start new timer
        refreshTimer = setInterval(() => {
          fetchTallyData(votingProcessId);
        }, refreshInterval);
      },

      stopPeriodicRefresh: () => {
        if (refreshTimer) {
          clearInterval(refreshTimer);
          refreshTimer = null;
        }
      },

      connectWebSocket: (votingProcessId = 'default') => {
        const { disconnectWebSocket, handleWebSocketMessage, handleWebSocketError, handleWebSocketClose } = get();
        
        // Store current voting process ID
        currentVotingProcessId = votingProcessId;
        
        // Disconnect existing connection
        disconnectWebSocket();
        
        try {
          // TODO: Replace with actual WebSocket URL from config
          const wsUrl = `ws://localhost:8080/ws?votingProcessId=${votingProcessId}`;
          
          websocket = new WebSocket(wsUrl);
          
          websocket.onopen = () => {
            console.log('WebSocket connected');
            set({ 
              isConnected: true, 
              connectionAttempts: 0,
              isReconnecting: false,
              error: null 
            });
            
            // Stop HTTP polling when WebSocket is connected
            get().stopPeriodicRefresh();
          };
          
          websocket.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);
              handleWebSocketMessage(data);
            } catch (error) {
              console.error('Failed to parse WebSocket message:', error);
            }
          };
          
          websocket.onerror = handleWebSocketError;
          websocket.onclose = handleWebSocketClose;
          
        } catch (error) {
          console.error('Failed to create WebSocket connection:', error);
          set({
            error: error instanceof Error ? error.message : 'Failed to connect WebSocket',
            isConnected: false,
          });
          
          // Fallback to HTTP polling
          get().startPeriodicRefresh(votingProcessId);
        }
      },

      disconnectWebSocket: () => {
        if (websocket) {
          websocket.close();
          websocket = null;
        }
        
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
        
        set({ 
          isConnected: false,
          isReconnecting: false,
          connectionAttempts: 0 
        });
      },

      handleWebSocketMessage: (data: any) => {
        if (data.type === 'tally_update' && data.data) {
          set({ 
            tallyData: data.data,
            error: null 
          });
        }
      },

      handleWebSocketError: (error: Event) => {
        console.error('WebSocket error:', error);
        set({
          error: 'WebSocket connection error',
          isConnected: false,
        });
      },

      handleWebSocketClose: (event: CloseEvent) => {
        console.log('WebSocket closed:', event.code, event.reason);
        set({ isConnected: false });
        
        // Only attempt reconnection if it wasn't a manual close
        if (event.code !== 1000) {
          get().attemptReconnection(currentVotingProcessId);
        }
      },

      attemptReconnection: (votingProcessId = 'default') => {
        const { connectionAttempts, maxReconnectAttempts, reconnectDelay } = get();
        
        if (connectionAttempts >= maxReconnectAttempts) {
          console.log('Max reconnection attempts reached, falling back to HTTP polling');
          set({
            error: 'WebSocket connection failed. Using periodic updates.',
            isReconnecting: false,
          });
          
          // Fallback to HTTP polling
          get().startPeriodicRefresh(votingProcessId);
          return;
        }
        
        const delay = reconnectDelay * Math.pow(2, connectionAttempts); // Exponential backoff
        
        set({ 
          isReconnecting: true,
          connectionAttempts: connectionAttempts + 1 
        });
        
        console.log(`Attempting WebSocket reconnection in ${delay}ms (attempt ${connectionAttempts + 1}/${maxReconnectAttempts})`);
        
        reconnectTimer = setTimeout(() => {
          get().connectWebSocket(votingProcessId);
        }, delay);
      },

      resetConnectionState: () => {
        set({
          connectionAttempts: 0,
          isReconnecting: false,
          error: null,
        });
      },

      setError: (error: string | null) => {
        set({ error });
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'dashboard-store',
    }
  )
);