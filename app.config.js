import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }) => ({
  ...config,
  name: "com.jyotishcallastrologerapp",
  slug: "jyotishcall-astrologer-app",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff"
  },
  assetBundlePatterns: [
    "**/*"
  ],
  ios: {
    supportsTablet: true,
    infoPlist: {
      NSCameraUsageDescription: "This app needs access to your camera for video consultations with users.",
      NSMicrophoneUsageDescription: "This app needs access to your microphone for voice and video consultations with users.",
      NSLocalNetworkUsageDescription: "This app needs access to local network for WebRTC connections."
    }
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#FFFFFF"
    },
    minSdkVersion: 25,
    permissions: [
      "CAMERA",
      "RECORD_AUDIO",
      "MODIFY_AUDIO_SETTINGS",
      "INTERNET",
      "ACCESS_NETWORK_STATE",
      "BLUETOOTH",
      "BLUETOOTH_CONNECT",
      "WAKE_LOCK"
    ],
    package: "com.jyotishcallastrologerapp"
  },
  web: {
    favicon: "./assets/favicon.png"
  },
  plugins: [
    "expo-notifications",
    [
      "expo-dev-client",
      {
        "addGeneratedScheme": false
      }
    ],
    [
      "@config-plugins/react-native-webrtc",
      {
        "cameraPermission": "This app needs access to your camera for video consultations with users.",
        "microphonePermission": "This app needs access to your microphone for voice and video consultations with users."
      }
    ]
  ],
  extra: {
    eas: {
      projectId: "df7c8590-c046-4d34-bacb-908b2207ea73"
    }
  }
});
