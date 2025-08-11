package services

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"

	"oyah-backend/internal/models"
)

// ErrorHandler provides centralized error handling and logging
type ErrorHandler struct {
	logger *logrus.Logger
}

// NewErrorHandler creates a new error handler instance
func NewErrorHandler(logger *logrus.Logger) *ErrorHandler {
	return &ErrorHandler{
		logger: logger,
	}
}

// ErrorType represents different types of errors
type ErrorType string

const (
	ErrorTypeValidation    ErrorType = "VALIDATION_ERROR"
	ErrorTypeNotFound      ErrorType = "NOT_FOUND"
	ErrorTypeConflict      ErrorType = "CONFLICT"
	ErrorTypeInternal      ErrorType = "INTERNAL_ERROR"
	ErrorTypeUnauthorized  ErrorType = "UNAUTHORIZED"
	ErrorTypeBadRequest    ErrorType = "BAD_REQUEST"
	ErrorTypeServiceError  ErrorType = "SERVICE_ERROR"
)

// APIError represents a structured API error
type APIError struct {
	Type       ErrorType `json:"type"`
	Message    string    `json:"message"`
	Details    string    `json:"details,omitempty"`
	StatusCode int       `json:"-"`
}

// Error implements the error interface
func (e *APIError) Error() string {
	return e.Message
}

// NewAPIError creates a new API error
func NewAPIError(errorType ErrorType, message string, details string, statusCode int) *APIError {
	return &APIError{
		Type:       errorType,
		Message:    message,
		Details:    details,
		StatusCode: statusCode,
	}
}

// HandleError handles errors with proper logging and HTTP response
func (eh *ErrorHandler) HandleError(c *gin.Context, err error, context map[string]interface{}) {
	// Extract request ID from context if available
	requestID, exists := c.Get("request_id")
	if !exists {
		requestID = "unknown"
	}

	// Create base logger with context
	logFields := logrus.Fields{
		"request_id": requestID,
	}
	
	// Safely add request information if available
	if c.Request != nil {
		logFields["endpoint"] = c.Request.URL.Path
		logFields["method"] = c.Request.Method
	}
	
	// Safely add client IP
	if clientIP := c.ClientIP(); clientIP != "" {
		logFields["client_ip"] = clientIP
	}
	
	logger := eh.logger.WithFields(logFields)

	// Add additional context if provided
	if context != nil {
		for key, value := range context {
			logger = logger.WithField(key, value)
		}
	}

	// Handle different error types
	var apiError *APIError
	var ok bool

	if apiError, ok = err.(*APIError); ok {
		// It's already an APIError
		logger.WithError(err).Error("API error occurred")
	} else {
		// Convert generic error to APIError
		apiError = eh.classifyError(err)
		logger.WithError(err).Error("Error occurred")
	}

	// Send HTTP response
	c.JSON(apiError.StatusCode, models.ErrorResponse{
		Error:   apiError.Message,
		Code:    string(apiError.Type),
		Details: apiError.Details,
	})
}

// classifyError classifies generic errors into APIErrors
func (eh *ErrorHandler) classifyError(err error) *APIError {
	errMsg := err.Error()

	// Check for common error patterns
	switch {
	case containsIgnoreCase(errMsg, "not found"):
		return NewAPIError(ErrorTypeNotFound, "Resource not found", errMsg, http.StatusNotFound)
	case containsIgnoreCase(errMsg, "validation failed"), containsIgnoreCase(errMsg, "invalid"):
		return NewAPIError(ErrorTypeValidation, "Validation failed", errMsg, http.StatusBadRequest)
	case containsIgnoreCase(errMsg, "already exists"), containsIgnoreCase(errMsg, "duplicate"):
		return NewAPIError(ErrorTypeConflict, "Resource conflict", errMsg, http.StatusConflict)
	case containsIgnoreCase(errMsg, "unauthorized"), containsIgnoreCase(errMsg, "permission denied"):
		return NewAPIError(ErrorTypeUnauthorized, "Unauthorized access", errMsg, http.StatusUnauthorized)
	default:
		return NewAPIError(ErrorTypeInternal, "Internal server error", "An unexpected error occurred", http.StatusInternalServerError)
	}
}

