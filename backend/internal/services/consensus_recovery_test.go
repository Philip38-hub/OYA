package services

import (
	"errors"
	"testing"
	"time"

	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"oyah-backend/internal/models"
)

func TestConsensusRecoveryService_RecoverConsensusProcessing(t *testing.T) {
	// Initialize services
	storage := NewStorageService()
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel) // Reduce noise in tests
	consensusService := NewConsensusService(storage, logger)
	recoveryService := NewConsensusRecoveryService(storage, consensusService, logger)

	// Set shorter retry configuration for testing
	recoveryService.SetRetryConfiguration(2, time.Millisecond*100)

	// Create test voting process
	votingProcess := models.VotingProcess{
		ID:              "test-process-1",
		Title:           "Test Election",
		Position:        "President",
		Candidates:      []models.Candidate{{ID: "1", Name: "Alice"}, {ID: "2", Name: "Bob"}},
		PollingStations: []string{"station-1"},
		Status:          "Active",
		CreatedAt:       time.Now(),
	}

	err := storage.StoreVotingProcess(votingProcess)
	require.NoError(t, err)

	// Add some test submissions to create a scenario where consensus can succeed
	submissions := []models.Submission{
		{
			ID:               "sub-1",
			WalletAddress:    "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
			PollingStationID: "station-1",
			Results:          map[string]int{"Alice": 100, "Bob": 80},
			ProcessedAt:      time.Now(),
		},
		{
			ID:               "sub-2",
			WalletAddress:    "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty",
			PollingStationID: "station-1",
			Results:          map[string]int{"Alice": 100, "Bob": 80},
			ProcessedAt:      time.Now(),
		},
		{
			ID:               "sub-3",
			WalletAddress:    "5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y",
			PollingStationID: "station-1",
			Results:          map[string]int{"Alice": 100, "Bob": 80},
			ProcessedAt:      time.Now(),
		},
	}

	for _, sub := range submissions {
		err := storage.StoreSubmission(sub)
		require.NoError(t, err)
	}

	// Test recovery with a simulated error
	originalError := errors.New("simulated consensus error")
	result := recoveryService.RecoverConsensusProcessing("station-1", originalError)

	// Should succeed because we have valid data and consensus should work on retry
	assert.True(t, result.Success)
	assert.NotNil(t, result.FinalResult)
	assert.Equal(t, "Verified", result.FinalResult.Status)
	assert.Greater(t, len(result.RecoveryActions), 0)
	assert.Contains(t, result.RecoveryActions, "validated_polling_station_exists")
}

func TestConsensusRecoveryService_RecoverConsensusProcessing_NonExistentStation(t *testing.T) {
	storage := NewStorageService()
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	consensusService := NewConsensusService(storage, logger)
	recoveryService := NewConsensusRecoveryService(storage, consensusService, logger)

	originalError := errors.New("simulated error")
	result := recoveryService.RecoverConsensusProcessing("non-existent-station", originalError)

	assert.False(t, result.Success)
	assert.Contains(t, result.Error, "polling station validation failed")
}

