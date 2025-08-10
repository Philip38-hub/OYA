package services

import (
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/sirupsen/logrus"

	"oyah-backend/internal/models"
)

func setupConsensusTest() (*ConsensusService, *StorageService) {
	// Create test logger (silent for tests)
	logger := logrus.New()
	logger.SetLevel(logrus.PanicLevel) // Only log panics during tests

	// Create storage service
	storageService := NewStorageService()

	// Create consensus service
	consensusService := NewConsensusService(storageService, logger)

	return consensusService, storageService
}

func TestConsensusService_ProcessConsensus_NoSubmissions(t *testing.T) {
	consensusService, _ := setupConsensusTest()

	// Try to process consensus for non-existent station
	result, err := consensusService.ProcessConsensus("NON_EXISTENT")
	
	if err == nil {
		t.Error("Expected error for non-existent polling station")
	}
	
	if result != nil {
		t.Error("Expected nil result for non-existent polling station")
	}
}

func TestConsensusService_ProcessConsensus_BelowThreshold(t *testing.T) {
	consensusService, storageService := setupConsensusTest()

	// Create and store a single submission (below threshold of 3)
	submission := models.Submission{
		ID:               "sub1",
		WalletAddress:    "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
		PollingStationID: "STATION_001",
		GPSCoordinates: models.GPSCoordinates{
			Latitude:  40.7128,
			Longitude: -74.0060,
		},
		Timestamp: time.Now(),
		Results: map[string]int{
			"Candidate A": 100,
			"Candidate B": 150,
		},
		SubmissionType: "image_ocr",
		Confidence:     0.85,
	}

	err := storageService.StoreSubmission(submission)
	if err != nil {
		t.Fatalf("Failed to store submission: %v", err)
	}

	// Process consensus
	result, err := consensusService.ProcessConsensus("STATION_001")
	if err != nil {
		t.Fatalf("ProcessConsensus failed: %v", err)
	}

	// Verify result
	if result.Status != "Pending" {
		t.Errorf("Expected status 'Pending', got %s", result.Status)
	}

	if result.ConfidenceLevel != 0.0 {
		t.Errorf("Expected confidence level 0.0, got %f", result.ConfidenceLevel)
	}

	// Verify polling station was updated
	station, err := storageService.GetPollingStation("STATION_001")
	if err != nil {
		t.Fatalf("Failed to get polling station: %v", err)
	}

	if station.Status != "Pending" {
		t.Errorf("Expected station status 'Pending', got %s", station.Status)
	}
}

func TestConsensusService_ProcessConsensus_AtThreshold(t *testing.T) {
	consensusService, storageService := setupConsensusTest()

	// Create and store 3 submissions (at threshold) with identical results
	wallets := []string{
		"5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
		"5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty",
		"5DAAnrj7VHTznn2AWBemMuyBwZWs6FNFjdyVXUeYum3PTXFy",
	}

	expectedResults := map[string]int{
		"Candidate A": 100,
		"Candidate B": 150,
	}

	for i, wallet := range wallets {
		submission := models.Submission{
			ID:               fmt.Sprintf("sub%d", i+1),
			WalletAddress:    wallet,
			PollingStationID: "STATION_001",
			GPSCoordinates: models.GPSCoordinates{
				Latitude:  40.7128,
				Longitude: -74.0060,
			},
			Timestamp: time.Now(),
			Results: expectedResults,
			SubmissionType: "image_ocr",
			Confidence:     0.85,
		}

		err := storageService.StoreSubmission(submission)
		if err != nil {
			t.Fatalf("Failed to store submission %d: %v", i+1, err)
		}
	}

	// Process consensus
	result, err := consensusService.ProcessConsensus("STATION_001")
	if err != nil {
		t.Fatalf("ProcessConsensus failed: %v", err)
	}

	// Should be verified since all 3 submissions are identical (100% consensus)
	if result.Status != "Verified" {
		t.Errorf("Expected status 'Verified', got %s", result.Status)
	}

	// Should have the verified results
	if !consensusService.areResultsIdentical(result.VerifiedResults, expectedResults) {
		t.Errorf("Expected verified results to match submitted results")
	}

	// Should have confidence level 1.0 (100% consensus)
	if result.ConfidenceLevel != 1.0 {
		t.Errorf("Expected confidence level 1.0, got %f", result.ConfidenceLevel)
	}
}

