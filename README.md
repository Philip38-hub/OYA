# OYAH! MVP - Decentralized Electoral Transparency Platform

OYAH! is a decentralized mobile application (dApp) that brings radical transparency and trust to the electoral process. The system empowers ordinary citizens and party agents to act as "witnesses" by securely submitting polling station results through Web3 technology.

## Project Structure

```
├── mobile/                 # React Native mobile application
│   ├── src/               # Source code
│   │   ├── components/    # Reusable UI components
│   │   ├── screens/       # Screen components
│   │   ├── services/      # API and external services
│   │   ├── stores/        # Zustand state management
│   │   ├── types/         # TypeScript type definitions
│   │   └── utils/         # Utility functions
│   ├── assets/            # Static assets (images, icons)
│   └── package.json       # Mobile dependencies
├── backend/               # Golang backend services
│   ├── cmd/               # Application entry points
│   ├── internal/          # Internal packages
│   │   ├── handlers/      # HTTP handlers
│   │   ├── models/        # Data models
│   │   ├── services/      # Business logic
│   │   └── storage/       # Data storage layer
│   ├── pkg/               # Public packages
│   └── go.mod             # Go dependencies
└── .kiro/                 # Kiro IDE specifications
    └── specs/             # Feature specifications
```

## Technology Stack

### Mobile Application
- **Framework:** React Native with Expo
- **Language:** TypeScript
- **Web3:** Polkadot.js API with Nova Wallet integration
- **State Management:** Zustand
- **Styling:** Styled Components + NativeWind (Tailwind CSS)
- **HTTP Client:** Axios
- **ML Processing:** TensorFlow Lite (OCR & Speech-to-Text)

### Backend Services
- **Language:** Go 1.24+
- **Framework:** Gin HTTP framework
- **WebSocket:** Gorilla WebSocket
- **Storage:** In-memory (Redis for production)
- **API:** RESTful JSON APIs

## Development Setup

### Prerequisites
- Node.js 18+ and npm
- Go 1.24+
- Expo CLI (`npm install -g @expo/cli`)
- Nova Wallet browser extension (for testing)

### Mobile Application Setup

1. Navigate to the mobile directory:
   ```bash
   cd mobile
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

4. Run on specific platform:
   ```bash
   npm run android  # Android
   npm run ios      # iOS
   npm run web      # Web browser
   ```

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   make deps
   ```

3. Run in development mode:
   ```bash
   make dev
   ```

4. Build for production:
   ```bash
   make build
   ```

5. Run tests:
   ```bash
   make test
   ```

## Development Commands

### Mobile
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run type-check` - TypeScript type checking
- `npm run format` - Format code with Prettier

### Backend
- `make dev` - Run development server
- `make build` - Build binary
- `make test` - Run tests
- `make fmt` - Format Go code
- `make clean` - Clean build artifacts

## Core Features

1. **Wallet Authentication** - Secure connection via Nova Wallet
2. **Image Capture & OCR** - Extract vote counts from Form 34A
3. **Audio Recording & STT** - Process official announcements
4. **Consensus Verification** - Crowdsourced result validation
5. **Live Dashboard** - Real-time tally updates
6. **Voting Process Management** - Multi-station electoral processes

## API Endpoints

### Backend API (Port 8080)
- `GET /health` - Health check
- `POST /api/v1/submitResult` - Submit polling results
- `GET /api/v1/getTally/{votingProcessId}` - Get tally data
- `POST /api/v1/voting-process` - Create voting process
- `PUT /api/v1/voting-process/{id}/start` - Start voting process

### WebSocket
- Real-time tally updates on consensus changes
- Automatic client reconnection support

## Environment Configuration

### Mobile
Configuration is handled through Expo's app.json and environment-specific builds.

### Backend
Copy `.env.example` to `.env` and configure:
```bash
cp .env.example .env
```

## Contributing

1. Follow the established code style (ESLint for mobile, gofmt for backend)
2. Write tests for new features
3. Update documentation as needed
4. Use the Kiro spec workflow for new features

## License

This project is part of the OYAH! electoral transparency initiative.