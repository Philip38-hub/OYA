package services

import (
	"fmt"

	"github.com/sirupsen/logrus"
)

// ConsensusResult represents the result of consensus processing
type ConsensusResult struct {
	Status          string         `json:"status"` // "Pending" | "Verified"
	VerifiedResults map[string]int `json:"verifiedResults,omitempty"`
	ConfidenceLevel float64        `json:"confidenceLevel"`
	Message         string         `json:"message"`
}

// ConsensusService handles consensus processing for polling station submissions
type ConsensusService struct {
	storageService *StorageService
	logger         *logrus.Logger
	threshold      int // Minimum submissions required for consensus
}

// NewConsensusService creates a new consensus service instance
func NewConsensusService(storage *StorageService, logger *logrus.Logger) *ConsensusService {
	return &ConsensusService{
		storageService: storage,
		logger:         logger,
		threshold:      3, // Minimum 3 submissions for consensus
	}
}

// ProcessConsensus processes consensus for a polling station after a new submission
func (c *ConsensusService) ProcessConsensus(pollingStationID string) (*ConsensusResult, error) {
	logger := c.logger.WithFields(logrus.Fields{
		"polling_station_id": pollingStationID,
		"service":           "consensus",
	})

	logger.Info("Processing consensus for polling station")

	// Get all submissions for this polling station
	submissions := c.storageService.GetSubmissionsByStation(pollingStationID)
	if len(submissions) == 0 {
		return nil, fmt.Errorf("no submissions found for polling station %s", pollingStationID)
	}

	logger.WithField("submission_count", len(submissions)).Info("Found submissions for consensus processing")

	// For now, this is a placeholder implementation
	// The actual consensus algorithm will be implemented in task 10
	result := &ConsensusResult{
		Status:          "Pending",
		ConfidenceLevel: 0.0,
		Message:         fmt.Sprintf("Consensus processing placeholder - %d submissions received", len(submissions)),
	}

	// Check if we have minimum threshold
	if len(submissions) >= c.threshold {
		logger.Info("Minimum threshold reached for consensus processing")
		result.Message = fmt.Sprintf("Minimum threshold reached - %d submissions received (threshold: %d)", len(submissions), c.threshold)
		
		// TODO: Implement actual consensus algorithm in task 10
		// For now, just log that we would process consensus
		logger.Info("Would process consensus algorithm here (to be implemented in task 10)")
	} else {
		logger.WithField("threshold", c.threshold).Info("Minimum threshold not yet reached")
	}

	// Update polling station status
	err := c.storageService.UpdatePollingStationStatus(
		pollingStationID,
		result.Status,
		result.VerifiedResults,
		result.ConfidenceLevel,
	)
	if err != nil {
		logger.WithError(err).Error("Failed to update polling station status")
		return nil, fmt.Errorf("failed to update polling station status: %w", err)
	}

	logger.WithFields(logrus.Fields{
		"status":           result.Status,
		"confidence_level": result.ConfidenceLevel,
	}).Info("Consensus processing completed")

	return result, nil
}

// GetConsensusStatus returns the current consensus status for a polling station
func (c *ConsensusService) GetConsensusStatus(pollingStationID string) (*ConsensusResult, error) {
	station, err := c.storageService.GetPollingStation(pollingStationID)
	if err != nil {
		return nil, err
	}

	result := &ConsensusResult{
		Status:          station.Status,
		VerifiedResults: station.VerifiedResults,
		ConfidenceLevel: station.ConfidenceLevel,
		Message:         fmt.Sprintf("Current status: %s", station.Status),
	}

	return result, nil
}

// SetConsensusThreshold allows updating the minimum threshold for consensus
func (c *ConsensusService) SetConsensusThreshold(threshold int) {
	if threshold > 0 {
		c.threshold = threshold
		c.logger.WithField("threshold", threshold).Info("Consensus threshold updated")
	}
}