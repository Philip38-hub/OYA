# OYAH! Troubleshooting Guide

## 🔧 Common Issues & Solutions

### 🚨 Build & Setup Issues

#### 1. **"SDK directory is not writable" Error**
```
FAILURE: Build failed with an exception.
* What went wrong:
Could not determine the dependencies of task ':app:compileDebugJavaWithJavac'.
> Failed to install the following SDK components:
The SDK directory is not writable (/usr/lib/android-sdk)
```

**Solution:**
```bash
# Fix Android SDK permissions (MOST COMMON ISSUE)
sudo chown -R $USER:$USER /usr/lib/android-sdk

# Verify permissions
ls -la /usr/lib/android-sdk
# Should show your username, not root
```

#### 2. **"ANDROID_HOME not set" Error**
```bash
# Set environment variable
export ANDROID_HOME=/usr/lib/android-sdk

# Add to your shell profile for persistence
echo 'export ANDROID_HOME=/usr/lib/android-sdk' >> ~/.bashrc
source ~/.bashrc
```

#### 3. **"Build tools not found" Error**
```bash
# Ensure Android SDK has proper structure
ls /usr/lib/android-sdk/
# Should contain: build-tools, platforms, platform-tools, tools

# If missing, reinstall Android SDK
sudo apt-get install --reinstall android-sdk
```

---

### 📱 Device & Connection Issues

#### 1. **"No devices found" Error**
```bash
# Check device connection
adb devices
# Should show your device

# If empty, try:
adb kill-server
adb start-server

# Enable USB debugging on device:
# Settings → Developer Options → USB Debugging
```

#### 2. **"Device unauthorized" Error**
```bash
# On device, tap "Always allow from this computer"
# Then run:
adb devices
# Should show "device" not "unauthorized"
```

#### 3. **App not installing on device**
```bash
# Clear previous installations
adb uninstall com.anonymous.mobile

# Restart the build process
ANDROID_HOME=/usr/lib/android-sdk npx expo run:android --variant debug
```

---

### 🎥 Camera & OCR Issues

#### 1. **Camera not opening**
**Symptoms:** Black screen, permission errors
**Solutions:**
```typescript
// Check camera permissions in device settings
// Settings → Apps → OYAH → Permissions → Camera

// In code, verify permission handling:
const [permission, requestPermission] = useCameraPermissions();
if (!permission?.granted) {
  await requestPermission();
}
```

#### 2. **OCR not processing images**
**Symptoms:** Images captured but no text extraction
**Solutions:**
```bash
# Ensure device has Google Play Services
# ML Kit requires this for text recognition

# Check device logs:
adb logcat | grep -i "ml kit"
```

**Common causes:**
- Emulator usage (use physical device)
- No internet for initial ML Kit model download
- Insufficient device storage
- Poor image quality

#### 3. **Poor OCR accuracy**
**Symptoms:** Wrong text extraction, missing characters
**Solutions:**
- Use better lighting
- Hold device steady
- Ensure document is flat
- Clean camera lens
- Use flash in low light

**Code improvements:**
```typescript
// Increase image quality
const photo = await cameraRef.current.takePictureAsync({
  quality: 1.0,  // Maximum quality
  flash: 'on',   // Force flash for better lighting
});

// Add preprocessing
const preprocessedUri = await preprocessImage(imageUri);
```

---

### 🔄 Metro & Bundling Issues

#### 1. **Metro bundler fails to start**
```bash
# Clear Metro cache
npx expo start --clear

# If that fails, nuclear option:
rm -rf node_modules
rm package-lock.json
npm install
```

#### 2. **"Unable to resolve module" errors**
```bash
# Reset Metro bundler completely
npx expo start --clear --reset-cache

# Check for missing dependencies
npm ls
```

#### 3. **JavaScript bundle errors**
```bash
# Check for syntax errors in recent changes
# Look for missing imports or typos

# Restart Metro with verbose logging
npx expo start --clear --verbose
```

---

### 🌐 Network & API Issues

#### 1. **"Network Error" during submission**
**Expected behavior:** App stores data offline
**Check logs for:**
```
LOG  Stored offline submission: submission_[timestamp]
LOG  Network unavailable. Submission stored for retry
```

