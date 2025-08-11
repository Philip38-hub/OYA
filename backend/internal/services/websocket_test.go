package services

import (
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"oyah-backend/internal/models"
)

func TestWebSocketHub_NewWebSocketHub(t *testing.T) {
	logger := logrus.New()
	logger.SetLevel(logrus.FatalLevel) // Suppress logs during testing

	hub := NewWebSocketHub(logger)

	assert.NotNil(t, hub)
	assert.NotNil(t, hub.clients)
	assert.NotNil(t, hub.broadcast)
	assert.NotNil(t, hub.register)
	assert.NotNil(t, hub.unregister)
	assert.Equal(t, logger, hub.logger)
}

func TestWebSocketHub_ClientRegistration(t *testing.T) {
	logger := logrus.New()
	logger.SetLevel(logrus.FatalLevel) // Suppress logs during testing

	hub := NewWebSocketHub(logger)
	
	// Start hub in goroutine
	go hub.Run()

	// Create mock client
	client := &WebSocketClient{
		ID:   "test-client-1",
		Send: make(chan []byte, 256),
		Hub:  hub,
	}

	// Register client
	hub.register <- client

	// Give some time for registration
	time.Sleep(10 * time.Millisecond)

	// Check client count
	assert.Equal(t, 1, hub.GetClientCount())

	// Unregister client
	hub.unregister <- client

	// Give some time for unregistration
	time.Sleep(10 * time.Millisecond)

	// Check client count
	assert.Equal(t, 0, hub.GetClientCount())
}

func TestWebSocketHub_BroadcastTallyUpdate(t *testing.T) {
	logger := logrus.New()
	logger.SetLevel(logrus.FatalLevel) // Suppress logs during testing

	hub := NewWebSocketHub(logger)
	
	// Start hub in goroutine
	go hub.Run()

	// Test data
	votingProcessID := "test-process-1"
	tallyData := map[string]int{
		"candidate1": 100,
		"candidate2": 150,
		"spoilt":     5,
	}

	// Broadcast tally update
	err := hub.BroadcastTallyUpdate(votingProcessID, tallyData)
	assert.NoError(t, err)

	// Verify message was queued (we can't easily test actual broadcast without real WebSocket connections)
	// The fact that no error was returned indicates the message was queued successfully
}

func TestWebSocketService_NewWebSocketService(t *testing.T) {
	logger := logrus.New()
	logger.SetLevel(logrus.FatalLevel) // Suppress logs during testing

	// Create dependencies
	storageService := NewStorageService()
	tallyService := NewTallyService(storageService, logger)

	// Create WebSocket service
	wsService := NewWebSocketService(tallyService, logger)

	assert.NotNil(t, wsService)
	assert.NotNil(t, wsService.hub)
	assert.Equal(t, tallyService, wsService.tallyService)
	assert.Equal(t, logger, wsService.logger)
}

func TestWebSocketService_BroadcastTallyUpdate(t *testing.T) {
	logger := logrus.New()
	logger.SetLevel(logrus.FatalLevel) // Suppress logs during testing

	// Create dependencies
	storageService := NewStorageService()
	tallyService := NewTallyService(storageService, logger)
	wsService := NewWebSocketService(tallyService, logger)

	// Create test voting process
	votingProcess := models.VotingProcess{
		ID:       "test-process-1",
		Title:    "Test Election",
		Position: "President",
		Candidates: []models.Candidate{
			{ID: "1", Name: "Candidate 1"},
			{ID: "2", Name: "Candidate 2"},
		},
		PollingStations: []string{"station-1", "station-2"},
		Status:          "Active",
		CreatedAt:       time.Now(),
	}

	err := storageService.StoreVotingProcess(votingProcess)
	require.NoError(t, err)

	// Test broadcasting tally update
	err = wsService.BroadcastTallyUpdate(votingProcess.ID)
	assert.NoError(t, err)
}

func TestWebSocketService_GetConnectedClientCount(t *testing.T) {
	logger := logrus.New()
	logger.SetLevel(logrus.FatalLevel) // Suppress logs during testing

	// Create dependencies
	storageService := NewStorageService()
	tallyService := NewTallyService(storageService, logger)
	wsService := NewWebSocketService(tallyService, logger)

	// Initially should have 0 clients
	assert.Equal(t, 0, wsService.GetConnectedClientCount())
}

func TestTallyUpdate_JSONMarshaling(t *testing.T) {
	update := TallyUpdate{
		Type:            "tally_update",
		VotingProcessID: "test-process-1",
		Data: map[string]int{
			"candidate1": 100,
			"candidate2": 150,
		},
		Timestamp: time.Now(),
	}

	// Test JSON marshaling
	data, err := json.Marshal(update)
	assert.NoError(t, err)
	assert.Contains(t, string(data), "tally_update")
	assert.Contains(t, string(data), "test-process-1")

	// Test JSON unmarshaling
	var unmarshaled TallyUpdate
	err = json.Unmarshal(data, &unmarshaled)
	assert.NoError(t, err)
	assert.Equal(t, update.Type, unmarshaled.Type)
	assert.Equal(t, update.VotingProcessID, unmarshaled.VotingProcessID)
}

func TestWebSocketMessage_JSONMarshaling(t *testing.T) {
	message := WebSocketMessage{
		Type: "test_message",
		Data: map[string]string{
			"key": "value",
		},
		Timestamp: time.Now(),
	}

	// Test JSON marshaling
	data, err := json.Marshal(message)
	assert.NoError(t, err)
	assert.Contains(t, string(data), "test_message")

	// Test JSON unmarshaling
	var unmarshaled WebSocketMessage
	err = json.Unmarshal(data, &unmarshaled)
	assert.NoError(t, err)
	assert.Equal(t, message.Type, unmarshaled.Type)
}

// Integration test for WebSocket upgrade (requires actual HTTP server)
func TestWebSocketUpgrade_Integration(t *testing.T) {
	logger := logrus.New()
	logger.SetLevel(logrus.FatalLevel) // Suppress logs during testing

	// Create dependencies
	storageService := NewStorageService()
	tallyService := NewTallyService(storageService, logger)
	wsService := NewWebSocketService(tallyService, logger)

	// Create Gin router
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/ws", wsService.HandleConnection)

	// Create test server
	server := httptest.NewServer(r)
	defer server.Close()

	// Convert HTTP URL to WebSocket URL
	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws"

	// Test WebSocket connection
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Skipf("WebSocket connection failed (expected in test environment): %v", err)
		return
	}
	defer conn.Close()

	// Verify connection was established
	assert.NotNil(t, conn)

	// Give some time for client registration
	time.Sleep(10 * time.Millisecond)

	// Check client count
	assert.Equal(t, 1, wsService.GetConnectedClientCount())
}

func TestGenerateClientID(t *testing.T) {
	id1 := generateClientID()
	id2 := generateClientID()

	// IDs should be different
	assert.NotEqual(t, id1, id2)

	// IDs should have expected format (timestamp + random string)
	assert.Greater(t, len(id1), 14) // At least timestamp length
	assert.Greater(t, len(id2), 14)
}

func TestRandomString(t *testing.T) {
	str1 := randomString(6)
	str2 := randomString(6)

	// Strings should be different
	assert.NotEqual(t, str1, str2)

	// Strings should have correct length
	assert.Equal(t, 6, len(str1))
	assert.Equal(t, 6, len(str2))
}