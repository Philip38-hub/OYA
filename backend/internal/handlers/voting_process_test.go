package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"oyah-backend/internal/models"
	"oyah-backend/internal/services"
)

func setupVotingProcessTestRouter() (*gin.Engine, *VotingProcessHandler, *services.StorageService) {
	// Set Gin to test mode
	gin.SetMode(gin.TestMode)

	// Create services
	storage := services.NewStorageService()
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel) // Reduce log noise in tests

	// Create handler
	handler := NewVotingProcessHandler(storage, logger)

	// Setup router
	router := gin.New()
	api := router.Group("/api/v1")
	{
		api.POST("/voting-process", handler.CreateVotingProcess)
		api.PUT("/voting-process/:id/start", handler.StartVotingProcess)
		api.GET("/voting-process/:id", handler.GetVotingProcess)
	}

	return router, handler, storage
}

func TestVotingProcessHandler_CreateVotingProcess(t *testing.T) {
	router, _, _ := setupVotingProcessTestRouter()

	t.Run("ValidRequest", func(t *testing.T) {
		// Create valid request
		request := models.VotingProcessRequest{
			Title:    "Presidential Election 2024",
			Position: "President",
			Candidates: []models.Candidate{
				{ID: "c1", Name: "John Doe"},
				{ID: "c2", Name: "Jane Smith"},
				{ID: "c3", Name: "Bob Johnson"},
			},
			PollingStations: []string{"PS001", "PS002", "PS003"},
		}

		// Convert to JSON
		jsonData, err := json.Marshal(request)
		require.NoError(t, err)

		// Create HTTP request
		req, err := http.NewRequest("POST", "/api/v1/voting-process", bytes.NewBuffer(jsonData))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")

		// Create response recorder
		w := httptest.NewRecorder()

		// Perform request
		router.ServeHTTP(w, req)

		// Assert response
		assert.Equal(t, http.StatusCreated, w.Code)

		var response map[string]interface{}
		err = json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)

		assert.True(t, response["success"].(bool))
		assert.Contains(t, response, "voting_process")
		assert.Equal(t, "Voting process created successfully", response["message"])

		// Verify voting process details
		votingProcess := response["voting_process"].(map[string]interface{})
		assert.Equal(t, request.Title, votingProcess["title"])
		assert.Equal(t, request.Position, votingProcess["position"])
		assert.Equal(t, "Setup", votingProcess["status"])
		assert.NotEmpty(t, votingProcess["id"])
		assert.NotEmpty(t, votingProcess["createdAt"])
	})

	t.Run("InvalidJSON", func(t *testing.T) {
		// Create invalid JSON
		invalidJSON := `{"title": "Test", "position": "Mayor", "candidates": [`

		// Create HTTP request
		req, err := http.NewRequest("POST", "/api/v1/voting-process", bytes.NewBufferString(invalidJSON))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")

		// Create response recorder
		w := httptest.NewRecorder()

		// Perform request
		router.ServeHTTP(w, req)

		// Assert response
		assert.Equal(t, http.StatusBadRequest, w.Code)

		var response models.ErrorResponse
		err = json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)

		assert.Equal(t, "Invalid JSON payload", response.Error)
		assert.Equal(t, "INVALID_JSON", response.Code)
	})

	t.Run("MissingTitle", func(t *testing.T) {
		// Create request without title
		request := models.VotingProcessRequest{
			Position: "Mayor",
			Candidates: []models.Candidate{
				{ID: "c1", Name: "Candidate 1"},
			},
			PollingStations: []string{"PS001"},
		}

		// Convert to JSON
		jsonData, err := json.Marshal(request)
		require.NoError(t, err)

		// Create HTTP request
		req, err := http.NewRequest("POST", "/api/v1/voting-process", bytes.NewBuffer(jsonData))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")

		// Create response recorder
		w := httptest.NewRecorder()

		// Perform request
		router.ServeHTTP(w, req)

		// Assert response
		assert.Equal(t, http.StatusBadRequest, w.Code)

		var response models.ErrorResponse
		err = json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)

		assert.Equal(t, "Invalid JSON payload", response.Error)
		assert.Equal(t, "INVALID_JSON", response.Code)
		assert.Contains(t, response.Details, "Title")
	})

	t.Run("NoCandidates", func(t *testing.T) {
		// Create request without candidates
		request := models.VotingProcessRequest{
			Title:           "Test Election",
			Position:        "Mayor",
			Candidates:      []models.Candidate{},
			PollingStations: []string{"PS001"},
		}

		// Convert to JSON
		jsonData, err := json.Marshal(request)
		require.NoError(t, err)

		// Create HTTP request
		req, err := http.NewRequest("POST", "/api/v1/voting-process", bytes.NewBuffer(jsonData))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")

		// Create response recorder
		w := httptest.NewRecorder()

		// Perform request
		router.ServeHTTP(w, req)

		// Assert response
		assert.Equal(t, http.StatusBadRequest, w.Code)

		var response models.ErrorResponse
		err = json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)

		assert.Contains(t, response.Details, "Candidates")
	})

	t.Run("NoPollingStations", func(t *testing.T) {
		// Create request without polling stations
		request := models.VotingProcessRequest{
			Title:    "Test Election",
			Position: "Mayor",
			Candidates: []models.Candidate{
				{ID: "c1", Name: "Candidate 1"},
			},
			PollingStations: []string{},
		}

		// Convert to JSON
		jsonData, err := json.Marshal(request)
		require.NoError(t, err)

		// Create HTTP request
		req, err := http.NewRequest("POST", "/api/v1/voting-process", bytes.NewBuffer(jsonData))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")

		// Create response recorder
		w := httptest.NewRecorder()

		// Perform request
		router.ServeHTTP(w, req)

		// Assert response
		assert.Equal(t, http.StatusBadRequest, w.Code)

		var response models.ErrorResponse
		err = json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)

		assert.Contains(t, response.Details, "PollingStations")
	})

	t.Run("DuplicateCandidateIDs", func(t *testing.T) {
		// Create request with duplicate candidate IDs
		request := models.VotingProcessRequest{
			Title:    "Test Election",
			Position: "Mayor",
			Candidates: []models.Candidate{
				{ID: "c1", Name: "Candidate 1"},
				{ID: "c1", Name: "Candidate 2"}, // Duplicate ID
			},
			PollingStations: []string{"PS001"},
		}

		// Convert to JSON
		jsonData, err := json.Marshal(request)
		require.NoError(t, err)

		// Create HTTP request
		req, err := http.NewRequest("POST", "/api/v1/voting-process", bytes.NewBuffer(jsonData))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")

		// Create response recorder
		w := httptest.NewRecorder()

		// Perform request
		router.ServeHTTP(w, req)

		// Assert response
		assert.Equal(t, http.StatusBadRequest, w.Code)

		var response models.ErrorResponse
		err = json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)

		assert.Contains(t, response.Details, "duplicate candidate ID")
	})
}

