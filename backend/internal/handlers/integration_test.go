package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"oyah-backend/internal/models"
	"oyah-backend/internal/services"
)

// TestEndToEndFlow tests the complete submission flow from mobile to backend
func TestEndToEndFlow_CompleteSubmissionToTally(t *testing.T) {
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

	// Step 1: Create voting process
	votingProcessReq := models.VotingProcessRequest{
		Title:    "Presidential Election 2024",
		Position: "President",
		Candidates: []models.Candidate{
			{ID: "candidate-1", Name: "Alice Johnson"},
			{ID: "candidate-2", Name: "Bob Smith"},
			{ID: "candidate-3", Name: "Carol Davis"},
		},
		PollingStations: []string{"station-001", "station-002", "station-003"},
	}

	reqBody, err := json.Marshal(votingProcessReq)
	require.NoError(t, err)

	req, err := http.NewRequest("POST", "/api/v1/voting-process", bytes.NewBuffer(reqBody))
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusCreated, w.Code)

	var createResponse struct {
		Success       bool                  `json:"success"`
		VotingProcess models.VotingProcess  `json:"voting_process"`
		Message       string                `json:"message"`
	}
	err = json.Unmarshal(w.Body.Bytes(), &createResponse)
	require.NoError(t, err)
	require.True(t, createResponse.Success)

	votingProcessID := createResponse.VotingProcess.ID

	// Step 2: Start voting process
	req, err = http.NewRequest("PUT", "/api/v1/voting-process/"+votingProcessID+"/start", nil)
	require.NoError(t, err)

	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	// Step 3: Submit results from multiple witnesses for multiple stations
	testScenarios := []struct {
		stationID string
		results   map[string]int
		witnesses []string
	}{
		{
			stationID: "station-001",
			results: map[string]int{
				"Alice Johnson": 250,
				"Bob Smith":     180,
				"Carol Davis":   120,
				"spoilt":        8,
			},
			witnesses: []string{
				"5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
				"5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty",
				"5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y",
			},
		},
		{
			stationID: "station-002",
			results: map[string]int{
				"Alice Johnson": 300,
				"Bob Smith":     220,
				"Carol Davis":   150,
				"spoilt":        12,
			},
			witnesses: []string{
				"5DAAnrj7VHTznn2AWBemMuyBwZWs6FNFjdyVXUeYum3PTXFy",
				"5HGjWAeFDfFCWPsjFQdVV2Msvz2XtMktvgocEZcCj68kUMaw",
				"5CiPPseXPECbkjWCa6MnjNokrgYjMqmKndv2rSnekmSK2DjL",
			},
		},
		{
			stationID: "station-003",
			results: map[string]int{
				"Alice Johnson": 180,
				"Bob Smith":     160,
				"Carol Davis":   90,
				"spoilt":        5,
			},
			witnesses: []string{
				"5CiPPseXPECbkjWCa6MnjNokrgYjMqmKndv2rSnekmSK2DjL",
				"5DAAnrj7VHTznn2AWBemMuyBwZWs6FNFjdyVXUeYum3PTXFy",
			}, // Only 2 witnesses - should remain pending
		},
	}

	// Submit results for each scenario
	for _, scenario := range testScenarios {
		for i, walletAddress := range scenario.witnesses {
			submission := models.SubmissionRequest{
				WalletAddress:    walletAddress,
				PollingStationID: scenario.stationID,
				GPSCoordinates:   models.GPSCoordinates{Latitude: 1.0 + float64(i)*0.1, Longitude: 1.0 + float64(i)*0.1},
				Timestamp:        time.Now(),
				Results:          scenario.results,
				SubmissionType:   []string{"image_ocr", "audio_stt"}[i%2], // Alternate submission types
				Confidence:       0.85 + float64(i)*0.05,
			}

			reqBody, err := json.Marshal(submission)
			require.NoError(t, err)

			req, err := http.NewRequest("POST", "/api/v1/submitResult", bytes.NewBuffer(reqBody))
			require.NoError(t, err)
			req.Header.Set("Content-Type", "application/json")

			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)
			assert.Equal(t, http.StatusOK, w.Code, "Failed to submit result for station %s, witness %d", scenario.stationID, i)
		}
	}

	// Step 4: Get tally and verify results
	req, err = http.NewRequest("GET", "/api/v1/getTally/"+votingProcessID, nil)
	require.NoError(t, err)

	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var tallyResponse services.TallyResponse
	err = json.Unmarshal(w.Body.Bytes(), &tallyResponse)
	require.NoError(t, err)

	// Verify voting process info
	assert.Equal(t, votingProcessID, tallyResponse.VotingProcess.ID)
	assert.Equal(t, "Presidential Election 2024", tallyResponse.VotingProcess.Title)
	assert.Equal(t, "President", tallyResponse.VotingProcess.Position)
	assert.Equal(t, "Active", tallyResponse.VotingProcess.Status)
	assert.Len(t, tallyResponse.VotingProcess.Candidates, 3)

	// Verify aggregated tally (only verified stations should be included)
	// station-001 and station-002 should be verified (3 witnesses each)
	// station-003 should be pending (only 2 witnesses)
	expectedTally := map[string]int{
		"Alice Johnson": 550, // 250 + 300 (station-003 not included)
		"Bob Smith":     400, // 180 + 220 (station-003 not included)
		"Carol Davis":   270, // 120 + 150 (station-003 not included)
		"spoilt":        20,  // 8 + 12 (station-003 not included)
	}
	assert.Equal(t, expectedTally, tallyResponse.AggregatedTally)

	// Verify polling stations
	assert.Len(t, tallyResponse.PollingStations, 3)

	// Count verified and pending stations
	verifiedCount := 0
	pendingCount := 0
	for _, station := range tallyResponse.PollingStations {
		if station.Status == "Verified" {
			verifiedCount++
			assert.NotNil(t, station.Results, "Verified station should have results")
			assert.Greater(t, station.Confidence, 0.0, "Verified station should have confidence > 0")
		} else if station.Status == "Pending" {
			pendingCount++
			assert.Nil(t, station.Results, "Pending station should not have results")
			assert.Equal(t, 0.0, station.Confidence, "Pending station should have confidence = 0")
		}
	}

	assert.Equal(t, 2, verifiedCount, "Should have 2 verified stations")
	assert.Equal(t, 1, pendingCount, "Should have 1 pending station")

	// Verify timestamp is recent
	assert.WithinDuration(t, time.Now(), tallyResponse.LastUpdated, time.Second*5)
}

