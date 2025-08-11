package handlers

import (
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

func TestTallyHandler_GetTally_Success(t *testing.T) {
	// Set Gin to test mode
	gin.SetMode(gin.TestMode)

	// Initialize services
	storage := services.NewStorageService()
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel) // Reduce noise in tests
	tallyService := services.NewTallyService(storage, logger)
	errorHandler := services.NewErrorHandler(logger)
	tallyHandler := NewTallyHandler(tallyService, errorHandler, logger)

	// Create test voting process
	votingProcess := models.VotingProcess{
		ID:       "test-process-1",
		Title:    "Test Election",
		Position: "President",
		Candidates: []models.Candidate{
			{ID: "candidate-1", Name: "Alice Johnson"},
			{ID: "candidate-2", Name: "Bob Smith"},
		},
		PollingStations: []string{"station-1", "station-2"},
		Status:          "Active",
		CreatedAt:       time.Now(),
	}

	// Store voting process (this will automatically create polling stations)
	err := storage.StoreVotingProcess(votingProcess)
	require.NoError(t, err)

	// Update station statuses with test data
	verifiedResults := map[string]int{
		"Alice Johnson": 150,
		"Bob Smith":     120,
		"spoilt":        5,
	}
	
	err = storage.UpdatePollingStationStatus("station-1", "Verified", verifiedResults, 0.85)
	require.NoError(t, err)
	
	err = storage.UpdatePollingStationStatus("station-2", "Pending", nil, 0.0)
	require.NoError(t, err)

	// Create test request
	router := gin.New()
	router.GET("/api/v1/getTally/:votingProcessId", tallyHandler.GetTally)

	req, err := http.NewRequest("GET", "/api/v1/getTally/test-process-1", nil)
	require.NoError(t, err)

	// Create response recorder
	w := httptest.NewRecorder()

	// Perform request
	router.ServeHTTP(w, req)

	// Assert response
	assert.Equal(t, http.StatusOK, w.Code)

	// Parse response
	var response services.TallyResponse
	err = json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)

	// Verify voting process info
	assert.Equal(t, "test-process-1", response.VotingProcess.ID)
	assert.Equal(t, "Test Election", response.VotingProcess.Title)
	assert.Equal(t, "President", response.VotingProcess.Position)
	assert.Equal(t, "Active", response.VotingProcess.Status)
	assert.Len(t, response.VotingProcess.Candidates, 2)

	// Verify aggregated tally (only verified station should be included)
	expectedTally := map[string]int{
		"Alice Johnson": 150,
		"Bob Smith":     120,
		"spoilt":        5,
	}
	assert.Equal(t, expectedTally, response.AggregatedTally)

	// Verify polling stations
	assert.Len(t, response.PollingStations, 2)

	// Find stations in response
	var verifiedStation, pendingStation *services.StationStatus
	for i := range response.PollingStations {
		if response.PollingStations[i].ID == "station-1" {
			verifiedStation = &response.PollingStations[i]
		} else if response.PollingStations[i].ID == "station-2" {
			pendingStation = &response.PollingStations[i]
		}
	}

	// Verify verified station
	require.NotNil(t, verifiedStation)
	assert.Equal(t, "Verified", verifiedStation.Status)
	assert.NotNil(t, verifiedStation.Results)
	assert.Equal(t, 0.85, verifiedStation.Confidence)

	// Verify pending station
	require.NotNil(t, pendingStation)
	assert.Equal(t, "Pending", pendingStation.Status)
	assert.Nil(t, pendingStation.Results)
	assert.Equal(t, 0.0, pendingStation.Confidence)

	// Verify timestamp is recent
	assert.WithinDuration(t, time.Now(), response.LastUpdated, time.Second)
}

func TestTallyHandler_GetTally_MissingProcessId(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Initialize services
	storage := services.NewStorageService()
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	tallyService := services.NewTallyService(storage, logger)
	errorHandler := services.NewErrorHandler(logger)
	tallyHandler := NewTallyHandler(tallyService, errorHandler, logger)

	// Create test request with empty process ID
	router := gin.New()
	router.GET("/api/v1/getTally/:votingProcessId", tallyHandler.GetTally)

	req, err := http.NewRequest("GET", "/api/v1/getTally/", nil)
	require.NoError(t, err)

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Should return 404 because the route doesn't match
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestTallyHandler_GetTally_ProcessNotFound(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Initialize services
	storage := services.NewStorageService()
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	tallyService := services.NewTallyService(storage, logger)
	errorHandler := services.NewErrorHandler(logger)
	tallyHandler := NewTallyHandler(tallyService, errorHandler, logger)

	// Create test request with non-existent process ID
	router := gin.New()
	router.GET("/api/v1/getTally/:votingProcessId", tallyHandler.GetTally)

	req, err := http.NewRequest("GET", "/api/v1/getTally/non-existent-process", nil)
	require.NoError(t, err)

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Assert error response
	assert.Equal(t, http.StatusNotFound, w.Code)

	// Parse error response
	var errorResponse models.ErrorResponse
	err = json.Unmarshal(w.Body.Bytes(), &errorResponse)
	require.NoError(t, err)

	assert.Equal(t, "voting process not found", errorResponse.Error)
	assert.Equal(t, "NOT_FOUND", errorResponse.Code)
}

func TestTallyHandler_GetTally_ZeroResults(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Initialize services
	storage := services.NewStorageService()
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	tallyService := services.NewTallyService(storage, logger)
	errorHandler := services.NewErrorHandler(logger)
	tallyHandler := NewTallyHandler(tallyService, errorHandler, logger)

	// Create test voting process with no verified results
	votingProcess := models.VotingProcess{
		ID:       "test-process-zero",
		Title:    "Test Election - No Results",
		Position: "Mayor",
		Candidates: []models.Candidate{
			{ID: "candidate-1", Name: "John Doe"},
			{ID: "candidate-2", Name: "Jane Smith"},
		},
		PollingStations: []string{"station-1"},
		Status:          "Active",
		CreatedAt:       time.Now(),
	}

	err := storage.StoreVotingProcess(votingProcess)
	require.NoError(t, err)

	// Station is already created as "Pending" by StoreVotingProcess, no need to update

	// Create test request
	router := gin.New()
	router.GET("/api/v1/getTally/:votingProcessId", tallyHandler.GetTally)

	req, err := http.NewRequest("GET", "/api/v1/getTally/test-process-zero", nil)
	require.NoError(t, err)

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Assert successful response
	assert.Equal(t, http.StatusOK, w.Code)

	// Parse response
	var response services.TallyResponse
	err = json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)

	// Verify zero results are handled gracefully
	expectedTally := map[string]int{
		"John Doe":   0,
		"Jane Smith": 0,
		"spoilt":     0,
	}
	assert.Equal(t, expectedTally, response.AggregatedTally)
}

func TestTallyHandler_HelperMethods(t *testing.T) {
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	handler := &TallyHandler{logger: logger}

	// Test counting methods
	stations := []services.StationStatus{
		{Status: "Verified"},
		{Status: "Verified"},
		{Status: "Pending"},
		{Status: "Pending"},
		{Status: "Verified"},
	}

	verifiedCount := handler.countVerifiedStations(stations)
	pendingCount := handler.countPendingStations(stations)

	assert.Equal(t, 3, verifiedCount)
	assert.Equal(t, 2, pendingCount)

	// Test sum total votes
	tally := map[string]int{
		"Alice":  150,
		"Bob":    120,
		"Carol":  80,
		"spoilt": 10,
	}

	total := handler.sumTotalVotes(tally)
	assert.Equal(t, 360, total)
}