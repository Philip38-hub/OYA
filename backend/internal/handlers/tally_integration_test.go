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
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"oyah-backend/internal/models"
	"oyah-backend/internal/services"
)

func TestTallyIntegration_CompleteFlow(t *testing.T) {
	// Set Gin to test mode
	gin.SetMode(gin.TestMode)

	// Initialize services
	storage := services.NewStorageService()
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel) // Reduce noise in tests
	
	validationService := services.NewValidationService(storage)
	consensusService := services.NewConsensusService(storage, logger)
	consensusRecoveryService := services.NewConsensusRecoveryService(storage, consensusService, logger)
	tallyService := services.NewTallyService(storage, logger)
	errorHandler := services.NewErrorHandler(logger)

	// Initialize handlers
	submissionHandler := NewSubmissionHandler(storage, validationService, consensusService, consensusRecoveryService, errorHandler, logger)
	votingProcessHandler := NewVotingProcessHandler(storage, logger)
	tallyHandler := NewTallyHandler(tallyService, errorHandler, logger)

	// Create router
	router := gin.New()
	v1 := router.Group("/api/v1")
	{
		v1.POST("/voting-process", votingProcessHandler.CreateVotingProcess)
		v1.PUT("/voting-process/:id/start", votingProcessHandler.StartVotingProcess)
		v1.POST("/submitResult", submissionHandler.SubmitResult)
		v1.GET("/getTally/:votingProcessId", tallyHandler.GetTally)
	}

	// Step 1: Create a voting process
	votingProcessReq := models.VotingProcessRequest{
		Title:    "Integration Test Election",
		Position: "President",
		Candidates: []models.Candidate{
			{ID: "candidate-1", Name: "Alice Johnson"},
			{ID: "candidate-2", Name: "Bob Smith"},
		},
		PollingStations: []string{"station-1", "station-2"},
	}

	reqBody, err := json.Marshal(votingProcessReq)
	require.NoError(t, err)

	req, err := http.NewRequest("POST", "/api/v1/voting-process", bytes.NewBuffer(reqBody))
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusCreated, w.Code)

	// Parse voting process creation response
	var createResponse struct {
		Success       bool                  `json:"success"`
		VotingProcess models.VotingProcess  `json:"voting_process"`
		Message       string                `json:"message"`
	}
	err = json.Unmarshal(w.Body.Bytes(), &createResponse)
	require.NoError(t, err)
	require.True(t, createResponse.Success)

	votingProcessID := createResponse.VotingProcess.ID

	// Step 2: Start the voting process
	req, err = http.NewRequest("PUT", "/api/v1/voting-process/"+votingProcessID+"/start", nil)
	require.NoError(t, err)

	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	// Step 3: Submit some results to create consensus
	// Using valid SS58 format addresses (Polkadot addresses)
	submissions := []models.SubmissionRequest{
		{
			WalletAddress:    "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY", // Valid SS58 address
			PollingStationID: "station-1",
			GPSCoordinates:   models.GPSCoordinates{Latitude: 1.0, Longitude: 1.0},
			Timestamp:        time.Now(),
			Results: map[string]int{
				"Alice Johnson": 150,
				"Bob Smith":     120,
				"spoilt":        5,
			},
			SubmissionType: "image_ocr",
			Confidence:     0.95,
		},
		{
			WalletAddress:    "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty", // Valid SS58 address
			PollingStationID: "station-1",
			GPSCoordinates:   models.GPSCoordinates{Latitude: 1.0, Longitude: 1.0},
			Timestamp:        time.Now(),
			Results: map[string]int{
				"Alice Johnson": 150,
				"Bob Smith":     120,
				"spoilt":        5,
			},
			SubmissionType: "audio_stt",
			Confidence:     0.90,
		},
		{
			WalletAddress:    "5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y", // Valid SS58 address
			PollingStationID: "station-1",
			GPSCoordinates:   models.GPSCoordinates{Latitude: 1.0, Longitude: 1.0},
			Timestamp:        time.Now(),
			Results: map[string]int{
				"Alice Johnson": 150,
				"Bob Smith":     120,
				"spoilt":        5,
			},
			SubmissionType: "image_ocr",
			Confidence:     0.88,
		},
	}

	// Submit all three submissions to reach consensus
	for _, submission := range submissions {
		reqBody, err := json.Marshal(submission)
		require.NoError(t, err)

		req, err := http.NewRequest("POST", "/api/v1/submitResult", bytes.NewBuffer(reqBody))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		assert.Equal(t, http.StatusOK, w.Code)
	}

	// Step 4: Get tally data
	req, err = http.NewRequest("GET", "/api/v1/getTally/"+votingProcessID, nil)
	require.NoError(t, err)

	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	// Parse tally response
	var tallyResponse services.TallyResponse
	err = json.Unmarshal(w.Body.Bytes(), &tallyResponse)
	require.NoError(t, err)

	// Verify voting process info
	assert.Equal(t, votingProcessID, tallyResponse.VotingProcess.ID)
	assert.Equal(t, "Integration Test Election", tallyResponse.VotingProcess.Title)
	assert.Equal(t, "President", tallyResponse.VotingProcess.Position)
	assert.Equal(t, "Active", tallyResponse.VotingProcess.Status)

	// Verify aggregated tally (station-1 should be verified, station-2 should be pending)
	expectedTally := map[string]int{
		"Alice Johnson": 150, // Only from verified station-1
		"Bob Smith":     120, // Only from verified station-1
		"spoilt":        5,   // Only from verified station-1
	}
	assert.Equal(t, expectedTally, tallyResponse.AggregatedTally)

	// Verify polling stations
	assert.Len(t, tallyResponse.PollingStations, 2)

	// Find stations in response
	var station1, station2 *services.StationStatus
	for i := range tallyResponse.PollingStations {
		if tallyResponse.PollingStations[i].ID == "station-1" {
			station1 = &tallyResponse.PollingStations[i]
		} else if tallyResponse.PollingStations[i].ID == "station-2" {
			station2 = &tallyResponse.PollingStations[i]
		}
	}

	// Verify station-1 is verified with results
	require.NotNil(t, station1)
	assert.Equal(t, "Verified", station1.Status)
	assert.NotNil(t, station1.Results)
	assert.Equal(t, expectedTally, station1.Results)
	assert.Greater(t, station1.Confidence, 0.0)

	// Verify station-2 is pending with no results
	require.NotNil(t, station2)
	assert.Equal(t, "Pending", station2.Status)
	assert.Nil(t, station2.Results)
	assert.Equal(t, 0.0, station2.Confidence)

	// Verify timestamp is recent
	assert.WithinDuration(t, time.Now(), tallyResponse.LastUpdated, time.Second)
}

func TestTallyIntegration_ErrorHandling(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Initialize services
	storage := services.NewStorageService()
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	tallyService := services.NewTallyService(storage, logger)
	errorHandler := services.NewErrorHandler(logger)
	tallyHandler := NewTallyHandler(tallyService, errorHandler, logger)

	// Create router
	router := gin.New()
	router.GET("/api/v1/getTally/:votingProcessId", tallyHandler.GetTally)

	// Test 1: Non-existent voting process
	req, err := http.NewRequest("GET", "/api/v1/getTally/non-existent", nil)
	require.NoError(t, err)

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)

	var errorResponse models.ErrorResponse
	err = json.Unmarshal(w.Body.Bytes(), &errorResponse)
	require.NoError(t, err)

	assert.Equal(t, "voting process not found", errorResponse.Error)
	assert.Equal(t, "NOT_FOUND", errorResponse.Code)

	// Test 2: Empty voting process ID (should result in 404 from router)
	req, err = http.NewRequest("GET", "/api/v1/getTally/", nil)
	require.NoError(t, err)

	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}