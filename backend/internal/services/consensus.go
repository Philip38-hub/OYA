package services

import (
	"fmt"
	"reflect"

	"github.com/sirupsen/logrus"
	"oyah-backend/internal/models"
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
	storageService   *StorageService
	webSocketService *WebSocketService
	logger           *logrus.Logger
	threshold        int // Minimum submissions required for consensus
}

// NewConsensusService creates a new consensus service instance
func NewConsensusService(storage *StorageService, logger *logrus.Logger) *ConsensusService {
	return &ConsensusService{
		storageService: storage,
		logger:         logger,
		threshold:      3, // Minimum 3 submissions for consensus
	}
}

// SetWebSocketService sets the WebSocket service for broadcasting updates
func (c *ConsensusService) SetWebSocketService(wsService *WebSocketService) {
	c.webSocketService = wsService
	c.logger.Info("WebSocket service attached to consensus engine")
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

	// Group submissions by identical results and enforce wallet uniqueness
	resultGroups := c.groupSubmissionsByResults(submissions)
	
	logger.WithField("result_groups", len(resultGroups)).Info("Grouped submissions by results")

	// Check if we have minimum threshold
	if len(submissions) < c.threshold {
		logger.WithField("threshold", c.threshold).Info("Minimum threshold not yet reached")
		result := &ConsensusResult{
			Status:          "Pending",
			ConfidenceLevel: 0.0,
			Message:         fmt.Sprintf("Waiting for more submissions - %d received (threshold: %d)", len(submissions), c.threshold),
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

		// Trigger WebSocket broadcast for pending status update if WebSocket service is available
		if c.webSocketService != nil {
			// Get the voting process ID for this polling station
			station, err := c.storageService.GetPollingStation(pollingStationID)
			if err == nil && station.VotingProcessID != "" {
				// Broadcast tally update for the voting process
				broadcastErr := c.webSocketService.BroadcastTallyUpdate(station.VotingProcessID)
				if broadcastErr != nil {
					logger.WithError(broadcastErr).Error("Failed to broadcast tally update via WebSocket")
					// Don't return error - consensus processing succeeded, broadcast failure is not critical
				} else {
					logger.WithField("voting_process_id", station.VotingProcessID).Info("WebSocket tally update broadcast triggered for pending status")
				}
			}
		}

		return result, nil
	}

	// Process consensus with majority-based verification
	result := c.calculateMajorityConsensus(resultGroups, len(submissions), logger)

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

	// Trigger WebSocket broadcast if consensus status changed and WebSocket service is available
	if c.webSocketService != nil {
		// Get the voting process ID for this polling station
		station, err := c.storageService.GetPollingStation(pollingStationID)
		if err == nil && station.VotingProcessID != "" {
			// Broadcast tally update for the voting process
			broadcastErr := c.webSocketService.BroadcastTallyUpdate(station.VotingProcessID)
			if broadcastErr != nil {
				logger.WithError(broadcastErr).Error("Failed to broadcast tally update via WebSocket")
				// Don't return error - consensus processing succeeded, broadcast failure is not critical
			} else {
				logger.WithField("voting_process_id", station.VotingProcessID).Info("WebSocket tally update broadcast triggered")
			}
		}
	}

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

// SubmissionGroup represents a group of submissions with identical results
type SubmissionGroup struct {
	Results     map[string]int     `json:"results"`
	Submissions []models.Submission `json:"submissions"`
	WalletCount int                `json:"walletCount"`
}

// groupSubmissionsByResults groups submissions by identical results and enforces wallet uniqueness
func (c *ConsensusService) groupSubmissionsByResults(submissions []models.Submission) map[string]*SubmissionGroup {
	groups := make(map[string]*SubmissionGroup)
	walletTracker := make(map[string]map[string]bool) // resultKey -> walletAddress -> bool

	for _, submission := range submissions {
		// Create a consistent key for the results map
		resultKey := c.createResultKey(submission.Results)
		
		// Initialize group if it doesn't exist
		if _, exists := groups[resultKey]; !exists {
			groups[resultKey] = &SubmissionGroup{
				Results:     make(map[string]int),
				Submissions: []models.Submission{},
				WalletCount: 0,
			}
			// Copy the results map
			for k, v := range submission.Results {
				groups[resultKey].Results[k] = v
			}
			walletTracker[resultKey] = make(map[string]bool)
		}

		// Check wallet uniqueness for this result group
		if !walletTracker[resultKey][submission.WalletAddress] {
			// First submission from this wallet for this result group
			groups[resultKey].Submissions = append(groups[resultKey].Submissions, submission)
			groups[resultKey].WalletCount++
			walletTracker[resultKey][submission.WalletAddress] = true
		}
		// If wallet already submitted for this result group, ignore (latest submission already handled by storage)
	}

	return groups
}

// createResultKey creates a consistent string key for a results map
func (c *ConsensusService) createResultKey(results map[string]int) string {
	// Create a deterministic string representation of the results map
	// We'll use a simple format: "candidate1:votes1,candidate2:votes2" (sorted by candidate name)
	key := ""
	
	// Get all candidate names and sort them for consistency
	candidates := make([]string, 0, len(results))
	for candidate := range results {
		candidates = append(candidates, candidate)
	}
	
	// Simple sort (bubble sort for small arrays)
	for i := 0; i < len(candidates)-1; i++ {
		for j := 0; j < len(candidates)-i-1; j++ {
			if candidates[j] > candidates[j+1] {
				candidates[j], candidates[j+1] = candidates[j+1], candidates[j]
			}
		}
	}
	
	// Build the key
	for i, candidate := range candidates {
		if i > 0 {
			key += ","
		}
		key += fmt.Sprintf("%s:%d", candidate, results[candidate])
	}
	
	return key
}

// areResultsIdentical compares two results maps for exact equality
func (c *ConsensusService) areResultsIdentical(results1, results2 map[string]int) bool {
	return reflect.DeepEqual(results1, results2)
}

// calculateMajorityConsensus implements the majority-based verification algorithm
func (c *ConsensusService) calculateMajorityConsensus(resultGroups map[string]*SubmissionGroup, totalSubmissions int, logger *logrus.Entry) *ConsensusResult {
	var largestGroup *SubmissionGroup
	maxWalletCount := 0

	// Find the group with the most unique wallet addresses
	for _, group := range resultGroups {
		if group.WalletCount > maxWalletCount {
			maxWalletCount = group.WalletCount
			largestGroup = group
		}
	}

	logger.WithFields(logrus.Fields{
		"largest_group_wallets": maxWalletCount,
		"total_submissions":     totalSubmissions,
		"result_groups_count":   len(resultGroups),
	}).Info("Analyzing consensus groups")

	// Check if the largest group meets the minimum threshold
	if maxWalletCount < c.threshold {
		return &ConsensusResult{
			Status:          "Pending",
			ConfidenceLevel: 0.0,
			Message:         fmt.Sprintf("Largest consensus group has %d wallets (threshold: %d)", maxWalletCount, c.threshold),
		}
	}

	// Check if the largest group constitutes a majority (>50% of submissions)
	majorityThreshold := float64(totalSubmissions) * 0.5
	if float64(maxWalletCount) > majorityThreshold {
		// We have consensus!
		confidenceLevel := c.calculateConfidenceLevel(largestGroup, totalSubmissions)
		
		logger.WithFields(logrus.Fields{
			"verified_results":   largestGroup.Results,
			"confidence_level":   confidenceLevel,
			"consensus_wallets":  maxWalletCount,
		}).Info("Consensus reached - results verified")

		return &ConsensusResult{
			Status:          "Verified",
			VerifiedResults: largestGroup.Results,
			ConfidenceLevel: confidenceLevel,
			Message:         fmt.Sprintf("Consensus reached with %d wallets (%.1f%% of submissions)", maxWalletCount, float64(maxWalletCount)/float64(totalSubmissions)*100),
		}
	}

	// No majority consensus
	return &ConsensusResult{
		Status:          "Pending",
		ConfidenceLevel: 0.0,
		Message:         fmt.Sprintf("No majority consensus - largest group: %d wallets (%.1f%% of %d submissions)", maxWalletCount, float64(maxWalletCount)/float64(totalSubmissions)*100, totalSubmissions),
	}
}

// calculateConfidenceLevel calculates confidence level for verified results
func (c *ConsensusService) calculateConfidenceLevel(group *SubmissionGroup, totalSubmissions int) float64 {
	// Base confidence is the percentage of submissions that agree
	baseConfidence := float64(group.WalletCount) / float64(totalSubmissions)
	
	// Boost confidence if we have more than minimum threshold
	if group.WalletCount > c.threshold {
		// Add bonus for submissions beyond threshold (up to 0.1 additional confidence)
		bonus := float64(group.WalletCount-c.threshold) * 0.02
		if bonus > 0.1 {
			bonus = 0.1
		}
		baseConfidence += bonus
	}
	
	// Cap confidence at 1.0
	if baseConfidence > 1.0 {
		baseConfidence = 1.0
	}
	
	return baseConfidence
}