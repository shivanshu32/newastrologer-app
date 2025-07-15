import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { NotificationProvider } from './src/context/NotificationContext';
import { SocketProvider } from './src/context/SocketContext';
import AuthNavigator from './src/navigation/AuthNavigator';
import MainNavigator from './src/navigation/MainNavigator';
import UpdateRequiredScreen from './src/screens/UpdateRequiredScreen';
import NotificationHandler from './src/components/NotificationHandler';
import SessionJoinNotificationHandler from './src/components/SessionJoinNotificationHandler';
import { LogBox, View, ActivityIndicator, Text } from 'react-native';
import navigationConfig from './src/navigation/NavigationConfig';
// import LogRocket from '@logrocket/react-native'; // Temporarily disabled due to build issues
import Constants from 'expo-constants';
import * as Sentry from '@sentry/react-native';

// Import version check hook
import useVersionCheck from './src/hooks/useVersionCheck';

// Import mock testing utility for Expo Go
import './src/utils/testMocks';

Sentry.init({
  dsn: 'https://3dc6159c27a6738cf8211a0f4dd7e15b@o4509555453067264.ingest.us.sentry.io/4509555454509056',

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,

  // Configure Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: [Sentry.mobileReplayIntegration()],

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});

// Initialize LogRocket safely - only in development or when safe
try {
  // Temporarily disable LogRocket to resolve build issues
  // TODO: Re-enable once LogRocket Maven repository issue is resolved
  if (false && (__DEV__ || Constants.debugMode)) {
    // LogRocket.init('r9ooew/astrolgoer-app');
    console.log('LogRocket initialized successfully');
  } else {
    console.log('LogRocket disabled temporarily due to build issues');
  }
} catch (error) {
  console.warn('LogRocket initialization failed:', error);
}

// Ignore specific warnings
LogBox.ignoreLogs([
  'Warning: ReferenceError: Property \'updateStatus\' doesn\'t exist',
  'Unsupported top level event type "topInsetsChange" dispatched',
  'expo-notifications: Android Push notifications',
  '`expo-notifications` functionality is not fully supported in Expo Go'
]);

// Main app component with navigation structure
const AppContent = () => {
  const { userToken } = useAuth();
  const { checkForUpdatesOnLaunch } = useVersionCheck();
  const [updateRequired, setUpdateRequired] = useState(null);
  const [versionCheckComplete, setVersionCheckComplete] = useState(false);
  
  // Check for updates on app launch
  useEffect(() => {
    const performVersionCheck = async () => {
      try {
        console.log('Performing version check on app launch...');
        const updateData = await checkForUpdatesOnLaunch();
        
        if (updateData && updateData.updateRequired) {
          console.log('Update required, setting update data:', updateData);
          setUpdateRequired(updateData);
        } else {
          console.log('No update required');
        }
      } catch (error) {
        console.error('Version check failed:', error);
      } finally {
        setVersionCheckComplete(true);
      }
    };

    performVersionCheck();
  }, []);
  
  // Show loading during version check
  if (!versionCheckComplete) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <ActivityIndicator size="large" color="#8A2BE2" />
        <View style={{ marginTop: 16, alignItems: 'center' }}>
          <Text style={{ color: '#6B7280', fontSize: 16 }}>Checking for updates...</Text>
        </View>
      </View>
    );
  }

  // Show update screen if update is required
  if (updateRequired) {
    return (
      <UpdateRequiredScreen 
        route={{
          params: {
            currentVersion: updateRequired.currentVersion,
            latestVersion: updateRequired.latestVersion,
            updateMessage: updateRequired.updateMessage,
            forceUpdate: updateRequired.forceUpdate,
          }
        }}
      />
    );
  }

  return (
    <>
      <NavigationContainer
        // Use our navigation config to avoid SafeAreaContext issues
        {...navigationConfig.container}
        documentTitle={{
          formatter: () => 'Astrologer App'
        }}
      >
        {userToken ? (
          <MainNavigator />
        ) : (
          <AuthNavigator />
        )}
        <NotificationHandler />
        {userToken && <SessionJoinNotificationHandler />}
      </NavigationContainer>
    </>
  );
};

// Root component with providers
export default Sentry.wrap(function App() {
  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="auto" />
      <AuthProvider>
        <NotificationProvider>
          <SocketProvider>
            <AppContent />
          </SocketProvider>
        </NotificationProvider>
      </AuthProvider>
    </View>
  );
});