package services

import (
	"fmt"
	"testing"
	"time"

	"oyah-backend/internal/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestStorageService_VotingProcessOperations(t *testing.T) {
	storage := NewStorageService()

	t.Run("StoreVotingProcess", func(t *testing.T) {
		// Create test voting process
		votingProcess := models.VotingProcess{
			ID:       "vp-001",
			Title:    "Presidential Election 2024",
			Position: "President",
			Candidates: []models.Candidate{
				{ID: "c1", Name: "John Doe"},
				{ID: "c2", Name: "Jane Smith"},
			},
			PollingStations: []string{"PS001", "PS002", "PS003"},
			Status:          "Setup",
			CreatedAt:       time.Now(),
		}

		// Store the voting process
		err := storage.StoreVotingProcess(votingProcess)
		require.NoError(t, err)

		// Verify it was stored
		retrieved, err := storage.GetVotingProcess("vp-001")
		require.NoError(t, err)
		assert.Equal(t, votingProcess.ID, retrieved.ID)
		assert.Equal(t, votingProcess.Title, retrieved.Title)
		assert.Equal(t, votingProcess.Position, retrieved.Position)
		assert.Equal(t, len(votingProcess.Candidates), len(retrieved.Candidates))
		assert.Equal(t, len(votingProcess.PollingStations), len(retrieved.PollingStations))
		assert.Equal(t, "Setup", retrieved.Status)
	})

	t.Run("StoreVotingProcess_Duplicate", func(t *testing.T) {
		votingProcess := models.VotingProcess{
			ID:       "vp-duplicate",
			Title:    "Test Election",
			Position: "Mayor",
			Candidates: []models.Candidate{
				{ID: "c1", Name: "Candidate 1"},
			},
			PollingStations: []string{"PS001"},
			Status:          "Setup",
			CreatedAt:       time.Now(),
		}

		// Store the voting process first time
		err := storage.StoreVotingProcess(votingProcess)
		require.NoError(t, err)

		// Try to store the same voting process again
		err = storage.StoreVotingProcess(votingProcess)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "voting process already exists")
	})

	t.Run("GetVotingProcess_NotFound", func(t *testing.T) {
		_, err := storage.GetVotingProcess("non-existent")
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "voting process not found")
	})

	t.Run("UpdateVotingProcessStatus", func(t *testing.T) {
		// Create and store a voting process
		votingProcess := models.VotingProcess{
			ID:       "vp-status-test",
			Title:    "Status Test Election",
			Position: "Governor",
			Candidates: []models.Candidate{
				{ID: "c1", Name: "Candidate A"},
				{ID: "c2", Name: "Candidate B"},
			},
			PollingStations: []string{"PS001", "PS002"},
			Status:          "Setup",
			CreatedAt:       time.Now(),
		}

		err := storage.StoreVotingProcess(votingProcess)
		require.NoError(t, err)

		// Update status to Active
		err = storage.UpdateVotingProcessStatus("vp-status-test", "Active")
		require.NoError(t, err)

		// Verify status was updated
		retrieved, err := storage.GetVotingProcess("vp-status-test")
		require.NoError(t, err)
		assert.Equal(t, "Active", retrieved.Status)
		assert.NotNil(t, retrieved.StartedAt)

		// Update status to Complete
		err = storage.UpdateVotingProcessStatus("vp-status-test", "Complete")
		require.NoError(t, err)

		// Verify status was updated
		retrieved, err = storage.GetVotingProcess("vp-status-test")
		require.NoError(t, err)
		assert.Equal(t, "Complete", retrieved.Status)
		assert.NotNil(t, retrieved.CompletedAt)
	})

	t.Run("UpdateVotingProcessStatus_NotFound", func(t *testing.T) {
		err := storage.UpdateVotingProcessStatus("non-existent", "Active")
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "voting process not found")
	})

	t.Run("GetAllVotingProcesses", func(t *testing.T) {
		// Create multiple voting processes
		processes := []models.VotingProcess{
			{
				ID:       "vp-all-1",
				Title:    "Election 1",
				Position: "Mayor",
				Candidates: []models.Candidate{
					{ID: "c1", Name: "Candidate 1"},
				},
				PollingStations: []string{"PS001"},
				Status:          "Setup",
				CreatedAt:       time.Now(),
			},
			{
				ID:       "vp-all-2",
				Title:    "Election 2",
				Position: "Governor",
				Candidates: []models.Candidate{
					{ID: "c1", Name: "Candidate A"},
					{ID: "c2", Name: "Candidate B"},
				},
				PollingStations: []string{"PS002", "PS003"},
				Status:          "Active",
				CreatedAt:       time.Now(),
			},
		}

		// Store all processes
		for _, process := range processes {
			err := storage.StoreVotingProcess(process)
			require.NoError(t, err)
		}

		// Get all processes
		allProcesses := storage.GetAllVotingProcesses()
		
		// Verify we have at least the processes we created
		assert.GreaterOrEqual(t, len(allProcesses), 2)
		assert.Contains(t, allProcesses, "vp-all-1")
		assert.Contains(t, allProcesses, "vp-all-2")
	})

	t.Run("GetPollingStationsByVotingProcess", func(t *testing.T) {
		// Create a voting process with polling stations
		votingProcess := models.VotingProcess{
			ID:       "vp-stations-test",
			Title:    "Stations Test Election",
			Position: "Senator",
			Candidates: []models.Candidate{
				{ID: "c1", Name: "Candidate X"},
				{ID: "c2", Name: "Candidate Y"},
			},
			PollingStations: []string{"PS100", "PS101", "PS102"},
			Status:          "Setup",
			CreatedAt:       time.Now(),
		}

		err := storage.StoreVotingProcess(votingProcess)
		require.NoError(t, err)

		// Get polling stations for this voting process
		stations, err := storage.GetPollingStationsByVotingProcess("vp-stations-test")
		require.NoError(t, err)
		assert.Equal(t, 3, len(stations))

		// Verify each station is associated with the voting process
		for _, station := range stations {
			assert.Equal(t, "vp-stations-test", station.VotingProcessID)
			assert.Equal(t, "Pending", station.Status)
			assert.Contains(t, []string{"PS100", "PS101", "PS102"}, station.ID)
		}
	})

	t.Run("GetPollingStationsByVotingProcess_NotFound", func(t *testing.T) {
		_, err := storage.GetPollingStationsByVotingProcess("non-existent")
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "voting process not found")
	})

	t.Run("IsPollingStationInActiveVotingProcess", func(t *testing.T) {
		// Create a voting process
		votingProcess := models.VotingProcess{
			ID:       "vp-active-test",
			Title:    "Active Test Election",
			Position: "Judge",
			Candidates: []models.Candidate{
				{ID: "c1", Name: "Judge A"},
			},
			PollingStations: []string{"PS200"},
			Status:          "Setup",
			CreatedAt:       time.Now(),
		}

		err := storage.StoreVotingProcess(votingProcess)
		require.NoError(t, err)

		// Initially should not be active
		isActive := storage.IsPollingStationInActiveVotingProcess("PS200")
		assert.False(t, isActive)

		// Activate the voting process
		err = storage.UpdateVotingProcessStatus("vp-active-test", "Active")
		require.NoError(t, err)

		// Now should be active
		isActive = storage.IsPollingStationInActiveVotingProcess("PS200")
		assert.True(t, isActive)

		// Complete the voting process
		err = storage.UpdateVotingProcessStatus("vp-active-test", "Complete")
		require.NoError(t, err)

		// Should no longer be active
		isActive = storage.IsPollingStationInActiveVotingProcess("PS200")
		assert.False(t, isActive)
	})

	t.Run("IsPollingStationInActiveVotingProcess_NonExistent", func(t *testing.T) {
		isActive := storage.IsPollingStationInActiveVotingProcess("non-existent-station")
		assert.False(t, isActive)
	})
}