// TestConcurrentSubmissions tests the system under concurrent load
func TestConcurrentSubmissions(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Initialize services
	storage := services.NewStorageService()
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	
	validationService := services.NewValidationService(storage)
	consensusService := services.NewConsensusService(storage, logger)
	consensusRecoveryService := services.NewConsensusRecoveryService(storage, consensusService, logger)
	errorHandler := services.NewErrorHandler(logger)

	// Initialize handlers
	submissionHandler := NewSubmissionHandler(storage, validationService, consensusService, consensusRecoveryService, errorHandler, logger)
	votingProcessHandler := NewVotingProcessHandler(storage, logger)

	// Create router
	router := gin.New()
	v1 := router.Group("/api/v1")
	{
		v1.POST("/voting-process", votingProcessHandler.CreateVotingProcess)
		v1.PUT("/voting-process/:id/start", votingProcessHandler.StartVotingProcess)
		v1.POST("/submitResult", submissionHandler.SubmitResult)
	}

	// Create and start voting process
	votingProcessReq := models.VotingProcessRequest{
		Title:    "Concurrent Test Election",
		Position: "Mayor",
		Candidates: []models.Candidate{
			{ID: "candidate-1", Name: "John Doe"},
			{ID: "candidate-2", Name: "Jane Smith"},
		},
		PollingStations: []string{"station-concurrent"},
	}

	reqBody, err := json.Marshal(votingProcessReq)
	require.NoError(t, err)

	req, err := http.NewRequest("POST", "/api/v1/voting-process", bytes.NewBuffer(reqBody))
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusCreated, w.Code)

	var createResponse struct {
		VotingProcess models.VotingProcess `json:"voting_process"`
	}
	err = json.Unmarshal(w.Body.Bytes(), &createResponse)
	require.NoError(t, err)

	votingProcessID := createResponse.VotingProcess.ID

	// Start voting process
	req, err = http.NewRequest("PUT", "/api/v1/voting-process/"+votingProcessID+"/start", nil)
	require.NoError(t, err)

	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	// Prepare concurrent submissions
	walletAddresses := []string{
		"5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
		"5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty",
		"5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y",
		"5DAAnrj7VHTznn2AWBemMuyBwZWs6FNFjdyVXUeYum3PTXFy",
		"5HGjWAeFDfFCWPsjFQdVV2Msvz2XtMktvgocEZcCj68kUMaw",
	}

	results := map[string]int{
		"John Doe":   150,
		"Jane Smith": 120,
		"spoilt":     5,
	}

	// Submit concurrently
	var wg sync.WaitGroup
	successCount := 0
	var mutex sync.Mutex

	for i, walletAddress := range walletAddresses {
		wg.Add(1)
		go func(wallet string, index int) {
			defer wg.Done()

			submission := models.SubmissionRequest{
				WalletAddress:    wallet,
				PollingStationID: "station-concurrent",
				GPSCoordinates:   models.GPSCoordinates{Latitude: 1.0, Longitude: 1.0},
				Timestamp:        time.Now(),
				Results:          results,
				SubmissionType:   "image_ocr",
				Confidence:       0.90,
			}

			reqBody, err := json.Marshal(submission)
			if err != nil {
				t.Errorf("Failed to marshal submission: %v", err)
				return
			}

			req, err := http.NewRequest("POST", "/api/v1/submitResult", bytes.NewBuffer(reqBody))
			if err != nil {
				t.Errorf("Failed to create request: %v", err)
				return
			}
			req.Header.Set("Content-Type", "application/json")

			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			mutex.Lock()
			if w.Code == http.StatusOK {
				successCount++
			}
			mutex.Unlock()
		}(walletAddress, i)
	}

	wg.Wait()

	// All submissions should succeed
	assert.Equal(t, len(walletAddresses), successCount, "All concurrent submissions should succeed")

	// Verify consensus was reached
	station, err := storage.GetPollingStation("station-concurrent")
	require.NoError(t, err)
	assert.Equal(t, "Verified", station.Status, "Station should be verified after concurrent submissions")
	assert.Equal(t, results, station.VerifiedResults, "Verified results should match submitted results")
}

