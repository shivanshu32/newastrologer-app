# FCM Setup for Development Build - Astrologer App

## Overview
Your astrologer-app has been updated to support proper FCM tokens in development builds while maintaining compatibility with Expo Go.

## What Changed

### 1. Enhanced FCMService.js
- **Smart Detection**: Automatically detects if running in development build or Expo Go
- **Firebase FCM**: Uses real Firebase FCM tokens for development builds
- **Expo Fallback**: Falls back to Expo push tokens for Expo Go
- **Better Logging**: Enhanced logging to debug token generation issues

### 2. Added Dependencies
- `@react-native-firebase/app`: Firebase core for React Native
- `@react-native-firebase/messaging`: Firebase Cloud Messaging

### 3. Updated Configuration
- Added Firebase plugin to `app.config.js`
- Configured for both development builds and Expo Go compatibility

## Setup Instructions

### Step 1: Install Dependencies
```bash
cd astrologer-app
npm install
```

### Step 2: Build Development Build
```bash
# For Android development build
eas build --profile development --platform android

# Or if you want to build locally
npx expo run:android
```

### Step 3: Verify FCM Token Generation
1. Install the development build on your device
2. Open the app and navigate to Profile → Notification Settings
3. Check the console logs for FCM token generation:
   - Look for: `🔥 [FCM] Firebase messaging loaded for development build`
   - Look for: `✅ [FCM] Firebase FCM token obtained`

## Expected Behavior

### In Development Build:
- ✅ Uses Firebase FCM tokens (real FCM tokens)
- ✅ Works with your backend FCM implementation
- ✅ Supports all FCM features (data messages, etc.)
- ✅ Better reliability and performance

### In Expo Go:
- ✅ Uses Expo push tokens (for testing)
- ✅ Limited to Expo's push service
- ✅ Good for development/testing

## Debugging

### Check Token Type
Look for these logs in your console:
```
📱 [FCM] App ownership: standalone (development build) or expo (Expo Go)
🏗️ [FCM] Is development build: true/false
📦 [FCM] Is Expo Go: true/false
```

### Firebase FCM Success:
```
🔥 [FCM] Using Firebase FCM for development build
✅ [FCM] Firebase messaging permission granted
✅ [FCM] Firebase FCM token obtained: [token preview]
```

### Expo Push Token Fallback:
```
📱 [FCM] Using Expo push tokens for Expo Go
✅ [FCM] Expo push token obtained: [token preview]
```

## Troubleshooting

### Issue: "Firebase messaging not available"
**Solution**: Make sure you've installed the dependencies and built a development build (not using Expo Go)

### Issue: "No Firebase FCM token available"
**Solution**: 
1. Check that `google-services.json` is in `android/app/` directory
2. Ensure Firebase project is properly configured
3. Verify app package name matches Firebase project

### Issue: Token still shows as "failed"
**Solution**:
1. Clear app data and restart
2. Check device permissions for notifications
3. Verify internet connection
4. Check backend FCM token registration endpoint

## Files Modified
- `src/services/FCMService.js`: Enhanced with Firebase FCM support
- `package.json`: Added Firebase dependencies
- `app.config.js`: Added Firebase plugin
- `FCM_DEVELOPMENT_BUILD_SETUP.md`: This setup guide

## Next Steps
1. Install dependencies: `npm install`
2. Build development build: `eas build --profile development --platform android`
3. Test FCM token generation in the development build
4. Verify push notifications work with your backend

Your FCM implementation now supports both development builds (with real FCM tokens) and Expo Go (with Expo push tokens) automatically!
