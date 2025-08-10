package services

import (
	"fmt"
	"testing"
	"time"

	"oyah-backend/internal/models"
)

func TestStorageService_StoreSubmission(t *testing.T) {
	storage := NewStorageService()

	submission1 := models.Submission{
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

	// Test storing first submission
	err := storage.StoreSubmission(submission1)
	if err != nil {
		t.Errorf("StoreSubmission() error = %v", err)
	}

	// Verify submission was stored
	submissions := storage.GetSubmissionsByStation("STATION_001")
	if len(submissions) != 1 {
		t.Errorf("Expected 1 submission, got %d", len(submissions))
	}

	// Verify polling station was created
	station, err := storage.GetPollingStation("STATION_001")
	if err != nil {
		t.Errorf("GetPollingStation() error = %v", err)
	}
	if station.Status != "Pending" {
		t.Errorf("Expected status 'Pending', got %s", station.Status)
	}
}

func TestStorageService_DuplicateSubmissionPrevention(t *testing.T) {
	storage := NewStorageService()

	// First submission
	submission1 := models.Submission{
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

	// Second submission from same wallet for same station (should replace first)
	submission2 := models.Submission{
		ID:               "sub2",
		WalletAddress:    "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
		PollingStationID: "STATION_001",
		GPSCoordinates: models.GPSCoordinates{
			Latitude:  40.7128,
			Longitude: -74.0060,
		},
		Timestamp: time.Now().Add(1 * time.Minute),
		Results: map[string]int{
			"Candidate A": 120,
			"Candidate B": 130,
		},
		SubmissionType: "audio_stt",
		Confidence:     0.90,
	}

	// Store first submission
	err := storage.StoreSubmission(submission1)
	if err != nil {
		t.Errorf("StoreSubmission() error = %v", err)
	}

	// Store second submission (should replace first)
	err = storage.StoreSubmission(submission2)
	if err != nil {
		t.Errorf("StoreSubmission() error = %v", err)
	}

	// Verify only one submission exists (the latest one)
	submissions := storage.GetSubmissionsByStation("STATION_001")
	if len(submissions) != 1 {
		t.Errorf("Expected 1 submission after duplicate, got %d", len(submissions))
	}

	// Verify it's the second submission
	if submissions[0].ID != "sub2" {
		t.Errorf("Expected submission ID 'sub2', got %s", submissions[0].ID)
	}
	if submissions[0].SubmissionType != "audio_stt" {
		t.Errorf("Expected submission type 'audio_stt', got %s", submissions[0].SubmissionType)
	}
}

func TestStorageService_MultipleWalletsForSameStation(t *testing.T) {
	storage := NewStorageService()

	// Submission from first wallet
	submission1 := models.Submission{
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

	// Submission from second wallet for same station
	submission2 := models.Submission{
		ID:               "sub2",
		WalletAddress:    "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty",
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
		Confidence:     0.90,
	}

	// Store both submissions
	err := storage.StoreSubmission(submission1)
	if err != nil {
		t.Errorf("StoreSubmission() error = %v", err)
	}

	err = storage.StoreSubmission(submission2)
	if err != nil {
		t.Errorf("StoreSubmission() error = %v", err)
	}

	// Verify both submissions exist
	submissions := storage.GetSubmissionsByStation("STATION_001")
	if len(submissions) != 2 {
		t.Errorf("Expected 2 submissions from different wallets, got %d", len(submissions))
	}
}

func TestStorageService_UpdatePollingStationStatus(t *testing.T) {
	storage := NewStorageService()

	// Create a polling station first
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

	err := storage.StoreSubmission(submission)
	if err != nil {
		t.Errorf("StoreSubmission() error = %v", err)
	}

	// Update status to verified
	verifiedResults := map[string]int{
		"Candidate A": 100,
		"Candidate B": 150,
	}

	err = storage.UpdatePollingStationStatus("STATION_001", "Verified", verifiedResults, 0.95)
	if err != nil {
		t.Errorf("UpdatePollingStationStatus() error = %v", err)
	}

	// Verify status was updated
	station, err := storage.GetPollingStation("STATION_001")
	if err != nil {
		t.Errorf("GetPollingStation() error = %v", err)
	}

	if station.Status != "Verified" {
		t.Errorf("Expected status 'Verified', got %s", station.Status)
	}

	if station.ConfidenceLevel != 0.95 {
		t.Errorf("Expected confidence level 0.95, got %f", station.ConfidenceLevel)
	}

	if station.VerifiedResults["Candidate A"] != 100 {
		t.Errorf("Expected Candidate A votes 100, got %d", station.VerifiedResults["Candidate A"])
	}

	if station.ConsensusReached == nil {
		t.Error("Expected ConsensusReached to be set")
	}
}

func TestStorageService_GetNonExistentPollingStation(t *testing.T) {
	storage := NewStorageService()

	_, err := storage.GetPollingStation("NON_EXISTENT")
	if err == nil {
		t.Error("Expected error for non-existent polling station")
	}
}

func TestStorageService_GetAllPollingStations(t *testing.T) {
	storage := NewStorageService()

	// Create submissions for multiple stations
	stations := []string{"STATION_001", "STATION_002", "STATION_003"}
	
	for i, stationID := range stations {
		submission := models.Submission{
			ID:               fmt.Sprintf("sub%d", i+1),
			WalletAddress:    "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
			PollingStationID: stationID,
			GPSCoordinates: models.GPSCoordinates{
				Latitude:  40.7128,
				Longitude: -74.0060,
			},
			Timestamp: time.Now(),
			Results: map[string]int{
				"Candidate A": 100 + i*10,
				"Candidate B": 150 + i*10,
			},
			SubmissionType: "image_ocr",
			Confidence:     0.85,
		}

		err := storage.StoreSubmission(submission)
		if err != nil {
			t.Errorf("StoreSubmission() error = %v", err)
		}
	}

	// Get all polling stations
	allStations := storage.GetAllPollingStations()
	
	if len(allStations) != 3 {
		t.Errorf("Expected 3 polling stations, got %d", len(allStations))
	}

	// Verify all stations exist
	for _, stationID := range stations {
		if _, exists := allStations[stationID]; !exists {
			t.Errorf("Expected station %s to exist", stationID)
		}
	}
}