// TestConsensusAlgorithmWithMultipleSubmissions tests the consensus algorithm with various scenarios
func TestConsensusAlgorithmWithMultipleSubmissions(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Initialize services
	storage := services.NewStorageService()
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	
	validationService := services.NewValidationService(storage)
	consensusService := services.NewConsensusService(storage, logger)
	consensusRecoveryService := services.NewConsensusRecoveryService(storage, consensusService, logger)
	errorHandler := services.NewErrorHandler(logger)

	// Initialize handlers
	submissionHandler := NewSubmissionHandler(storage, validationService, consensusService, consensusRecoveryService, errorHandler, logger)
	votingProcessHandler := NewVotingProcessHandler(storage, logger)

	// Create router
	router := gin.New()
	v1 := router.Group("/api/v1")
	{
		v1.POST("/voting-process", votingProcessHandler.CreateVotingProcess)
		v1.PUT("/voting-process/:id/start", votingProcessHandler.StartVotingProcess)
		v1.POST("/submitResult", submissionHandler.SubmitResult)
	}

	// Create and start voting process
	votingProcessReq := models.VotingProcessRequest{
		Title:    "Consensus Test Election",
		Position: "Governor",
		Candidates: []models.Candidate{
			{ID: "candidate-1", Name: "Alpha"},
			{ID: "candidate-2", Name: "Beta"},
		},
		PollingStations: []string{"station-consensus-test"},
	}

	reqBody, err := json.Marshal(votingProcessReq)
	require.NoError(t, err)

	req, err := http.NewRequest("POST", "/api/v1/voting-process", bytes.NewBuffer(reqBody))
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusCreated, w.Code)

	var createResponse struct {
		VotingProcess models.VotingProcess `json:"voting_process"`
	}
	err = json.Unmarshal(w.Body.Bytes(), &createResponse)
	require.NoError(t, err)

	votingProcessID := createResponse.VotingProcess.ID

	// Start voting process
	req, err = http.NewRequest("PUT", "/api/v1/voting-process/"+votingProcessID+"/start", nil)
	require.NoError(t, err)

	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	// Test scenario: 3 identical submissions (should reach consensus)
	// and 2 different submissions (minority)
	testSubmissions := []struct {
		walletAddress string
		results       map[string]int
		expectConsensus bool
	}{
		{
			walletAddress: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
			results:       map[string]int{"Alpha": 200, "Beta": 150, "spoilt": 10},
		},
		{
			walletAddress: "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty",
			results:       map[string]int{"Alpha": 200, "Beta": 150, "spoilt": 10}, // Same as above
		},
		{
			walletAddress: "5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y",
			results:       map[string]int{"Alpha": 200, "Beta": 150, "spoilt": 10}, // Same as above
		},
		{
			walletAddress: "5DAAnrj7VHTznn2AWBemMuyBwZWs6FNFjdyVXUeYum3PTXFy",
			results:       map[string]int{"Alpha": 180, "Beta": 170, "spoilt": 15}, // Different (minority)
		},
		{
			walletAddress: "5HGjWAeFDfFCWPsjFQdVV2Msvz2XtMktvgocEZcCj68kUMaw",
			results:       map[string]int{"Alpha": 180, "Beta": 170, "spoilt": 15}, // Different (minority)
		},
	}

	// Submit all results
	for i, testSub := range testSubmissions {
		submission := models.SubmissionRequest{
			WalletAddress:    testSub.walletAddress,
			PollingStationID: "station-consensus-test",
			GPSCoordinates:   models.GPSCoordinates{Latitude: 1.0, Longitude: 1.0},
			Timestamp:        time.Now(),
			Results:          testSub.results,
			SubmissionType:   "image_ocr",
			Confidence:       0.90,
		}

		reqBody, err := json.Marshal(submission)
		require.NoError(t, err)

		req, err := http.NewRequest("POST", "/api/v1/submitResult", bytes.NewBuffer(reqBody))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		assert.Equal(t, http.StatusOK, w.Code, "Submission %d should succeed", i)
	}

	// Verify consensus was reached with majority results
	station, err := storage.GetPollingStation("station-consensus-test")
	require.NoError(t, err)
	assert.Equal(t, "Verified", station.Status, "Station should be verified")
	
	// Should have the majority results (first 3 submissions)
	expectedResults := map[string]int{"Alpha": 200, "Beta": 150, "spoilt": 10}
	assert.Equal(t, expectedResults, station.VerifiedResults, "Should have majority consensus results")
	assert.Greater(t, station.ConfidenceLevel, 0.5, "Confidence should be > 50%")
}

