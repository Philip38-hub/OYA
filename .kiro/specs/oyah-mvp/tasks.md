# Implementation Plan

- [x] 1. Set up project structure and development environment
  - Create React Native project with TypeScript configuration
  - Set up Golang backend project with Gin framework
  - Configure development tools and linting
  - Set up package.json with required dependencies (@polkadot/api, zustand, styled-components, axios)
  - Initialize Go modules with Gin and required packages
  - _Requirements: All requirements depend on proper project setup_

- [x] 2. Implement core mobile app foundation
- [x] 2.1 Create basic app navigation and routing structure
  - Set up React Navigation with stack navigator
  - Create placeholder screens for all main flows
  - Implement basic TypeScript interfaces for navigation
  - _Requirements: 1.1, 2.1_

- [x] 2.2 Implement Zustand state management stores
  - Create wallet authentication state store with actions
  - Create submission data state store
  - Create dashboard data state store with periodic refresh logic
  - Write unit tests for state management logic
  - _Requirements: 1.4, 5.5, 6.6_

- [x] 2.3 Set up styled-components theme and basic UI components
  - Create theme configuration with colors and typography
  - Implement reusable button, input, and status indicator components
  - Create loading and error state components
  - _Requirements: 2.2, 2.3, 6.3, 6.4, 6.5_

- [x] 3. Implement wallet authentication module
- [x] 3.1 Create Polkadot.js API integration
  - Set up @polkadot/api connection with Nova Wallet detection
  - Implement wallet connection logic with retry mechanism
  - Handle wallet extension detection and user account selection
  - Write unit tests for wallet connection scenarios
  - _Requirements: 1.1, 1.2, 1.3, 1.6_

- [x] 3.2 Build splash screen and wallet connection UI
  - Create splash screen with "Connect Wallet to Witness" button
  - Implement wallet connection flow with loading states
  - Add error handling UI for connection failures
  - Navigate to main action screen on successful connection
  - _Requirements: 1.1, 1.5_

- [x] 4. Create main action screen interface
- [x] 4.1 Build main action screen with navigation buttons
  - Create clean UI with camera and microphone action buttons
  - Implement navigation to image capture and audio recording modules
  - Add proper icons and labels for each action
  - Write component tests for navigation behavior
  - _Requirements: 2.1, 2.2, 2.4, 2.5_

- [-] 5. Implement image capture and OCR processing
- [x] 5.1 Set up native camera integration
  - Configure React Native camera permissions and setup
  - Create document scanning optimized camera interface
  - Implement image capture with preview functionality
  - Handle camera permissions and error states
  - _Requirements: 3.1_

- [x] 5.2 Integrate TensorFlow Lite OCR model
  - Set up TensorFlow Lite React Native integration
  - Load and initialize OCR model for on-device processing
  - Implement image preprocessing for better OCR accuracy
  - Create OCR result parsing for vote count extraction
  - Write unit tests with mock OCR responses
  - _Requirements: 3.2, 3.3_

- [x] 5.3 Build confirmation screen for extracted data
  - Create editable form interface for OCR results
  - Implement manual correction functionality for vote counts
  - Add validation for numerical inputs
  - Include "Confirm & Submit" action button
  - Handle OCR failure fallback to manual entry
  - _Requirements: 3.4, 3.5, 3.7_

- [x] 6. Implement audio recording and speech-to-text
- [x] 6.1 Set up native audio recording
  - Configure audio recording permissions and setup
  - Create simple audio recording interface with start/stop controls
  - Implement audio file handling and storage
  - Handle audio permissions and error states
  - _Requirements: 4.1_

- [x] 6.2 Integrate TensorFlow Lite speech-to-text model
  - Set up TensorFlow Lite STT model integration
  - Implement audio preprocessing for better transcription
  - Create text parsing logic for vote count extraction
  - Write unit tests with mock transcription responses
  - _Requirements: 4.2, 4.3_

- [x] 6.3 Build audio confirmation screen
  - Reuse confirmation screen component from image capture
  - Pre-fill extracted numbers from speech-to-text processing
  - Implement manual correction for audio-extracted data
  - Handle STT failure fallback to manual entry
  - _Requirements: 4.4, 4.5, 4.7_

- [x] 7. Create data payload assembly and transmission
- [x] 7.1 Implement GPS location services
  - Set up location permissions and GPS access
  - Create location service for coordinate extraction
  - Handle location unavailable scenarios
  - Add location accuracy validation
  - _Requirements: 5.3_

- [x] 7.2 Build JSON payload assembly logic
  - Create payload builder with wallet address, station ID, GPS, timestamp, and results
  - Implement submission type tracking (image_ocr vs audio_stt)
  - Add payload validation before transmission
  - Write unit tests for payload structure
  - _Requirements: 5.1, 5.2, 5.4_

- [x] 7.3 Implement API client for result submission
  - Create HTTP client using Axios for backend communication
  - Implement POST request to /api/v1/submitResult endpoint
  - Add retry logic for failed transmissions
  - Implement offline storage for failed submissions
  - Handle success/error responses and user feedback
  - _Requirements: 5.4, 5.5, 5.6, 5.7_

