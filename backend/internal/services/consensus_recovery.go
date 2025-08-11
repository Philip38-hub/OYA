package services

import (
	"fmt"
	"time"

	"github.com/sirupsen/logrus"
	"oyah-backend/internal/models"
)

// ConsensusRecoveryService handles consensus engine error recovery
type ConsensusRecoveryService struct {
	storageService   *StorageService
	consensusService *ConsensusService
	logger           *logrus.Logger
	maxRetries       int
	retryDelay       time.Duration
}

// NewConsensusRecoveryService creates a new consensus recovery service
func NewConsensusRecoveryService(storage *StorageService, consensus *ConsensusService, logger *logrus.Logger) *ConsensusRecoveryService {
	return &ConsensusRecoveryService{
		storageService:   storage,
		consensusService: consensus,
		logger:           logger,
		maxRetries:       3,
		retryDelay:       time.Second * 2,
	}
}

// RecoveryResult represents the result of a consensus recovery operation
type RecoveryResult struct {
	Success         bool                `json:"success"`
	AttemptsUsed    int                 `json:"attempts_used"`
	FinalResult     *ConsensusResult    `json:"final_result,omitempty"`
	RecoveryActions []string            `json:"recovery_actions"`
	Error           string              `json:"error,omitempty"`
}

// RecoverConsensusProcessing attempts to recover from consensus processing errors
func (crs *ConsensusRecoveryService) RecoverConsensusProcessing(pollingStationID string, originalError error) *RecoveryResult {
	logger := crs.logger.WithFields(logrus.Fields{
		"polling_station_id": pollingStationID,
		"service":           "consensus_recovery",
		"original_error":    originalError.Error(),
	})

	logger.Info("Starting consensus recovery process")

	result := &RecoveryResult{
		Success:         false,
		AttemptsUsed:    0,
		RecoveryActions: []string{},
	}

	// Step 1: Validate polling station exists
	station, err := crs.storageService.GetPollingStation(pollingStationID)
	if err != nil {
		result.Error = fmt.Sprintf("polling station validation failed: %v", err)
		logger.WithError(err).Error("Polling station validation failed during recovery")
		return result
	}

	result.RecoveryActions = append(result.RecoveryActions, "validated_polling_station_exists")

	// Step 2: Check data integrity
	if err := crs.validateDataIntegrity(station); err != nil {
		logger.WithError(err).Warning("Data integrity issues found, attempting repair")
		if repairErr := crs.repairDataIntegrity(station); repairErr != nil {
			result.Error = fmt.Sprintf("data integrity repair failed: %v", repairErr)
			logger.WithError(repairErr).Error("Failed to repair data integrity")
			return result
		}
		result.RecoveryActions = append(result.RecoveryActions, "repaired_data_integrity")
	}

	// Step 3: Retry consensus processing with exponential backoff
	for attempt := 1; attempt <= crs.maxRetries; attempt++ {
		result.AttemptsUsed = attempt
		
		logger.WithField("attempt", attempt).Info("Attempting consensus recovery")

		// Wait before retry (except for first attempt)
		if attempt > 1 {
			delay := time.Duration(attempt-1) * crs.retryDelay
			logger.WithField("delay_seconds", delay.Seconds()).Info("Waiting before retry")
			time.Sleep(delay)
		}

		// Attempt consensus processing
		consensusResult, err := crs.consensusService.ProcessConsensus(pollingStationID)
		if err == nil {
			// Success!
			result.Success = true
			result.FinalResult = consensusResult
			result.RecoveryActions = append(result.RecoveryActions, fmt.Sprintf("consensus_retry_success_attempt_%d", attempt))
			
			logger.WithFields(logrus.Fields{
				"attempt":     attempt,
				"status":      consensusResult.Status,
				"confidence":  consensusResult.ConfidenceLevel,
			}).Info("Consensus recovery successful")
			
			return result
		}

		// Log the retry failure
		logger.WithFields(logrus.Fields{
			"attempt": attempt,
			"error":   err.Error(),
		}).Warning("Consensus retry failed")

		result.RecoveryActions = append(result.RecoveryActions, fmt.Sprintf("consensus_retry_failed_attempt_%d", attempt))

		// If this is the last attempt, set the error
		if attempt == crs.maxRetries {
			result.Error = fmt.Sprintf("consensus recovery failed after %d attempts: %v", crs.maxRetries, err)
		}
	}

	// Step 4: If all retries failed, attempt emergency recovery
	logger.Warning("All consensus retries failed, attempting emergency recovery")
	if emergencyResult := crs.attemptEmergencyRecovery(pollingStationID); emergencyResult != nil {
		result.Success = true
		result.FinalResult = emergencyResult
		result.RecoveryActions = append(result.RecoveryActions, "emergency_recovery_success")
		
		logger.Info("Emergency consensus recovery successful")
		return result
	}

	result.RecoveryActions = append(result.RecoveryActions, "emergency_recovery_failed")
	logger.Error("Consensus recovery completely failed")
	
	return result
}

