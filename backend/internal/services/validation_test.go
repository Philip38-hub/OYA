package services

import (
	"testing"
	"time"

	"oyah-backend/internal/models"
)

func TestValidationService_ValidateWalletAddress(t *testing.T) {
	validator := NewValidationService(nil)

	tests := []struct {
		name    string
		address string
		wantErr bool
	}{
		{
			name:    "valid SS58 address",
			address: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
			wantErr: false,
		},
		{
			name:    "empty address",
			address: "",
			wantErr: true,
		},
		{
			name:    "too short address",
			address: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNo",
			wantErr: true,
		},
		{
			name:    "invalid characters",
			address: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQ0",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validator.validateWalletAddress(tt.address)
			if (err != nil) != tt.wantErr {
				t.Errorf("validateWalletAddress() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestValidationService_ValidatePollingStationID(t *testing.T) {
	validator := NewValidationService(nil)

	tests := []struct {
		name      string
		stationID string
		wantErr   bool
	}{
		{
			name:      "valid station ID",
			stationID: "STATION_001",
			wantErr:   false,
		},
		{
			name:      "valid station ID with hyphens",
			stationID: "STATION-001-A",
			wantErr:   false,
		},
		{
			name:      "empty station ID",
			stationID: "",
			wantErr:   true,
		},
		{
			name:      "too short station ID",
			stationID: "AB",
			wantErr:   true,
		},
		{
			name:      "too long station ID",
			stationID: "STATION_001_VERY_LONG_NAME_THAT_EXCEEDS_FIFTY_CHARACTERS",
			wantErr:   true,
		},
		{
			name:      "invalid characters",
			stationID: "STATION@001",
			wantErr:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validator.validatePollingStationID(tt.stationID)
			if (err != nil) != tt.wantErr {
				t.Errorf("validatePollingStationID() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestValidationService_ValidateGPSCoordinates(t *testing.T) {
	validator := NewValidationService(nil)

	tests := []struct {
		name   string
		coords models.GPSCoordinates
		wantErr bool
	}{
		{
			name:   "valid coordinates",
			coords: models.GPSCoordinates{Latitude: 40.7128, Longitude: -74.0060},
			wantErr: false,
		},
		{
			name:   "latitude too high",
			coords: models.GPSCoordinates{Latitude: 91.0, Longitude: -74.0060},
			wantErr: true,
		},
		{
			name:   "latitude too low",
			coords: models.GPSCoordinates{Latitude: -91.0, Longitude: -74.0060},
			wantErr: true,
		},
		{
			name:   "longitude too high",
			coords: models.GPSCoordinates{Latitude: 40.7128, Longitude: 181.0},
			wantErr: true,
		},
		{
			name:   "longitude too low",
			coords: models.GPSCoordinates{Latitude: 40.7128, Longitude: -181.0},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validator.validateGPSCoordinates(tt.coords)
			if (err != nil) != tt.wantErr {
				t.Errorf("validateGPSCoordinates() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestValidationService_ValidateTimestamp(t *testing.T) {
	validator := NewValidationService(nil)

	now := time.Now()

	tests := []struct {
		name      string
		timestamp time.Time
		wantErr   bool
	}{
		{
			name:      "current time",
			timestamp: now,
			wantErr:   false,
		},
		{
			name:      "1 hour ago",
			timestamp: now.Add(-1 * time.Hour),
			wantErr:   false,
		},
		{
			name:      "future time (beyond tolerance)",
			timestamp: now.Add(10 * time.Minute),
			wantErr:   true,
		},
		{
			name:      "too old (9 hours ago)",
			timestamp: now.Add(-9 * time.Hour),
			wantErr:   true,
		},
		{
			name:      "within tolerance (4 minutes future)",
			timestamp: now.Add(4 * time.Minute),
			wantErr:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validator.validateTimestamp(tt.timestamp)
			if (err != nil) != tt.wantErr {
				t.Errorf("validateTimestamp() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestValidationService_ValidateResults(t *testing.T) {
	validator := NewValidationService(nil)

	tests := []struct {
		name    string
		results map[string]int
		wantErr bool
	}{
		{
			name: "valid results",
			results: map[string]int{
				"Candidate A": 100,
				"Candidate B": 150,
				"spoilt":      5,
			},
			wantErr: false,
		},
		{
			name:    "empty results",
			results: map[string]int{},
			wantErr: true,
		},
		{
			name: "negative votes",
			results: map[string]int{
				"Candidate A": -10,
				"Candidate B": 150,
			},
			wantErr: true,
		},
		{
			name: "empty candidate name",
			results: map[string]int{
				"":           100,
				"Candidate B": 150,
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validator.validateResults(tt.results)
			if (err != nil) != tt.wantErr {
				t.Errorf("validateResults() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestValidationService_ValidateSubmissionType(t *testing.T) {
	validator := NewValidationService(nil)

	tests := []struct {
		name           string
		submissionType string
		wantErr        bool
	}{
		{
			name:           "valid image_ocr type",
			submissionType: "image_ocr",
			wantErr:        false,
		},
		{
			name:           "valid audio_stt type",
			submissionType: "audio_stt",
			wantErr:        false,
		},
		{
			name:           "invalid type",
			submissionType: "invalid_type",
			wantErr:        true,
		},
		{
			name:           "empty type",
			submissionType: "",
			wantErr:        true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validator.validateSubmissionType(tt.submissionType)
			if (err != nil) != tt.wantErr {
				t.Errorf("validateSubmissionType() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestValidationService_ValidateConfidence(t *testing.T) {
	validator := NewValidationService(nil)

	tests := []struct {
		name       string
		confidence float64
		wantErr    bool
	}{
		{
			name:       "valid confidence 0.5",
			confidence: 0.5,
			wantErr:    false,
		},
		{
			name:       "valid confidence 0.0",
			confidence: 0.0,
			wantErr:    false,
		},
		{
			name:       "valid confidence 1.0",
			confidence: 1.0,
			wantErr:    false,
		},
		{
			name:       "invalid confidence negative",
			confidence: -0.1,
			wantErr:    true,
		},
		{
			name:       "invalid confidence greater than 1",
			confidence: 1.1,
			wantErr:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validator.validateConfidence(tt.confidence)
			if (err != nil) != tt.wantErr {
				t.Errorf("validateConfidence() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestValidationService_ValidateSubmission(t *testing.T) {
	validator := NewValidationService(nil)

	validSubmission := models.SubmissionRequest{
		WalletAddress:    "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
		PollingStationID: "STATION_001",
		GPSCoordinates: models.GPSCoordinates{
			Latitude:  40.7128,
			Longitude: -74.0060,
		},
		Timestamp: time.Now().Add(-1 * time.Hour),
		Results: map[string]int{
			"Candidate A": 100,
			"Candidate B": 150,
			"spoilt":      5,
		},
		SubmissionType: "image_ocr",
		Confidence:     0.85,
	}

	tests := []struct {
		name        string
		submission  models.SubmissionRequest
		wantErr     bool
		description string
	}{
		{
			name:        "valid submission",
			submission:  validSubmission,
			wantErr:     false,
			description: "should pass validation for valid submission",
		},
		{
			name: "invalid wallet address",
			submission: func() models.SubmissionRequest {
				s := validSubmission
				s.WalletAddress = "invalid_address"
				return s
			}(),
			wantErr:     true,
			description: "should fail validation for invalid wallet address",
		},
		{
			name: "invalid GPS coordinates",
			submission: func() models.SubmissionRequest {
				s := validSubmission
				s.GPSCoordinates.Latitude = 100.0
				return s
			}(),
			wantErr:     true,
			description: "should fail validation for invalid GPS coordinates",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validator.ValidateSubmission(tt.submission)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateSubmission() error = %v, wantErr %v - %s", err, tt.wantErr, tt.description)
			}
		})
	}
}

func TestValidationService_ValidatePollingStationInActiveVotingProcess(t *testing.T) {
	// Create storage service and add a voting process
	storage := NewStorageService()
	
	// Create a voting process
	votingProcess := models.VotingProcess{
		ID:       "vp-test",
		Title:    "Test Election",
		Position: "Mayor",
		Candidates: []models.Candidate{
			{ID: "c1", Name: "Candidate 1"},
		},
		PollingStations: []string{"STATION_001", "STATION_002"},
		Status:          "Setup",
	}
	
	err := storage.StoreVotingProcess(votingProcess)
	if err != nil {
		t.Fatalf("Failed to store voting process: %v", err)
	}

	validator := NewValidationService(storage)

	tests := []struct {
		name      string
		stationID string
		setup     func()
		wantErr   bool
	}{
		{
			name:      "station not in active voting process (Setup status)",
			stationID: "STATION_001",
			setup:     func() {}, // voting process is in Setup status
			wantErr:   true,
		},
		{
			name:      "station in active voting process",
			stationID: "STATION_001",
			setup: func() {
				// Activate the voting process
				storage.UpdateVotingProcessStatus("vp-test", "Active")
			},
			wantErr: false,
		},
		{
			name:      "station not in any voting process",
			stationID: "STATION_999",
			setup:     func() {}, // station doesn't exist in any voting process
			wantErr:   true,
		},
		{
			name:      "station in completed voting process",
			stationID: "STATION_002",
			setup: func() {
				// Complete the voting process
				storage.UpdateVotingProcessStatus("vp-test", "Complete")
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.setup()
			err := validator.validatePollingStationInActiveVotingProcess(tt.stationID)
			if (err != nil) != tt.wantErr {
				t.Errorf("validatePollingStationInActiveVotingProcess() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestValidationService_ValidateSubmissionWithVotingProcess(t *testing.T) {
	// Create storage service and add a voting process
	storage := NewStorageService()
	
	// Create and store an active voting process
	votingProcess := models.VotingProcess{
		ID:       "vp-integration-test",
		Title:    "Integration Test Election",
		Position: "President",
		Candidates: []models.Candidate{
			{ID: "c1", Name: "Alice"},
			{ID: "c2", Name: "Bob"},
		},
		PollingStations: []string{"STATION_ACTIVE"},
		Status:          "Setup",
	}
	
	err := storage.StoreVotingProcess(votingProcess)
	if err != nil {
		t.Fatalf("Failed to store voting process: %v", err)
	}
	
	// Activate the voting process
	err = storage.UpdateVotingProcessStatus("vp-integration-test", "Active")
	if err != nil {
		t.Fatalf("Failed to activate voting process: %v", err)
	}

	validator := NewValidationService(storage)

	validSubmission := models.SubmissionRequest{
		WalletAddress:    "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
		PollingStationID: "STATION_ACTIVE",
		GPSCoordinates: models.GPSCoordinates{
			Latitude:  40.7128,
			Longitude: -74.0060,
		},
		Timestamp: time.Now().Add(-1 * time.Hour),
		Results: map[string]int{
			"Alice": 100,
			"Bob":   150,
		},
		SubmissionType: "image_ocr",
		Confidence:     0.85,
	}

	tests := []struct {
		name        string
		submission  models.SubmissionRequest
		wantErr     bool
		description string
	}{
		{
			name:        "valid submission to active voting process",
			submission:  validSubmission,
			wantErr:     false,
			description: "should pass validation for submission to active voting process",
		},
		{
			name: "submission to inactive polling station",
			submission: func() models.SubmissionRequest {
				s := validSubmission
				s.PollingStationID = "STATION_INACTIVE"
				return s
			}(),
			wantErr:     true,
			description: "should fail validation for submission to inactive polling station",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validator.ValidateSubmission(tt.submission)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateSubmission() error = %v, wantErr %v - %s", err, tt.wantErr, tt.description)
			}
		})
	}
}