func TestVotingProcessHandler_StartVotingProcess(t *testing.T) {
	router, _, storage := setupVotingProcessTestRouter()

	// Create a test voting process
	testProcess := models.VotingProcess{
		ID:       "test-process-1",
		Title:    "Test Election",
		Position: "Mayor",
		Candidates: []models.Candidate{
			{ID: "c1", Name: "Candidate 1"},
		},
		PollingStations: []string{"PS001"},
		Status:          "Setup",
	}
	err := storage.StoreVotingProcess(testProcess)
	require.NoError(t, err)

	t.Run("ValidStart", func(t *testing.T) {
		// Create HTTP request
		req, err := http.NewRequest("PUT", "/api/v1/voting-process/test-process-1/start", nil)
		require.NoError(t, err)

		// Create response recorder
		w := httptest.NewRecorder()

		// Perform request
		router.ServeHTTP(w, req)

		// Assert response
		assert.Equal(t, http.StatusOK, w.Code)

		var response map[string]interface{}
		err = json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)

		assert.True(t, response["success"].(bool))
		assert.Equal(t, "Voting process started successfully", response["message"])

		// Verify voting process status was updated
		votingProcess := response["voting_process"].(map[string]interface{})
		assert.Equal(t, "Active", votingProcess["status"])
		assert.NotNil(t, votingProcess["startedAt"])
	})

	t.Run("ProcessNotFound", func(t *testing.T) {
		// Create HTTP request for non-existent process
		req, err := http.NewRequest("PUT", "/api/v1/voting-process/non-existent/start", nil)
		require.NoError(t, err)

		// Create response recorder
		w := httptest.NewRecorder()

		// Perform request
		router.ServeHTTP(w, req)

		// Assert response
		assert.Equal(t, http.StatusNotFound, w.Code)

		var response models.ErrorResponse
		err = json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)

		assert.Equal(t, "Voting process not found", response.Error)
		assert.Equal(t, "PROCESS_NOT_FOUND", response.Code)
	})

	t.Run("InvalidStatus", func(t *testing.T) {
		// Try to start the same process again (should be in Active status now)
		req, err := http.NewRequest("PUT", "/api/v1/voting-process/test-process-1/start", nil)
		require.NoError(t, err)

		// Create response recorder
		w := httptest.NewRecorder()

		// Perform request
		router.ServeHTTP(w, req)

		// Assert response
		assert.Equal(t, http.StatusBadRequest, w.Code)

		var response models.ErrorResponse
		err = json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)

		assert.Equal(t, "Cannot start voting process", response.Error)
		assert.Equal(t, "INVALID_STATUS", response.Code)
	})

	t.Run("MissingProcessID", func(t *testing.T) {
		// Create HTTP request with space as process ID (which gets trimmed to empty)
		req, err := http.NewRequest("PUT", "/api/v1/voting-process/ /start", nil)
		require.NoError(t, err)

		// Create response recorder
		w := httptest.NewRecorder()

		// Perform request
		router.ServeHTTP(w, req)

		// Assert response (should be 404 since space is treated as a process ID that doesn't exist)
		assert.Equal(t, http.StatusNotFound, w.Code)
	})
}

