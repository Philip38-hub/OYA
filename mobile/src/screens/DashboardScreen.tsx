import React, { useEffect } from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { StyledButton, Card, StatusIndicator, LoadingSpinner, ErrorMessage } from '@/components';
import { RootStackParamList } from '@/types/navigation';
import { useDashboardStore } from '@/stores/dashboardStore';

type DashboardScreenNavigationProp = StackNavigationProp<RootStackParamList, 'DashboardScreen'>;

interface Props {
  navigation: DashboardScreenNavigationProp;
}

export const DashboardScreen: React.FC<Props> = ({ navigation }) => {
  const {
    tallyData,
    isLoading,
    isConnected,
    isReconnecting,
    error,
    fetchTallyData,
    connectWebSocket,
    disconnectWebSocket,
    startPeriodicRefresh,
    stopPeriodicRefresh,
    clearError,
    resetConnectionState,
  } = useDashboardStore();

  useEffect(() => {
    // Reset connection state when component mounts
    resetConnectionState();
    
    // Initial data fetch
    fetchTallyData();
    
    // Try to establish WebSocket connection
    connectWebSocket();
    
    // Cleanup on unmount
    return () => {
      disconnectWebSocket();
      stopPeriodicRefresh();
    };
  }, []);

  const handleRefresh = () => {
    clearError();
    fetchTallyData();
  };

  if (isLoading && !tallyData) {
    return (
      <View className="flex-1 bg-gray-50 justify-center items-center">
        <LoadingSpinner size="large" />
        <Text className="text-gray-600 mt-4">Loading tally data...</Text>
      </View>
    );
  }

  if (error && !tallyData) {
    return (
      <View className="flex-1 bg-gray-50 justify-center items-center p-5">
        <ErrorMessage message={error} />
        <StyledButton
          title="Retry"
          onPress={handleRefresh}
          className="mt-4"
        />
        <StyledButton
          title="← Back to Actions"
          variant="outline"
          onPress={() => navigation.navigate('MainActionScreen')}
          className="mt-2"
        />
      </View>
    );
  }

  return (
    <ScrollView 
      className="flex-1 bg-gray-50"
      refreshControl={
        <RefreshControl
          refreshing={isLoading}
          onRefresh={handleRefresh}
          colors={['#1e40af']}
          tintColor="#1e40af"
        />
      }
    >
      <View className="p-4">
        {/* Header */}
        <View className="mb-6">
          <Text className="text-2xl font-bold text-gray-800 text-center mb-2">
            Live Tally Dashboard
          </Text>
          {tallyData && (
            <Text className="text-sm text-gray-600 text-center">
              {tallyData.title}
            </Text>
          )}
          
          {/* Connection Status */}
          <View className="flex-row justify-center items-center mt-2">
            {isConnected ? (
              <View className="flex-row items-center">
                <View className="w-2 h-2 bg-green-500 rounded-full mr-2" />
                <Text className="text-xs text-green-600">Live Updates</Text>
              </View>
            ) : isReconnecting ? (
              <View className="flex-row items-center">
                <View className="w-2 h-2 bg-yellow-500 rounded-full mr-2" />
                <Text className="text-xs text-yellow-600">Reconnecting...</Text>
              </View>
            ) : (
              <View className="flex-row items-center">
                <View className="w-2 h-2 bg-gray-400 rounded-full mr-2" />
                <Text className="text-xs text-gray-500">Periodic Updates</Text>
              </View>
            )}
          </View>
          
          {tallyData?.lastUpdated && (
            <Text className="text-xs text-gray-500 text-center mt-1">
              Last updated: {new Date(tallyData.lastUpdated).toLocaleTimeString()}
            </Text>
          )}
        </View>

        {error && (
          <View className="mb-4">
            <ErrorMessage message={error} />
          </View>
        )}

        {tallyData && (
          <>
            {/* National Tally */}
            <Card padding="lg" className="mb-6" shadow>
              <Text className="text-xl font-bold text-gray-800 mb-4 text-center">
                National Aggregate Results
              </Text>
              
              <View className="space-y-3">
                {Object.entries(tallyData.aggregatedTally)
                  .filter(([candidate]) => candidate !== 'spoilt')
                  .map(([candidate, votes]) => (
                    <View key={candidate} className="flex-row justify-between items-center py-2 border-b border-gray-100">
                      <Text className="text-lg font-medium text-gray-700">
                        {candidate}
                      </Text>
                      <Text className="text-lg font-bold text-blue-600">
                        {votes.toLocaleString()}
                      </Text>
                    </View>
                  ))}
                
                {/* Spoilt ballots */}
                <View className="flex-row justify-between items-center py-2 mt-2">
                  <Text className="text-base text-gray-600">
                    Spoilt Ballots
                  </Text>
                  <Text className="text-base font-semibold text-gray-600">
                    {tallyData.aggregatedTally.spoilt?.toLocaleString() || 0}
                  </Text>
                </View>
              </View>
            </Card>

            {/* Polling Stations */}
            <View className="mb-6">
              <Text className="text-xl font-bold text-gray-800 mb-4">
                Polling Stations Status
              </Text>
              
              {/* Summary stats */}
              <View className="flex-row justify-between mb-4">
                <View className="flex-1 mr-2">
                  <Card padding="sm" className="bg-green-50">
                    <Text className="text-center text-sm text-gray-600">Verified</Text>
                    <Text className="text-center text-xl font-bold text-green-600">
                      {tallyData.pollingStations.filter(s => s.status === 'Verified').length}
                    </Text>
                  </Card>
                </View>
                <View className="flex-1 ml-2">
                  <Card padding="sm" className="bg-yellow-50">
                    <Text className="text-center text-sm text-gray-600">Pending</Text>
                    <Text className="text-center text-xl font-bold text-yellow-600">
                      {tallyData.pollingStations.filter(s => s.status === 'Pending').length}
                    </Text>
                  </Card>
                </View>
              </View>

              {/* Station list */}
              {tallyData.pollingStations.map((station) => (
                <Card key={station.id} padding="md" className="mb-3" shadow>
                  <View className="flex-row justify-between items-center mb-3">
                    <Text className="text-lg font-semibold text-gray-800">
                      {station.id}
                    </Text>
                    <StatusIndicator 
                      status={station.status === 'Verified' ? 'verified' : 'pending'}
                      size="sm"
                    />
                  </View>
                  
                  {station.results ? (
                    <View className="space-y-1">
                      {Object.entries(station.results)
                        .filter(([candidate]) => candidate !== 'spoilt')
                        .map(([candidate, votes]) => (
                          <View key={candidate} className="flex-row justify-between">
                            <Text className="text-sm text-gray-600">
                              {candidate}
                            </Text>
                            <Text className="text-sm font-medium text-gray-800">
                              {votes}
                            </Text>
                          </View>
                        ))}
                      <View className="flex-row justify-between pt-1 border-t border-gray-100">
                        <Text className="text-xs text-gray-500">
                          Spoilt: {station.results.spoilt || 0}
                        </Text>
                        {station.confidence && (
                          <Text className="text-xs text-gray-500">
                            Confidence: {Math.round(station.confidence * 100)}%
                          </Text>
                        )}
                      </View>
                    </View>
                  ) : (
                    <Text className="text-sm text-gray-500 italic">
                      Awaiting consensus from witnesses
                    </Text>
                  )}
                </Card>
              ))}
            </View>
          </>
        )}

        <StyledButton
          title="← Back to Actions"
          variant="outline"
          onPress={() => navigation.navigate('MainActionScreen')}
          className="mb-4"
        />
      </View>
    </ScrollView>
  );
};