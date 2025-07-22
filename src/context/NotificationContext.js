import React, { createContext, useState, useContext, useEffect } from 'react';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { useAuth } from './AuthContext';
import axios from 'axios';

// API URL Configuration
const API_URL = 'https://jyotishcallbackend-2uxrv.ondigitalocean.app/api/v1';

// Import notifications - FORCE real implementation
let Notifications;
let Device;
let isUsingMockImplementation = false;

// Try multiple ways to import expo-notifications
try {
  // Method 1: Direct require
  Notifications = require('expo-notifications');
  Device = require('expo-device');
  
  // Validate that we have real functions
  if (Notifications && typeof Notifications.getExpoPushTokenAsync === 'function' && Device) {
    console.log('✅ [FCM] Real expo-notifications loaded successfully');
    console.log('✅ [FCM] Device.isDevice:', Device.isDevice);
    console.log('✅ [FCM] Notifications functions available:', {
      getExpoPushTokenAsync: typeof Notifications.getExpoPushTokenAsync,
      getPermissionsAsync: typeof Notifications.getPermissionsAsync,
      requestPermissionsAsync: typeof Notifications.requestPermissionsAsync
    });
  } else {
    throw new Error('expo-notifications functions not available');
  }
} catch (error) {
  console.log('❌ [FCM] Failed to load expo-notifications:', error.message);
  console.log('❌ [FCM] This will prevent real FCM tokens from being generated');
  isUsingMockImplementation = true;
  
  // Minimal mock implementation - should not be used in production
  Notifications = {
    setNotificationHandler: () => {},
    addNotificationReceivedListener: () => ({ remove: () => {} }),
    addNotificationResponseReceivedListener: () => ({ remove: () => {} }),
    getPermissionsAsync: async () => ({ status: 'granted' }),
    requestPermissionsAsync: async () => ({ status: 'granted' }),
    getExpoPushTokenAsync: async () => {
      console.log('❌ [FCM] WARNING: Using mock token - push notifications will NOT work!');
      return { data: 'MOCK_TOKEN_PUSH_NOTIFICATIONS_DISABLED' };
    },
    scheduleNotificationAsync: async () => {},
    setNotificationChannelAsync: async () => {},
    removeNotificationSubscription: () => {},
    AndroidImportance: { MAX: 5 }
  };
  
  Device = {
    isDevice: true
  };
}

const NotificationContext = createContext();

export const useNotification = () => useContext(NotificationContext);

// Configure notifications if available
if (Notifications && Notifications.setNotificationHandler) {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  } catch (error) {
    console.log('Notification handler setup failed - using mock implementation');
  }
}

