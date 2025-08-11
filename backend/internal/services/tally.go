package services

import (
	"fmt"
	"time"

	"github.com/sirupsen/logrus"
	"oyah-backend/internal/models"
)

// TallyService handles tally calculation and aggregation for voting processes
type TallyService struct {
	storageService *StorageService
	logger         *logrus.Logger
}

// TallyResponse represents the response structure for tally data
type TallyResponse struct {
	VotingProcess   VotingProcessInfo `json:"votingProcess"`
	AggregatedTally map[string]int    `json:"aggregatedTally"`
	PollingStations []StationStatus   `json:"pollingStations"`
	LastUpdated     time.Time         `json:"lastUpdated"`
}

// VotingProcessInfo represents voting process information in tally response
type VotingProcessInfo struct {
	ID         string             `json:"id"`
	Title      string             `json:"title"`
	Position   string             `json:"position"`
	Candidates []models.Candidate `json:"candidates"`
	Status     string             `json:"status"`
}

// StationStatus represents polling station status in tally response
type StationStatus struct {
	ID         string         `json:"id"`
	Status     string         `json:"status"` // "Pending" | "Verified"
	Results    map[string]int `json:"results,omitempty"`
	Confidence float64        `json:"confidence,omitempty"`
}

// NewTallyService creates a new tally service instance
func NewTallyService(storage *StorageService, logger *logrus.Logger) *TallyService {
	return &TallyService{
		storageService: storage,
		logger:         logger,
	}
}

// GetTallyData calculates and returns aggregated tally data for a voting process
func (t *TallyService) GetTallyData(votingProcessID string) (*TallyResponse, error) {
	logger := t.logger.WithFields(logrus.Fields{
		"voting_process_id": votingProcessID,
		"service":          "tally",
	})

	logger.Info("Calculating tally data for voting process")

	// Get voting process
	votingProcess, err := t.storageService.GetVotingProcess(votingProcessID)
	if err != nil {
		logger.WithError(err).Error("Failed to get voting process")
		return nil, fmt.Errorf("voting process not found: %w", err)
	}

	// Get polling stations for this voting process
	pollingStations, err := t.storageService.GetPollingStationsByVotingProcess(votingProcessID)
	if err != nil {
		logger.WithError(err).Error("Failed to get polling stations")
		return nil, fmt.Errorf("failed to get polling stations: %w", err)
	}

	logger.WithField("polling_stations_count", len(pollingStations)).Info("Retrieved polling stations")

	// Calculate aggregated tally from verified results only
	aggregatedTally := t.calculateAggregatedTally(pollingStations, votingProcess.Candidates, logger)

	// Build station status list
	stationStatuses := t.buildStationStatusList(pollingStations, logger)

	// Create response
	response := &TallyResponse{
		VotingProcess: VotingProcessInfo{
			ID:         votingProcess.ID,
			Title:      votingProcess.Title,
			Position:   votingProcess.Position,
			Candidates: votingProcess.Candidates,
			Status:     votingProcess.Status,
		},
		AggregatedTally: aggregatedTally,
		PollingStations: stationStatuses,
		LastUpdated:     time.Now(),
	}

	logger.WithFields(logrus.Fields{
		"verified_stations": t.countVerifiedStations(pollingStations),
		"pending_stations":  t.countPendingStations(pollingStations),
		"total_votes":       t.sumTotalVotes(aggregatedTally),
	}).Info("Tally calculation completed")

	return response, nil
}

// calculateAggregatedTally calculates the aggregated tally from verified polling stations only
func (t *TallyService) calculateAggregatedTally(stations []*models.PollingStation, candidates []models.Candidate, logger *logrus.Entry) map[string]int {
	aggregatedTally := make(map[string]int)

	// Initialize tally with all candidates and spoilt votes
	for _, candidate := range candidates {
		aggregatedTally[candidate.Name] = 0
	}
	aggregatedTally["spoilt"] = 0

	verifiedCount := 0
	
	// Sum up verified results only
	for _, station := range stations {
		if station.Status == "Verified" && station.VerifiedResults != nil {
			verifiedCount++
			for candidate, votes := range station.VerifiedResults {
				if _, exists := aggregatedTally[candidate]; exists {
					aggregatedTally[candidate] += votes
				} else {
					// Handle case where verified results contain candidates not in the original list
					// This could happen if there are write-in candidates or data inconsistencies
					logger.WithFields(logrus.Fields{
						"station_id": station.ID,
						"candidate":  candidate,
					}).Warn("Found candidate in verified results not in original candidate list")
					aggregatedTally[candidate] = votes
				}
			}
		}
	}

	logger.WithField("verified_stations_processed", verifiedCount).Info("Processed verified stations for aggregation")

	return aggregatedTally
}

// buildStationStatusList builds the list of station statuses for the response
func (t *TallyService) buildStationStatusList(stations []*models.PollingStation, logger *logrus.Entry) []StationStatus {
	stationStatuses := make([]StationStatus, 0, len(stations))

	for _, station := range stations {
		status := StationStatus{
			ID:     station.ID,
			Status: station.Status,
		}

		// Include results and confidence only for verified stations
		if station.Status == "Verified" && station.VerifiedResults != nil {
			status.Results = make(map[string]int)
			for k, v := range station.VerifiedResults {
				status.Results[k] = v
			}
			status.Confidence = station.ConfidenceLevel
		}
		// For pending stations, results remain nil as per requirements

		stationStatuses = append(stationStatuses, status)
	}

	return stationStatuses
}

// countVerifiedStations counts the number of verified polling stations
func (t *TallyService) countVerifiedStations(stations []*models.PollingStation) int {
	count := 0
	for _, station := range stations {
		if station.Status == "Verified" {
			count++
		}
	}
	return count
}

// countPendingStations counts the number of pending polling stations
func (t *TallyService) countPendingStations(stations []*models.PollingStation) int {
	count := 0
	for _, station := range stations {
		if station.Status == "Pending" {
			count++
		}
	}
	return count
}

// sumTotalVotes calculates the total number of votes in the aggregated tally
func (t *TallyService) sumTotalVotes(tally map[string]int) int {
	total := 0
	for _, votes := range tally {
		total += votes
	}
	return total
}

// GetTallyDataWithFreshness returns tally data with freshness tracking
func (t *TallyService) GetTallyDataWithFreshness(votingProcessID string) (*TallyResponse, error) {
	// For now, this is the same as GetTallyData since we calculate fresh data each time
	// In a production system, this could implement caching with TTL
	return t.GetTallyData(votingProcessID)
}

// HandleZeroResultScenarios ensures graceful handling when no verified results exist
func (t *TallyService) HandleZeroResultScenarios(response *TallyResponse) {
	// Check if all tally values are zero
	hasAnyVotes := false
	for _, votes := range response.AggregatedTally {
		if votes > 0 {
			hasAnyVotes = true
			break
		}
	}

	// If no votes, ensure all candidates are still represented with zero values
	if !hasAnyVotes {
		t.logger.WithField("voting_process_id", response.VotingProcess.ID).Info("No verified results found - returning zero tally")
		
		// Ensure all candidates have zero entries
		for _, candidate := range response.VotingProcess.Candidates {
			if _, exists := response.AggregatedTally[candidate.Name]; !exists {
				response.AggregatedTally[candidate.Name] = 0
			}
		}
		
		// Ensure spoilt votes are represented
		if _, exists := response.AggregatedTally["spoilt"]; !exists {
			response.AggregatedTally["spoilt"] = 0
		}
	}
}