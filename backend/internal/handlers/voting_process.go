package handlers

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/sirupsen/logrus"

	"oyah-backend/internal/models"
	"oyah-backend/internal/services"
)

// VotingProcessHandler handles voting process management HTTP requests
type VotingProcessHandler struct {
	storageService *services.StorageService
	logger         *logrus.Logger
}

// NewVotingProcessHandler creates a new voting process handler
func NewVotingProcessHandler(storage *services.StorageService, logger *logrus.Logger) *VotingProcessHandler {
	return &VotingProcessHandler{
		storageService: storage,
		logger:         logger,
	}
}

// CreateVotingProcess handles POST /api/v1/voting-process requests
func (h *VotingProcessHandler) CreateVotingProcess(c *gin.Context) {
	// Generate request ID for tracing
	requestID := uuid.New().String()
	
	// Create logger with request context
	logger := h.logger.WithFields(logrus.Fields{
		"request_id": requestID,
		"endpoint":   "createVotingProcess",
		"method":     c.Request.Method,
		"client_ip":  c.ClientIP(),
	})

	logger.Info("Processing create voting process request")

	var req models.VotingProcessRequest
	
	// Bind JSON payload
	if err := c.ShouldBindJSON(&req); err != nil {
		logger.WithError(err).Error("Failed to bind JSON payload")
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error:   "Invalid JSON payload",
			Code:    "INVALID_JSON",
			Details: err.Error(),
		})
		return
	}

	// Add request details to logger
	logger = logger.WithFields(logrus.Fields{
		"title":              req.Title,
		"position":           req.Position,
		"candidates_count":   len(req.Candidates),
		"polling_stations_count": len(req.PollingStations),
	})

	// Validate request
	if err := h.validateVotingProcessRequest(req); err != nil {
		logger.WithError(err).Error("Voting process validation failed")
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error:   "Validation failed",
			Code:    "VALIDATION_ERROR",
			Details: err.Error(),
		})
		return
	}

	// Create voting process model
	votingProcess := models.VotingProcess{
		ID:              uuid.New().String(),
		Title:           req.Title,
		Position:        req.Position,
		Candidates:      req.Candidates,
		PollingStations: req.PollingStations,
		Status:          "Setup",
		CreatedAt:       time.Now(),
	}

	// Store voting process
	if err := h.storageService.StoreVotingProcess(votingProcess); err != nil {
		logger.WithError(err).Error("Failed to store voting process")
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error:   "Failed to create voting process",
			Code:    "STORAGE_ERROR",
			Details: err.Error(),
		})
		return
	}

	logger.WithField("voting_process_id", votingProcess.ID).Info("Voting process created successfully")

	// Return success response
	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"voting_process": votingProcess,
		"message": "Voting process created successfully",
	})
}

// StartVotingProcess handles PUT /api/v1/voting-process/{id}/start requests
func (h *VotingProcessHandler) StartVotingProcess(c *gin.Context) {
	// Generate request ID for tracing
	requestID := uuid.New().String()
	
	// Get voting process ID from URL parameter
	processID := c.Param("id")
	
	// Create logger with request context
	logger := h.logger.WithFields(logrus.Fields{
		"request_id":         requestID,
		"endpoint":           "startVotingProcess",
		"method":             c.Request.Method,
		"client_ip":          c.ClientIP(),
		"voting_process_id":  processID,
	})

	logger.Info("Processing start voting process request")

	// Validate process ID
	if processID == "" {
		logger.Error("Missing voting process ID")
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error:   "Missing voting process ID",
			Code:    "MISSING_PROCESS_ID",
			Details: "Voting process ID is required in the URL path",
		})
		return
	}

	// Check if voting process exists
	votingProcess, err := h.storageService.GetVotingProcess(processID)
	if err != nil {
		logger.WithError(err).Error("Voting process not found")
		c.JSON(http.StatusNotFound, models.ErrorResponse{
			Error:   "Voting process not found",
			Code:    "PROCESS_NOT_FOUND",
			Details: err.Error(),
		})
		return
	}

	// Check if voting process is in Setup status
	if votingProcess.Status != "Setup" {
		logger.WithField("current_status", votingProcess.Status).Error("Invalid status for starting voting process")
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error:   "Cannot start voting process",
			Code:    "INVALID_STATUS",
			Details: "Voting process must be in 'Setup' status to be started",
		})
		return
	}

	// Update voting process status to Active
	if err := h.storageService.UpdateVotingProcessStatus(processID, "Active"); err != nil {
		logger.WithError(err).Error("Failed to update voting process status")
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error:   "Failed to start voting process",
			Code:    "UPDATE_ERROR",
			Details: err.Error(),
		})
		return
	}

	logger.Info("Voting process started successfully")

	// Get updated voting process
	updatedProcess, err := h.storageService.GetVotingProcess(processID)
	if err != nil {
		logger.WithError(err).Error("Failed to retrieve updated voting process")
		// Still return success since the update was successful
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "Voting process started successfully",
		})
		return
	}

	// Return success response with updated process
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"voting_process": updatedProcess,
		"message": "Voting process started successfully",
	})
}

