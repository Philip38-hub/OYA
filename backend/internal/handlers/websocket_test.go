package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"

	"oyah-backend/internal/services"
)

func TestWebSocketHandler_NewWebSocketHandler(t *testing.T) {
	logger := logrus.New()
	logger.SetLevel(logrus.FatalLevel) // Suppress logs during testing

	// Create dependencies
	storageService := services.NewStorageService()
	tallyService := services.NewTallyService(storageService, logger)
	webSocketService := services.NewWebSocketService(tallyService, logger)

	// Create handler
	handler := NewWebSocketHandler(webSocketService, logger)

	assert.NotNil(t, handler)
	assert.Equal(t, webSocketService, handler.webSocketService)
	assert.Equal(t, logger, handler.logger)
}

func TestWebSocketHandler_GetWebSocketStats(t *testing.T) {
	logger := logrus.New()
	logger.SetLevel(logrus.FatalLevel) // Suppress logs during testing

	// Create dependencies
	storageService := services.NewStorageService()
	tallyService := services.NewTallyService(storageService, logger)
	webSocketService := services.NewWebSocketService(tallyService, logger)
	handler := NewWebSocketHandler(webSocketService, logger)

	// Create Gin router
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/websocket/stats", handler.GetWebSocketStats)

	// Create test request
	req, _ := http.NewRequest("GET", "/websocket/stats", nil)
	w := httptest.NewRecorder()

	// Perform request
	r.ServeHTTP(w, req)

	// Verify response
	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), "connected_clients")
	assert.Contains(t, w.Body.String(), "status")
	assert.Contains(t, w.Body.String(), "active")
}

func TestWebSocketHandler_HandleWebSocket_InvalidUpgrade(t *testing.T) {
	logger := logrus.New()
	logger.SetLevel(logrus.FatalLevel) // Suppress logs during testing

	// Create dependencies
	storageService := services.NewStorageService()
	tallyService := services.NewTallyService(storageService, logger)
	webSocketService := services.NewWebSocketService(tallyService, logger)
	handler := NewWebSocketHandler(webSocketService, logger)

	// Create Gin router
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/ws", handler.HandleWebSocket)

	// Create test request without WebSocket upgrade headers
	req, _ := http.NewRequest("GET", "/ws", nil)
	w := httptest.NewRecorder()

	// Perform request
	r.ServeHTTP(w, req)

	// Verify response - should return error for invalid upgrade request
	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Contains(t, w.Body.String(), "Invalid WebSocket upgrade request")
}

func TestWebSocketHandler_HandleWebSocket_ValidUpgrade(t *testing.T) {
	// Skip this test as httptest.ResponseRecorder doesn't support WebSocket hijacking
	// This functionality is tested in the integration test in websocket_test.go
	t.Skip("WebSocket upgrade cannot be tested with httptest.ResponseRecorder - tested in integration tests")
}