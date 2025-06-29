# Astrologer App - Expo Go Setup

This guide explains how to run the astrologer-app in Expo Go by using mock implementations for native modules.

## What Was Changed

### Mock Implementations Created:
1. **`src/mocks/react-native-webrtc.js`** - Mock WebRTC components and classes
2. **`src/mocks/react-native-vector-icons.js`** - Mock vector icons that display icon names as text
3. **`src/mocks/WebRTCService.js`** - Mock WebRTC service with logging
4. **`src/config/expoConfig.js`** - Configuration to detect Expo Go and conditionally load mocks

### Files Updated:
1. **`src/screens/VideoConsultationScreen.js`** - Uses conditional imports for WebRTC and icons
2. **`src/services/WebRTCService.js`** - Uses conditional imports for WebRTC modules
3. **`src/screens/AstrologerDashboardScreen.js`** - Uses conditional imports for vector icons

## How It Works

The app automatically detects if it's running in Expo Go using `Constants.appOwnership === 'expo'` and:
- **In Expo Go**: Uses mock implementations that log actions and display placeholder UI
- **In Native Build**: Uses real native modules for full functionality

## Running in Expo Go

1. Make sure you have Expo CLI installed:
   ```bash
   npm install -g @expo/cli
   ```

2. Start the development server:
   ```bash
   cd astrologer-app
   expo start
   ```

3. Scan the QR code with Expo Go app on your device

## Mock Behavior

### WebRTC Mocks:
- **RTCView**: Shows "Video Stream" or "No Stream" text instead of actual video
- **WebRTC Classes**: Log all method calls to console
- **Media Devices**: Return mock streams and devices

### Vector Icons Mocks:
- Display the icon name as text instead of actual icons
- Maintains the same styling and layout

### WebRTC Service Mock:
- Logs all WebRTC operations to console
- Simulates connection states and events
- Provides same API as real service

## Testing Features

You can test most app functionality in Expo Go:
- ✅ Authentication and login
- ✅ Dashboard and navigation
- ✅ Booking management
- ✅ Chat functionality
- ✅ Socket connections
- ✅ API calls
- ⚠️ Video calls (mock UI only)
- ⚠️ Voice calls (mock UI only)

## Console Logs

All mock implementations include detailed console logging prefixed with `[Mock]` to help with debugging:
- `[Mock] WebRTCService initialized`
- `[Mock] RTCPeerConnection.createOffer called`
- `[ExpoConfig] Using mock WebRTC implementation`

## Building for Production

When you build the app for production (not Expo Go), it will automatically use the real native modules:
```bash
eas build -p android --profile preview
```

The conditional imports ensure the real WebRTC and vector icons are used in production builds.

## Troubleshooting

If you still get native module errors:
1. Clear Expo cache: `expo start -c`
2. Check console logs for `[ExpoConfig]` messages
3. Verify `Constants.appOwnership` value in logs
4. Make sure all imports use the conditional pattern

## Next Steps

Once you've tested the core functionality in Expo Go, build the app for real device testing to verify video/voice calling works properly with native modules.