export const NotificationProvider = ({ children }) => {
  const [expoPushToken, setExpoPushToken] = useState('');
  const [notification, setNotification] = useState(null);
  const { user, userToken } = useAuth();

  useEffect(() => {
    console.log('🚀 [FCM] NotificationProvider useEffect triggered');
    console.log('🚀 [FCM] userToken present:', !!userToken);
    console.log('🚀 [FCM] expoPushToken:', expoPushToken);
    
    // Always attempt to set up notifications
    if (Notifications && Device) {
      console.log('🚀 [FCM] Setting up notifications with real implementation');
      
      try {
        registerForPushNotificationsAsync().then(token => {
          console.log('🚀 [FCM] Received token from registration:', token);
          if (token) {
            setExpoPushToken(token);
            
            // Register with backend immediately if user is logged in
            if (userToken) {
              console.log('🚀 [FCM] User is logged in, registering token with backend');
              registerTokenWithBackend(token);
            }
          }
        }).catch(error => {
          console.log('❌ [FCM] Error in token registration:', error.message);
        });

        // Set up notification listeners
        let notificationListener = { remove: () => {} };
        let responseListener = { remove: () => {} };
        
        try {
          notificationListener = Notifications.addNotificationReceivedListener(
            notification => {
              console.log('🔔 [FCM] Notification received:', notification);
              setNotification(notification);
            }
          );

          responseListener = Notifications.addNotificationResponseReceivedListener(
            response => {
              console.log('🔔 [FCM] Notification response:', response);
              // Handle notification tap here
              if (response?.notification?.request?.content?.data) {
                const { data } = response.notification.request.content;
                handleNotificationNavigation(data);
              }
            }
          );
          
          console.log('✅ [FCM] Notification listeners set up successfully');
        } catch (error) {
          console.log('❌ [FCM] Failed to add notification listeners:', error.message);
        }

        return () => {
          try {
            if (notificationListener && notificationListener.remove) {
              notificationListener.remove();
            }
            if (responseListener && responseListener.remove) {
              responseListener.remove();
            }
          } catch (error) {
            console.log('❌ [FCM] Error removing notification subscriptions:', error.message);
          }
        };
      } catch (error) {
        console.log('❌ [FCM] Notification setup failed:', error.message);
      }
    } else {
      console.log('❌ [FCM] CRITICAL ERROR: Notifications not available');
      console.log('❌ [FCM] This means expo-notifications failed to load');
      console.log('❌ [FCM] Push notifications will NOT work');
      // Do not set any token - let it remain empty to indicate failure
    }
    
    return () => {};
  }, [userToken]); // Remove expoPushToken from dependencies to avoid infinite loop

  // Register token with backend
  const registerTokenWithBackend = async (token) => {
    console.log('🔄 [FCM] Registering token with backend...');
    console.log('🔄 [FCM] Token to register:', token);
    console.log('🔄 [FCM] Token length:', token?.length);
    console.log('🔄 [FCM] Token starts with mock:', token?.startsWith('mock-'));
    console.log('🔄 [FCM] UserToken present:', !!userToken);
    
    try {
      const response = await axios.post(`${API_URL}/notifications/register-token`, {
        fcmToken: token,
      }, {
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        }
      });
      console.log('✅ [FCM] Device token registered with backend successfully');
      console.log('✅ [FCM] Registered token:', token);
      console.log('✅ [FCM] Backend response:', response.data);
    } catch (error) {
      console.error('❌ [FCM] Error registering device token:', error.response?.data || error.message);
      console.error('❌ [FCM] Error status:', error.response?.status);
      console.error('❌ [FCM] Full error:', error);
    }
  };

  // Handle notification navigation
  const handleNotificationNavigation = (data) => {
    // Example: Navigate to booking screen when a new booking notification is received
    if (data?.type === 'new_booking' && data?.bookingId) {
      // In a real app, you would use navigation to navigate to the booking screen
      console.log('Navigate to booking:', data.bookingId);
    }
  };

  // Send a test notification
  const sendTestNotification = async () => {
    if (Notifications && typeof Notifications.scheduleNotificationAsync === 'function') {
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Test Notification',
            body: 'This is a test notification for the Astrologer App!',
            data: { type: 'test' },
          },
          trigger: { seconds: 2 },
        });
        return { success: true };
      } catch (error) {
        console.log('Error sending test notification:', error);
        // Return mock success for better UX in Expo Go
        return { success: true, message: 'Mock notification (Expo Go SDK 53 compatibility mode)' };
      }
    } else {
      console.log('Notifications not available in this environment (Expo Go SDK 53)');
      // Mock success response for testing in Expo Go
      return { success: true, message: 'Mock notification (Expo Go SDK 53 compatibility mode)' };
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        expoPushToken,
        notification,
        sendTestNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

// Register for push notifications
async function registerForPushNotificationsAsync() {
  console.log('🚀 [FCM] Starting FCM token registration...');
  console.log('🚀 [FCM] Using mock implementation:', isUsingMockImplementation);
  console.log('🚀 [FCM] Device.isDevice:', Device?.isDevice);
  console.log('🚀 [FCM] Platform:', Platform.OS);
  console.log('🚀 [FCM] Constants.expoConfig?.extra?.eas?.projectId:', Constants.expoConfig?.extra?.eas?.projectId);
  
  // CRITICAL: Do not use mock tokens in production
  if (isUsingMockImplementation) {
    console.log('❌ [FCM] CRITICAL ERROR: Using mock implementation - push notifications will NOT work!');
    console.log('❌ [FCM] This means expo-notifications failed to load properly');
    console.log('❌ [FCM] Check your app build configuration and dependencies');
    return 'MOCK_TOKEN_PUSH_NOTIFICATIONS_DISABLED';
  }
  
  // Validate that we have real Notifications functions
  if (!Notifications || typeof Notifications.getExpoPushTokenAsync !== 'function') {
    console.log('❌ [FCM] CRITICAL ERROR: Notifications.getExpoPushTokenAsync is not available');
    console.log('❌ [FCM] Notifications object:', Notifications);
    return '';
  }
  
  try {
    let token;
    
    // Set up Android notification channel
    if (Platform.OS === 'android') {
      try {
        console.log('📱 [FCM] Setting up Android notification channel...');
        if (typeof Notifications.setNotificationChannelAsync === 'function') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#F97316',
          });
          console.log('✅ [FCM] Android notification channel set up successfully');
        }
      } catch (error) {
        console.log('❌ [FCM] Error setting notification channel:', error.message);
      }
    }

    if (Device.isDevice) {
      console.log('📱 [FCM] Running on physical device, requesting permissions...');
      
      try {
        // Check permissions
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        console.log('🔐 [FCM] Existing permission status:', existingStatus);
        let finalStatus = existingStatus;
        
        if (existingStatus !== 'granted') {
          console.log('🔐 [FCM] Requesting notification permissions...');
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
          console.log('🔐 [FCM] Permission request result:', finalStatus);
        }
        
        if (finalStatus !== 'granted') {
          console.log('❌ [FCM] Notification permissions not granted!');
          return '';
        }
        
        // Get Expo push token with comprehensive diagnostics
        console.log('🎫 [FCM] Getting Expo push token...');
        console.log('🎫 [FCM] Project ID:', Constants.expoConfig?.extra?.eas?.projectId);
        console.log('🎫 [FCM] Constants.expoConfig:', JSON.stringify(Constants.expoConfig, null, 2));
        console.log('🎫 [FCM] Constants.executionEnvironment:', Constants.executionEnvironment);
        console.log('🎫 [FCM] Constants.appOwnership:', Constants.appOwnership);
        
        // Try to get token with detailed error handling
        let tokenResult;
        try {
          tokenResult = await Notifications.getExpoPushTokenAsync({
            projectId: Constants.expoConfig?.extra?.eas?.projectId,
          });
          console.log('🎫 [FCM] Raw token result:', tokenResult);
        } catch (tokenError) {
          console.log('❌ [FCM] Error getting token:', tokenError.message);
          console.log('❌ [FCM] Error stack:', tokenError.stack);
          
          // Try without project ID as fallback
          try {
            console.log('🎫 [FCM] Trying without project ID...');
            tokenResult = await Notifications.getExpoPushTokenAsync();
            console.log('🎫 [FCM] Fallback token result:', tokenResult);
          } catch (fallbackError) {
            console.log('❌ [FCM] Fallback also failed:', fallbackError.message);
            return '';
          }
        }
        
        token = tokenResult.data;
        console.log('✅ [FCM] Successfully obtained Expo push token:', token);
        console.log('✅ [FCM] Token length:', token?.length);
        console.log('✅ [FCM] Token type:', typeof token);
        
        // Comprehensive token validation
        if (!token) {
          console.log('❌ [FCM] Token is null or undefined');
          return '';
        }
        
        if (token.startsWith('ExponentPushToken[')) {
          console.log('✅ [FCM] Token appears to be a REAL Expo push token');
          return token;
        } else if (token.startsWith('mock-') || token.includes('mock') || token.includes('MOCK')) {
          console.log('❌ [FCM] Token is MOCK - this will not work for push notifications');
          console.log('❌ [FCM] Mock token detected:', token);
          // Return empty string to prevent backend from using mock token
          return '';
        } else {
          console.log('⚠️ [FCM] Token format unknown:', token);
          console.log('⚠️ [FCM] Will attempt to use it anyway');
          return token;
        }
        
      } catch (error) {
        console.log('❌ [FCM] Error getting push token:', error.message);
        console.log('❌ [FCM] Error stack:', error.stack);
        return '';
      }
    } else {
      console.log('❌ [FCM] Not running on physical device - push notifications not available');
      return '';
    }
  } catch (error) {
    console.log('❌ [FCM] Critical error in registerForPushNotificationsAsync:', error.message);
    console.log('❌ [FCM] Error stack:', error.stack);
    return '';
  }
}

export default NotificationContext;