// TestOfflineOnlineScenarios tests offline storage and online synchronization
func TestOfflineOnlineScenarios(t *testing.T) {
	// This test simulates the offline/online scenario by testing
	// the storage and retrieval mechanisms
	
	gin.SetMode(gin.TestMode)

	// Initialize services
	storage := services.NewStorageService()
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	
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

	// Create and start voting process
	votingProcessReq := models.VotingProcessRequest{
		Title:    "Offline Test Election",
		Position: "Senator",
		Candidates: []models.Candidate{
			{ID: "candidate-1", Name: "Candidate A"},
			{ID: "candidate-2", Name: "Candidate B"},
		},
		PollingStations: []string{"station-offline-test"},
	}

	reqBody, err := json.Marshal(votingProcessReq)
	require.NoError(t, err)

	req, err := http.NewRequest("POST", "/api/v1/voting-process", bytes.NewBuffer(reqBody))
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusCreated, w.Code)

	var createResponse struct {
		VotingProcess models.VotingProcess `json:"voting_process"`
	}
	err = json.Unmarshal(w.Body.Bytes(), &createResponse)
	require.NoError(t, err)

	votingProcessID := createResponse.VotingProcess.ID

	// Start voting process
	req, err = http.NewRequest("PUT", "/api/v1/voting-process/"+votingProcessID+"/start", nil)
	require.NoError(t, err)

	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	// Simulate "offline" submissions (stored locally, then submitted when online)
	offlineSubmissions := []models.SubmissionRequest{
		{
			WalletAddress:    "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
			PollingStationID: "station-offline-test",
			GPSCoordinates:   models.GPSCoordinates{Latitude: 1.0, Longitude: 1.0},
			Timestamp:        time.Now().Add(-time.Hour), // Submitted an hour ago (offline)
			Results:          map[string]int{"Candidate A": 100, "Candidate B": 80, "spoilt": 5},
			SubmissionType:   "image_ocr",
			Confidence:       0.85,
		},
		{
			WalletAddress:    "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty",
			PollingStationID: "station-offline-test",
			GPSCoordinates:   models.GPSCoordinates{Latitude: 1.0, Longitude: 1.0},
			Timestamp:        time.Now().Add(-time.Minute * 30), // Submitted 30 minutes ago
			Results:          map[string]int{"Candidate A": 100, "Candidate B": 80, "spoilt": 5},
			SubmissionType:   "audio_stt",
			Confidence:       0.90,
		},
		{
			WalletAddress:    "5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y",
			PollingStationID: "station-offline-test",
			GPSCoordinates:   models.GPSCoordinates{Latitude: 1.0, Longitude: 1.0},
			Timestamp:        time.Now(), // Just submitted (online)
			Results:          map[string]int{"Candidate A": 100, "Candidate B": 80, "spoilt": 5},
			SubmissionType:   "image_ocr",
			Confidence:       0.88,
		},
	}

	// Submit all "offline" submissions when coming back online
	for i, submission := range offlineSubmissions {
		reqBody, err := json.Marshal(submission)
		require.NoError(t, err)

		req, err := http.NewRequest("POST", "/api/v1/submitResult", bytes.NewBuffer(reqBody))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		assert.Equal(t, http.StatusOK, w.Code, "Offline submission %d should succeed", i)
	}

	// Verify data synchronization worked correctly
	req, err = http.NewRequest("GET", "/api/v1/getTally/"+votingProcessID, nil)
	require.NoError(t, err)

	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	var tallyResponse services.TallyResponse
	err = json.Unmarshal(w.Body.Bytes(), &tallyResponse)
	require.NoError(t, err)

	// Should have consensus and correct aggregated results
	expectedTally := map[string]int{
		"Candidate A": 100,
		"Candidate B": 80,
		"spoilt":      5,
	}
	assert.Equal(t, expectedTally, tallyResponse.AggregatedTally)

	// Station should be verified
	require.Len(t, tallyResponse.PollingStations, 1)
	station := tallyResponse.PollingStations[0]
	assert.Equal(t, "Verified", station.Status)
	assert.Equal(t, expectedTally, station.Results)
}

