package services

import (
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/sirupsen/logrus"
)

// WebSocketClient represents a connected WebSocket client
type WebSocketClient struct {
	ID         string
	Connection *websocket.Conn
	Send       chan []byte
	Hub        *WebSocketHub
	Logger     *logrus.Entry
}

// WebSocketHub manages WebSocket client connections and broadcasts
type WebSocketHub struct {
	// Registered clients
	clients map[*WebSocketClient]bool

	// Inbound messages from clients
	broadcast chan []byte

	// Register requests from clients
	register chan *WebSocketClient

	// Unregister requests from clients
	unregister chan *WebSocketClient

	// Mutex for thread-safe operations
	mutex sync.RWMutex

	// Logger
	logger *logrus.Logger
}

// TallyUpdate represents a WebSocket message for tally updates
type TallyUpdate struct {
	Type            string      `json:"type"` // "tally_update"
	VotingProcessID string      `json:"votingProcessId"`
	Data            interface{} `json:"data"`
	Timestamp       time.Time   `json:"timestamp"`
}

// WebSocketMessage represents a generic WebSocket message
type WebSocketMessage struct {
	Type      string      `json:"type"`
	Data      interface{} `json:"data"`
	Timestamp time.Time   `json:"timestamp"`
}

// WebSocket upgrader configuration
var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// Allow connections from any origin for development
		// In production, implement proper origin checking
		return true
	},
}

// NewWebSocketHub creates a new WebSocket hub
func NewWebSocketHub(logger *logrus.Logger) *WebSocketHub {
	return &WebSocketHub{
		clients:    make(map[*WebSocketClient]bool),
		broadcast:  make(chan []byte, 256),
		register:   make(chan *WebSocketClient),
		unregister: make(chan *WebSocketClient),
		logger:     logger,
	}
}

// Run starts the WebSocket hub and handles client management
func (h *WebSocketHub) Run() {
	logger := h.logger.WithField("service", "websocket_hub")
	logger.Info("Starting WebSocket hub")

	for {
		select {
		case client := <-h.register:
			h.registerClient(client, logger)

		case client := <-h.unregister:
			h.unregisterClient(client, logger)

		case message := <-h.broadcast:
			h.broadcastMessage(message, logger)
		}
	}
}

// registerClient registers a new WebSocket client
func (h *WebSocketHub) registerClient(client *WebSocketClient, logger *logrus.Entry) {
	h.mutex.Lock()
	defer h.mutex.Unlock()

	h.clients[client] = true
	logger.WithFields(logrus.Fields{
		"client_id":     client.ID,
		"total_clients": len(h.clients),
	}).Info("WebSocket client registered")
}

// unregisterClient unregisters a WebSocket client
func (h *WebSocketHub) unregisterClient(client *WebSocketClient, logger *logrus.Entry) {
	h.mutex.Lock()
	defer h.mutex.Unlock()

	if _, ok := h.clients[client]; ok {
		delete(h.clients, client)
		close(client.Send)
		logger.WithFields(logrus.Fields{
			"client_id":     client.ID,
			"total_clients": len(h.clients),
		}).Info("WebSocket client unregistered")
	}
}

// broadcastMessage sends a message to all connected clients
func (h *WebSocketHub) broadcastMessage(message []byte, logger *logrus.Entry) {
	h.mutex.RLock()
	clientCount := len(h.clients)
	clients := make([]*WebSocketClient, 0, clientCount)
	for client := range h.clients {
		clients = append(clients, client)
	}
	h.mutex.RUnlock()

	logger.WithField("client_count", clientCount).Debug("Broadcasting message to clients")

	for _, client := range clients {
		select {
		case client.Send <- message:
			// Message sent successfully
		default:
			// Client's send channel is full, close the connection
			h.unregisterClient(client, logger)
			client.Connection.Close()
		}
	}
}

// BroadcastTallyUpdate broadcasts a tally update to all connected clients
func (h *WebSocketHub) BroadcastTallyUpdate(votingProcessID string, tallyData interface{}) error {
	update := TallyUpdate{
		Type:            "tally_update",
		VotingProcessID: votingProcessID,
		Data:            tallyData,
		Timestamp:       time.Now(),
	}

	message, err := json.Marshal(update)
	if err != nil {
		h.logger.WithError(err).Error("Failed to marshal tally update")
		return err
	}

	select {
	case h.broadcast <- message:
		h.logger.WithFields(logrus.Fields{
			"voting_process_id": votingProcessID,
			"message_type":      "tally_update",
		}).Info("Tally update queued for broadcast")
		return nil
	default:
		h.logger.Error("Broadcast channel is full, dropping tally update")
		return nil // Don't return error to avoid blocking consensus processing
	}
}

