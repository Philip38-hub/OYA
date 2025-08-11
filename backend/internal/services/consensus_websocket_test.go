package services

import (
	"testing"
	"time"

	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"oyah-backend/internal/models"
)

func TestConsensusService_SetWebSocketService(t *testing.T) {
	logger := logrus.New()
	logger.SetLevel(logrus.FatalLevel) // Suppress logs during testing

	// Create services
	storageService := NewStorageService()
	consensusService := NewConsensusService(storageService, logger)
	tallyService := NewTallyService(storageService, logger)
	webSocketService := NewWebSocketService(tallyService, logger)

	// Initially WebSocket service should be nil
	assert.Nil(t, consensusService.webSocketService)

	// Set WebSocket service
	consensusService.SetWebSocketService(webSocketService)

	// WebSocket service should now be set
	assert.Equal(t, webSocketService, consensusService.webSocketService)
}

func TestConsensusService_ProcessConsensusWithWebSocketBroadcast(t *testing.T) {
	logger := logrus.New()
	logger.SetLevel(logrus.FatalLevel) // Suppress logs during testing

	// Create services
	storageService := NewStorageService()
	consensusService := NewConsensusService(storageService, logger)
	tallyService := NewTallyService(storageService, logger)
	webSocketService := NewWebSocketService(tallyService, logger)

	// Wire WebSocket service with consensus service
	consensusService.SetWebSocketService(webSocketService)

	// Create test voting process
	votingProcess := models.VotingProcess{
		ID:       "test-process-1",
		Title:    "Test Election",
		Position: "President",
		Candidates: []models.Candidate{
			{ID: "1", Name: "Candidate 1"},
			{ID: "2", Name: "Candidate 2"},
		},
		PollingStations: []string{"station-1"},
		Status:          "Active",
		CreatedAt:       time.Now(),
	}

	err := storageService.StoreVotingProcess(votingProcess)
	require.NoError(t, err)

	// Create test submissions that will reach consensus
	pollingStationID := "station-1"
	results := map[string]int{
		"Candidate 1": 100,
		"Candidate 2": 150,
		"spoilt":      5,
	}

	// Create 3 identical submissions from different wallets to reach consensus
	for i := 0; i < 3; i++ {
		submission := models.Submission{
			ID:               generateSubmissionID(),
			WalletAddress:    generateWalletAddress(i),
			PollingStationID: pollingStationID,
			GPSCoordinates: models.GPSCoordinates{
				Latitude:  -1.2921,
				Longitude: 36.8219,
			},
			Timestamp:      time.Now(),
			Results:        copyResults(results),
			SubmissionType: "image_ocr",
			Confidence:     0.95,
		}

		err := storageService.StoreSubmission(submission)
		require.NoError(t, err)
	}

	// Process consensus - this should trigger WebSocket broadcast
	consensusResult, err := consensusService.ProcessConsensus(pollingStationID)
	require.NoError(t, err)

	// Verify consensus was reached
	assert.Equal(t, "Verified", consensusResult.Status)
	assert.NotNil(t, consensusResult.VerifiedResults)
	assert.Greater(t, consensusResult.ConfidenceLevel, 0.0)

	// The WebSocket broadcast should have been triggered (we can't easily test the actual broadcast
	// without setting up WebSocket connections, but we can verify no errors occurred)
}