func TestConsensusService_GetConsensusStatus(t *testing.T) {
	consensusService, storageService := setupConsensusTest()

	// Create and store a submission
	submission := models.Submission{
		ID:               "sub1",
		WalletAddress:    "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
		PollingStationID: "STATION_001",
		GPSCoordinates: models.GPSCoordinates{
			Latitude:  40.7128,
			Longitude: -74.0060,
		},
		Timestamp: time.Now(),
		Results: map[string]int{
			"Candidate A": 100,
			"Candidate B": 150,
		},
		SubmissionType: "image_ocr",
		Confidence:     0.85,
	}

	err := storageService.StoreSubmission(submission)
	if err != nil {
		t.Fatalf("Failed to store submission: %v", err)
	}

	// Get consensus status
	result, err := consensusService.GetConsensusStatus("STATION_001")
	if err != nil {
		t.Fatalf("GetConsensusStatus failed: %v", err)
	}

	// Verify result
	if result.Status != "Pending" {
		t.Errorf("Expected status 'Pending', got %s", result.Status)
	}

	if result.Message == "" {
		t.Error("Expected non-empty message")
	}
}

func TestConsensusService_GetConsensusStatus_NonExistent(t *testing.T) {
	consensusService, _ := setupConsensusTest()

	// Try to get status for non-existent station
	result, err := consensusService.GetConsensusStatus("NON_EXISTENT")
	
	if err == nil {
		t.Error("Expected error for non-existent polling station")
	}
	
	if result != nil {
		t.Error("Expected nil result for non-existent polling station")
	}
}

func TestConsensusService_SetConsensusThreshold(t *testing.T) {
	consensusService, _ := setupConsensusTest()

	// Test setting valid threshold
	consensusService.SetConsensusThreshold(5)
	if consensusService.threshold != 5 {
		t.Errorf("Expected threshold 5, got %d", consensusService.threshold)
	}

	// Test setting invalid threshold (should not change)
	originalThreshold := consensusService.threshold
	consensusService.SetConsensusThreshold(0)
	if consensusService.threshold != originalThreshold {
		t.Errorf("Expected threshold to remain %d, got %d", originalThreshold, consensusService.threshold)
	}

	consensusService.SetConsensusThreshold(-1)
	if consensusService.threshold != originalThreshold {
		t.Errorf("Expected threshold to remain %d, got %d", originalThreshold, consensusService.threshold)
	}
}

// Helper function to check if a string contains a substring
func contains(s, substr string) bool {
	return strings.Contains(s, substr)
}

// Test grouping submissions by identical results
func TestConsensusService_GroupSubmissionsByResults(t *testing.T) {
	consensusService, _ := setupConsensusTest()

	// Create submissions with different results
	submissions := []models.Submission{
		{
			ID:            "sub1",
			WalletAddress: "wallet1",
			Results:       map[string]int{"Candidate A": 100, "Candidate B": 150},
		},
		{
			ID:            "sub2",
			WalletAddress: "wallet2",
			Results:       map[string]int{"Candidate A": 100, "Candidate B": 150}, // Same as sub1
		},
		{
			ID:            "sub3",
			WalletAddress: "wallet3",
			Results:       map[string]int{"Candidate A": 120, "Candidate B": 130}, // Different
		},
		{
			ID:            "sub4",
			WalletAddress: "wallet1", // Same wallet as sub1, should be ignored for uniqueness
			Results:       map[string]int{"Candidate A": 100, "Candidate B": 150},
		},
	}

	groups := consensusService.groupSubmissionsByResults(submissions)

	// Should have 2 groups (identical results grouped together)
	if len(groups) != 2 {
		t.Errorf("Expected 2 groups, got %d", len(groups))
	}

	// Find the group with results {A:100, B:150}
	var group1 *SubmissionGroup
	for _, group := range groups {
		if group.Results["Candidate A"] == 100 && group.Results["Candidate B"] == 150 {
			group1 = group
			break
		}
	}

	if group1 == nil {
		t.Fatal("Could not find group with results A:100, B:150")
	}

	// Should have 2 unique wallets (wallet1 and wallet2), wallet1 duplicate ignored
	if group1.WalletCount != 2 {
		t.Errorf("Expected wallet count 2 for group1, got %d", group1.WalletCount)
	}

	// Find the group with results {A:120, B:130}
	var group2 *SubmissionGroup
	for _, group := range groups {
		if group.Results["Candidate A"] == 120 && group.Results["Candidate B"] == 130 {
			group2 = group
			break
		}
	}

	if group2 == nil {
		t.Fatal("Could not find group with results A:120, B:130")
	}

	// Should have 1 unique wallet
	if group2.WalletCount != 1 {
		t.Errorf("Expected wallet count 1 for group2, got %d", group2.WalletCount)
	}
}

