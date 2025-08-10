package services

import (
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/sirupsen/logrus"

	"oyah-backend/internal/models"
)

func setupConsensusTest() (*ConsensusService, *StorageService) {
	// Create test logger (silent for tests)
	logger := logrus.New()
	logger.SetLevel(logrus.PanicLevel) // Only log panics during tests

	// Create storage service
	storageService := NewStorageService()

	// Create consensus service
	consensusService := NewConsensusService(storageService, logger)

	return consensusService, storageService
}

func TestConsensusService_ProcessConsensus_NoSubmissions(t *testing.T) {
	consensusService, _ := setupConsensusTest()

	// Try to process consensus for non-existent station
	result, err := consensusService.ProcessConsensus("NON_EXISTENT")
	
	if err == nil {
		t.Error("Expected error for non-existent polling station")
	}
	
	if result != nil {
		t.Error("Expected nil result for non-existent polling station")
	}
}

func TestConsensusService_ProcessConsensus_BelowThreshold(t *testing.T) {
	consensusService, storageService := setupConsensusTest()

	// Create and store a single submission (below threshold of 3)
	submission := models.Submission{
		ID:               "sub1",
		WalletAddress:    "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
		PollingStationID: "STATION_001",
		GPSCoordinates: models.GPSCoordinates{
			Latitude:  40.7128,
			Longitude: -74.0060,
		},
		Timestamp: time.Now(),
		Results: map[string]int{
			"Candidate A": 100,
			"Candidate B": 150,
		},
		SubmissionType: "image_ocr",
		Confidence:     0.85,
	}

	err := storageService.StoreSubmission(submission)
	if err != nil {
		t.Fatalf("Failed to store submission: %v", err)
	}

	// Process consensus
	result, err := consensusService.ProcessConsensus("STATION_001")
	if err != nil {
		t.Fatalf("ProcessConsensus failed: %v", err)
	}

	// Verify result
	if result.Status != "Pending" {
		t.Errorf("Expected status 'Pending', got %s", result.Status)
	}

	if result.ConfidenceLevel != 0.0 {
		t.Errorf("Expected confidence level 0.0, got %f", result.ConfidenceLevel)
	}

	// Verify polling station was updated
	station, err := storageService.GetPollingStation("STATION_001")
	if err != nil {
		t.Fatalf("Failed to get polling station: %v", err)
	}

	if station.Status != "Pending" {
		t.Errorf("Expected station status 'Pending', got %s", station.Status)
	}
}

func TestConsensusService_ProcessConsensus_AtThreshold(t *testing.T) {
	consensusService, storageService := setupConsensusTest()

	// Create and store 3 submissions (at threshold)
	wallets := []string{
		"5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
		"5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty",
		"5DAAnrj7VHTznn2AWBemMuyBwZWs6FNFjdyVXUeYum3PTXFy",
	}

	for i, wallet := range wallets {
		submission := models.Submission{
			ID:               fmt.Sprintf("sub%d", i+1),
			WalletAddress:    wallet,
			PollingStationID: "STATION_001",
			GPSCoordinates: models.GPSCoordinates{
				Latitude:  40.7128,
				Longitude: -74.0060,
			},
			Timestamp: time.Now(),
			Results: map[string]int{
				"Candidate A": 100,
				"Candidate B": 150,
			},
			SubmissionType: "image_ocr",
			Confidence:     0.85,
		}

		err := storageService.StoreSubmission(submission)
		if err != nil {
			t.Fatalf("Failed to store submission %d: %v", i+1, err)
		}
	}

	// Process consensus
	result, err := consensusService.ProcessConsensus("STATION_001")
	if err != nil {
		t.Fatalf("ProcessConsensus failed: %v", err)
	}

	// Verify result indicates threshold reached
	if result.Status != "Pending" {
		t.Errorf("Expected status 'Pending' (placeholder implementation), got %s", result.Status)
	}

	// Verify message indicates threshold was reached
	if !contains(result.Message, "threshold reached") {
		t.Errorf("Expected message to indicate threshold reached, got: %s", result.Message)
	}
}

func TestConsensusService_GetConsensusStatus(t *testing.T) {
	consensusService, storageService := setupConsensusTest()

	// Create and store a submission
	submission := models.Submission{
		ID:               "sub1",
		WalletAddress:    "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
		PollingStationID: "STATION_001",
		GPSCoordinates: models.GPSCoordinates{
			Latitude:  40.7128,
			Longitude: -74.0060,
		},
		Timestamp: time.Now(),
		Results: map[string]int{
			"Candidate A": 100,
			"Candidate B": 150,
		},
		SubmissionType: "image_ocr",
		Confidence:     0.85,
	}

	err := storageService.StoreSubmission(submission)
	if err != nil {
		t.Fatalf("Failed to store submission: %v", err)
	}

	// Get consensus status
	result, err := consensusService.GetConsensusStatus("STATION_001")
	if err != nil {
		t.Fatalf("GetConsensusStatus failed: %v", err)
	}

	// Verify result
	if result.Status != "Pending" {
		t.Errorf("Expected status 'Pending', got %s", result.Status)
	}

	if result.Message == "" {
		t.Error("Expected non-empty message")
	}
}

func TestConsensusService_GetConsensusStatus_NonExistent(t *testing.T) {
	consensusService, _ := setupConsensusTest()

	// Try to get status for non-existent station
	result, err := consensusService.GetConsensusStatus("NON_EXISTENT")
	
	if err == nil {
		t.Error("Expected error for non-existent polling station")
	}
	
	if result != nil {
		t.Error("Expected nil result for non-existent polling station")
	}
}

func TestConsensusService_SetConsensusThreshold(t *testing.T) {
	consensusService, _ := setupConsensusTest()

	// Test setting valid threshold
	consensusService.SetConsensusThreshold(5)
	if consensusService.threshold != 5 {
		t.Errorf("Expected threshold 5, got %d", consensusService.threshold)
	}

	// Test setting invalid threshold (should not change)
	originalThreshold := consensusService.threshold
	consensusService.SetConsensusThreshold(0)
	if consensusService.threshold != originalThreshold {
		t.Errorf("Expected threshold to remain %d, got %d", originalThreshold, consensusService.threshold)
	}

	consensusService.SetConsensusThreshold(-1)
	if consensusService.threshold != originalThreshold {
		t.Errorf("Expected threshold to remain %d, got %d", originalThreshold, consensusService.threshold)
	}
}

// Helper function to check if a string contains a substring
func contains(s, substr string) bool {
	return strings.Contains(s, substr)
}