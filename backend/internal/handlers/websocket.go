package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"

	"oyah-backend/internal/services"
)

// WebSocketHandler handles WebSocket connections for real-time updates
type WebSocketHandler struct {
	webSocketService *services.WebSocketService
	logger           *logrus.Logger
}

// NewWebSocketHandler creates a new WebSocket handler
func NewWebSocketHandler(webSocketService *services.WebSocketService, logger *logrus.Logger) *WebSocketHandler {
	return &WebSocketHandler{
		webSocketService: webSocketService,
		logger:           logger,
	}
}

// HandleWebSocket handles WebSocket connection upgrades
func (h *WebSocketHandler) HandleWebSocket(c *gin.Context) {
	logger := h.logger.WithFields(logrus.Fields{
		"handler":     "websocket",
		"remote_addr": c.Request.RemoteAddr,
		"user_agent":  c.Request.UserAgent(),
	})

	logger.Info("Handling WebSocket connection request")

	// Check if the request is a valid WebSocket upgrade request
	if c.Request.Header.Get("Upgrade") != "websocket" {
		logger.Error("Invalid WebSocket upgrade request")
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid WebSocket upgrade request",
			"code":  "INVALID_UPGRADE",
		})
		return
	}

	// Handle the WebSocket connection
	h.webSocketService.HandleConnection(c)
}

// GetWebSocketStats returns WebSocket connection statistics
func (h *WebSocketHandler) GetWebSocketStats(c *gin.Context) {
	logger := h.logger.WithField("handler", "websocket_stats")
	logger.Info("Getting WebSocket statistics")

	stats := gin.H{
		"connected_clients": h.webSocketService.GetConnectedClientCount(),
		"status":           "active",
	}

	c.JSON(http.StatusOK, stats)
}