func TestStorageService_VotingProcessLifecycle(t *testing.T) {
	storage := NewStorageService()

	t.Run("CompleteLifecycle", func(t *testing.T) {
		// Create voting process
		votingProcess := models.VotingProcess{
			ID:       "vp-lifecycle",
			Title:    "Lifecycle Test Election",
			Position: "Council Member",
			Candidates: []models.Candidate{
				{ID: "c1", Name: "Alice Johnson"},
				{ID: "c2", Name: "Bob Wilson"},
				{ID: "c3", Name: "Carol Davis"},
			},
			PollingStations: []string{"PS301", "PS302"},
			Status:          "Setup",
			CreatedAt:       time.Now(),
		}

		// Store the voting process
		err := storage.StoreVotingProcess(votingProcess)
		require.NoError(t, err)

		// Verify initial state
		retrieved, err := storage.GetVotingProcess("vp-lifecycle")
		require.NoError(t, err)
		assert.Equal(t, "Setup", retrieved.Status)
		assert.Nil(t, retrieved.StartedAt)
		assert.Nil(t, retrieved.CompletedAt)

		// Start the voting process
		err = storage.UpdateVotingProcessStatus("vp-lifecycle", "Active")
		require.NoError(t, err)

		// Verify active state
		retrieved, err = storage.GetVotingProcess("vp-lifecycle")
		require.NoError(t, err)
		assert.Equal(t, "Active", retrieved.Status)
		assert.NotNil(t, retrieved.StartedAt)
		assert.Nil(t, retrieved.CompletedAt)

		// Complete the voting process
		err = storage.UpdateVotingProcessStatus("vp-lifecycle", "Complete")
		require.NoError(t, err)

		// Verify completed state
		retrieved, err = storage.GetVotingProcess("vp-lifecycle")
		require.NoError(t, err)
		assert.Equal(t, "Complete", retrieved.Status)
		assert.NotNil(t, retrieved.StartedAt)
		assert.NotNil(t, retrieved.CompletedAt)
		assert.True(t, retrieved.CompletedAt.After(*retrieved.StartedAt))
	})
}

func TestStorageService_ThreadSafety(t *testing.T) {
	storage := NewStorageService()

	t.Run("ConcurrentVotingProcessOperations", func(t *testing.T) {
		// Test concurrent operations to ensure thread safety
		done := make(chan bool, 10)

		// Create multiple goroutines performing different operations
		for i := 0; i < 5; i++ {
			go func(id int) {
				defer func() { done <- true }()
				
				votingProcess := models.VotingProcess{
					ID:       fmt.Sprintf("vp-concurrent-%d", id),
					Title:    fmt.Sprintf("Concurrent Election %d", id),
					Position: "Test Position",
					Candidates: []models.Candidate{
						{ID: "c1", Name: "Candidate 1"},
					},
					PollingStations: []string{fmt.Sprintf("PS%d", id)},
					Status:          "Setup",
					CreatedAt:       time.Now(),
				}

				err := storage.StoreVotingProcess(votingProcess)
				assert.NoError(t, err)

				// Update status
				err = storage.UpdateVotingProcessStatus(votingProcess.ID, "Active")
				assert.NoError(t, err)

				// Retrieve process
				_, err = storage.GetVotingProcess(votingProcess.ID)
				assert.NoError(t, err)
			}(i)
		}

		// Wait for all goroutines to complete
		for i := 0; i < 5; i++ {
			<-done
		}

		// Verify all processes were created
		allProcesses := storage.GetAllVotingProcesses()
		assert.GreaterOrEqual(t, len(allProcesses), 5)
	})
}