// GetClientCount returns the current number of connected clients
func (h *WebSocketHub) GetClientCount() int {
	h.mutex.RLock()
	defer h.mutex.RUnlock()
	return len(h.clients)
}

// HandleWebSocketConnection handles new WebSocket connections
func (h *WebSocketHub) HandleWebSocketConnection(c *gin.Context) {
	logger := h.logger.WithFields(logrus.Fields{
		"service":    "websocket",
		"remote_addr": c.Request.RemoteAddr,
		"user_agent":  c.Request.UserAgent(),
	})

	// Upgrade HTTP connection to WebSocket
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		logger.WithError(err).Error("Failed to upgrade connection to WebSocket")
		return
	}

	// Create client
	clientID := generateClientID()
	client := &WebSocketClient{
		ID:         clientID,
		Connection: conn,
		Send:       make(chan []byte, 256),
		Hub:        h,
		Logger:     logger.WithField("client_id", clientID),
	}

	// Register client
	h.register <- client

	// Start client goroutines
	go client.writePump()
	go client.readPump()
}

// generateClientID generates a unique client ID
func generateClientID() string {
	return time.Now().Format("20060102150405") + "-" + randomString(6)
}

// randomString generates a random string of specified length
func randomString(length int) string {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, length)
	for i := range b {
		b[i] = charset[time.Now().UnixNano()%int64(len(charset))]
	}
	return string(b)
}

// Constants for WebSocket configuration
const (
	// Time allowed to write a message to the peer
	writeWait = 10 * time.Second

	// Time allowed to read the next pong message from the peer
	pongWait = 60 * time.Second

	// Send pings to peer with this period. Must be less than pongWait
	pingPeriod = (pongWait * 9) / 10

	// Maximum message size allowed from peer
	maxMessageSize = 512
)

// readPump pumps messages from the WebSocket connection to the hub
func (c *WebSocketClient) readPump() {
	defer func() {
		c.Hub.unregister <- c
		c.Connection.Close()
	}()

	// Set read limits and deadline
	c.Connection.SetReadLimit(maxMessageSize)
	c.Connection.SetReadDeadline(time.Now().Add(pongWait))
	c.Connection.SetPongHandler(func(string) error {
		c.Connection.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		// Read message from client
		_, message, err := c.Connection.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				c.Logger.WithError(err).Error("WebSocket connection closed unexpectedly")
			} else {
				c.Logger.Debug("WebSocket connection closed normally")
			}
			break
		}

		// Log received message (for debugging)
		c.Logger.WithField("message", string(message)).Debug("Received message from client")

		// For now, we don't process client messages, but this is where
		// we would handle client-to-server communication if needed
	}
}

// writePump pumps messages from the hub to the WebSocket connection
func (c *WebSocketClient) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.Connection.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Connection.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// The hub closed the channel
				c.Connection.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.Connection.NextWriter(websocket.TextMessage)
			if err != nil {
				c.Logger.WithError(err).Error("Failed to get WebSocket writer")
				return
			}
			w.Write(message)

			// Add queued messages to the current WebSocket message
			n := len(c.Send)
			for i := 0; i < n; i++ {
				w.Write([]byte{'\n'})
				w.Write(<-c.Send)
			}

			if err := w.Close(); err != nil {
				c.Logger.WithError(err).Error("Failed to close WebSocket writer")
				return
			}

		case <-ticker.C:
			c.Connection.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.Connection.WriteMessage(websocket.PingMessage, nil); err != nil {
				c.Logger.WithError(err).Debug("Failed to send ping message")
				return
			}
		}
	}
}

// SendMessage sends a message to this specific client
func (c *WebSocketClient) SendMessage(messageType string, data interface{}) error {
	message := WebSocketMessage{
		Type:      messageType,
		Data:      data,
		Timestamp: time.Now(),
	}

	messageBytes, err := json.Marshal(message)
	if err != nil {
		c.Logger.WithError(err).Error("Failed to marshal message")
		return err
	}

	select {
	case c.Send <- messageBytes:
		return nil
	default:
		c.Logger.Error("Client send channel is full")
		return nil // Don't return error to avoid blocking
	}
}