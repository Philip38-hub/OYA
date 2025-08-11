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
	storageService         *services.StorageService
	validationService      *services.ValidationService
	consensusService       *services.ConsensusService
	consensusRecovery      *services.ConsensusRecoveryService
	errorHandler          *services.ErrorHandler
	logger                *logrus.Logger
}

// NewSubmissionHandler creates a new submission handler
func NewSubmissionHandler(storage *services.StorageService, validation *services.ValidationService, consensus *services.ConsensusService, consensusRecovery *services.ConsensusRecoveryService, errorHandler *services.ErrorHandler, logger *logrus.Logger) *SubmissionHandler {
	return &SubmissionHandler{
		storageService:    storage,
		validationService: validation,
		consensusService:  consensus,
		consensusRecovery: consensusRecovery,
		errorHandler:     errorHandler,
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
	
	// Store request ID in context for error handler
	c.Set("request_id", requestID)

	// Bind JSON payload
	if err := c.ShouldBindJSON(&req); err != nil {
		h.errorHandler.HandleValidationError(c, err, "json_payload")
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
		context := map[string]interface{}{
			"wallet_address":     req.WalletAddress,
			"polling_station_id": req.PollingStationID,
			"submission_type":    req.SubmissionType,
		}
		h.errorHandler.HandleError(c, err, context)
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
		h.errorHandler.HandleServiceError(c, err, "storage", "store_submission")
		return
	}

	logger.WithField("submission_id", submission.ID).Info("Submission stored successfully")

	// Trigger consensus processing with recovery
	consensusResult, err := h.consensusService.ProcessConsensus(submission.PollingStationID)
	if err != nil {
		// Attempt consensus recovery
		logger.WithError(err).Warning("Consensus processing failed, attempting recovery")
		
		recoveryResult := h.consensusRecovery.RecoverConsensusProcessing(submission.PollingStationID, err)
		
		if recoveryResult.Success {
			consensusResult = recoveryResult.FinalResult
			logger.WithFields(logrus.Fields{
				"recovery_attempts": recoveryResult.AttemptsUsed,
				"recovery_actions":  recoveryResult.RecoveryActions,
				"consensus_status":  consensusResult.Status,
			}).Info("Consensus recovery successful")
		} else {
			// Log the failure but don't fail the request
			logger.WithFields(logrus.Fields{
				"recovery_attempts": recoveryResult.AttemptsUsed,
				"recovery_actions":  recoveryResult.RecoveryActions,
				"recovery_error":    recoveryResult.Error,
			}).Error("Consensus recovery failed")
			
			// Continue without consensus result
			logger.Warning("Continuing despite consensus processing and recovery failure")
		}
	} else {
		logger.WithFields(logrus.Fields{
			"consensus_status":     consensusResult.Status,
			"consensus_confidence": consensusResult.ConfidenceLevel,
		}).Info("Consensus processing completed successfully")
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