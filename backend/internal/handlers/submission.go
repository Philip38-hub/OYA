package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/sirupsen/logrus"

	"oyah-backend/internal/models"
	"oyah-backend/internal/services"
)

// SubmissionHandler handles submission-related HTTP requests
type SubmissionHandler struct {
	storageService    *services.StorageService
	validationService *services.ValidationService
	consensusService  *services.ConsensusService
	logger           *logrus.Logger
}

// NewSubmissionHandler creates a new submission handler
func NewSubmissionHandler(storage *services.StorageService, validation *services.ValidationService, consensus *services.ConsensusService, logger *logrus.Logger) *SubmissionHandler {
	return &SubmissionHandler{
		storageService:    storage,
		validationService: validation,
		consensusService:  consensus,
		logger:           logger,
	}
}

// SubmitResult handles POST /api/v1/submitResult requests
func (h *SubmissionHandler) SubmitResult(c *gin.Context) {
	// Generate request ID for tracing
	requestID := uuid.New().String()
	
	// Create logger with request context
	logger := h.logger.WithFields(logrus.Fields{
		"request_id": requestID,
		"endpoint":   "submitResult",
		"method":     c.Request.Method,
		"client_ip":  c.ClientIP(),
	})

	logger.Info("Processing submission request")

	var req models.SubmissionRequest
	
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
		"wallet_address":     req.WalletAddress,
		"polling_station_id": req.PollingStationID,
		"submission_type":    req.SubmissionType,
	})

	// Validate submission
	if err := h.validationService.ValidateSubmission(req); err != nil {
		logger.WithError(err).Error("Submission validation failed")
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error:   "Validation failed",
			Code:    "VALIDATION_ERROR",
			Details: err.Error(),
		})
		return
	}

	// Create submission model
	submission := models.Submission{
		ID:               uuid.New().String(),
		WalletAddress:    req.WalletAddress,
		PollingStationID: req.PollingStationID,
		GPSCoordinates:   req.GPSCoordinates,
		Timestamp:        req.Timestamp,
		Results:          req.Results,
		SubmissionType:   req.SubmissionType,
		Confidence:       req.Confidence,
	}

	// Store submission
	if err := h.storageService.StoreSubmission(submission); err != nil {
		logger.WithError(err).Error("Failed to store submission")
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error:   "Failed to store submission",
			Code:    "STORAGE_ERROR",
			Details: err.Error(),
		})
		return
	}

	logger.WithField("submission_id", submission.ID).Info("Submission stored successfully")

	// Trigger consensus processing
	consensusResult, err := h.consensusService.ProcessConsensus(submission.PollingStationID)
	if err != nil {
		logger.WithError(err).Error("Consensus processing failed")
		// Don't fail the request if consensus processing fails
		// The submission is already stored successfully
		logger.Warn("Continuing despite consensus processing failure")
	} else {
		logger.WithFields(logrus.Fields{
			"consensus_status":     consensusResult.Status,
			"consensus_confidence": consensusResult.ConfidenceLevel,
		}).Info("Consensus processing completed")
	}

	// Prepare response
	response := gin.H{
		"success":       true,
		"submission_id": submission.ID,
		"message":       "Submission received and stored successfully",
	}

	// Include consensus information if available
	if consensusResult != nil {
		response["consensus"] = gin.H{
			"status":          consensusResult.Status,
			"confidence_level": consensusResult.ConfidenceLevel,
			"message":         consensusResult.Message,
		}
	}

	// Return success response
	c.JSON(http.StatusOK, response)
}