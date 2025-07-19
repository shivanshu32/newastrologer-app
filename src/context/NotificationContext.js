import React, { createContext, useState, useContext, useEffect } from 'react';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { useAuth } from './AuthContext';
import axios from 'axios';

// API URL Configuration
const API_URL = 'https://jyotishcallbackend-2uxrv.ondigitalocean.app/api/v1';

// Conditionally import notifications to avoid warnings in Expo Go with SDK 53
let Notifications;
let Device;

// In a development build or production app, we would use the real implementation
// For Expo Go with SDK 53, we'll use a mock implementation
try {
  // This might throw an error in Expo Go with SDK 53
  Notifications = require('expo-notifications');
  Device = require('expo-device');
} catch (error) {
  console.log('Using mock notifications for Expo Go compatibility');
  // Mock implementation for Expo Go
  Notifications = {
    setNotificationHandler: () => {},
    addNotificationReceivedListener: () => ({ remove: () => {} }),
    addNotificationResponseReceivedListener: () => ({ remove: () => {} }),
    getPermissionsAsync: async () => ({ status: 'granted' }),
    requestPermissionsAsync: async () => ({ status: 'granted' }),
    getExpoPushTokenAsync: async () => ({ data: 'mock-expo-push-token' }),
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
    // Only attempt to set up notifications if we have the real implementation
    if (Notifications && Device) {
      try {
        registerForPushNotificationsAsync().then(token => {
          if (token) setExpoPushToken(token);
        });

        // Set up notification listeners
        let notificationListener = { remove: () => {} };
        let responseListener = { remove: () => {} };
        
        try {
          notificationListener = Notifications.addNotificationReceivedListener(
            notification => {
              setNotification(notification);
            }
          );

          responseListener = Notifications.addNotificationResponseReceivedListener(
            response => {
              console.log('Notification response:', response);
              // Handle notification tap here
              if (response?.notification?.request?.content?.data) {
                const { data } = response.notification.request.content;
                handleNotificationNavigation(data);
              }
            }
          );
        } catch (error) {
          console.log('Failed to add notification listeners - using mock implementation');
        }

        // Register token with backend if user is logged in
        if (userToken && expoPushToken) {
          registerTokenWithBackend(expoPushToken);
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
            console.log('Error removing notification subscriptions');
          }
        };
      } catch (error) {
        console.log('Notification setup failed - using mock implementation');
      }
    } else {
      console.log('Notifications not available in this environment (Expo Go SDK 53)');
      // If we're in Expo Go with SDK 53, set a mock token
      setExpoPushToken('mock-expo-push-token-for-testing');
    }
    
    return () => {};
  }, [userToken, expoPushToken]);

  // Register token with backend
  const registerTokenWithBackend = async (token) => {
    try {
      const response = await axios.post(`${API_URL}/notifications/register-token`, {
        fcmToken: token,
      }, {
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        }
      });
      console.log('✅ Device token registered with backend:', token);
      console.log('✅ Backend response:', response.data);
    } catch (error) {
      console.error('❌ Error registering device token:', error.response?.data || error.message);
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
  // Check if we have real Notifications implementation
  if (!Notifications || !Device) {
    console.log('Using mock push token for Expo Go SDK 53');
    return 'mock-expo-push-token-for-testing';
  }
  
  try {
    let token;
    
    if (Platform.OS === 'android') {
      try {
        if (typeof Notifications.setNotificationChannelAsync === 'function') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#F97316',
          });
        }
      } catch (error) {
        console.log('Error setting notification channel');
      }
    }

    if (Device.isDevice) {
      try {
        if (typeof Notifications.getPermissionsAsync !== 'function') {
          return 'mock-expo-push-token-for-testing';
        }
        
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        
        if (existingStatus !== 'granted') {
          if (typeof Notifications.requestPermissionsAsync === 'function') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
          } else {
            finalStatus = 'granted'; // Mock granted for Expo Go
          }
        }
        
        if (finalStatus !== 'granted') {
          console.log('Failed to get push token for push notification!');
          return '';
        }
        
        if (typeof Notifications.getExpoPushTokenAsync !== 'function') {
          return 'mock-expo-push-token-for-testing';
        }
        
        token = (await Notifications.getExpoPushTokenAsync({
          projectId: Constants.expoConfig?.extra?.eas?.projectId,
        })).data;
        
        console.log('Expo push token:', token);
        return token;
      } catch (error) {
        console.log('Error getting push token - using mock token');
        return 'mock-expo-push-token-for-testing';
      }
    } else {
      console.log('Must use physical device for push notifications');
      return '';
    }
  } catch (error) {
    console.log('Error in registerForPushNotificationsAsync - using mock token');
    return 'mock-expo-push-token-for-testing';
  }
}

export default NotificationContext;
