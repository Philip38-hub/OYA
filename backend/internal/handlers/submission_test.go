package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"

	"oyah-backend/internal/models"
	"oyah-backend/internal/services"
)

func setupTestHandler() (*SubmissionHandler, *gin.Engine) {
	// Create test services
	storageService := services.NewStorageService()
	validationService := services.NewValidationService()
	
	// Create test logger (silent for tests)
	logger := logrus.New()
	logger.SetLevel(logrus.PanicLevel) // Only log panics during tests

	// Create consensus service
	consensusService := services.NewConsensusService(storageService, logger)

	// Create handler
	handler := NewSubmissionHandler(storageService, validationService, consensusService, logger)

	// Setup Gin router
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.POST("/api/v1/submitResult", handler.SubmitResult)

	return handler, router
}

func TestSubmissionHandler_SubmitResult_Success(t *testing.T) {
	_, router := setupTestHandler()

	// Create valid submission request
	submission := models.SubmissionRequest{
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

	// Convert to JSON
	jsonData, err := json.Marshal(submission)
	if err != nil {
		t.Fatalf("Failed to marshal JSON: %v", err)
	}

	// Create request
	req, err := http.NewRequest("POST", "/api/v1/submitResult", bytes.NewBuffer(jsonData))
	if err != nil {
		t.Fatalf("Failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")

	// Create response recorder
	w := httptest.NewRecorder()

	// Perform request
	router.ServeHTTP(w, req)

	// Check response
	if w.Code != http.StatusOK {
		t.Errorf("Expected status code %d, got %d", http.StatusOK, w.Code)
	}

	// Parse response
	var response map[string]interface{}
	err = json.Unmarshal(w.Body.Bytes(), &response)
	if err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	// Verify response structure
	if success, ok := response["success"].(bool); !ok || !success {
		t.Error("Expected success to be true")
	}

	if _, ok := response["submission_id"].(string); !ok {
		t.Error("Expected submission_id in response")
	}

	if message, ok := response["message"].(string); !ok || message == "" {
		t.Error("Expected message in response")
	}

	// Verify consensus information is included
	if consensus, ok := response["consensus"].(map[string]interface{}); ok {
		if status, ok := consensus["status"].(string); !ok || status == "" {
			t.Error("Expected consensus status in response")
		}
	}
}

func TestSubmissionHandler_SubmitResult_InvalidJSON(t *testing.T) {
	_, router := setupTestHandler()

	// Create invalid JSON
	invalidJSON := `{"invalid": json}`

	// Create request
	req, err := http.NewRequest("POST", "/api/v1/submitResult", bytes.NewBufferString(invalidJSON))
	if err != nil {
		t.Fatalf("Failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")

	// Create response recorder
	w := httptest.NewRecorder()

	// Perform request
	router.ServeHTTP(w, req)

	// Check response
	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status code %d, got %d", http.StatusBadRequest, w.Code)
	}

	// Parse response
	var response models.ErrorResponse
	err = json.Unmarshal(w.Body.Bytes(), &response)
	if err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	// Verify error response
	if response.Code != "INVALID_JSON" {
		t.Errorf("Expected error code 'INVALID_JSON', got %s", response.Code)
	}
}

func TestSubmissionHandler_SubmitResult_ValidationError(t *testing.T) {
	_, router := setupTestHandler()

	// Create submission with invalid wallet address
	submission := models.SubmissionRequest{
		WalletAddress:    "invalid_wallet_address",
		PollingStationID: "STATION_001",
		GPSCoordinates: models.GPSCoordinates{
			Latitude:  40.7128,
			Longitude: -74.0060,
		},
		Timestamp: time.Now().Add(-1 * time.Hour),
		Results: map[string]int{
			"Candidate A": 100,
			"Candidate B": 150,
		},
		SubmissionType: "image_ocr",
		Confidence:     0.85,
	}

	// Convert to JSON
	jsonData, err := json.Marshal(submission)
	if err != nil {
		t.Fatalf("Failed to marshal JSON: %v", err)
	}

	// Create request
	req, err := http.NewRequest("POST", "/api/v1/submitResult", bytes.NewBuffer(jsonData))
	if err != nil {
		t.Fatalf("Failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")

	// Create response recorder
	w := httptest.NewRecorder()

	// Perform request
	router.ServeHTTP(w, req)

	// Check response
	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status code %d, got %d", http.StatusBadRequest, w.Code)
	}

	// Parse response
	var response models.ErrorResponse
	err = json.Unmarshal(w.Body.Bytes(), &response)
	if err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	// Verify error response
	if response.Code != "VALIDATION_ERROR" {
		t.Errorf("Expected error code 'VALIDATION_ERROR', got %s", response.Code)
	}
}

func TestSubmissionHandler_SubmitResult_MissingRequiredFields(t *testing.T) {
	_, router := setupTestHandler()

	// Create submission missing required fields
	submission := map[string]interface{}{
		"walletAddress": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
		// Missing pollingStationId, gpsCoordinates, timestamp, results, submissionType
	}

	// Convert to JSON
	jsonData, err := json.Marshal(submission)
	if err != nil {
		t.Fatalf("Failed to marshal JSON: %v", err)
	}

	// Create request
	req, err := http.NewRequest("POST", "/api/v1/submitResult", bytes.NewBuffer(jsonData))
	if err != nil {
		t.Fatalf("Failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")

	// Create response recorder
	w := httptest.NewRecorder()

	// Perform request
	router.ServeHTTP(w, req)

	// Check response
	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status code %d, got %d", http.StatusBadRequest, w.Code)
	}

	// Parse response
	var response models.ErrorResponse
	err = json.Unmarshal(w.Body.Bytes(), &response)
	if err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	// Verify error response
	if response.Code != "INVALID_JSON" {
		t.Errorf("Expected error code 'INVALID_JSON', got %s", response.Code)
	}
}

func TestSubmissionHandler_SubmitResult_DuplicateSubmission(t *testing.T) {
	handler, router := setupTestHandler()

	// Create valid submission request
	submission := models.SubmissionRequest{
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
		},
		SubmissionType: "image_ocr",
		Confidence:     0.85,
	}

	// Convert to JSON
	jsonData, err := json.Marshal(submission)
	if err != nil {
		t.Fatalf("Failed to marshal JSON: %v", err)
	}

	// Submit first time
	req1, _ := http.NewRequest("POST", "/api/v1/submitResult", bytes.NewBuffer(jsonData))
	req1.Header.Set("Content-Type", "application/json")
	w1 := httptest.NewRecorder()
	router.ServeHTTP(w1, req1)

	if w1.Code != http.StatusOK {
		t.Errorf("First submission failed with status %d", w1.Code)
	}

	// Submit second time (should replace first)
	submission.Results["Candidate A"] = 120 // Different results
	jsonData2, _ := json.Marshal(submission)
	req2, _ := http.NewRequest("POST", "/api/v1/submitResult", bytes.NewBuffer(jsonData2))
	req2.Header.Set("Content-Type", "application/json")
	w2 := httptest.NewRecorder()
	router.ServeHTTP(w2, req2)

	if w2.Code != http.StatusOK {
		t.Errorf("Second submission failed with status %d", w2.Code)
	}

	// Verify only one submission exists in storage
	submissions := handler.storageService.GetSubmissionsByStation("STATION_001")
	if len(submissions) != 1 {
		t.Errorf("Expected 1 submission after duplicate, got %d", len(submissions))
	}

	// Verify it's the latest submission
	if submissions[0].Results["Candidate A"] != 120 {
		t.Errorf("Expected latest submission results, got %d", submissions[0].Results["Candidate A"])
	}
}