// HandleValidationError handles validation errors specifically
func (eh *ErrorHandler) HandleValidationError(c *gin.Context, err error, field string) {
	context := map[string]interface{}{
		"validation_field": field,
		"error_type":      "validation",
	}

	apiError := NewAPIError(
		ErrorTypeValidation,
		"Validation failed",
		err.Error(),
		http.StatusBadRequest,
	)

	eh.HandleError(c, apiError, context)
}

// HandleNotFoundError handles not found errors specifically
func (eh *ErrorHandler) HandleNotFoundError(c *gin.Context, resource string, identifier string) {
	context := map[string]interface{}{
		"resource":   resource,
		"identifier": identifier,
		"error_type": "not_found",
	}

	apiError := NewAPIError(
		ErrorTypeNotFound,
		fmt.Sprintf("%s not found", resource),
		fmt.Sprintf("The requested %s with identifier '%s' does not exist", resource, identifier),
		http.StatusNotFound,
	)

	eh.HandleError(c, apiError, context)
}

// HandleInternalError handles internal server errors
func (eh *ErrorHandler) HandleInternalError(c *gin.Context, err error, operation string) {
	context := map[string]interface{}{
		"operation":  operation,
		"error_type": "internal",
	}

	apiError := NewAPIError(
		ErrorTypeInternal,
		"Internal server error",
		"An unexpected error occurred while processing your request",
		http.StatusInternalServerError,
	)

	eh.HandleError(c, apiError, context)
}

// HandleServiceError handles service-level errors
func (eh *ErrorHandler) HandleServiceError(c *gin.Context, err error, service string, operation string) {
	context := map[string]interface{}{
		"service":    service,
		"operation":  operation,
		"error_type": "service",
	}

	apiError := NewAPIError(
		ErrorTypeServiceError,
		"Service error",
		fmt.Sprintf("Error in %s service during %s operation", service, operation),
		http.StatusInternalServerError,
	)

	eh.HandleError(c, apiError, context)
}

// LogInfo logs informational messages with context
func (eh *ErrorHandler) LogInfo(c *gin.Context, message string, context map[string]interface{}) {
	requestID, exists := c.Get("request_id")
	if !exists {
		requestID = "unknown"
	}

	logFields := logrus.Fields{
		"request_id": requestID,
	}
	
	if c.Request != nil {
		logFields["endpoint"] = c.Request.URL.Path
		logFields["method"] = c.Request.Method
	}
	
	if clientIP := c.ClientIP(); clientIP != "" {
		logFields["client_ip"] = clientIP
	}
	
	logger := eh.logger.WithFields(logFields)

	if context != nil {
		for key, value := range context {
			logger = logger.WithField(key, value)
		}
	}

	logger.Info(message)
}

// LogWarning logs warning messages with context
func (eh *ErrorHandler) LogWarning(c *gin.Context, message string, context map[string]interface{}) {
	requestID, exists := c.Get("request_id")
	if !exists {
		requestID = "unknown"
	}

	logFields := logrus.Fields{
		"request_id": requestID,
	}
	
	if c.Request != nil {
		logFields["endpoint"] = c.Request.URL.Path
		logFields["method"] = c.Request.Method
	}
	
	if clientIP := c.ClientIP(); clientIP != "" {
		logFields["client_ip"] = clientIP
	}
	
	logger := eh.logger.WithFields(logFields)

	if context != nil {
		for key, value := range context {
			logger = logger.WithField(key, value)
		}
	}

	logger.Warning(message)
}

// RecoverFromPanic recovers from panics and logs them appropriately
func (eh *ErrorHandler) RecoverFromPanic(c *gin.Context) {
	if r := recover(); r != nil {
		err := fmt.Errorf("panic recovered: %v", r)
		eh.HandleInternalError(c, err, "panic_recovery")
		c.Abort()
	}
}

// Helper function to check if string contains substring (case-insensitive)
func containsIgnoreCase(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || 
		(len(s) > len(substr) && 
			(s[:len(substr)] == substr || 
			 s[len(s)-len(substr):] == substr ||
			 containsSubstring(s, substr))))
}

func containsSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}