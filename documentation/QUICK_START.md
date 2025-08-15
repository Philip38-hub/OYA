# OYAH! Quick Start Guide

## 🚀 Get OYAH Running in 5 Minutes

### Prerequisites Check
```bash
# Verify you have these installed
node --version    # Should be 18+
npm --version     # Latest
expo --version    # Latest
```

### 1. Fix Android SDK Permissions (CRITICAL)
```bash
# This is the #1 cause of build failures
sudo chown -R $USER:$USER /usr/lib/android-sdk
```

### 2. Set Environment
```bash
export ANDROID_HOME=/usr/lib/android-sdk
```

### 3. Install & Run
```bash
cd mobile
npm install
ANDROID_HOME=/usr/lib/android-sdk npx expo run:android --variant debug
```

### 4. Success Indicators
- ✅ "BUILD SUCCESSFUL in 16s"
- ✅ Metro bundler starts
- ✅ App installs on device
- ✅ Camera and OCR work

### 5. Test OCR Flow
1. Open app → Connect Wallet (mock)
2. Choose "📷 Capture Form Image" 
3. Take photo of Form 34A document
4. Watch OCR extract vote counts
5. Review in confirmation screen

## 🔧 If Something Breaks

### Build Fails?
```bash
sudo chown -R $USER:$USER /usr/lib/android-sdk
```

### Metro Issues?
```bash
npx expo start --clear
```

### Device Not Found?
```bash
adb devices
```

### OCR Not Working?
- Use physical device (not emulator)
- Ensure good lighting
- Test with clear document images

## 📱 Expected Features Working

- ✅ Camera with document overlay
- ✅ Gallery image selection  
- ✅ ML Kit OCR text extraction
- ✅ Form 34A vote parsing
- ✅ Flash control
- ✅ Data confirmation & editing
- ✅ Complete navigation flow

**That's it! Your OYAH app with OCR should be running perfectly.** 🎉