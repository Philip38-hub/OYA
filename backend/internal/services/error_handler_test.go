package services

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
)

func TestErrorHandler_HandleError(t *testing.T) {
	gin.SetMode(gin.TestMode)
	
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel) // Reduce noise in tests
	errorHandler := NewErrorHandler(logger)

	tests := []struct {
		name           string
		error          error
		expectedStatus int
		expectedCode   string
	}{
		{
			name:           "Not found error",
			error:          errors.New("resource not found"),
			expectedStatus: http.StatusNotFound,
			expectedCode:   "NOT_FOUND",
		},
		{
			name:           "Validation error",
			error:          errors.New("validation failed: invalid input"),
			expectedStatus: http.StatusBadRequest,
			expectedCode:   "VALIDATION_ERROR",
		},
		{
			name:           "Conflict error",
			error:          errors.New("resource already exists"),
			expectedStatus: http.StatusConflict,
			expectedCode:   "CONFLICT",
		},
		{
			name:           "Generic error",
			error:          errors.New("something went wrong"),
			expectedStatus: http.StatusInternalServerError,
			expectedCode:   "INTERNAL_ERROR",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create test context
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Set("request_id", "test-request-id")
			
			// Set up a mock request
			req, _ := http.NewRequest("GET", "/test", nil)
			c.Request = req

			// Handle the error
			errorHandler.HandleError(c, tt.error, nil)

			// Check status code
			assert.Equal(t, tt.expectedStatus, w.Code)

			// Check that response contains error information
			assert.Contains(t, w.Body.String(), tt.expectedCode)
		})
	}
}

func TestErrorHandler_HandleValidationError(t *testing.T) {
	gin.SetMode(gin.TestMode)
	
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	errorHandler := NewErrorHandler(logger)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("request_id", "test-request-id")
	
	req, _ := http.NewRequest("POST", "/test", nil)
	c.Request = req

	err := errors.New("field is required")
	errorHandler.HandleValidationError(c, err, "email")

	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Contains(t, w.Body.String(), "VALIDATION_ERROR")
	assert.Contains(t, w.Body.String(), "field is required")
}

func TestErrorHandler_HandleNotFoundError(t *testing.T) {
	gin.SetMode(gin.TestMode)
	
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	errorHandler := NewErrorHandler(logger)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("request_id", "test-request-id")
	
	req, _ := http.NewRequest("GET", "/test", nil)
	c.Request = req

	errorHandler.HandleNotFoundError(c, "user", "123")

	assert.Equal(t, http.StatusNotFound, w.Code)
	assert.Contains(t, w.Body.String(), "NOT_FOUND")
	assert.Contains(t, w.Body.String(), "user not found")
}

func TestErrorHandler_HandleInternalError(t *testing.T) {
	gin.SetMode(gin.TestMode)
	
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	errorHandler := NewErrorHandler(logger)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("request_id", "test-request-id")
	
	req, _ := http.NewRequest("POST", "/test", nil)
	c.Request = req

	err := errors.New("database connection failed")
	errorHandler.HandleInternalError(c, err, "database_query")

	assert.Equal(t, http.StatusInternalServerError, w.Code)
	assert.Contains(t, w.Body.String(), "INTERNAL_ERROR")
}

func TestErrorHandler_HandleServiceError(t *testing.T) {
	gin.SetMode(gin.TestMode)
	
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	errorHandler := NewErrorHandler(logger)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("request_id", "test-request-id")
	
	req, _ := http.NewRequest("POST", "/test", nil)
	c.Request = req

	err := errors.New("service unavailable")
	errorHandler.HandleServiceError(c, err, "consensus", "process_consensus")

	assert.Equal(t, http.StatusInternalServerError, w.Code)
	assert.Contains(t, w.Body.String(), "SERVICE_ERROR")
}

func TestAPIError(t *testing.T) {
	apiError := NewAPIError(ErrorTypeValidation, "Test error", "Test details", http.StatusBadRequest)
	
	assert.Equal(t, ErrorTypeValidation, apiError.Type)
	assert.Equal(t, "Test error", apiError.Message)
	assert.Equal(t, "Test details", apiError.Details)
	assert.Equal(t, http.StatusBadRequest, apiError.StatusCode)
	assert.Equal(t, "Test error", apiError.Error())
}

func TestErrorHandler_LogInfo(t *testing.T) {
	gin.SetMode(gin.TestMode)
	
	logger := logrus.New()
	logger.SetLevel(logrus.InfoLevel)
	errorHandler := NewErrorHandler(logger)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("request_id", "test-request-id")
	
	req, _ := http.NewRequest("GET", "/test", nil)
	c.Request = req

	context := map[string]interface{}{
		"operation": "test_operation",
		"user_id":   "123",
	}

	// This should not panic
	errorHandler.LogInfo(c, "Test info message", context)
}

func TestErrorHandler_LogWarning(t *testing.T) {
	gin.SetMode(gin.TestMode)
	
	logger := logrus.New()
	logger.SetLevel(logrus.WarnLevel)
	errorHandler := NewErrorHandler(logger)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("request_id", "test-request-id")
	
	req, _ := http.NewRequest("GET", "/test", nil)
	c.Request = req

	context := map[string]interface{}{
		"operation": "test_operation",
		"warning_type": "performance",
	}

	// This should not panic
	errorHandler.LogWarning(c, "Test warning message", context)
}