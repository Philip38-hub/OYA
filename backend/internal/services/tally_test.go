package services

import (
	"testing"
	"time"

	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"oyah-backend/internal/models"
)

func TestTallyService_GetTallyData(t *testing.T) {
	// Initialize services
	storage := NewStorageService()
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel) // Reduce noise in tests
	tallyService := NewTallyService(storage, logger)

	// Create test voting process
	votingProcess := models.VotingProcess{
		ID:       "test-process-1",
		Title:    "Test Election",
		Position: "President",
		Candidates: []models.Candidate{
			{ID: "candidate-1", Name: "Alice Johnson"},
			{ID: "candidate-2", Name: "Bob Smith"},
			{ID: "candidate-3", Name: "Carol Davis"},
		},
		PollingStations: []string{"station-1", "station-2", "station-3"},
		Status:          "Active",
		CreatedAt:       time.Now(),
	}

	// Store voting process
	err := storage.StoreVotingProcess(votingProcess)
	require.NoError(t, err)

	// Create test polling stations with different statuses
	// Station 1: Verified with results
	station1 := &models.PollingStation{
		ID:              "station-1",
		VotingProcessID: "test-process-1",
		Status:          "Verified",
		VerifiedResults: map[string]int{
			"Alice Johnson": 150,
			"Bob Smith":     120,
			"Carol Davis":   80,
			"spoilt":        5,
		},
		ConfidenceLevel: 0.85,
	}

	// Station 2: Verified with results
	station2 := &models.PollingStation{
		ID:              "station-2",
		VotingProcessID: "test-process-1",
		Status:          "Verified",
		VerifiedResults: map[string]int{
			"Alice Johnson": 200,
			"Bob Smith":     180,
			"Carol Davis":   100,
			"spoilt":        10,
		},
		ConfidenceLevel: 0.90,
	}

	// Station 3: Pending (should not be included in aggregation)
	station3 := &models.PollingStation{
		ID:              "station-3",
		VotingProcessID: "test-process-1",
		Status:          "Pending",
		ConfidenceLevel: 0.0,
	}

	// Manually add stations to storage (simulating what would happen through normal flow)
	storage.pollingStations["station-1"] = station1
	storage.pollingStations["station-2"] = station2
	storage.pollingStations["station-3"] = station3

	// Test GetTallyData
	response, err := tallyService.GetTallyData("test-process-1")
	require.NoError(t, err)
	require.NotNil(t, response)

	// Verify voting process info
	assert.Equal(t, "test-process-1", response.VotingProcess.ID)
	assert.Equal(t, "Test Election", response.VotingProcess.Title)
	assert.Equal(t, "President", response.VotingProcess.Position)
	assert.Equal(t, "Active", response.VotingProcess.Status)
	assert.Len(t, response.VotingProcess.Candidates, 3)

	// Verify aggregated tally (only verified stations should be included)
	expectedTally := map[string]int{
		"Alice Johnson": 350, // 150 + 200
		"Bob Smith":     300, // 120 + 180
		"Carol Davis":   180, // 80 + 100
		"spoilt":        15,  // 5 + 10
	}
	assert.Equal(t, expectedTally, response.AggregatedTally)

	// Verify polling stations
	assert.Len(t, response.PollingStations, 3)

	// Find stations in response
	var verifiedStation1, verifiedStation2, pendingStation3 *StationStatus
	for i := range response.PollingStations {
		switch response.PollingStations[i].ID {
		case "station-1":
			verifiedStation1 = &response.PollingStations[i]
		case "station-2":
			verifiedStation2 = &response.PollingStations[i]
		case "station-3":
			pendingStation3 = &response.PollingStations[i]
		}
	}

	// Verify verified stations have results
	require.NotNil(t, verifiedStation1)
	assert.Equal(t, "Verified", verifiedStation1.Status)
	assert.NotNil(t, verifiedStation1.Results)
	assert.Equal(t, 0.85, verifiedStation1.Confidence)

	require.NotNil(t, verifiedStation2)
	assert.Equal(t, "Verified", verifiedStation2.Status)
	assert.NotNil(t, verifiedStation2.Results)
	assert.Equal(t, 0.90, verifiedStation2.Confidence)

	// Verify pending station has no results
	require.NotNil(t, pendingStation3)
	assert.Equal(t, "Pending", pendingStation3.Status)
	assert.Nil(t, pendingStation3.Results)
	assert.Equal(t, 0.0, pendingStation3.Confidence)

	// Verify timestamp is recent
	assert.WithinDuration(t, time.Now(), response.LastUpdated, time.Second)
}