// validateDataIntegrity checks for data integrity issues
func (crs *ConsensusRecoveryService) validateDataIntegrity(station *models.PollingStation) error {
	// Check for nil or empty submissions
	if station.Submissions == nil {
		return fmt.Errorf("submissions list is nil")
	}

	// Check for duplicate wallet addresses in submissions
	walletAddresses := make(map[string]bool)
	for _, submission := range station.Submissions {
		if walletAddresses[submission.WalletAddress] {
			return fmt.Errorf("duplicate wallet address found: %s", submission.WalletAddress)
		}
		walletAddresses[submission.WalletAddress] = true

		// Validate submission data
		if submission.Results == nil || len(submission.Results) == 0 {
			return fmt.Errorf("submission %s has empty results", submission.ID)
		}

		// Check for negative vote counts
		for candidate, votes := range submission.Results {
			if votes < 0 {
				return fmt.Errorf("negative vote count for candidate %s in submission %s", candidate, submission.ID)
			}
		}
	}

	return nil
}

// repairDataIntegrity attempts to repair data integrity issues
func (crs *ConsensusRecoveryService) repairDataIntegrity(station *models.PollingStation) error {
	logger := crs.logger.WithField("polling_station_id", station.ID)

	// Initialize submissions if nil
	if station.Submissions == nil {
		station.Submissions = []models.Submission{}
		logger.Info("Initialized empty submissions list")
	}

	// Remove duplicate submissions (keep the latest one per wallet)
	uniqueSubmissions := make(map[string]models.Submission)
	for _, submission := range station.Submissions {
		existing, exists := uniqueSubmissions[submission.WalletAddress]
		if !exists || submission.ProcessedAt.After(existing.ProcessedAt) {
			uniqueSubmissions[submission.WalletAddress] = submission
		}
	}

	// Rebuild submissions list
	repairedSubmissions := make([]models.Submission, 0, len(uniqueSubmissions))
	for _, submission := range uniqueSubmissions {
		// Fix negative vote counts
		if submission.Results != nil {
			for candidate, votes := range submission.Results {
				if votes < 0 {
					logger.WithFields(logrus.Fields{
						"submission_id": submission.ID,
						"candidate":     candidate,
						"original_votes": votes,
					}).Warning("Fixed negative vote count")
					submission.Results[candidate] = 0
				}
			}
		}
		repairedSubmissions = append(repairedSubmissions, submission)
	}

	station.Submissions = repairedSubmissions
	
	logger.WithFields(logrus.Fields{
		"original_count": len(station.Submissions),
		"repaired_count": len(repairedSubmissions),
	}).Info("Data integrity repair completed")

	return nil
}

// attemptEmergencyRecovery performs emergency recovery when normal consensus fails
func (crs *ConsensusRecoveryService) attemptEmergencyRecovery(pollingStationID string) *ConsensusResult {
	logger := crs.logger.WithFields(logrus.Fields{
		"polling_station_id": pollingStationID,
		"recovery_type":     "emergency",
	})

	logger.Warning("Attempting emergency consensus recovery")

	// Get current submissions
	submissions := crs.storageService.GetSubmissionsByStation(pollingStationID)
	if len(submissions) == 0 {
		logger.Error("No submissions found for emergency recovery")
		return nil
	}

	// Emergency strategy: If we have at least 2 identical submissions, consider it verified
	// This is a fallback when normal consensus fails due to technical issues
	resultGroups := make(map[string][]models.Submission)
	
	for _, submission := range submissions {
		key := crs.createResultKey(submission.Results)
		resultGroups[key] = append(resultGroups[key], submission)
	}

	// Find the largest group
	var largestResults map[string]int
	maxCount := 0

	for _, group := range resultGroups {
		if len(group) > maxCount {
			maxCount = len(group)
			largestResults = group[0].Results // All submissions in group have identical results
		}
	}

	// Emergency threshold: at least 2 submissions with identical results
	if maxCount >= 2 {
		// Calculate emergency confidence (lower than normal)
		confidence := float64(maxCount) / float64(len(submissions)) * 0.7 // Reduced confidence for emergency recovery

		result := &ConsensusResult{
			Status:          "Verified",
			VerifiedResults: largestResults,
			ConfidenceLevel: confidence,
			Message:         fmt.Sprintf("Emergency recovery: %d identical submissions found", maxCount),
		}

		// Update storage
		err := crs.storageService.UpdatePollingStationStatus(
			pollingStationID,
			result.Status,
			result.VerifiedResults,
			result.ConfidenceLevel,
		)

		if err != nil {
			logger.WithError(err).Error("Failed to update polling station status during emergency recovery")
			return nil
		}

		logger.WithFields(logrus.Fields{
			"identical_submissions": maxCount,
			"total_submissions":     len(submissions),
			"confidence":           confidence,
		}).Warning("Emergency consensus recovery completed")

		return result
	}

	logger.Error("Emergency recovery failed: insufficient identical submissions")
	return nil
}

// createResultKey creates a consistent string key for results (same as consensus service)
func (crs *ConsensusRecoveryService) createResultKey(results map[string]int) string {
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

// SetRetryConfiguration allows customizing retry behavior
func (crs *ConsensusRecoveryService) SetRetryConfiguration(maxRetries int, retryDelay time.Duration) {
	if maxRetries > 0 {
		crs.maxRetries = maxRetries
	}
	if retryDelay > 0 {
		crs.retryDelay = retryDelay
	}
	
	crs.logger.WithFields(logrus.Fields{
		"max_retries":  crs.maxRetries,
		"retry_delay":  crs.retryDelay.Seconds(),
	}).Info("Consensus recovery configuration updated")
}