// Test result key creation for consistent grouping
func TestConsensusService_CreateResultKey(t *testing.T) {
	consensusService, _ := setupConsensusTest()

	// Test with same results in different order
	results1 := map[string]int{"Candidate A": 100, "Candidate B": 150}
	results2 := map[string]int{"Candidate B": 150, "Candidate A": 100}

	key1 := consensusService.createResultKey(results1)
	key2 := consensusService.createResultKey(results2)

	if key1 != key2 {
		t.Errorf("Expected identical keys for same results, got %s and %s", key1, key2)
	}

	// Test with different results
	results3 := map[string]int{"Candidate A": 120, "Candidate B": 130}
	key3 := consensusService.createResultKey(results3)

	if key1 == key3 {
		t.Errorf("Expected different keys for different results, got %s for both", key1)
	}
}

// Test results comparison
func TestConsensusService_AreResultsIdentical(t *testing.T) {
	consensusService, _ := setupConsensusTest()

	results1 := map[string]int{"Candidate A": 100, "Candidate B": 150}
	results2 := map[string]int{"Candidate A": 100, "Candidate B": 150}
	results3 := map[string]int{"Candidate A": 120, "Candidate B": 130}

	// Test identical results
	if !consensusService.areResultsIdentical(results1, results2) {
		t.Error("Expected identical results to be equal")
	}

	// Test different results
	if consensusService.areResultsIdentical(results1, results3) {
		t.Error("Expected different results to not be equal")
	}
}

// Test majority consensus with verified results
func TestConsensusService_ProcessConsensus_MajorityReached(t *testing.T) {
	consensusService, storageService := setupConsensusTest()

	// Create 5 submissions: 3 with identical results (majority), 2 with different results
	identicalResults := map[string]int{"Candidate A": 100, "Candidate B": 150}
	differentResults := map[string]int{"Candidate A": 120, "Candidate B": 130}

	submissions := []models.Submission{
		{
			ID:               "sub1",
			WalletAddress:    "wallet1",
			PollingStationID: "STATION_001",
			GPSCoordinates:   models.GPSCoordinates{Latitude: 40.7128, Longitude: -74.0060},
			Timestamp:        time.Now(),
			Results:          identicalResults,
			SubmissionType:   "image_ocr",
			Confidence:       0.85,
		},
		{
			ID:               "sub2",
			WalletAddress:    "wallet2",
			PollingStationID: "STATION_001",
			GPSCoordinates:   models.GPSCoordinates{Latitude: 40.7128, Longitude: -74.0060},
			Timestamp:        time.Now(),
			Results:          identicalResults,
			SubmissionType:   "image_ocr",
			Confidence:       0.85,
		},
		{
			ID:               "sub3",
			WalletAddress:    "wallet3",
			PollingStationID: "STATION_001",
			GPSCoordinates:   models.GPSCoordinates{Latitude: 40.7128, Longitude: -74.0060},
			Timestamp:        time.Now(),
			Results:          identicalResults,
			SubmissionType:   "image_ocr",
			Confidence:       0.85,
		},
		{
			ID:               "sub4",
			WalletAddress:    "wallet4",
			PollingStationID: "STATION_001",
			GPSCoordinates:   models.GPSCoordinates{Latitude: 40.7128, Longitude: -74.0060},
			Timestamp:        time.Now(),
			Results:          differentResults,
			SubmissionType:   "image_ocr",
			Confidence:       0.85,
		},
		{
			ID:               "sub5",
			WalletAddress:    "wallet5",
			PollingStationID: "STATION_001",
			GPSCoordinates:   models.GPSCoordinates{Latitude: 40.7128, Longitude: -74.0060},
			Timestamp:        time.Now(),
			Results:          differentResults,
			SubmissionType:   "image_ocr",
			Confidence:       0.85,
		},
	}

	// Store all submissions
	for _, submission := range submissions {
		err := storageService.StoreSubmission(submission)
		if err != nil {
			t.Fatalf("Failed to store submission: %v", err)
		}
	}

	// Process consensus
	result, err := consensusService.ProcessConsensus("STATION_001")
	if err != nil {
		t.Fatalf("ProcessConsensus failed: %v", err)
	}

	// Should be verified since 3 out of 5 (60%) have identical results
	if result.Status != "Verified" {
		t.Errorf("Expected status 'Verified', got %s", result.Status)
	}

	// Should have the majority results
	if !consensusService.areResultsIdentical(result.VerifiedResults, identicalResults) {
		t.Errorf("Expected verified results to match majority results")
	}

	// Should have confidence level > 0.5
	if result.ConfidenceLevel <= 0.5 {
		t.Errorf("Expected confidence level > 0.5, got %f", result.ConfidenceLevel)
	}

	// Verify polling station was updated
	station, err := storageService.GetPollingStation("STATION_001")
	if err != nil {
		t.Fatalf("Failed to get polling station: %v", err)
	}

	if station.Status != "Verified" {
		t.Errorf("Expected station status 'Verified', got %s", station.Status)
	}

	if !consensusService.areResultsIdentical(station.VerifiedResults, identicalResults) {
		t.Errorf("Expected station verified results to match majority results")
	}
}