func TestVotingProcessHandler_GetVotingProcess(t *testing.T) {
	router, _, storage := setupVotingProcessTestRouter()

	// Create a test voting process
	testProcess := models.VotingProcess{
		ID:       "test-process-get",
		Title:    "Get Test Election",
		Position: "Governor",
		Candidates: []models.Candidate{
			{ID: "c1", Name: "Alice Johnson"},
			{ID: "c2", Name: "Bob Wilson"},
		},
		PollingStations: []string{"PS001", "PS002"},
		Status:          "Setup",
	}
	err := storage.StoreVotingProcess(testProcess)
	require.NoError(t, err)

	t.Run("ValidGet", func(t *testing.T) {
		// Create HTTP request
		req, err := http.NewRequest("GET", "/api/v1/voting-process/test-process-get", nil)
		require.NoError(t, err)

		// Create response recorder
		w := httptest.NewRecorder()

		// Perform request
		router.ServeHTTP(w, req)

		// Assert response
		assert.Equal(t, http.StatusOK, w.Code)

		var response map[string]interface{}
		err = json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)

		assert.True(t, response["success"].(bool))
		assert.Contains(t, response, "voting_process")

		// Verify voting process details
		votingProcess := response["voting_process"].(map[string]interface{})
		assert.Equal(t, testProcess.ID, votingProcess["id"])
		assert.Equal(t, testProcess.Title, votingProcess["title"])
		assert.Equal(t, testProcess.Position, votingProcess["position"])
		assert.Equal(t, testProcess.Status, votingProcess["status"])
		
		// Verify candidates
		candidates := votingProcess["candidates"].([]interface{})
		assert.Equal(t, 2, len(candidates))
		
		// Verify polling stations
		pollingStations := votingProcess["pollingStations"].([]interface{})
		assert.Equal(t, 2, len(pollingStations))
	})

	t.Run("ProcessNotFound", func(t *testing.T) {
		// Create HTTP request for non-existent process
		req, err := http.NewRequest("GET", "/api/v1/voting-process/non-existent", nil)
		require.NoError(t, err)

		// Create response recorder
		w := httptest.NewRecorder()

		// Perform request
		router.ServeHTTP(w, req)

		// Assert response
		assert.Equal(t, http.StatusNotFound, w.Code)

		var response models.ErrorResponse
		err = json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)

		assert.Equal(t, "Voting process not found", response.Error)
		assert.Equal(t, "PROCESS_NOT_FOUND", response.Code)
	})

	t.Run("MissingProcessID", func(t *testing.T) {
		// Create HTTP request without process ID
		req, err := http.NewRequest("GET", "/api/v1/voting-process/", nil)
		require.NoError(t, err)

		// Create response recorder
		w := httptest.NewRecorder()

		// Perform request
		router.ServeHTTP(w, req)

		// Assert response (should be 404 due to route not matching)
		assert.Equal(t, http.StatusNotFound, w.Code)
	})
}