// GetVotingProcess handles GET /api/v1/voting-process/{id} requests
func (h *VotingProcessHandler) GetVotingProcess(c *gin.Context) {
	// Generate request ID for tracing
	requestID := uuid.New().String()
	
	// Get voting process ID from URL parameter
	processID := c.Param("id")
	
	// Create logger with request context
	logger := h.logger.WithFields(logrus.Fields{
		"request_id":         requestID,
		"endpoint":           "getVotingProcess",
		"method":             c.Request.Method,
		"client_ip":          c.ClientIP(),
		"voting_process_id":  processID,
	})

	logger.Info("Processing get voting process request")

	// Validate process ID
	if processID == "" {
		logger.Error("Missing voting process ID")
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error:   "Missing voting process ID",
			Code:    "MISSING_PROCESS_ID",
			Details: "Voting process ID is required in the URL path",
		})
		return
	}

	// Get voting process
	votingProcess, err := h.storageService.GetVotingProcess(processID)
	if err != nil {
		logger.WithError(err).Error("Voting process not found")
		c.JSON(http.StatusNotFound, models.ErrorResponse{
			Error:   "Voting process not found",
			Code:    "PROCESS_NOT_FOUND",
			Details: err.Error(),
		})
		return
	}

	logger.Info("Voting process retrieved successfully")

	// Return voting process
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"voting_process": votingProcess,
	})
}

// validateVotingProcessRequest validates the voting process creation request
func (h *VotingProcessHandler) validateVotingProcessRequest(req models.VotingProcessRequest) error {
	// Title validation
	if len(req.Title) == 0 {
		return fmt.Errorf("title is required")
	}
	if len(req.Title) > 200 {
		return fmt.Errorf("title must be less than 200 characters")
	}

	// Position validation
	if len(req.Position) == 0 {
		return fmt.Errorf("position is required")
	}
	if len(req.Position) > 100 {
		return fmt.Errorf("position must be less than 100 characters")
	}

	// Candidates validation
	if len(req.Candidates) == 0 {
		return fmt.Errorf("at least one candidate is required")
	}
	if len(req.Candidates) > 50 {
		return fmt.Errorf("maximum 50 candidates allowed")
	}

	// Validate each candidate
	candidateIDs := make(map[string]bool)
	candidateNames := make(map[string]bool)
	for i, candidate := range req.Candidates {
		if len(candidate.ID) == 0 {
			return fmt.Errorf("candidate %d: ID is required", i+1)
		}
		if len(candidate.Name) == 0 {
			return fmt.Errorf("candidate %d: name is required", i+1)
		}
		if len(candidate.Name) > 100 {
			return fmt.Errorf("candidate %d: name must be less than 100 characters", i+1)
		}
		
		// Check for duplicate IDs
		if candidateIDs[candidate.ID] {
			return fmt.Errorf("duplicate candidate ID: %s", candidate.ID)
		}
		candidateIDs[candidate.ID] = true
		
		// Check for duplicate names
		if candidateNames[candidate.Name] {
			return fmt.Errorf("duplicate candidate name: %s", candidate.Name)
		}
		candidateNames[candidate.Name] = true
	}

	// Polling stations validation
	if len(req.PollingStations) == 0 {
		return fmt.Errorf("at least one polling station is required")
	}
	if len(req.PollingStations) > 1000 {
		return fmt.Errorf("maximum 1000 polling stations allowed")
	}

	// Validate each polling station ID
	stationIDs := make(map[string]bool)
	for i, stationID := range req.PollingStations {
		if len(stationID) == 0 {
			return fmt.Errorf("polling station %d: ID is required", i+1)
		}
		if len(stationID) > 50 {
			return fmt.Errorf("polling station %d: ID must be less than 50 characters", i+1)
		}
		
		// Check for duplicate station IDs
		if stationIDs[stationID] {
			return fmt.Errorf("duplicate polling station ID: %s", stationID)
		}
		stationIDs[stationID] = true
	}

	return nil
}