// Test no majority consensus
func TestConsensusService_ProcessConsensus_NoMajority(t *testing.T) {
	consensusService, storageService := setupConsensusTest()

	// Create 4 submissions: 2 with one result, 2 with another (no majority)
	results1 := map[string]int{"Candidate A": 100, "Candidate B": 150}
	results2 := map[string]int{"Candidate A": 120, "Candidate B": 130}

	submissions := []models.Submission{
		{
			ID:               "sub1",
			WalletAddress:    "wallet1",
			PollingStationID: "STATION_001",
			GPSCoordinates:   models.GPSCoordinates{Latitude: 40.7128, Longitude: -74.0060},
			Timestamp:        time.Now(),
			Results:          results1,
			SubmissionType:   "image_ocr",
			Confidence:       0.85,
		},
		{
			ID:               "sub2",
			WalletAddress:    "wallet2",
			PollingStationID: "STATION_001",
			GPSCoordinates:   models.GPSCoordinates{Latitude: 40.7128, Longitude: -74.0060},
			Timestamp:        time.Now(),
			Results:          results1,
			SubmissionType:   "image_ocr",
			Confidence:       0.85,
		},
		{
			ID:               "sub3",
			WalletAddress:    "wallet3",
			PollingStationID: "STATION_001",
			GPSCoordinates:   models.GPSCoordinates{Latitude: 40.7128, Longitude: -74.0060},
			Timestamp:        time.Now(),
			Results:          results2,
			SubmissionType:   "image_ocr",
			Confidence:       0.85,
		},
		{
			ID:               "sub4",
			WalletAddress:    "wallet4",
			PollingStationID: "STATION_001",
			GPSCoordinates:   models.GPSCoordinates{Latitude: 40.7128, Longitude: -74.0060},
			Timestamp:        time.Now(),
			Results:          results2,
			SubmissionType:   "image_ocr",
			Confidence:       0.85,
		},
	}

	// Store all submissions
	for _, submission := range submissions {
		err := storageService.StoreSubmission(submission)
		if err != nil {
			t.Fatalf("Failed to store submission: %v", err)
		}
	}

	// Process consensus
	result, err := consensusService.ProcessConsensus("STATION_001")
	if err != nil {
		t.Fatalf("ProcessConsensus failed: %v", err)
	}

	// Should remain pending since no majority (2/4 = 50%, need >50%)
	if result.Status != "Pending" {
		t.Errorf("Expected status 'Pending', got %s", result.Status)
	}

	// Should have confidence level 0
	if result.ConfidenceLevel != 0.0 {
		t.Errorf("Expected confidence level 0.0, got %f", result.ConfidenceLevel)
	}
}