func TestVotingProcessHandler_ValidationEdgeCases(t *testing.T) {
	router, _, _ := setupVotingProcessTestRouter()

	t.Run("LongTitle", func(t *testing.T) {
		// Create request with very long title
		longTitle := string(make([]byte, 201)) // 201 characters
		for i := range longTitle {
			longTitle = longTitle[:i] + "a" + longTitle[i+1:]
		}

		request := models.VotingProcessRequest{
			Title:    longTitle,
			Position: "Mayor",
			Candidates: []models.Candidate{
				{ID: "c1", Name: "Candidate 1"},
			},
			PollingStations: []string{"PS001"},
		}

		// Convert to JSON
		jsonData, err := json.Marshal(request)
		require.NoError(t, err)

		// Create HTTP request
		req, err := http.NewRequest("POST", "/api/v1/voting-process", bytes.NewBuffer(jsonData))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")

		// Create response recorder
		w := httptest.NewRecorder()

		// Perform request
		router.ServeHTTP(w, req)

		// Assert response
		assert.Equal(t, http.StatusBadRequest, w.Code)

		var response models.ErrorResponse
		err = json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)

		assert.Contains(t, response.Details, "title must be less than 200 characters")
	})

	t.Run("DuplicateCandidateNames", func(t *testing.T) {
		// Create request with duplicate candidate names
		request := models.VotingProcessRequest{
			Title:    "Test Election",
			Position: "Mayor",
			Candidates: []models.Candidate{
				{ID: "c1", Name: "John Doe"},
				{ID: "c2", Name: "John Doe"}, // Duplicate name
			},
			PollingStations: []string{"PS001"},
		}

		// Convert to JSON
		jsonData, err := json.Marshal(request)
		require.NoError(t, err)

		// Create HTTP request
		req, err := http.NewRequest("POST", "/api/v1/voting-process", bytes.NewBuffer(jsonData))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")

		// Create response recorder
		w := httptest.NewRecorder()

		// Perform request
		router.ServeHTTP(w, req)

		// Assert response
		assert.Equal(t, http.StatusBadRequest, w.Code)

		var response models.ErrorResponse
		err = json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)

		assert.Contains(t, response.Details, "duplicate candidate name")
	})

	t.Run("DuplicatePollingStations", func(t *testing.T) {
		// Create request with duplicate polling station IDs
		request := models.VotingProcessRequest{
			Title:    "Test Election",
			Position: "Mayor",
			Candidates: []models.Candidate{
				{ID: "c1", Name: "Candidate 1"},
			},
			PollingStations: []string{"PS001", "PS001"}, // Duplicate station
		}

		// Convert to JSON
		jsonData, err := json.Marshal(request)
		require.NoError(t, err)

		// Create HTTP request
		req, err := http.NewRequest("POST", "/api/v1/voting-process", bytes.NewBuffer(jsonData))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")

		// Create response recorder
		w := httptest.NewRecorder()

		// Perform request
		router.ServeHTTP(w, req)

		// Assert response
		assert.Equal(t, http.StatusBadRequest, w.Code)

		var response models.ErrorResponse
		err = json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)

		assert.Contains(t, response.Details, "duplicate polling station ID")
	})
}