func TestConsensusService_ProcessConsensusPendingWithWebSocketBroadcast(t *testing.T) {
	logger := logrus.New()
	logger.SetLevel(logrus.FatalLevel) // Suppress logs during testing

	// Create services
	storageService := NewStorageService()
	consensusService := NewConsensusService(storageService, logger)
	tallyService := NewTallyService(storageService, logger)
	webSocketService := NewWebSocketService(tallyService, logger)

	// Wire WebSocket service with consensus service
	consensusService.SetWebSocketService(webSocketService)

	// Create test voting process
	votingProcess := models.VotingProcess{
		ID:       "test-process-2",
		Title:    "Test Election 2",
		Position: "President",
		Candidates: []models.Candidate{
			{ID: "1", Name: "Candidate 1"},
			{ID: "2", Name: "Candidate 2"},
		},
		PollingStations: []string{"station-2"},
		Status:          "Active",
		CreatedAt:       time.Now(),
	}

	err := storageService.StoreVotingProcess(votingProcess)
	require.NoError(t, err)

	// Create test submission (only 1, below threshold)
	pollingStationID := "station-2"
	results := map[string]int{
		"Candidate 1": 100,
		"Candidate 2": 150,
		"spoilt":      5,
	}

	submission := models.Submission{
		ID:               generateSubmissionID(),
		WalletAddress:    generateWalletAddress(0),
		PollingStationID: pollingStationID,
		GPSCoordinates: models.GPSCoordinates{
			Latitude:  -1.2921,
			Longitude: 36.8219,
		},
		Timestamp:      time.Now(),
		Results:        copyResults(results),
		SubmissionType: "image_ocr",
		Confidence:     0.95,
	}

	err = storageService.StoreSubmission(submission)
	require.NoError(t, err)

	// Process consensus - this should trigger WebSocket broadcast for pending status
	consensusResult, err := consensusService.ProcessConsensus(pollingStationID)
	require.NoError(t, err)

	// Verify consensus is pending
	assert.Equal(t, "Pending", consensusResult.Status)
	assert.Nil(t, consensusResult.VerifiedResults)
	assert.Equal(t, 0.0, consensusResult.ConfidenceLevel)

	// The WebSocket broadcast should have been triggered for pending status
}

func TestConsensusService_ProcessConsensusWithoutWebSocketService(t *testing.T) {
	logger := logrus.New()
	logger.SetLevel(logrus.FatalLevel) // Suppress logs during testing

	// Create services without WebSocket service
	storageService := NewStorageService()
	consensusService := NewConsensusService(storageService, logger)

	// Create test voting process
	votingProcess := models.VotingProcess{
		ID:       "test-process-3",
		Title:    "Test Election 3",
		Position: "President",
		Candidates: []models.Candidate{
			{ID: "1", Name: "Candidate 1"},
			{ID: "2", Name: "Candidate 2"},
		},
		PollingStations: []string{"station-3"},
		Status:          "Active",
		CreatedAt:       time.Now(),
	}

	err := storageService.StoreVotingProcess(votingProcess)
	require.NoError(t, err)

	// Create test submissions that will reach consensus
	pollingStationID := "station-3"
	results := map[string]int{
		"Candidate 1": 100,
		"Candidate 2": 150,
		"spoilt":      5,
	}

	// Create 3 identical submissions from different wallets to reach consensus
	for i := 0; i < 3; i++ {
		submission := models.Submission{
			ID:               generateSubmissionID(),
			WalletAddress:    generateWalletAddress(i),
			PollingStationID: pollingStationID,
			GPSCoordinates: models.GPSCoordinates{
				Latitude:  -1.2921,
				Longitude: 36.8219,
			},
			Timestamp:      time.Now(),
			Results:        copyResults(results),
			SubmissionType: "image_ocr",
			Confidence:     0.95,
		}

		err := storageService.StoreSubmission(submission)
		require.NoError(t, err)
	}

	// Process consensus without WebSocket service - should still work
	consensusResult, err := consensusService.ProcessConsensus(pollingStationID)
	require.NoError(t, err)

	// Verify consensus was reached
	assert.Equal(t, "Verified", consensusResult.Status)
	assert.NotNil(t, consensusResult.VerifiedResults)
	assert.Greater(t, consensusResult.ConfidenceLevel, 0.0)

	// Should work fine without WebSocket service
}

// Helper functions for testing

func generateSubmissionID() string {
	return "sub-" + time.Now().Format("20060102150405") + "-" + randomString(6)
}

func generateWalletAddress(index int) string {
	return "wallet-address-" + string(rune('a'+index)) + randomString(8)
}

func copyResults(original map[string]int) map[string]int {
	copy := make(map[string]int)
	for k, v := range original {
		copy[k] = v
	}
	return copy
}