// Test confidence level calculation
func TestConsensusService_CalculateConfidenceLevel(t *testing.T) {
	consensusService, _ := setupConsensusTest()

	// Helper function for floating point comparison
	floatEquals := func(a, b, tolerance float64) bool {
		return (a-b) < tolerance && (b-a) < tolerance
	}

	// Test with exact threshold (3 out of 5 = 60%)
	group := &SubmissionGroup{WalletCount: 3}
	confidence := consensusService.calculateConfidenceLevel(group, 5)
	expected := 0.6 // 60%
	if !floatEquals(confidence, expected, 0.001) {
		t.Errorf("Expected confidence %f, got %f", expected, confidence)
	}

	// Test with above threshold (4 out of 5 = 80% + bonus)
	group = &SubmissionGroup{WalletCount: 4}
	confidence = consensusService.calculateConfidenceLevel(group, 5)
	expected = 0.82 // 80% + 2% bonus for 1 submission above threshold
	if !floatEquals(confidence, expected, 0.001) {
		t.Errorf("Expected confidence %f, got %f", expected, confidence)
	}

	// Test with unanimous (5 out of 5 = 100% + bonus, capped at 1.0)
	group = &SubmissionGroup{WalletCount: 5}
	confidence = consensusService.calculateConfidenceLevel(group, 5)
	expected = 1.0 // Capped at 1.0
	if !floatEquals(confidence, expected, 0.001) {
		t.Errorf("Expected confidence %f, got %f", expected, confidence)
	}
}

// Test edge case: exactly at majority threshold (51%)
func TestConsensusService_ProcessConsensus_ExactMajority(t *testing.T) {
	consensusService, storageService := setupConsensusTest()

	// Create 7 submissions: 4 with identical results (57% majority), 3 with different results
	majorityResults := map[string]int{"Candidate A": 100, "Candidate B": 150}
	minorityResults := map[string]int{"Candidate A": 120, "Candidate B": 130}

	// 4 submissions with majority results
	for i := 1; i <= 4; i++ {
		submission := models.Submission{
			ID:               fmt.Sprintf("sub%d", i),
			WalletAddress:    fmt.Sprintf("wallet%d", i),
			PollingStationID: "STATION_001",
			GPSCoordinates:   models.GPSCoordinates{Latitude: 40.7128, Longitude: -74.0060},
			Timestamp:        time.Now(),
			Results:          majorityResults,
			SubmissionType:   "image_ocr",
			Confidence:       0.85,
		}
		err := storageService.StoreSubmission(submission)
		if err != nil {
			t.Fatalf("Failed to store submission: %v", err)
		}
	}

	// 3 submissions with minority results
	for i := 5; i <= 7; i++ {
		submission := models.Submission{
			ID:               fmt.Sprintf("sub%d", i),
			WalletAddress:    fmt.Sprintf("wallet%d", i),
			PollingStationID: "STATION_001",
			GPSCoordinates:   models.GPSCoordinates{Latitude: 40.7128, Longitude: -74.0060},
			Timestamp:        time.Now(),
			Results:          minorityResults,
			SubmissionType:   "image_ocr",
			Confidence:       0.85,
		}
		err := storageService.StoreSubmission(submission)
		if err != nil {
			t.Fatalf("Failed to store submission: %v", err)
		}
	}

	// Process consensus
	result, err := consensusService.ProcessConsensus("STATION_001")
	if err != nil {
		t.Fatalf("ProcessConsensus failed: %v", err)
	}

	// Should be verified since 4 out of 7 (57%) have identical results
	if result.Status != "Verified" {
		t.Errorf("Expected status 'Verified', got %s", result.Status)
	}

	// Should have the majority results
	if !consensusService.areResultsIdentical(result.VerifiedResults, majorityResults) {
		t.Errorf("Expected verified results to match majority results")
	}
}