func TestTallyService_GetTallyData_NonExistentVotingProcess(t *testing.T) {
	storage := NewStorageService()
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	tallyService := NewTallyService(storage, logger)

	// Test with non-existent voting process
	response, err := tallyService.GetTallyData("non-existent-process")
	assert.Error(t, err)
	assert.Nil(t, response)
	assert.Contains(t, err.Error(), "voting process not found")
}

func TestTallyService_HandleZeroResultScenarios(t *testing.T) {
	storage := NewStorageService()
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	tallyService := NewTallyService(storage, logger)

	// Create voting process with no verified results
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

	// Create pending station (no verified results)
	station1 := &models.PollingStation{
		ID:              "station-1",
		VotingProcessID: "test-process-zero",
		Status:          "Pending",
		ConfidenceLevel: 0.0,
	}
	storage.pollingStations["station-1"] = station1

	// Get tally data
	response, err := tallyService.GetTallyData("test-process-zero")
	require.NoError(t, err)
	require.NotNil(t, response)

	// Handle zero result scenarios
	tallyService.HandleZeroResultScenarios(response)

	// Verify all candidates have zero entries
	expectedTally := map[string]int{
		"John Doe":   0,
		"Jane Smith": 0,
		"spoilt":     0,
	}
	assert.Equal(t, expectedTally, response.AggregatedTally)
}

func TestTallyService_CalculateAggregatedTally(t *testing.T) {
	storage := NewStorageService()
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	tallyService := NewTallyService(storage, logger)

	candidates := []models.Candidate{
		{ID: "1", Name: "Alice"},
		{ID: "2", Name: "Bob"},
	}

	// Test with mixed verified and pending stations
	stations := []*models.PollingStation{
		{
			ID:     "station-1",
			Status: "Verified",
			VerifiedResults: map[string]int{
				"Alice":  100,
				"Bob":    80,
				"spoilt": 5,
			},
		},
		{
			ID:     "station-2",
			Status: "Pending", // Should be ignored
		},
		{
			ID:     "station-3",
			Status: "Verified",
			VerifiedResults: map[string]int{
				"Alice":  150,
				"Bob":    120,
				"spoilt": 10,
			},
		},
	}

	logger_entry := logger.WithField("test", "calculate_aggregated_tally")
	result := tallyService.calculateAggregatedTally(stations, candidates, logger_entry)

	expected := map[string]int{
		"Alice":  250, // 100 + 150
		"Bob":    200, // 80 + 120
		"spoilt": 15,  // 5 + 10
	}

	assert.Equal(t, expected, result)
}

func TestTallyService_BuildStationStatusList(t *testing.T) {
	storage := NewStorageService()
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	tallyService := NewTallyService(storage, logger)

	stations := []*models.PollingStation{
		{
			ID:     "station-1",
			Status: "Verified",
			VerifiedResults: map[string]int{
				"Alice": 100,
				"Bob":   80,
			},
			ConfidenceLevel: 0.85,
		},
		{
			ID:              "station-2",
			Status:          "Pending",
			ConfidenceLevel: 0.0,
		},
	}

	logger_entry := logger.WithField("test", "build_station_status_list")
	result := tallyService.buildStationStatusList(stations, logger_entry)

	assert.Len(t, result, 2)

	// Verified station should have results
	verifiedStation := result[0]
	assert.Equal(t, "station-1", verifiedStation.ID)
	assert.Equal(t, "Verified", verifiedStation.Status)
	assert.NotNil(t, verifiedStation.Results)
	assert.Equal(t, 100, verifiedStation.Results["Alice"])
	assert.Equal(t, 80, verifiedStation.Results["Bob"])
	assert.Equal(t, 0.85, verifiedStation.Confidence)

	// Pending station should not have results
	pendingStation := result[1]
	assert.Equal(t, "station-2", pendingStation.ID)
	assert.Equal(t, "Pending", pendingStation.Status)
	assert.Nil(t, pendingStation.Results)
	assert.Equal(t, 0.0, pendingStation.Confidence)
}

func TestTallyService_CountingMethods(t *testing.T) {
	storage := NewStorageService()
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	tallyService := NewTallyService(storage, logger)

	stations := []*models.PollingStation{
		{Status: "Verified"},
		{Status: "Verified"},
		{Status: "Pending"},
		{Status: "Pending"},
		{Status: "Verified"},
	}

	verifiedCount := tallyService.countVerifiedStations(stations)
	pendingCount := tallyService.countPendingStations(stations)

	assert.Equal(t, 3, verifiedCount)
	assert.Equal(t, 2, pendingCount)
}

func TestTallyService_SumTotalVotes(t *testing.T) {
	storage := NewStorageService()
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	tallyService := NewTallyService(storage, logger)

	tally := map[string]int{
		"Alice":  150,
		"Bob":    120,
		"Carol":  80,
		"spoilt": 10,
	}

	total := tallyService.sumTotalVotes(tally)
	assert.Equal(t, 360, total)
}