package services

import (
	"fmt"
	"regexp"
	"strings"
	"time"

	"oyah-backend/internal/models"
)

// ValidationService provides validation logic for submissions
type ValidationService struct {
	walletAddressRegex *regexp.Regexp
}

// NewValidationService creates a new validation service instance
func NewValidationService() *ValidationService {
	// Polkadot wallet address regex (SS58 format)
	walletRegex := regexp.MustCompile(`^[1-9A-HJ-NP-Za-km-z]{47,48}$`)
	
	return &ValidationService{
		walletAddressRegex: walletRegex,
	}
}

// ValidateSubmission validates a submission request
func (v *ValidationService) ValidateSubmission(req models.SubmissionRequest) error {
	// Validate wallet address format
	if err := v.validateWalletAddress(req.WalletAddress); err != nil {
		return fmt.Errorf("invalid wallet address: %w", err)
	}

	// Validate polling station ID
	if err := v.validatePollingStationID(req.PollingStationID); err != nil {
		return fmt.Errorf("invalid polling station ID: %w", err)
	}

	// Validate GPS coordinates
	if err := v.validateGPSCoordinates(req.GPSCoordinates); err != nil {
		return fmt.Errorf("invalid GPS coordinates: %w", err)
	}

	// Validate timestamp (should be within last 8 hours)
	if err := v.validateTimestamp(req.Timestamp); err != nil {
		return fmt.Errorf("invalid timestamp: %w", err)
	}

	// Validate results
	if err := v.validateResults(req.Results); err != nil {
		return fmt.Errorf("invalid results: %w", err)
	}

	// Validate submission type
	if err := v.validateSubmissionType(req.SubmissionType); err != nil {
		return fmt.Errorf("invalid submission type: %w", err)
	}

	// Validate confidence (should be between 0 and 1)
	if err := v.validateConfidence(req.Confidence); err != nil {
		return fmt.Errorf("invalid confidence: %w", err)
	}

	return nil
}

// validateWalletAddress validates Polkadot wallet address format
func (v *ValidationService) validateWalletAddress(address string) error {
	if strings.TrimSpace(address) == "" {
		return fmt.Errorf("wallet address cannot be empty")
	}

	if !v.walletAddressRegex.MatchString(address) {
		return fmt.Errorf("wallet address format is invalid (expected SS58 format)")
	}

	return nil
}

// validatePollingStationID validates polling station ID format
func (v *ValidationService) validatePollingStationID(stationID string) error {
	if strings.TrimSpace(stationID) == "" {
		return fmt.Errorf("polling station ID cannot be empty")
	}

	// Basic validation - should be alphanumeric with possible hyphens/underscores
	if len(stationID) < 3 || len(stationID) > 50 {
		return fmt.Errorf("polling station ID must be between 3 and 50 characters")
	}

	validChars := regexp.MustCompile(`^[a-zA-Z0-9_-]+$`)
	if !validChars.MatchString(stationID) {
		return fmt.Errorf("polling station ID contains invalid characters")
	}

	return nil
}

// validateGPSCoordinates validates GPS coordinates range
func (v *ValidationService) validateGPSCoordinates(coords models.GPSCoordinates) error {
	// Validate latitude range (-90 to 90)
	if coords.Latitude < -90 || coords.Latitude > 90 {
		return fmt.Errorf("latitude must be between -90 and 90 degrees")
	}

	// Validate longitude range (-180 to 180)
	if coords.Longitude < -180 || coords.Longitude > 180 {
		return fmt.Errorf("longitude must be between -180 and 180 degrees")
	}

	return nil
}

// validateTimestamp validates that timestamp is within acceptable range
func (v *ValidationService) validateTimestamp(timestamp time.Time) error {
	now := time.Now()
	
	// Check if timestamp is in the future (with 5 minute tolerance for clock skew)
	if timestamp.After(now.Add(5 * time.Minute)) {
		return fmt.Errorf("timestamp cannot be in the future")
	}

	// Check if timestamp is too old (more than 8 hours)
	if timestamp.Before(now.Add(-8 * time.Hour)) {
		return fmt.Errorf("timestamp is too old (must be within last 8 hours)")
	}

	return nil
}

// validateResults validates the results map
func (v *ValidationService) validateResults(results map[string]int) error {
	if len(results) == 0 {
		return fmt.Errorf("results cannot be empty")
	}

	// Validate that all values are non-negative
	for candidate, votes := range results {
		if strings.TrimSpace(candidate) == "" {
			return fmt.Errorf("candidate name cannot be empty")
		}

		if votes < 0 {
			return fmt.Errorf("vote count for %s cannot be negative", candidate)
		}
	}

	return nil
}

// validateSubmissionType validates the submission type
func (v *ValidationService) validateSubmissionType(submissionType string) error {
	validTypes := map[string]bool{
		"image_ocr": true,
		"audio_stt": true,
	}

	if !validTypes[submissionType] {
		return fmt.Errorf("submission type must be either 'image_ocr' or 'audio_stt'")
	}

	return nil
}

// validateConfidence validates the confidence score
func (v *ValidationService) validateConfidence(confidence float64) error {
	if confidence < 0 || confidence > 1 {
		return fmt.Errorf("confidence must be between 0 and 1")
	}

	return nil
}