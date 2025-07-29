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
    supportsTablet: true
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#FFFFFF"
    },
    permissions: [
      "INTERNET",
      "ACCESS_NETWORK_STATE",
      "WAKE_LOCK",
      "RECEIVE_BOOT_COMPLETED",
      "VIBRATE",
      "com.google.android.c2dm.permission.RECEIVE",
      "android.permission.RECEIVE_BOOT_COMPLETED",
      "android.permission.WAKE_LOCK",
      "android.permission.VIBRATE"
    ],
    package: "com.jyotishcallastrologerapp",
    googleServicesFile: "./android/app/google-services.json",
    edgeToEdgeEnabled: false
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
    "@react-native-firebase/app",
    "./plugins/withAdIdPermission"
  ],
  extra: {
    eas: {
      projectId: "df7c8590-c046-4d34-bacb-908b2207ea73"
    }
  }
});
