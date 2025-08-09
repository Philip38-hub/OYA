# Requirements Document

## Introduction

OYAH! is a decentralized mobile application (dApp) that brings radical transparency and trust to the electoral process. The system empowers ordinary citizens and party agents to act as "witnesses" by securely submitting polling station results through Web3 technology. The MVP demonstrates the core user flow: Connect -> Capture -> Confirm -> Transmit -> Tally, using crowdsourced consensus for real-time verification and on-device processing for speed and resilience in low-connectivity environments.

## Requirements

### Requirement 1: Wallet Authentication

**User Story:** As a citizen witness, I want to connect my Nova Wallet to the application, so that I can securely authenticate my identity for submitting polling station results.

#### Acceptance Criteria

1. WHEN the user opens the application THEN the system SHALL display a splash screen with a single "Connect Wallet to Witness" button
2. WHEN the user taps the connect button THEN the system SHALL initiate a connection to Nova Wallet using Polkadot.js API
3. WHEN the wallet connection is successful THEN the system SHALL request read-only access to the user's public wallet address
4. WHEN the wallet address is obtained THEN the system SHALL store it securely in the app's state using Zustand
5. WHEN the wallet is successfully connected THEN the system SHALL navigate to the Main Action Screen
6. IF the wallet connection fails THEN the system SHALL display an appropriate error message and allow retry

### Requirement 2: Main Action Interface

**User Story:** As an authenticated witness, I want to choose between capturing form images or recording official announcements, so that I can submit polling results through my preferred method.

#### Acceptance Criteria

1. WHEN the user reaches the Main Action Screen THEN the system SHALL display two distinct action buttons
2. WHEN the screen loads THEN the system SHALL show a camera icon labeled "Capture Form Image"
3. WHEN the screen loads THEN the system SHALL show a microphone icon labeled "Record Official Announcement"
4. WHEN the user taps the camera button THEN the system SHALL navigate to the Image Capture module
5. WHEN the user taps the microphone button THEN the system SHALL navigate to the Audio Recording module

### Requirement 3: Image Capture and OCR Processing

**User Story:** As a witness, I want to capture images of Form 34A and have the system extract vote counts automatically, so that I can quickly submit accurate polling results without manual data entry.

#### Acceptance Criteria

1. WHEN the user enters the Image Capture module THEN the system SHALL open a native camera view optimized for document scanning
2. WHEN the user captures an image THEN the system SHALL process it locally using TensorFlow Lite OCR without transmitting the image
3. WHEN OCR processing completes THEN the system SHALL extract key numerical values including votes per candidate and total votes
4. WHEN extraction is complete THEN the system SHALL display a Confirmation Screen with extracted numbers in an editable format
5. WHEN the user reviews the extracted data THEN the system SHALL allow manual correction of any values
6. WHEN the user taps "Confirm & Submit" THEN the system SHALL proceed to data transmission
7. IF OCR processing fails THEN the system SHALL allow manual entry of vote counts

### Requirement 4: Audio Recording and Speech-to-Text Processing

**User Story:** As a witness, I want to record official announcements and have the system extract vote counts from the audio, so that I can submit results when written forms are not available or readable.

#### Acceptance Criteria

1. WHEN the user enters the Audio Recording module THEN the system SHALL open a simple audio recording interface
2. WHEN the user records an announcement THEN the system SHALL process the audio locally using TensorFlow Lite Speech-to-Text without transmitting the audio file
3. WHEN transcription completes THEN the system SHALL parse the text to identify and extract key numerical values
4. WHEN extraction is complete THEN the system SHALL display the same Confirmation Screen as image capture with pre-filled extracted numbers
5. WHEN the user reviews the extracted data THEN the system SHALL allow manual correction of any values
6. WHEN the user taps "Confirm & Submit" THEN the system SHALL proceed to data transmission
7. IF speech-to-text processing fails THEN the system SHALL allow manual entry of vote counts

### Requirement 5: Data Payload Assembly and Transmission

**User Story:** As a witness, I want my confirmed polling results to be securely transmitted to the backend system, so that they can contribute to the consensus verification process.

#### Acceptance Criteria

1. WHEN the user confirms data from either capture method THEN the system SHALL assemble a JSON payload containing wallet address, polling station ID, GPS coordinates, timestamp, results, and submission type
2. WHEN the payload is assembled THEN the system SHALL include the user's wallet address as unique identifier
3. WHEN location services are available THEN the system SHALL include current GPS coordinates in the payload
4. WHEN the payload is complete THEN the system SHALL transmit it via POST request to the backend API endpoint
5. WHEN transmission is successful THEN the system SHALL display a success confirmation to the user
6. IF transmission fails THEN the system SHALL store the payload locally and attempt retransmission when connectivity is restored
7. WHEN retransmission succeeds THEN the system SHALL remove the locally stored payload

