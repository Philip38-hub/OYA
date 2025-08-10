package models

import (
	"time"
)

// GPSCoordinates represents GPS location data
type GPSCoordinates struct {
	Latitude  float64 `json:"latitude" binding:"required"`
	Longitude float64 `json:"longitude" binding:"required"`
}

// Submission represents a polling result submission from a mobile client
type Submission struct {
	ID               string            `json:"id"`
	WalletAddress    string            `json:"walletAddress" binding:"required"`
	PollingStationID string            `json:"pollingStationId" binding:"required"`
	GPSCoordinates   GPSCoordinates    `json:"gpsCoordinates" binding:"required"`
	Timestamp        time.Time         `json:"timestamp" binding:"required"`
	Results          map[string]int    `json:"results" binding:"required"`
	SubmissionType   string            `json:"submissionType" binding:"required,oneof=image_ocr audio_stt"`
	Confidence       float64           `json:"confidence"`
	ProcessedAt      time.Time         `json:"processedAt"`
}

// SubmissionRequest represents the incoming request payload for submissions
type SubmissionRequest struct {
	WalletAddress    string            `json:"walletAddress" binding:"required"`
	PollingStationID string            `json:"pollingStationId" binding:"required"`
	GPSCoordinates   GPSCoordinates    `json:"gpsCoordinates" binding:"required"`
	Timestamp        time.Time         `json:"timestamp" binding:"required"`
	Results          map[string]int    `json:"results" binding:"required"`
	SubmissionType   string            `json:"submissionType" binding:"required,oneof=image_ocr audio_stt"`
	Confidence       float64           `json:"confidence"`
}

// PollingStation represents a polling station with its submissions and status
type PollingStation struct {
	ID              string            `json:"id"`
	VotingProcessID string            `json:"votingProcessId"`
	Status          string            `json:"status"` // "Pending" | "Verified"
	VerifiedResults map[string]int    `json:"verifiedResults,omitempty"`
	Submissions     []Submission      `json:"submissions"`
	ConsensusReached *time.Time       `json:"consensusReached,omitempty"`
	ConfidenceLevel float64           `json:"confidenceLevel"`
}

// ErrorResponse represents API error responses
type ErrorResponse struct {
	Error   string `json:"error"`
	Code    string `json:"code"`
	Details string `json:"details,omitempty"`
}