- [x] 8. Build live tally dashboard
- [x] 8.1 Create dashboard UI components
  - Build national tally display with candidate vote counts
  - Create polling station list with status indicators
  - Implement yellow (Pending) and green (Verified) status indicators
  - Add clean mobile-optimized layout
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 8.2 Implement WebSocket real-time data synchronization
  - Set up WebSocket client connection for live tally updates
  - Implement automatic reconnection logic with exponential backoff
  - Add fallback to 30-second HTTP polling when WebSocket unavailable
  - Handle connection state management and error recovery
  - Update UI reactively when WebSocket messages arrive
  - _Requirements: 6.6, 6.7, 6.8, 6.9, 6.10_

- [x] 9. Implement backend ingestion API
- [x] 9.1 Set up Golang backend project structure
  - Initialize Go modules with Gin framework
  - Create project structure with handlers, models, and services
  - Set up CORS configuration for mobile app communication
  - Add structured logging and request tracing
  - _Requirements: 7.1_

- [x] 9.2 Create submission validation and storage
  - Implement POST /api/v1/submitResult endpoint with Gin
  - Add JSON payload validation for all required fields
  - Create in-memory storage structure for submissions
  - Implement wallet address format validation
  - Add duplicate submission prevention logic
  - Write unit tests for validation scenarios
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.6_

- [x] 9.3 Trigger consensus processing on submission
  - Integrate consensus engine with submission handler
  - Update polling station status after each submission
  - Add error handling for consensus processing failures
  - _Requirements: 7.5_

- [x] 10. Implement consensus algorithm engine
- [x] 10.1 Create consensus data structures and grouping logic
  - Implement submission grouping by polling station ID
  - Create result comparison logic for identical submissions
  - Add wallet address uniqueness enforcement
  - Write unit tests for grouping and comparison logic
  - _Requirements: 8.1, 8.2_

- [x] 10.2 Build majority-based verification algorithm
  - Implement 3-submission minimum threshold checking
  - Create majority calculation for identical results
  - Add verification status updates (Pending/Verified)
  - Calculate confidence levels for verified results
  - Write comprehensive unit tests for consensus scenarios
  - _Requirements: 8.3, 8.4, 8.5, 8.6, 8.7_

- [x] 11. Implement voting process management system
- [x] 11.1 Create voting process data structures and storage
  - Implement VotingProcess and Candidate models in Go
  - Create in-memory storage for voting processes with thread safety
  - Add voting process lifecycle management (Setup/Active/Complete)
  - Write unit tests for voting process data operations
  - _Requirements: 9.1, 9.2, 9.5_

- [x] 11.2 Build voting process management API endpoints
  - Implement POST /api/v1/voting-process endpoint for creating new voting processes
  - Create PUT /api/v1/voting-process/{id}/start endpoint to activate voting
  - Add GET /api/v1/voting-process/{id} endpoint for process details
  - Include validation for single position and multiple polling stations
  - Write integration tests for voting process API endpoints
  - _Requirements: 9.3, 9.4, 9.6_

- [x] 11.3 Integrate voting processes with polling stations
  - Update polling station model to include voting process association
  - Modify consensus engine to work within voting process context
  - Update submission validation to verify polling station belongs to active voting process
  - _Requirements: 9.7, 9.8_

- [x] 12. Create results API for dashboard data
- [x] 12.1 Implement tally calculation and aggregation
  - Create aggregated tally calculation from verified results only
  - Implement polling station status aggregation within voting processes
  - Add data freshness tracking with timestamps
  - Handle zero-result scenarios gracefully
  - _Requirements: 10.3, 10.6, 10.7_

- [x] 12.2 Build GET /api/v1/getTally/{votingProcessId} endpoint
  - Implement JSON response with voting process details, aggregated tally, and station details
  - Add proper HTTP status codes and error handling
  - Include verification status and confidence levels
  - Return null results for pending consensus stations
  - Write integration tests for API endpoint
  - _Requirements: 10.1, 10.2, 10.4, 10.5_

- [ ] 13. Implement WebSocket service for real-time updates
- [ ] 13.1 Create WebSocket hub and client management
  - Set up WebSocket server using Gorilla WebSocket library
  - Implement client connection management with registration/deregistration
  - Create broadcast mechanism for tally updates
  - Add connection heartbeat and cleanup for disconnected clients
  - _Requirements: 6.6, 6.8_

- [ ] 13.2 Integrate WebSocket with consensus engine
  - Trigger WebSocket broadcasts when consensus status changes
  - Send tally updates to all connected clients when results are verified
  - Include voting process ID in update messages for client filtering
  - Add error handling for WebSocket broadcast failures
  - _Requirements: 6.7, 6.10_

- [ ] 14. Add comprehensive error handling and testing
- [ ] 14.1 Implement mobile app error handling
  - Add network error handling with retry mechanisms
  - Create ML processing failure fallbacks
  - Implement wallet connection error recovery
  - Add user-friendly error messages and recovery options
  - _Requirements: 1.6, 3.7, 4.7, 5.6_

- [x] 12.2 Add backend error handling and logging
  - Implement structured error responses with proper HTTP codes
  - Add request validation error handling
  - Create consensus engine error recovery
  - Add comprehensive logging for debugging and monitoring
  - _Requirements: 7.4_

- [x] 12.3 Write integration tests for end-to-end flows
  - Create tests for complete submission flow from mobile to backend
  - Test consensus algorithm with multiple submissions
  - Verify dashboard data accuracy with backend integration
  - Add performance tests for concurrent submissions
  - Test offline/online scenarios and data synchronization
  - _Requirements: All requirements integration testing_