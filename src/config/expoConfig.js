// Configuration to detect Expo Go and conditionally use mocks
import Constants from 'expo-constants';

// Check if running in Expo Go
export const isExpoGo = Constants.appOwnership === 'expo';

console.log('[ExpoConfig] Running in Expo Go:', isExpoGo);

// Conditional imports for WebRTC
export const getWebRTCImports = () => {
  if (isExpoGo) {
    console.log('[ExpoConfig] Using mock WebRTC implementation');
    return require('../mocks/react-native-webrtc');
  } else {
    console.log('[ExpoConfig] Using native WebRTC implementation');
    return require('react-native-webrtc');
  }
};

// Conditional imports for Vector Icons
export const getVectorIconsImport = (iconFamily) => {
  if (isExpoGo) {
    return require('../mocks/react-native-vector-icons').default;
  } else {
    // Static imports for production builds to avoid Metro bundler issues
    switch (iconFamily) {
      case 'MaterialIcons':
        return require('react-native-vector-icons/MaterialIcons').default;
      case 'FontAwesome':
        return require('react-native-vector-icons/FontAwesome').default;
      case 'Ionicons':
        return require('react-native-vector-icons/Ionicons').default;
      case 'Feather':
        return require('react-native-vector-icons/Feather').default;
      case 'AntDesign':
        return require('react-native-vector-icons/AntDesign').default;
      case 'Entypo':
        return require('react-native-vector-icons/Entypo').default;
      default:
        return require('react-native-vector-icons/MaterialIcons').default;
    }
  }
};

// Conditional imports for WebRTC Service
export const getWebRTCService = () => {
  if (isExpoGo) {
    console.log('[ExpoConfig] Using mock WebRTC service');
    return require('../mocks/WebRTCService').default;
  } else {
    console.log('[ExpoConfig] Using native WebRTC service');
    return require('../services/WebRTCService').default;
  }
};
