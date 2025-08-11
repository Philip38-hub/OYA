package handlers

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/sirupsen/logrus"

	"oyah-backend/internal/services"
)

// TallyHandler handles tally-related HTTP requests
type TallyHandler struct {
	tallyService *services.TallyService
	errorHandler *services.ErrorHandler
	logger       *logrus.Logger
}

// NewTallyHandler creates a new tally handler
func NewTallyHandler(tallyService *services.TallyService, errorHandler *services.ErrorHandler, logger *logrus.Logger) *TallyHandler {
	return &TallyHandler{
		tallyService: tallyService,
		errorHandler: errorHandler,
		logger:       logger,
	}
}

// GetTally handles GET /api/v1/getTally/{votingProcessId} requests
func (h *TallyHandler) GetTally(c *gin.Context) {
	// Generate request ID for tracing
	requestID := uuid.New().String()
	
	// Get voting process ID from URL parameter
	votingProcessID := c.Param("votingProcessId")
	
	// Create logger with request context
	logger := h.logger.WithFields(logrus.Fields{
		"request_id":         requestID,
		"endpoint":           "getTally",
		"method":             c.Request.Method,
		"client_ip":          c.ClientIP(),
		"voting_process_id":  votingProcessID,
	})

	logger.Info("Processing get tally request")

	// Validate voting process ID
	if votingProcessID == "" {
		h.errorHandler.HandleValidationError(c, 
			fmt.Errorf("voting process ID is required in the URL path"), 
			"votingProcessId")
		return
	}

	// Get tally data
	tallyData, err := h.tallyService.GetTallyData(votingProcessID)
	if err != nil {
		// Check if it's a "not found" error
		if contains(err.Error(), "voting process not found") {
			h.errorHandler.HandleNotFoundError(c, "voting process", votingProcessID)
			return
		}

		// Handle other service errors
		h.errorHandler.HandleServiceError(c, err, "tally", "get_tally_data")
		return
	}

	// Handle zero result scenarios gracefully
	h.tallyService.HandleZeroResultScenarios(tallyData)

	logger.WithFields(logrus.Fields{
		"verified_stations": h.countVerifiedStations(tallyData.PollingStations),
		"pending_stations":  h.countPendingStations(tallyData.PollingStations),
		"total_votes":       h.sumTotalVotes(tallyData.AggregatedTally),
	}).Info("Tally data retrieved successfully")

	// Return tally data
	c.JSON(http.StatusOK, tallyData)
}

// Helper methods for logging

func (h *TallyHandler) countVerifiedStations(stations []services.StationStatus) int {
	count := 0
	for _, station := range stations {
		if station.Status == "Verified" {
			count++
		}
	}
	return count
}

func (h *TallyHandler) countPendingStations(stations []services.StationStatus) int {
	count := 0
	for _, station := range stations {
		if station.Status == "Pending" {
			count++
		}
	}
	return count
}

func (h *TallyHandler) sumTotalVotes(tally map[string]int) int {
	total := 0
	for _, votes := range tally {
		total += votes
	}
	return total
}

// Helper function to check if string contains substring
func contains(s, substr string) bool {
	return strings.Contains(strings.ToLower(s), strings.ToLower(substr))
}