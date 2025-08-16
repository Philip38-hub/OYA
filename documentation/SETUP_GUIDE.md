# OYAH! Mobile App Setup Guide

## Complete Setup Documentation for Running OYAH with OCR & Image Processing

This guide documents the complete process to successfully run the OYAH mobile application with fully functional OCR (Optical Character Recognition) and image processing capabilities using ML Kit and Expo.

---

## 📋 Prerequisites

### System Requirements
- **Operating System**: Linux (tested on Ubuntu/Debian)
- **Node.js**: Version 18+ 
- **npm/yarn**: Latest version
- **Android SDK**: Required for Android development
- **Physical Android Device**: Recommended for ML Kit testing

### Required Tools
```bash
# Install Node.js (if not already installed)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Expo CLI globally
npm install -g @expo/cli

# Install Android SDK tools
sudo apt-get install android-sdk
```

---

## 🔧 Android SDK Setup

### 1. Fix Android SDK Permissions
The most critical step that caused our initial build failures:

```bash
# Change ownership of Android SDK to your user
sudo chown -R $USER:$USER /usr/lib/android-sdk

# Verify permissions
ls -la /usr/lib/android-sdk
```

**Why this matters**: The Android SDK directory must be writable by your user account for Expo to install required build tools (API 35, Build Tools 35.0.0).

### 2. Set Environment Variables
```bash
# Add to your ~/.bashrc or ~/.zshrc
export ANDROID_HOME=/usr/lib/android-sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/tools

# Reload your shell
source ~/.bashrc
```

### 3. Verify SDK Setup
```bash
# Check if Android SDK is accessible
echo $ANDROID_HOME
which adb
```

---

## 📱 Project Setup

### 1. Navigate to Project Directory
```bash
cd /path/to/your/project/mobile
```

### 2. Install Dependencies
```bash
# Install all project dependencies
npm install

# Key dependencies for OCR functionality:
# - @react-native-ml-kit/text-recognition
# - expo-camera
# - expo-image-picker
# - expo-file-system
```

### 3. Key Dependencies Verification
Ensure these critical packages are installed:

```json
{
  "@react-native-ml-kit/text-recognition": "^7.0.0",
  "expo-camera": "~16.1.11",
  "expo-image-picker": "~16.1.4",
  "expo-file-system": "~18.1.11",
  "@react-navigation/native": "^6.0.0",
  "@react-navigation/stack": "^6.0.0"
}
```

---

## 🚀 Running the Application

### 1. Start Development Server
```bash
# Set Android SDK path and run
ANDROID_HOME=/usr/lib/android-sdk npx expo run:android --variant debug
```

### 2. Expected Build Process
The build process will:
1. **Configure Gradle** (takes ~30 seconds)
2. **Download SDK components** if needed (API 35, Build Tools 35.0.0)
3. **Compile Android app** (takes 15-20 seconds)
4. **Start Metro bundler** 
5. **Install APK** on connected device
6. **Launch app** automatically

### 3. Successful Build Indicators
Look for these success messages:
```
BUILD SUCCESSFUL in 16s
456 actionable tasks: 10 executed, 446 up-to-date
Starting Metro Bundler
```

### 4. QR Code and Connection
After successful build, you'll see:
- QR code for development client
- Metro bundler running on `http://localhost:8081`
- App automatically installing and launching on device

---

## 📸 OCR & Image Processing Features

### Core Functionality
The app includes these working features:

#### 1. **Camera Integration**
- Document scanning with overlay guides
- High-quality image capture (0.9 quality)
- Flash control (Off/On/Auto)
- Real-time camera preview

#### 2. **Gallery Integration** 
- Select existing images from device gallery
- Proper permission handling
- Same OCR processing pipeline

#### 3. **ML Kit OCR Processing**
- Real-time text recognition
- Form 34A specific parsing
- Candidate name and vote extraction
- Confidence scoring

#### 4. **User Flow**
```
SplashScreen → MainActionScreen → ImageCaptureScreen → ConfirmationScreen
```

### Expected OCR Output
When processing Form 34A documents, you'll see logs like:
```
LOG  📷 Photo taken: file:///data/user/0/com.anonymous.mobile/cache/Camera/...
LOG  🔍 Processing image with OCR service...
LOG  ML Kit OCR service initialized successfully
LOG  📝 Extracted text from ML Kit: [extracted text]
LOG  📊 Final parsing result: {"candidates": {...}, "spoilt": 0}
```

---

## 🛠️ Troubleshooting

### Common Issues & Solutions

#### 1. **Build Failed: SDK Directory Not Writable**
```bash
# Error: The SDK directory is not writable (/usr/lib/android-sdk)
# Solution:
sudo chown -R $USER:$USER /usr/lib/android-sdk
```

