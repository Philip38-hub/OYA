# OYAH! - Decentralized Electoral Transparency

OYAH! is a decentralized mobile application (dApp) that brings radical transparency and trust to the electoral process. The system empowers ordinary citizens and party agents to act as "witnesses" by securely submitting polling station results through Web3 technology.

## Project Structure

```
├── mobile/          # React Native mobile application
├── backend/         # Golang backend services
└── .kiro/specs/     # Project specifications and requirements
```

## Mobile Application (React Native + TypeScript)

### Prerequisites
- Node.js 18+
- npm or yarn
- Expo CLI

### Setup
```bash
cd mobile
npm install
```

### Development
```bash
# Start development server
npm start

# Run on Android
npm run android

# Run on iOS
npm run ios

# Run on web
npm run web

# Linting and formatting
npm run lint
npm run format
npm run type-check

# Build Tailwind CSS (for development)
npm run build-css
```

### Key Dependencies
- **@polkadot/api**: Web3 integration with Polkadot ecosystem
- **zustand**: State management
- **nativewind**: Tailwind CSS for React Native
- **tailwindcss**: Utility-first CSS framework
- **axios**: HTTP client
- **@react-navigation/native**: Navigation

### Styling with Tailwind CSS
The mobile app uses NativeWind to bring Tailwind CSS to React Native:

- **Theme Configuration**: Custom color palette in `tailwind.config.js`
- **Utility Classes**: Use Tailwind classes directly in `className` props
- **Common Styles**: Predefined style combinations in `src/utils/styles.ts`
- **Theme Constants**: Design tokens in `src/utils/theme.ts`
- **Components**: Reusable components with Tailwind styling in `src/components/`

Example usage:
```tsx
<View className="flex-1 bg-white items-center justify-center p-5">
  <Text className="text-4xl font-bold text-primary-800 mb-3">
    OYAH!
  </Text>
</View>
```

## Backend (Golang + Gin)

### Prerequisites
- Go 1.21+

### Setup
```bash
cd backend
go mod download
```

### Development
```bash
# Run development server
make dev

# Build application
make build

# Run tests
make test

# Format code
make fmt
```

### Key Dependencies
- **gin-gonic/gin**: Web framework
- **gorilla/websocket**: WebSocket support

## Core Features

1. **Wallet Authentication**: Connect Nova Wallet for secure identity verification
2. **Image Capture & OCR**: Capture Form 34A and extract vote counts automatically
3. **Audio Recording & STT**: Record official announcements and extract vote counts
4. **Consensus Verification**: Crowdsourced verification through majority consensus
5. **Live Dashboard**: Real-time polling results and verification status
6. **Voting Process Management**: Create and manage electoral processes

## Development Workflow

The project follows a spec-driven development approach:
1. Requirements gathering and clarification
2. Design document creation
3. Implementation task breakdown
4. Incremental development with testing

See `.kiro/specs/oyah-mvp/` for detailed specifications.

## Getting Started

1. Clone the repository
2. Set up the mobile application (see Mobile Application section)
3. Set up the backend services (see Backend section)
4. Follow the implementation tasks in `.kiro/specs/oyah-mvp/tasks.md`

## License

This project is part of the OYAH! electoral transparency initiative.