#### 2. **WebSocket connection fails**
**Symptoms:** Dashboard not updating in real-time
**Solutions:**
- Check backend server is running
- Verify network connectivity
- App should fallback to polling

---

### 💾 Storage & Performance Issues

#### 1. **App crashes during OCR processing**
**Symptoms:** App closes when processing large images
**Solutions:**
```typescript
// Reduce image size before processing
const resizedImage = await ImageManipulator.manipulateAsync(
  imageUri,
  [{ resize: { width: 1920 } }],
  { compress: 0.8 }
);
```

#### 2. **Slow OCR processing**
**Normal times:**
- Image capture: Instant
- OCR processing: 2-5 seconds
- Results parsing: <1 second

**If slower:**
- Check device performance
- Close other apps
- Restart device
- Check available storage

---

### 🔍 Debugging Tools

#### 1. **Enable detailed logging**
```typescript
// In ocrService.ts, ensure console.log statements are active
console.log('📷 Photo taken:', photo.uri);
console.log('🔍 Processing image with OCR service...');
console.log('📝 Extracted text:', extractedText);
```

#### 2. **Check device logs**
```bash
# View all app logs
adb logcat | grep -i "oyah\|expo\|ml kit"

# Filter for errors only
adb logcat | grep -i "error\|exception\|crash"
```

#### 3. **Monitor device resources**
```bash
# Check device storage
adb shell df -h

# Check memory usage
adb shell dumpsys meminfo com.anonymous.mobile
```

---

### 🎯 Performance Optimization

#### 1. **Reduce memory usage**
```typescript
// Clean up temporary files
await FileSystem.deleteAsync(tempImagePath, { idempotent: true });

// Limit concurrent operations
const processQueue = new Queue({ concurrency: 1 });
```

#### 2. **Improve OCR speed**
```typescript
// Optimize image before OCR
const optimizedImage = await preprocessImage(imageUri, {
  maxWidth: 1920,
  quality: 0.8,
  format: 'jpeg'
});
```

---

### 📋 Health Check Checklist

Before reporting issues, verify:

- [ ] **Android SDK permissions**: `ls -la /usr/lib/android-sdk` shows your username
- [ ] **Environment variables**: `echo $ANDROID_HOME` returns correct path
- [ ] **Device connection**: `adb devices` shows your device
- [ ] **Dependencies installed**: `npm ls` shows no missing packages
- [ ] **Physical device**: Not using emulator for ML Kit
- [ ] **Camera permissions**: Enabled in device settings
- [ ] **Storage space**: Device has >1GB free space
- [ ] **Network connection**: For initial ML Kit model download

---

### 🆘 Getting Help

#### 1. **Collect diagnostic information**
```bash
# System info
node --version
npm --version
expo --version
echo $ANDROID_HOME

# Device info
adb devices
adb shell getprop ro.build.version.release

# App logs
adb logcat | grep -i "oyah" > app_logs.txt
```

#### 2. **Common log patterns to look for**

**Success patterns:**
```
LOG  📷 Photo taken: file:///...
LOG  ML Kit OCR service initialized successfully
LOG  📊 Final parsing result: {"candidates": {...}}
```

**Error patterns:**
```
ERROR  OCR processing failed: [error message]
ERROR  Camera permission denied
ERROR  Network unavailable
```

#### 3. **Report issues with:**
- Device model and Android version
- Exact error messages
- Steps to reproduce
- App logs (filtered for relevant entries)
- Screenshots if UI-related

---

### 🔄 Reset Procedures

#### 1. **Soft reset** (try first)
```bash
# Clear caches
npx expo start --clear
```

#### 2. **Medium reset**
```bash
# Reinstall dependencies
rm -rf node_modules
npm install
```

#### 3. **Hard reset** (nuclear option)
```bash
# Complete clean slate
rm -rf node_modules
rm package-lock.json
npm install
npx expo start --clear --reset-cache
```

#### 4. **Device reset**
```bash
# Uninstall app from device
adb uninstall com.anonymous.mobile

# Clear ADB cache
adb kill-server
adb start-server
```

---

**Remember:** 90% of issues are solved by fixing Android SDK permissions with `sudo chown -R $USER:$USER /usr/lib/android-sdk` 🎯