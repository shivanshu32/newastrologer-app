import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { NotificationProvider } from './src/context/NotificationContext';
import { SocketProvider } from './src/context/SocketContext';
import AuthNavigator from './src/navigation/AuthNavigator';
import MainNavigator from './src/navigation/MainNavigator';
import NotificationHandler from './src/components/NotificationHandler';
import { LogBox, View } from 'react-native';
import navigationConfig from './src/navigation/NavigationConfig';

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
      </NavigationContainer>
    </>
  );
};

// Root component with providers
export default function App() {
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
}
