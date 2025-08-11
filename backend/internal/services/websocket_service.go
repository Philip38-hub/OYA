package services

import (
	"encoding/json"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

// WebSocketService provides WebSocket functionality for real-time updates
type WebSocketService struct {
	hub          *WebSocketHub
	tallyService *TallyService
	logger       *logrus.Logger
}

// NewWebSocketService creates a new WebSocket service
func NewWebSocketService(tallyService *TallyService, logger *logrus.Logger) *WebSocketService {
	hub := NewWebSocketHub(logger)
	
	service := &WebSocketService{
		hub:          hub,
		tallyService: tallyService,
		logger:       logger,
	}

	// Start the hub in a goroutine
	go hub.Run()

	logger.Info("WebSocket service initialized")
	return service
}

// HandleConnection handles new WebSocket connections
func (ws *WebSocketService) HandleConnection(c *gin.Context) {
	ws.hub.HandleWebSocketConnection(c)
}

// BroadcastTallyUpdate broadcasts tally updates to all connected clients
func (ws *WebSocketService) BroadcastTallyUpdate(votingProcessID string) error {
	logger := ws.logger.WithFields(logrus.Fields{
		"service":           "websocket_service",
		"voting_process_id": votingProcessID,
	})

	logger.Info("Broadcasting tally update")

	// Get fresh tally data
	tallyData, err := ws.tallyService.GetTallyData(votingProcessID)
	if err != nil {
		logger.WithError(err).Error("Failed to get tally data for broadcast")
		return err
	}

	// Broadcast the update
	err = ws.hub.BroadcastTallyUpdate(votingProcessID, tallyData)
	if err != nil {
		logger.WithError(err).Error("Failed to broadcast tally update")
		return err
	}

	logger.WithField("client_count", ws.hub.GetClientCount()).Info("Tally update broadcast completed")
	return nil
}

// GetConnectedClientCount returns the number of connected WebSocket clients
func (ws *WebSocketService) GetConnectedClientCount() int {
	return ws.hub.GetClientCount()
}

// BroadcastMessage broadcasts a generic message to all connected clients
func (ws *WebSocketService) BroadcastMessage(messageType string, data interface{}) error {
	logger := ws.logger.WithFields(logrus.Fields{
		"service":      "websocket_service",
		"message_type": messageType,
	})
	
	logger.Info("Broadcasting generic message")

	message := WebSocketMessage{
		Type:      messageType,
		Data:      data,
		Timestamp: time.Now(),
	}

	messageBytes, err := json.Marshal(message)
	if err != nil {
		logger.WithError(err).Error("Failed to marshal broadcast message")
		return err
	}

	select {
	case ws.hub.broadcast <- messageBytes:
		return nil
	default:
		logger.Error("Broadcast channel is full, dropping message")
		return nil
	}
}

// Shutdown gracefully shuts down the WebSocket service
func (ws *WebSocketService) Shutdown() {
	ws.logger.Info("Shutting down WebSocket service")
	// Close all client connections
	// The hub will handle cleanup when clients disconnect
}