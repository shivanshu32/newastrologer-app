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
    "./plugins/withAdIdPermission"
  ],
  extra: {
    eas: {
      projectId: "df7c8590-c046-4d34-bacb-908b2207ea73"
    }
  }
});
