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
  const [permissionStatus, setPermissionStatus] = useState('unknown');
  const [tokenStatus, setTokenStatus] = useState('unknown'); // 'unknown', 'generating', 'success', 'failed'
  const [lastTokenError, setLastTokenError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const { user, userToken } = useAuth();

  useEffect(() => {
    console.log('🚀 [FCM] NotificationProvider useEffect triggered');
    console.log('🚀 [FCM] userToken present:', !!userToken);
    console.log('🚀 [FCM] expoPushToken:', expoPushToken);
    
    // Check permission status first
    const initializeNotifications = async () => {
      try {
        // Check current permission status
        const currentPermissionStatus = await checkPermissionStatus();
        setPermissionStatus(currentPermissionStatus);
        console.log('🔐 [FCM] Current permission status:', currentPermissionStatus);
        
        // Only proceed if we have a chance of getting a token
        if (currentPermissionStatus === 'granted' || currentPermissionStatus === 'undetermined') {
          setTokenStatus('generating');
          setLastTokenError(null);
          
          const token = await registerForPushNotificationsAsync();
          
          if (token && token !== 'MOCK_TOKEN_PUSH_NOTIFICATIONS_DISABLED') {
            console.log('✅ [FCM] Token registration successful:', token);
            setExpoPushToken(token);
            setTokenStatus('success');
            setRetryCount(0);
            
            // Register with backend immediately if user is logged in
            if (userToken) {
              registerTokenWithBackend(token);
            }
          } else {
            console.log('❌ [FCM] Token registration failed or returned mock token');
            setTokenStatus('failed');
            setLastTokenError('Failed to generate valid FCM token');
          }
        } else {
          console.log('❌ [FCM] Permissions not available, skipping token generation');
          setTokenStatus('failed');
          setLastTokenError('Notification permissions not granted');
        }
      } catch (error) {
        console.log('❌ [FCM] Error initializing notifications:', error);
        setTokenStatus('failed');
        setLastTokenError(error.message);
      }
    };
    
    // Always attempt to set up notifications
    if (Notifications && Device) {
      console.log('🚀 [FCM] Setting up notifications with real implementation');
      initializeNotifications();
      
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
    } else {
      console.log('❌ [FCM] CRITICAL ERROR: Notifications not available');
      console.log('❌ [FCM] This means expo-notifications failed to load');
      console.log('❌ [FCM] Push notifications will NOT work');
      setTokenStatus('failed');
      setLastTokenError('Expo notifications not available');
      // Do not set any token - let it remain empty to indicate failure
    }
    
    return () => {};
  }, [userToken]); // Remove expoPushToken from dependencies to avoid infinite loop
  
  // App state change listener for FCM token refresh after permission grant
  useEffect(() => {
    const { AppState } = require('react-native');
    
    const handleAppStateChange = async (nextAppState) => {
      console.log(`📱 [FCM] App state changed to: ${nextAppState}`);
      
      // When app becomes active (user returns from settings)
      if (nextAppState === 'active') {
        console.log('📱 [FCM] App became active - checking for permission changes...');
        
        try {
          // Check current permission status
          const { status: currentStatus } = await Notifications.getPermissionsAsync();
          console.log(`📱 [FCM] Current permission status: ${currentStatus}`);
          
          // If permission was just granted and we don't have a valid token
          if (currentStatus === 'granted' && 
              (tokenStatus !== 'success' || !expoPushToken || expoPushToken.startsWith('ExponentPushToken'))) {
            
            console.log('🔄 [FCM] Permission granted and no valid FCM token - attempting refresh...');
            setPermissionStatus(currentStatus);
            setTokenStatus('generating');
            setLastTokenError(null);
            
            // Wait a moment for the system to settle
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Attempt to get FCM token
            const newToken = await registerForPushNotificationsAsync();
            
            if (newToken && !newToken.startsWith('ExponentPushToken') && newToken !== 'MOCK_TOKEN_PUSH_NOTIFICATIONS_DISABLED') {
              console.log('✅ [FCM] Successfully obtained FCM token after permission grant:', newToken);
              setExpoPushToken(newToken);
              setTokenStatus('success');
              setRetryCount(0);
              
              // Register with backend
              if (userToken) {
                registerTokenWithBackend(newToken);
              }
            } else {
              console.log('❌ [FCM] Still getting Expo token or failed after permission grant');
              setTokenStatus('failed');
              setLastTokenError('Still receiving Expo token - FCM setup incomplete');
            }
          } else if (currentStatus !== permissionStatus) {
            // Update permission status if it changed
            console.log(`📱 [FCM] Permission status changed from ${permissionStatus} to ${currentStatus}`);
            setPermissionStatus(currentStatus);
          }
          
        } catch (error) {
          console.error('❌ [FCM] Error checking permission status on app state change:', error);
        }
      }
    };
    
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      if (subscription?.remove) {
        subscription.remove();
      }
    };
  }, [tokenStatus, expoPushToken, permissionStatus, userToken]);
  
  // Periodic token renewal effect
  useEffect(() => {
    let renewalInterval;
    
    // Set up periodic token renewal if we have a valid token
    if (expoPushToken && tokenStatus === 'success' && permissionStatus === 'granted') {
      console.log('🔄 [FCM] Setting up periodic token renewal (every 24 hours)');
      
      renewalInterval = setInterval(async () => {
        console.log('🔄 [FCM] Performing periodic token renewal...');
        
        try {
          // Silent token renewal - don't update UI state unless there's an issue
          const newToken = await registerForPushNotificationsAsync();
          
          if (newToken && newToken !== expoPushToken && newToken !== 'MOCK_TOKEN_PUSH_NOTIFICATIONS_DISABLED') {
            console.log('✅ [FCM] Token renewed successfully:', newToken);
            setExpoPushToken(newToken);
            
            // Register new token with backend
            if (userToken) {
              registerTokenWithBackend(newToken);
            }
          } else if (!newToken || newToken === 'MOCK_TOKEN_PUSH_NOTIFICATIONS_DISABLED') {
            console.log('❌ [FCM] Token renewal failed - will retry on next interval');
            // Don't update UI state for silent renewal failures
          } else {
            console.log('🔄 [FCM] Token unchanged during renewal');
          }
        } catch (error) {
          console.log('❌ [FCM] Silent token renewal error:', error.message);
          // Don't update UI state for silent renewal errors
        }
      }, 24 * 60 * 60 * 1000); // 24 hours
    }
    
    return () => {
      if (renewalInterval) {
        clearInterval(renewalInterval);
        console.log('🔄 [FCM] Periodic token renewal cleared');
      }
    };
  }, [expoPushToken, tokenStatus, permissionStatus, userToken]);

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

  // Manual retry function for FCM token
  const retryTokenGeneration = async () => {
    console.log('🔄 [FCM] Manual retry requested by user');
    setTokenStatus('generating');
    setLastTokenError(null);
    setRetryCount(prev => prev + 1);
    
    try {
      const token = await registerForPushNotificationsAsync();
      
      if (token && token !== 'MOCK_TOKEN_PUSH_NOTIFICATIONS_DISABLED') {
        console.log('✅ [FCM] Manual retry successful:', token);
        setExpoPushToken(token);
        setTokenStatus('success');
        
        if (userToken) {
          registerTokenWithBackend(token);
        }
      } else {
        console.log('❌ [FCM] Manual retry failed');
        setTokenStatus('failed');
        setLastTokenError('Failed to generate valid FCM token');
      }
    } catch (error) {
      console.log('❌ [FCM] Manual retry error:', error.message);
      setTokenStatus('failed');
      setLastTokenError(error.message);
    }
  };
  
  // Request permissions manually
  const requestPermissions = async () => {
    console.log('🔐 [FCM] Manual permission request by user');
    
    try {
      const result = await requestNotificationPermissions();
      setPermissionStatus(result.status);
      
      if (result.status === 'granted') {
        // Automatically try to get token after permission granted
        await retryTokenGeneration();
      }
      
      return result;
    } catch (error) {
      console.log('❌ [FCM] Manual permission request error:', error.message);
      setPermissionStatus('error');
      return { status: 'error', canAskAgain: false };
    }
  };
  
  // Refresh permission status
  const refreshPermissionStatus = async () => {
    const status = await checkPermissionStatus();
    setPermissionStatus(status);
    return status;
  };

  return (
    <NotificationContext.Provider
      value={{
        expoPushToken,
        notification,
        permissionStatus,
        tokenStatus,
        lastTokenError,
        retryCount,
        registerTokenWithBackend,
        handleNotificationNavigation,
        retryTokenGeneration,
        requestPermissions,
        refreshPermissionStatus,
        sendTestNotification
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

// Check current permission status
async function checkPermissionStatus() {
  try {
    if (!Notifications || typeof Notifications.getPermissionsAsync !== 'function') {
      return 'unavailable';
    }
    
    const { status } = await Notifications.getPermissionsAsync();
    return status; // 'granted', 'denied', 'undetermined'
  } catch (error) {
    console.log('❌ [FCM] Error checking permission status:', error.message);
    return 'error';
  }
}

// Request permissions with user-friendly handling
async function requestNotificationPermissions() {
  try {
    if (!Notifications || typeof Notifications.requestPermissionsAsync !== 'function') {
      return { status: 'unavailable', canAskAgain: false };
    }
    
    const result = await Notifications.requestPermissionsAsync();
    return result;
  } catch (error) {
    console.log('❌ [FCM] Error requesting permissions:', error.message);
    return { status: 'error', canAskAgain: false };
  }
}

// Register for push notifications with retry mechanism
async function registerForPushNotificationsAsync(maxRetries = 3, currentRetry = 0) {
  console.log(`🚀 [FCM] Starting FCM token registration... (Attempt ${currentRetry + 1}/${maxRetries + 1})`);
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
        
        // Get FCM registration token using React Native Firebase SDK
        console.log('🎫 [FCM] Getting FCM registration token...');
        console.log('🎫 [FCM] Project ID:', Constants.expoConfig?.extra?.eas?.projectId);
        
        let token;
        try {
          // Try to use React Native Firebase SDK for proper FCM tokens
          console.log('🔥 [FCM] Attempting to get FCM token using React Native Firebase...');
          
          try {
            // Import React Native Firebase Messaging
            const messaging = require('@react-native-firebase/messaging').default;
            
            // Request permission first
            const authStatus = await messaging().requestPermission();
            const enabled = authStatus === messaging.AuthorizationStatus.AUTHORIZED || 
                           authStatus === messaging.AuthorizationStatus.PROVISIONAL;
            
            if (enabled) {
              console.log('🔥 [FCM] Firebase messaging permission granted');
              
              // Get FCM registration token
              token = await messaging().getToken();
              console.log('✅ [FCM] Successfully obtained FCM registration token via React Native Firebase');
              console.log('✅ [FCM] Token length:', token?.length);
              console.log('✅ [FCM] Token type:', typeof token);
              console.log('✅ [FCM] Token preview:', token ? token.substring(0, 20) + '...' : 'null');
              
              if (!token) {
                throw new Error('FCM token is null or empty');
              }
              
            } else {
              console.log('❌ [FCM] Firebase messaging permission denied');
              throw new Error('Firebase messaging permission denied');
            }
            
          } catch (firebaseError) {
            console.log('❌ [FCM] React Native Firebase failed:', firebaseError.message);
            console.log('🔄 [FCM] Falling back to expo-notifications getDevicePushTokenAsync...');
            
            // Fallback to expo-notifications device token
            try {
              const tokenResult = await Notifications.getDevicePushTokenAsync();
              console.log('🎫 [FCM] Device token result:', tokenResult);
              
              if (tokenResult && tokenResult.data) {
                token = tokenResult.data;
                console.log('✅ [FCM] Got device token via expo-notifications');
                console.log('✅ [FCM] Token length:', token?.length);
                console.log('✅ [FCM] Token preview:', token ? token.substring(0, 20) + '...' : 'null');
              } else {
                throw new Error('No device token data received');
              }
            } catch (deviceTokenError) {
              console.log('❌ [FCM] Device token also failed:', deviceTokenError.message);
              console.log('🔄 [FCM] Final fallback to Expo push token...');
              
              // Final fallback to Expo push token
              const expoTokenResult = await Notifications.getExpoPushTokenAsync({
                projectId: Constants.expoConfig?.extra?.eas?.projectId,
              });
              token = expoTokenResult.data;
              console.log('⚠️ [FCM] Using Expo push token as final fallback:', token);
            }
          }
          
        } catch (fcmError) {
          console.log('❌ [FCM] All FCM token methods failed:', fcmError.message);
          console.log('❌ [FCM] FCM Error stack:', fcmError.stack);
          throw fcmError;
        }
        
        // Comprehensive token validation
        if (!token) {
          console.log('❌ [FCM] Token is null or undefined');
          return '';
        }
        
        // Check token format and validity
        if (token.startsWith('ExponentPushToken[')) {
          console.log('⚠️ [FCM] Warning: Using Expo push token instead of FCM token');
          console.log('⚠️ [FCM] Backend expects FCM tokens - this may cause notification failures');
          return token;
        } else if (token.startsWith('mock-') || token.includes('mock') || token.includes('MOCK')) {
          console.log('❌ [FCM] Token is MOCK - this will not work for push notifications');
          console.log('❌ [FCM] Mock token detected:', token);
          return '';
        } else if (token.length >= 100) {
          console.log('✅ [FCM] Token appears to be a valid FCM registration token');
          return token;
        } else {
          console.log('⚠️ [FCM] Token format unknown or too short:', token);
          console.log('⚠️ [FCM] Token length:', token.length);
          return token;
        }
        
      } catch (error) {
        console.log('❌ [FCM] Error getting push token:', error.message);
        console.log('❌ [FCM] Error stack:', error.stack);
        
        // Retry logic for token generation failures
        if (currentRetry < maxRetries) {
          const backoffDelay = Math.pow(2, currentRetry) * 1000; // Exponential backoff: 1s, 2s, 4s
          console.log(`🔄 [FCM] Retrying token generation in ${backoffDelay}ms... (${currentRetry + 1}/${maxRetries})`);
          
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
          return registerForPushNotificationsAsync(maxRetries, currentRetry + 1);
        }
        
        return '';
      }
    } else {
      console.log('❌ [FCM] Not running on physical device - push notifications not available');
      return '';
    }
  } catch (error) {
    console.log('❌ [FCM] Critical error in registerForPushNotificationsAsync:', error.message);
    console.log('❌ [FCM] Error stack:', error.stack);
    
    // Retry logic for critical errors (network issues, etc.)
    if (currentRetry < maxRetries && (error.message.includes('network') || error.message.includes('timeout') || error.message.includes('fetch'))) {
      const backoffDelay = Math.pow(2, currentRetry) * 1000;
      console.log(`🔄 [FCM] Retrying after critical error in ${backoffDelay}ms... (${currentRetry + 1}/${maxRetries})`);
      
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
      return registerForPushNotificationsAsync(maxRetries, currentRetry + 1);
    }
    
    return '';
  }
}

export default NotificationContext;