#### 2. **Metro Bundler Errors**
```bash
# Clear Metro cache
npx expo start --clear

# Or reset completely
rm -rf node_modules
npm install
```

#### 3. **Device Connection Issues**
```bash
# Check device connection
adb devices

# Restart ADB if needed
adb kill-server
adb start-server
```

#### 4. **Permission Errors**
- Camera permissions are handled automatically
- Gallery permissions are requested when needed
- If permissions fail, check device settings

#### 5. **OCR Not Working**
- Ensure device has Google Play Services
- ML Kit requires internet for initial model download
- Test with clear, well-lit document images

---

## 📊 Performance Expectations

### Build Times
- **First build**: 2-3 minutes (downloads dependencies)
- **Subsequent builds**: 15-20 seconds
- **Metro bundling**: 30-60 seconds (first time)

### OCR Processing
- **Image capture**: Instant
- **OCR processing**: 2-5 seconds
- **Results parsing**: <1 second
- **Navigation**: Instant

### Memory Usage
- **App size**: ~50MB installed
- **Runtime memory**: ~100-150MB
- **Image processing**: Additional 20-30MB temporarily

---

## 🔍 Testing the Complete Flow

### 1. **Wallet Connection** (Mock)
- App starts with splash screen
- "Connect Wallet to Witness" button
- Navigates to main action screen

### 2. **Image Capture Options**
- **"📷 Capture Form Image"**: Opens camera
- **"📁 Choose from Gallery"**: Opens image picker
- Both lead to OCR processing

### 3. **Camera Experience**
- Document scanning overlay
- Gallery, Capture, Flash buttons
- High-quality image capture

### 4. **OCR Processing**
- Automatic text extraction
- Form 34A parsing
- Candidate vote counting

### 5. **Confirmation Screen**
- Review extracted data
- Manual editing capability
- Submit to backend (with offline fallback)

---

## 📁 Project Structure

### Key Files for OCR Functionality
```
mobile/
├── src/
│   ├── components/
│   │   ├── DocumentCamera.tsx      # Enhanced camera component
│   │   └── index.ts               # Component exports
│   ├── screens/
│   │   ├── ImageCaptureScreen.tsx # Main capture interface
│   │   ├── ConfirmationScreen.tsx # Data review & editing
│   │   └── index.ts              # Screen exports
│   ├── services/
│   │   ├── ocrService.ts         # ML Kit integration
│   │   └── cameraService.ts      # Camera utilities
│   ├── hooks/
│   │   └── useOCR.ts            # OCR state management
│   └── config/
│       └── ocrConfig.ts         # OCR configuration
├── App.tsx                      # Main navigation setup
└── package.json                # Dependencies
```

---

## 🎯 Success Criteria

### You know the setup is successful when:

1. **✅ Build completes without errors**
2. **✅ App launches on device**  
3. **✅ Camera opens and captures images**
4. **✅ Gallery picker works**
5. **✅ OCR processes images and extracts text**
6. **✅ Navigation flows smoothly between screens**
7. **✅ Confirmation screen shows extracted data**

### Expected Log Output
```
LOG  Mock API initialized
LOG  📷 Photo taken: file:///data/user/0/com.anonymous.mobile/cache/Camera/...
LOG  Initializing ML Kit OCR service...
LOG  ML Kit OCR service initialized successfully
LOG  🔍 Attempting ML Kit text recognition...
LOG  📝 Extracted text from ML Kit: [document text]
LOG  📊 Final parsing result: {"candidates": {...}, "spoilt": 0}
```

---

## 🚀 Next Steps

After successful setup, you can:

1. **Improve OCR Accuracy**: Fine-tune parsing algorithms for better handwritten text recognition
2. **Add More Document Types**: Extend beyond Form 34A to other electoral documents  
3. **Enhance UI/UX**: Polish the interface based on user feedback
4. **Backend Integration**: Connect to real API endpoints
5. **Wallet Integration**: Implement actual Web3 wallet connectivity

---

## 📞 Support

If you encounter issues not covered in this guide:

1. **Check logs**: Look for specific error messages in the console
2. **Verify permissions**: Ensure Android SDK and file permissions are correct
3. **Test on device**: ML Kit requires physical device testing
4. **Clear cache**: Try clearing Metro and npm caches
5. **Reinstall dependencies**: Remove node_modules and reinstall

---

**Last Updated**: August 15, 2025  
**Tested On**: Linux (Ubuntu), Android devices  
**Expo SDK**: 52.x  
**React Native**: 0.76.x

This documentation represents a fully tested and working setup for the OYAH mobile application with complete OCR and image processing functionality.