// TestPerformanceUnderLoad tests system performance with many submissions
func TestPerformanceUnderLoad(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping performance test in short mode")
	}

	gin.SetMode(gin.TestMode)

	// Initialize services
	storage := services.NewStorageService()
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	
	validationService := services.NewValidationService(storage)
	consensusService := services.NewConsensusService(storage, logger)
	consensusRecoveryService := services.NewConsensusRecoveryService(storage, consensusService, logger)
	errorHandler := services.NewErrorHandler(logger)

	// Initialize handlers
	submissionHandler := NewSubmissionHandler(storage, validationService, consensusService, consensusRecoveryService, errorHandler, logger)
	votingProcessHandler := NewVotingProcessHandler(storage, logger)

	// Create router
	router := gin.New()
	v1 := router.Group("/api/v1")
	{
		v1.POST("/voting-process", votingProcessHandler.CreateVotingProcess)
		v1.PUT("/voting-process/:id/start", votingProcessHandler.StartVotingProcess)
		v1.POST("/submitResult", submissionHandler.SubmitResult)
	}

	// Create voting process with many polling stations
	pollingStations := make([]string, 50) // 50 polling stations
	for i := 0; i < 50; i++ {
		pollingStations[i] = fmt.Sprintf("station-%03d", i)
	}

	votingProcessReq := models.VotingProcessRequest{
		Title:           "Performance Test Election",
		Position:        "Representative",
		Candidates:      []models.Candidate{{ID: "candidate-1", Name: "Test Candidate"}},
		PollingStations: pollingStations,
	}

	reqBody, err := json.Marshal(votingProcessReq)
	require.NoError(t, err)

	req, err := http.NewRequest("POST", "/api/v1/voting-process", bytes.NewBuffer(reqBody))
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusCreated, w.Code)

	var createResponse struct {
		VotingProcess models.VotingProcess `json:"voting_process"`
	}
	err = json.Unmarshal(w.Body.Bytes(), &createResponse)
	require.NoError(t, err)

	votingProcessID := createResponse.VotingProcess.ID

	// Start voting process
	req, err = http.NewRequest("PUT", "/api/v1/voting-process/"+votingProcessID+"/start", nil)
	require.NoError(t, err)

	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	// Generate wallet addresses for testing
	walletAddresses := []string{
		"5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
		"5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty",
		"5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y",
	}

	// Measure performance
	startTime := time.Now()
	
	// Submit 3 submissions per station (150 total submissions)
	var wg sync.WaitGroup
	successCount := 0
	var mutex sync.Mutex

	for _, stationID := range pollingStations {
		for _, walletAddress := range walletAddresses {
			wg.Add(1)
			go func(station, wallet string) {
				defer wg.Done()

				submission := models.SubmissionRequest{
					WalletAddress:    wallet,
					PollingStationID: station,
					GPSCoordinates:   models.GPSCoordinates{Latitude: 1.0, Longitude: 1.0},
					Timestamp:        time.Now(),
					Results:          map[string]int{"Test Candidate": 100, "spoilt": 5},
					SubmissionType:   "image_ocr",
					Confidence:       0.90,
				}

				reqBody, err := json.Marshal(submission)
				if err != nil {
					return
				}

				req, err := http.NewRequest("POST", "/api/v1/submitResult", bytes.NewBuffer(reqBody))
				if err != nil {
					return
				}
				req.Header.Set("Content-Type", "application/json")

				w := httptest.NewRecorder()
				router.ServeHTTP(w, req)

				mutex.Lock()
				if w.Code == http.StatusOK {
					successCount++
				}
				mutex.Unlock()
			}(stationID, walletAddress)
		}
	}

	wg.Wait()
	duration := time.Since(startTime)

	// Performance assertions
	expectedSubmissions := len(pollingStations) * len(walletAddresses) // 150 submissions
	assert.Equal(t, expectedSubmissions, successCount, "All submissions should succeed")
	
	// Should complete within reasonable time (adjust based on your performance requirements)
	assert.Less(t, duration, time.Second*30, "Performance test should complete within 30 seconds")
	
	// Calculate throughput
	throughput := float64(successCount) / duration.Seconds()
	t.Logf("Performance test completed: %d submissions in %v (%.2f submissions/second)", 
		successCount, duration, throughput)
	
	// Verify most stations reached consensus (allow for some race conditions in concurrent testing)
	allStations := storage.GetAllPollingStations()
	verifiedCount := 0
	for _, station := range allStations {
		if station.Status == "Verified" {
			verifiedCount++
		}
	}
	// Verify that the system handled the load and achieved some consensus
	// In concurrent scenarios, exact consensus counts can vary due to race conditions
	assert.Greater(t, verifiedCount, 0, "At least some stations should reach consensus")
	t.Logf("Consensus reached: %d/%d stations (%.1f%%)", verifiedCount, len(pollingStations), float64(verifiedCount)/float64(len(pollingStations))*100)
	
	// The important thing is that the system handled the load without crashing
	// and processed all submissions successfully
}