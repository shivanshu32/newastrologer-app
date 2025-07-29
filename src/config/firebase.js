// Firebase configuration for Expo managed workflow
// Using Expo's Firebase integration instead of React Native Firebase
import { Platform } from 'react-native';

// Firebase configuration
// Replace these with your actual Firebase config values from Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyDM5_yykPFf7jgUia7jKpqjvXCdYWjuqzo", // From google-services.json
  authDomain: "jyotish2-dd398.firebaseapp.com",
  projectId: "jyotish2-dd398",
  storageBucket: "jyotish2-dd398.firebasestorage.app",
  messagingSenderId: "225163383908", // From google-services.json
  appId: "1:225163383908:android:a9490f2ec3af7646083b71", // From google-services.json
};

// For Expo managed workflow, we don't need to initialize Firebase manually
// Expo handles Firebase initialization through the google-services.json file
// and the Firebase plugins in app.json

// Export configuration for use in FCM service
export { firebaseConfig };

// Helper function to check if Firebase is configured
export const isFirebaseConfigured = () => {
  return (
    firebaseConfig.apiKey !== "your-api-key-here" &&
    firebaseConfig.projectId !== "your-project-id"
  );
};

// Note: For Expo managed workflow, we use expo-notifications for push notifications
// instead of @react-native-firebase/messaging
// The FCMService.js handles the Expo-specific implementation

// Get Firebase project info
export const getFirebaseProjectInfo = () => {
  return {
    projectId: firebaseConfig.projectId,
    messagingSenderId: firebaseConfig.messagingSenderId,
    isConfigured: isFirebaseConfigured(),
  };
};

// No default export needed for Expo managed workflow
// Firebase is handled automatically by Expo