### Requirement 6: Live Tally Dashboard

**User Story:** As a witness or interested citizen, I want to view real-time polling results and verification status, so that I can monitor the transparency and progress of the electoral process.

#### Acceptance Criteria

1. WHEN the user accesses the dashboard THEN the system SHALL display a clean mobile view with national-level aggregate tallies
2. WHEN the dashboard loads THEN the system SHALL show vote counts for each candidate and spoilt ballots
3. WHEN the dashboard displays polling stations THEN the system SHALL show each station with appropriate status indicators
4. WHEN a polling station has pending results THEN the system SHALL display a yellow "Pending Consensus" indicator
5. WHEN a polling station has verified results THEN the system SHALL display a green "Verified by Crowd" indicator
6. WHEN the dashboard is active THEN the system SHALL establish a WebSocket connection for real-time updates
7. WHEN new tally data is available THEN the system SHALL receive automatic updates via WebSocket without manual refresh
8. WHEN WebSocket connection is unavailable THEN the system SHALL fallback to periodic API polling every 30 seconds
9. WHEN network connectivity is restored THEN the system SHALL automatically reconnect WebSocket and synchronize latest data
10. WHEN new data is received THEN the system SHALL update the UI to reflect current results

### Requirement 7: Backend Result Ingestion

**User Story:** As the system, I want to receive and validate polling result submissions from mobile clients, so that I can process them for consensus verification.

#### Acceptance Criteria

1. WHEN a mobile client submits results THEN the backend SHALL accept POST requests at the `/api/v1/submitResult` endpoint
2. WHEN a payload is received THEN the system SHALL validate the JSON data structure
3. WHEN validation passes THEN the system SHALL store the submission with timestamp and wallet address
4. WHEN validation fails THEN the system SHALL return appropriate error response to the client
5. WHEN a submission is stored THEN the system SHALL trigger the consensus algorithm for that polling station
6. IF the same wallet address submits multiple results for the same station THEN the system SHALL use only the most recent submission

### Requirement 8: Consensus Algorithm and Verification

**User Story:** As the system, I want to verify polling results through crowdsourced consensus, so that I can ensure accuracy and prevent manipulation of electoral data.

#### Acceptance Criteria

1. WHEN submissions are received for a polling station THEN the system SHALL group them by polling station ID
2. WHEN comparing submissions THEN the system SHALL match results objects from different wallet addresses
3. WHEN at least 3 unique wallet addresses submit identical results THEN the system SHALL consider this a potential consensus
4. WHEN identical results constitute the majority of submissions for a station THEN the system SHALL mark those results as "Verified"
5. WHEN consensus is not reached THEN the system SHALL maintain "Pending Consensus" status
6. WHEN verification status changes THEN the system SHALL update the stored polling station data
7. WHEN results are verified THEN the system SHALL include them in national tally calculations

### Requirement 9: Voting Process Management

**User Story:** As the owner of the app, I want to create and manage voting processes with multiple polling stations for a single candidate position, so that I can initiate and oversee complete electoral processes from setup to final results.

#### Acceptance Criteria

1. WHEN the app owner accesses the admin interface THEN the system SHALL provide functionality to create a new voting process
2. WHEN creating a voting process THEN the system SHALL allow specification of voting title, candidate list for a single position, and voting period
3. WHEN setting up candidates THEN the system SHALL allow adding candidate names and basic information for the single position being voted on
4. WHEN configuring polling stations THEN the system SHALL allow adding multiple polling station IDs that will participate in this voting process
5. WHEN a voting process is created THEN the system SHALL generate a unique voting process ID and set initial status as "Setup"
6. WHEN the app owner initiates voting THEN the system SHALL change status to "Active" and enable result submissions for the configured polling stations
7. WHEN all polling stations have verified results THEN the system SHALL automatically calculate and display the combined final results for the single position
8. WHEN viewing results THEN the system SHALL show both individual polling station results and aggregated totals across all stations for the voting process

### Requirement 10: Results API and Data Access

**User Story:** As a mobile client, I want to retrieve current polling results and verification status for active voting processes, so that I can display up-to-date information to users.

#### Acceptance Criteria

1. WHEN clients request tally data THEN the backend SHALL provide GET endpoint at `/api/v1/getTally/{votingProcessId}`
2. WHEN the endpoint is called THEN the system SHALL return JSON response with voting process details, aggregated tally, and polling station details
3. WHEN calculating aggregated tally THEN the system SHALL include only verified polling station results for the specified voting process
4. WHEN returning polling station data THEN the system SHALL include station ID, verification status, and results if verified
5. WHEN results are pending consensus THEN the system SHALL return null for results while showing pending status
6. WHEN the API response is generated THEN the system SHALL ensure data freshness by including latest verified results
7. IF no verified results exist for the voting process THEN the system SHALL return zero values for aggregated tally