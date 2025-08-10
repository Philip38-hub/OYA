package services

import (
	"fmt"
	"sync"
	"time"

	"oyah-backend/internal/models"
)

// StorageService provides in-memory storage for submissions and polling stations
type StorageService struct {
	submissions     map[string][]models.Submission // key: pollingStationId
	pollingStations map[string]*models.PollingStation // key: pollingStationId
	walletSubmissions map[string]map[string]*models.Submission // key: walletAddress -> pollingStationId -> submission
	mutex           sync.RWMutex
}

// NewStorageService creates a new storage service instance
func NewStorageService() *StorageService {
	return &StorageService{
		submissions:       make(map[string][]models.Submission),
		pollingStations:   make(map[string]*models.PollingStation),
		walletSubmissions: make(map[string]map[string]*models.Submission),
	}
}

// StoreSubmission stores a submission and handles duplicate prevention
func (s *StorageService) StoreSubmission(submission models.Submission) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	// Check for duplicate submission from same wallet for same station
	if walletStations, exists := s.walletSubmissions[submission.WalletAddress]; exists {
		if existingSubmission, stationExists := walletStations[submission.PollingStationID]; stationExists {
			// Update existing submission (latest wins)
			s.removeSubmissionFromStation(existingSubmission.ID, submission.PollingStationID)
		}
	} else {
		s.walletSubmissions[submission.WalletAddress] = make(map[string]*models.Submission)
	}

	// Store the new submission
	submission.ProcessedAt = time.Now()
	
	// Add to submissions list for the polling station
	s.submissions[submission.PollingStationID] = append(s.submissions[submission.PollingStationID], submission)
	
	// Update wallet submissions tracking
	s.walletSubmissions[submission.WalletAddress][submission.PollingStationID] = &submission

	// Initialize or update polling station
	if station, exists := s.pollingStations[submission.PollingStationID]; exists {
		station.Submissions = s.submissions[submission.PollingStationID]
	} else {
		s.pollingStations[submission.PollingStationID] = &models.PollingStation{
			ID:          submission.PollingStationID,
			Status:      "Pending",
			Submissions: s.submissions[submission.PollingStationID],
		}
	}

	return nil
}

// GetSubmissionsByStation returns all submissions for a polling station
func (s *StorageService) GetSubmissionsByStation(stationID string) []models.Submission {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	if submissions, exists := s.submissions[stationID]; exists {
		// Return a copy to avoid race conditions
		result := make([]models.Submission, len(submissions))
		copy(result, submissions)
		return result
	}
	return []models.Submission{}
}

// GetPollingStation returns a polling station by ID
func (s *StorageService) GetPollingStation(stationID string) (*models.PollingStation, error) {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	if station, exists := s.pollingStations[stationID]; exists {
		// Return a copy to avoid race conditions
		stationCopy := *station
		return &stationCopy, nil
	}
	return nil, fmt.Errorf("polling station not found: %s", stationID)
}

// UpdatePollingStationStatus updates the status and verified results of a polling station
func (s *StorageService) UpdatePollingStationStatus(stationID, status string, verifiedResults map[string]int, confidenceLevel float64) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	station, exists := s.pollingStations[stationID]
	if !exists {
		return fmt.Errorf("polling station not found: %s", stationID)
	}

	station.Status = status
	station.ConfidenceLevel = confidenceLevel
	
	if verifiedResults != nil {
		station.VerifiedResults = make(map[string]int)
		for k, v := range verifiedResults {
			station.VerifiedResults[k] = v
		}
		now := time.Now()
		station.ConsensusReached = &now
	}

	return nil
}

// GetAllPollingStations returns all polling stations
func (s *StorageService) GetAllPollingStations() map[string]*models.PollingStation {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	// Return a copy to avoid race conditions
	result := make(map[string]*models.PollingStation)
	for k, v := range s.pollingStations {
		stationCopy := *v
		result[k] = &stationCopy
	}
	return result
}

// removeSubmissionFromStation removes a submission from a station's submission list
func (s *StorageService) removeSubmissionFromStation(submissionID, stationID string) {
	submissions := s.submissions[stationID]
	for i, sub := range submissions {
		if sub.ID == submissionID {
			s.submissions[stationID] = append(submissions[:i], submissions[i+1:]...)
			break
		}
	}
}