func TestConsensusRecoveryService_ValidateDataIntegrity(t *testing.T) {
	storage := NewStorageService()
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	consensusService := NewConsensusService(storage, logger)
	recoveryService := NewConsensusRecoveryService(storage, consensusService, logger)

	tests := []struct {
		name        string
		station     *models.PollingStation
		expectError bool
		errorMsg    string
	}{
		{
			name: "Valid station",
			station: &models.PollingStation{
				ID: "station-1",
				Submissions: []models.Submission{
					{
						ID:            "sub-1",
						WalletAddress: "wallet-1",
						Results:       map[string]int{"Alice": 100, "Bob": 80},
					},
				},
			},
			expectError: false,
		},
		{
			name: "Nil submissions",
			station: &models.PollingStation{
				ID:          "station-1",
				Submissions: nil,
			},
			expectError: true,
			errorMsg:    "submissions list is nil",
		},
		{
			name: "Duplicate wallet addresses",
			station: &models.PollingStation{
				ID: "station-1",
				Submissions: []models.Submission{
					{
						ID:            "sub-1",
						WalletAddress: "wallet-1",
						Results:       map[string]int{"Alice": 100},
					},
					{
						ID:            "sub-2",
						WalletAddress: "wallet-1", // Duplicate
						Results:       map[string]int{"Alice": 100},
					},
				},
			},
			expectError: true,
			errorMsg:    "duplicate wallet address found",
		},
		{
			name: "Empty results",
			station: &models.PollingStation{
				ID: "station-1",
				Submissions: []models.Submission{
					{
						ID:            "sub-1",
						WalletAddress: "wallet-1",
						Results:       nil, // Empty results
					},
				},
			},
			expectError: true,
			errorMsg:    "has empty results",
		},
		{
			name: "Negative vote count",
			station: &models.PollingStation{
				ID: "station-1",
				Submissions: []models.Submission{
					{
						ID:            "sub-1",
						WalletAddress: "wallet-1",
						Results:       map[string]int{"Alice": -10}, // Negative votes
					},
				},
			},
			expectError: true,
			errorMsg:    "negative vote count",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := recoveryService.validateDataIntegrity(tt.station)
			
			if tt.expectError {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.errorMsg)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestConsensusRecoveryService_RepairDataIntegrity(t *testing.T) {
	storage := NewStorageService()
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	consensusService := NewConsensusService(storage, logger)
	recoveryService := NewConsensusRecoveryService(storage, consensusService, logger)

	// Create station with data integrity issues
	station := &models.PollingStation{
		ID: "station-1",
		Submissions: []models.Submission{
			{
				ID:            "sub-1",
				WalletAddress: "wallet-1",
				Results:       map[string]int{"Alice": 100, "Bob": -10}, // Negative votes
				ProcessedAt:   time.Now().Add(-time.Hour),
			},
			{
				ID:            "sub-2",
				WalletAddress: "wallet-1", // Duplicate wallet
				Results:       map[string]int{"Alice": 120, "Bob": 80},
				ProcessedAt:   time.Now(), // More recent
			},
			{
				ID:            "sub-3",
				WalletAddress: "wallet-2",
				Results:       map[string]int{"Alice": 90, "Bob": 70},
				ProcessedAt:   time.Now().Add(-time.Minute*30),
			},
		},
	}

	err := recoveryService.repairDataIntegrity(station)
	assert.NoError(t, err)

	// Check that duplicates were removed (should keep the most recent)
	walletAddresses := make(map[string]bool)
	for _, sub := range station.Submissions {
		assert.False(t, walletAddresses[sub.WalletAddress], "Duplicate wallet address found after repair")
		walletAddresses[sub.WalletAddress] = true

		// Check that negative votes were fixed
		for _, votes := range sub.Results {
			assert.GreaterOrEqual(t, votes, 0, "Negative vote count found after repair")
		}
	}

	// Should have 2 unique submissions (wallet-1 latest and wallet-2)
	assert.Len(t, station.Submissions, 2)
}

func TestConsensusRecoveryService_AttemptEmergencyRecovery(t *testing.T) {
	storage := NewStorageService()
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	consensusService := NewConsensusService(storage, logger)
	recoveryService := NewConsensusRecoveryService(storage, consensusService, logger)

	// Create test voting process
	votingProcess := models.VotingProcess{
		ID:              "test-process-1",
		PollingStations: []string{"station-1"},
		Status:          "Active",
	}
	err := storage.StoreVotingProcess(votingProcess)
	require.NoError(t, err)

	// Test case 1: Sufficient identical submissions for emergency recovery
	submissions := []models.Submission{
		{
			ID:               "sub-1",
			WalletAddress:    "wallet-1",
			PollingStationID: "station-1",
			Results:          map[string]int{"Alice": 100, "Bob": 80},
		},
		{
			ID:               "sub-2",
			WalletAddress:    "wallet-2",
			PollingStationID: "station-1",
			Results:          map[string]int{"Alice": 100, "Bob": 80}, // Identical
		},
	}

	for _, sub := range submissions {
		err := storage.StoreSubmission(sub)
		require.NoError(t, err)
	}

	result := recoveryService.attemptEmergencyRecovery("station-1")
	assert.NotNil(t, result)
	assert.Equal(t, "Verified", result.Status)
	assert.Equal(t, map[string]int{"Alice": 100, "Bob": 80}, result.VerifiedResults)
	assert.Greater(t, result.ConfidenceLevel, 0.0)
	assert.Less(t, result.ConfidenceLevel, 1.0) // Should be reduced for emergency recovery

	// Test case 2: Insufficient submissions
	// Clear previous submissions
	storage.submissions["station-2"] = []models.Submission{
		{
			ID:               "sub-1",
			WalletAddress:    "wallet-1",
			PollingStationID: "station-2",
			Results:          map[string]int{"Alice": 100},
		},
	}

	result = recoveryService.attemptEmergencyRecovery("station-2")
	assert.Nil(t, result) // Should fail with only 1 submission
}

func TestConsensusRecoveryService_SetRetryConfiguration(t *testing.T) {
	storage := NewStorageService()
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	consensusService := NewConsensusService(storage, logger)
	recoveryService := NewConsensusRecoveryService(storage, consensusService, logger)

	// Test setting valid configuration
	recoveryService.SetRetryConfiguration(5, time.Second*3)
	assert.Equal(t, 5, recoveryService.maxRetries)
	assert.Equal(t, time.Second*3, recoveryService.retryDelay)

	// Test setting invalid configuration (should be ignored)
	recoveryService.SetRetryConfiguration(0, 0)
	assert.Equal(t, 5, recoveryService.maxRetries) // Should remain unchanged
	assert.Equal(t, time.Second*3, recoveryService.retryDelay) // Should remain unchanged
}