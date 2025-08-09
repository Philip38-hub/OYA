package models

import "time"

// GPSCoordinates represents geographical coordinates
type GPSCoordinates struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
}

// Submission represents a polling result submission from a mobile client
type Submission struct {
	ID               string            `json:"id"`
	WalletAddress    string            `json:"walletAddress"`
	PollingStationID string            `json:"pollingStationId"`
	GPSCoordinates   GPSCoordinates    `json:"gpsCoordinates"`
	Timestamp        time.Time         `json:"timestamp"`
	Results          map[string]int    `json:"results"`
	SubmissionType   string            `json:"submissionType"` // "image_ocr" | "audio_stt"
	Confidence       float64           `json:"confidence"`
	ProcessedAt      time.Time         `json:"processedAt"`
}

// PollingStation represents a polling station with its verification status
type PollingStation struct {
	ID              string            `json:"id"`
	VotingProcessID string            `json:"votingProcessId"`
	Status          string            `json:"status"` // "Pending" | "Verified"
	VerifiedResults map[string]int    `json:"verifiedResults,omitempty"`
	Submissions     []Submission      `json:"submissions"`
	ConsensusReached *time.Time       `json:"consensusReached,omitempty"`
	ConfidenceLevel float64           `json:"confidenceLevel"`
}

// VotingProcess represents a complete voting process with multiple polling stations
type VotingProcess struct {
	ID              string      `json:"id"`
	Title           string      `json:"title"`
	Position        string      `json:"position"`
	Candidates      []Candidate `json:"candidates"`
	PollingStations []string    `json:"pollingStations"`
	Status          string      `json:"status"` // "Setup" | "Active" | "Complete"
	CreatedAt       time.Time   `json:"createdAt"`
	StartedAt       *time.Time  `json:"startedAt,omitempty"`
	CompletedAt     *time.Time  `json:"completedAt,omitempty"`
}

// Candidate represents a candidate in the voting process
type Candidate struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}