// Test edge case: below minimum threshold but above majority percentage
func TestConsensusService_ProcessConsensus_BelowThresholdAboveMajority(t *testing.T) {
	consensusService, storageService := setupConsensusTest()

	// Create 2 submissions with identical results (100% majority but below threshold of 3)
	identicalResults := map[string]int{"Candidate A": 100, "Candidate B": 150}

	for i := 1; i <= 2; i++ {
		submission := models.Submission{
			ID:               fmt.Sprintf("sub%d", i),
			WalletAddress:    fmt.Sprintf("wallet%d", i),
			PollingStationID: "STATION_001",
			GPSCoordinates:   models.GPSCoordinates{Latitude: 40.7128, Longitude: -74.0060},
			Timestamp:        time.Now(),
			Results:          identicalResults,
			SubmissionType:   "image_ocr",
			Confidence:       0.85,
		}
		err := storageService.StoreSubmission(submission)
		if err != nil {
			t.Fatalf("Failed to store submission: %v", err)
		}
	}

	// Process consensus
	result, err := consensusService.ProcessConsensus("STATION_001")
	if err != nil {
		t.Fatalf("ProcessConsensus failed: %v", err)
	}

	// Should remain pending since below minimum threshold (2 < 3)
	if result.Status != "Pending" {
		t.Errorf("Expected status 'Pending', got %s", result.Status)
	}

	// Should have confidence level 0
	if result.ConfidenceLevel != 0.0 {
		t.Errorf("Expected confidence level 0.0, got %f", result.ConfidenceLevel)
	}
}

// Test wallet uniqueness enforcement
func TestConsensusService_ProcessConsensus_WalletUniqueness(t *testing.T) {
	consensusService, storageService := setupConsensusTest()

	// Create multiple submissions from same wallet (should only count once)
	results := map[string]int{"Candidate A": 100, "Candidate B": 150}

	// First submission from wallet1
	submission1 := models.Submission{
		ID:               "sub1",
		WalletAddress:    "wallet1",
		PollingStationID: "STATION_001",
		GPSCoordinates:   models.GPSCoordinates{Latitude: 40.7128, Longitude: -74.0060},
		Timestamp:        time.Now(),
		Results:          results,
		SubmissionType:   "image_ocr",
		Confidence:       0.85,
	}

	// Second submission from same wallet1 (should replace first)
	submission2 := models.Submission{
		ID:               "sub2",
		WalletAddress:    "wallet1",
		PollingStationID: "STATION_001",
		GPSCoordinates:   models.GPSCoordinates{Latitude: 40.7128, Longitude: -74.0060},
		Timestamp:        time.Now().Add(time.Minute), // Later timestamp
		Results:          results,
		SubmissionType:   "image_ocr",
		Confidence:       0.90,
	}

	// Submissions from other wallets
	submission3 := models.Submission{
		ID:               "sub3",
		WalletAddress:    "wallet2",
		PollingStationID: "STATION_001",
		GPSCoordinates:   models.GPSCoordinates{Latitude: 40.7128, Longitude: -74.0060},
		Timestamp:        time.Now(),
		Results:          results,
		SubmissionType:   "image_ocr",
		Confidence:       0.85,
	}

	submission4 := models.Submission{
		ID:               "sub4",
		WalletAddress:    "wallet3",
		PollingStationID: "STATION_001",
		GPSCoordinates:   models.GPSCoordinates{Latitude: 40.7128, Longitude: -74.0060},
		Timestamp:        time.Now(),
		Results:          results,
		SubmissionType:   "image_ocr",
		Confidence:       0.85,
	}

	// Store submissions
	for _, sub := range []models.Submission{submission1, submission2, submission3, submission4} {
		err := storageService.StoreSubmission(sub)
		if err != nil {
			t.Fatalf("Failed to store submission: %v", err)
		}
	}

	// Process consensus
	result, err := consensusService.ProcessConsensus("STATION_001")
	if err != nil {
		t.Fatalf("ProcessConsensus failed: %v", err)
	}

	// Should be verified since we have 3 unique wallets (wallet1 counted once, wallet2, wallet3)
	if result.Status != "Verified" {
		t.Errorf("Expected status 'Verified', got %s", result.Status)
	}

	// Verify that only 3 submissions are counted (not 4)
	submissions := storageService.GetSubmissionsByStation("STATION_001")
	if len(submissions) != 3 {
		t.Errorf("Expected 3 submissions after duplicate handling, got %d", len(submissions))
	}
}