import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Alert, AppState } from 'react-native';
import Constants from 'expo-constants';
import { authAPI } from './api';

// Check if running in standalone build (development/production) vs Expo Go
const isExpoGo = Constants.appOwnership === 'expo';
const isStandaloneBuild = Constants.appOwnership === 'standalone' || Constants.appOwnership === null;
const isDevelopmentBuild = __DEV__ && isStandaloneBuild;
const isProductionBuild = !__DEV__ && isStandaloneBuild;

// Dynamic Firebase import for standalone builds (both development and production)
let messaging = null;
if (isStandaloneBuild && !isExpoGo) {
  try {
    // Import Firebase messaging for standalone builds (development + production)
    const firebase = require('@react-native-firebase/app').default;
    messaging = require('@react-native-firebase/messaging').default;
    
    if (isProductionBuild) {
      console.log('🔥 [FCM] Firebase messaging loaded for production build');
    } else if (isDevelopmentBuild) {
      console.log('🔥 [FCM] Firebase messaging loaded for development build');
    } else {
      console.log('🔥 [FCM] Firebase messaging loaded for standalone build');
    }
  } catch (error) {
    console.log('⚠️ [FCM] Firebase messaging not available, falling back to Expo notifications');
  }
}

// FCM Service for Astrologer App (Expo FCM)
class FCMService {
  constructor() {
    this.token = null;
    this.isInitialized = false;
    this.unsubscribeTokenRefresh = null;
    this.unsubscribeForeground = null;
    this.unsubscribeBackground = null;
    this.appStateSubscription = null;
  }

  /**
   * Initialize FCM service with production-grade configuration
   */
  async initialize() {
    try {
      console.log('🚀 [FCM] Initializing FCM Service for Astrologer App...');
      
      // Check if device supports push notifications
      if (!Device.isDevice) {
        console.log('⚠️ [FCM] Must use physical device for push notifications');
        return false;
      }
      
      // Configure notification behavior
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
      
      console.log('✅ [FCM] Device configured for notifications');

      // Configure push notifications
      await this.configurePushNotifications();
      
      // Request permissions
      await this.requestPermissions();
      
      // Get FCM token
      await this.getFCMToken();
      
      // Set up message handlers
      this.setupMessageHandlers();
      
      // Set up token refresh listener
      this.setupTokenRefreshListener();
      
      // Handle app state changes
      this.setupAppStateHandler();
      
      this.isInitialized = true;
      console.log('✅ [FCM] FCM Service initialized successfully');
      
      return true;
    } catch (error) {
      console.error('❌ [FCM] Failed to initialize FCM Service:', error);
      return false;
    }
  }

  /**
   * Configure push notifications for Android
   */
  async configurePushNotifications() {
    // Configure push notification channels for Android using Expo Notifications
    console.log('📱 [FCM] Configuring push notifications with Expo Notifications');
    
    // Create notification channels for Android
    if (Platform.OS === 'android') {
      await this.createNotificationChannels();
    }
    
    console.log('✅ [FCM] Push notifications configured');
  }

  /**
   * Create notification channels for Android
   */
  async createNotificationChannels() {
    if (Platform.OS !== 'android') {
      console.log('📱 [FCM] Notification channels only needed on Android');
      return;
    }

    try {
      // High priority channel for booking requests
      await Notifications.setNotificationChannelAsync('booking_requests', {
        name: 'Booking Requests',
        description: 'Notifications for new booking requests',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
      console.log('📱 [FCM] Booking requests channel created');

      // Default channel for general notifications
      await Notifications.setNotificationChannelAsync('general', {
        name: 'General Notifications',
        description: 'General app notifications',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
      });
      console.log('📱 [FCM] General channel created');

      // Chat messages channel
      await Notifications.setNotificationChannelAsync('chat_messages', {
        name: 'Chat Messages',
        description: 'New chat messages from users',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
      });
      console.log('📱 [FCM] Chat messages channel created');

      // Payment notifications channel
      await Notifications.setNotificationChannelAsync('payments', {
        name: 'Payment Notifications',
        description: 'Payment and wallet related notifications',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: 'default',
      });
      console.log('📱 [FCM] Payments channel created');
      
      console.log('✅ [FCM] All notification channels created successfully');
    } catch (error) {
      console.error('❌ [FCM] Failed to create notification channels:', error);
    }
  }

  /**
   * Request notification permissions
   */
  async requestPermissions() {
    try {
      console.log('🔐 [FCM] Requesting notification permissions...');
      
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus === 'granted') {
        console.log('✅ [FCM] Notification permissions granted');
        return true;
      } else {
        console.log('❌ [FCM] Notification permissions denied');
        
        // Show alert to guide user to settings
        Alert.alert(
          'Notification Permission Required',
          'Please enable notifications in your device settings to receive booking requests and important updates.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => this.openNotificationSettings() },
          ]
        );
        
        return false;
      }
    } catch (error) {
      console.error('❌ [FCM] Error requesting permissions:', error);
      return false;
    }
  }

  /**
   * Get FCM token
   */
  async getFCMToken() {
    try {
      console.log('🔑 [FCM] Getting FCM token...');
      console.log('📱 [FCM] App ownership:', Constants.appOwnership);
      console.log('🏗️ [FCM] Is development build:', isDevelopmentBuild);
      console.log('🏭 [FCM] Is production build:', isProductionBuild);
      console.log('📱 [FCM] Is standalone build:', isStandaloneBuild);
      console.log('📦 [FCM] Is Expo Go:', isExpoGo);
      console.log('🔧 [FCM] __DEV__ flag:', __DEV__);
      
      let token = null;
      
      // Use Firebase FCM for standalone builds (both development and production)
      if (messaging && isStandaloneBuild && !isExpoGo) {
        if (isProductionBuild) {
          console.log('🔥 [FCM] Using Firebase FCM for production build');
        } else if (isDevelopmentBuild) {
          console.log('🔥 [FCM] Using Firebase FCM for development build');
        } else {
          console.log('🔥 [FCM] Using Firebase FCM for standalone build');
        }
        
        // Request permission for Firebase messaging
        const authStatus = await messaging.requestPermission();
        const enabled = authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
                       authStatus === messaging.AuthorizationStatus.PROVISIONAL;
        
        if (enabled) {
          console.log('✅ [FCM] Firebase messaging permission granted');
          
          // Get Firebase FCM token
          const fcmToken = await messaging.getToken();
          if (fcmToken) {
            console.log('✅ [FCM] Firebase FCM token obtained:', fcmToken.substring(0, 20) + '...');
            token = fcmToken;
          } else {
            console.warn('⚠️ [FCM] No Firebase FCM token available');
          }
        } else {
          console.warn('⚠️ [FCM] Firebase messaging permission denied');
        }
      } 
      // Fallback to Expo push tokens for Expo Go
      else {
        console.log('📱 [FCM] Using Expo push tokens for Expo Go');
        
        try {
          const expoPushToken = await Notifications.getExpoPushTokenAsync({
            projectId: '19ce1c4d-7c68-407f-96a0-d41bedaa3d55', // Your Expo project ID
          });
          
          if (expoPushToken?.data) {
            console.log('✅ [FCM] Expo push token obtained:', expoPushToken.data.substring(0, 30) + '...');
            token = expoPushToken.data;
          } else {
            console.warn('⚠️ [FCM] No Expo push token available');
          }
        } catch (expoError) {
          console.error('❌ [FCM] Failed to get Expo push token:', expoError);
          // Don't throw here, continue with null token
        }
      }
      
      if (token) {
        // Store token locally
        await AsyncStorage.setItem('fcm_token', token);
        this.token = token;
        
        // Register token with backend
        await this.registerTokenWithBackend(token);
        
        return token;
      } else {
        console.warn('⚠️ [FCM] No token available from any source');
        return null;
      }
    } catch (error) {
      console.error('❌ [FCM] Failed to get FCM token:', error);
      throw error;
    }
  }

  /**
   * Register FCM token with backend
   */
  async registerTokenWithBackend(token) {
    try {
      console.log('🔄 [FCM] Registering token with backend...');
      
      const response = await authAPI.post('/auth/register-fcm-token', {
        fcmToken: token,
        platform: Platform.OS,
        userType: 'astrologer',
        deviceInfo: {
          platform: Platform.OS,
          version: Platform.Version,
        }
      });

      if (response.data.success) {
        console.log('✅ [FCM] Token registered with backend successfully');
        await AsyncStorage.setItem('fcm_token_registered', 'true');
      } else {
        throw new Error(response.data.message || 'Failed to register token');
      }
    } catch (error) {
      console.error('❌ [FCM] Failed to register token with backend:', error);
      // Don't throw error - app should continue working even if token registration fails
    }
  }

  /**
   * Setup message handlers for different app states
   */
  setupMessageHandlers() {
    // Handle notification received while app is in foreground
    this.unsubscribeForeground = Notifications.addNotificationReceivedListener((notification) => {
      console.log('📱 [FCM] Foreground notification received:', notification);
      this.handleForegroundMessage(notification);
    });

    // Handle notification tapped/opened
    this.unsubscribeBackground = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('📱 [FCM] Notification response received:', response);
      this.handleNotificationOpened(response.notification);
    });

    // Handle app opened from quit state by notification
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        console.log('📱 [FCM] App opened from quit state by notification:', response);
        this.handleNotificationOpened(response.notification);
      }
    });

    // Note: Background message handling is managed by Expo's push notification service
    // No need to set up a separate background message handler for Expo managed workflow

    console.log('✅ [FCM] Message handlers setup');
  }

  /**
   * Handle foreground messages
   */
  async handleForegroundMessage(remoteMessage) {
    const { notification, data } = remoteMessage;
    
    console.log('📱 [FCM] Processing foreground message:', {
      title: notification?.title,
      body: notification?.body,
      data: data,
    });

    // Show local notification for foreground messages
    this.showLocalNotification(remoteMessage);
    
    // Handle specific notification types
    await this.processNotificationByType(remoteMessage);
  }

  /**
   * Handle background messages
   */
  async handleBackgroundMessage(remoteMessage) {
    console.log('📱 [FCM] Processing background message:', remoteMessage);
    
    // Store for processing when app becomes active
    await this.storeNotificationForLaterProcessing(remoteMessage);
    
    // Handle urgent notifications immediately
    if (remoteMessage.data?.urgent === 'true') {
      await this.processUrgentNotification(remoteMessage);
    }
  }

  /**
   * Handle notification opened (from background or quit state)
   */
  handleNotificationOpened(remoteMessage) {
    console.log('👆 [FCM] Notification opened:', remoteMessage);
    
    const { data } = remoteMessage;
    
    // Navigate based on notification type
    this.navigateBasedOnNotification(data);
  }

  /**
   * Show local notification for foreground messages
   */
  showLocalNotification(remoteMessage) {
    const { notification, data } = remoteMessage;
    
    if (!notification) return;

    const channelId = this.getChannelIdByType(data?.type);
    
    PushNotification.localNotification({
      title: notification.title,
      message: notification.body,
      channelId: channelId,
      userInfo: data,
      playSound: true,
      soundName: 'default',
      actions: this.getNotificationActions(data?.type),
    });
  }

  /**
   * Get notification channel ID based on type
   */
  getChannelIdByType(type) {
    switch (type) {
      case 'booking_request':
        return 'booking_requests';
      case 'chat_message':
        return 'chat_messages';
      case 'payment':
        return 'payments';
      default:
        return 'general';
    }
  }

  /**
   * Get notification actions based on type
   */
  getNotificationActions(type) {
    switch (type) {
      case 'booking_request':
        return ['Accept', 'Decline'];
      case 'chat_message':
        return ['Reply', 'Mark Read'];
      default:
        return [];
    }
  }

  /**
   * Process notification by type
   */
  async processNotificationByType(remoteMessage) {
    const { data } = remoteMessage;
    const type = data?.type;

    switch (type) {
      case 'booking_request':
        await this.handleBookingRequestNotification(data);
        break;
      case 'chat_message':
        await this.handleChatMessageNotification(data);
        break;
      case 'payment':
        await this.handlePaymentNotification(data);
        break;
      case 'profile_update':
        await this.handleProfileUpdateNotification(data);
        break;
      default:
        console.log('📱 [FCM] General notification processed');
    }
  }

  /**
   * Handle specific notification types
   */
  async handleBookingRequestNotification(data) {
    console.log('📅 [FCM] Processing booking request:', data);
    
    // Update local state, show in-app notification, etc.
    // Could trigger a refresh of bookings list
    
    // Store booking request for immediate access
    await this.storeBookingRequest(data);
  }

  async handleChatMessageNotification(data) {
    console.log('💬 [FCM] Processing chat message:', data);
    
    // Update chat state, increment unread count, etc.
    await this.updateChatState(data);
  }

  async handlePaymentNotification(data) {
    console.log('💳 [FCM] Processing payment notification:', data);
    
    // Update wallet balance, show payment status, etc.
    await this.updatePaymentState(data);
  }

  async handleProfileUpdateNotification(data) {
    console.log('👤 [FCM] Processing profile update:', data);
    
    // Refresh profile data, show update notification, etc.
  }

  /**
   * Navigate based on notification data
   */
  navigateBasedOnNotification(data) {
    const type = data?.type;
    
    console.log('🧭 [FCM] Navigating based on notification type:', type);
    
    // This would integrate with your navigation system
    switch (type) {
      case 'booking_request':
        // Navigate to bookings screen
        // NavigationService.navigate('Bookings', { bookingId: data.bookingId });
        break;
      case 'chat_message':
        // Navigate to chat screen
        // NavigationService.navigate('Chat', { chatId: data.chatId });
        break;
      case 'payment':
        // Navigate to wallet screen
        // NavigationService.navigate('Wallet');
        break;
      default:
        // Navigate to home screen
        // NavigationService.navigate('Home');
    }
  }

  /**
   * Setup token refresh listener
   */
  setupTokenRefreshListener() {
    // Note: Expo handles token refresh automatically
    // We can periodically check for token updates if needed
    console.log('🔄 [FCM] Token refresh handling setup (managed by Expo)');
    
    // Optional: Set up periodic token refresh check
    // This is generally not needed as Expo handles token lifecycle
  }

  /**
   * Setup app state handler
   */
  setupAppStateHandler() {
    this.appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        console.log('📱 [FCM] App became active, processing pending notifications');
        this.processPendingNotifications();
      }
    });
  }

  /**
   * Store notification for later processing
   */
  async storeNotificationForLaterProcessing(remoteMessage) {
    try {
      const existingNotifications = await AsyncStorage.getItem('pending_notifications');
      const notifications = existingNotifications ? JSON.parse(existingNotifications) : [];
      
      notifications.push({
        ...remoteMessage,
        receivedAt: new Date().toISOString(),
      });

      await AsyncStorage.setItem('pending_notifications', JSON.stringify(notifications));
      console.log('💾 [FCM] Notification stored for later processing');
    } catch (error) {
      console.error('❌ [FCM] Failed to store notification:', error);
    }
  }

  /**
   * Process pending notifications
   */
  async processPendingNotifications() {
    try {
      const pendingNotifications = await AsyncStorage.getItem('pending_notifications');
      if (!pendingNotifications) return;

      const notifications = JSON.parse(pendingNotifications);
      console.log(`🔄 [FCM] Processing ${notifications.length} pending notifications`);

      for (const notification of notifications) {
        await this.processNotificationByType(notification);
      }

      // Clear processed notifications
      await AsyncStorage.removeItem('pending_notifications');
      console.log('✅ [FCM] Pending notifications processed');
    } catch (error) {
      console.error('❌ [FCM] Failed to process pending notifications:', error);
    }
  }

  /**
   * Process urgent notifications immediately
   */
  async processUrgentNotification(remoteMessage) {
    console.log('🚨 [FCM] Processing urgent notification:', remoteMessage);
    
    // Handle urgent notifications that need immediate processing
    // even when app is in background
    
    const { data } = remoteMessage;
    
    if (data?.type === 'booking_request' && data?.urgent === 'true') {
      // Store urgent booking request
      await this.storeBookingRequest(data);
    }
  }

  /**
   * Store booking request data
   */
  async storeBookingRequest(data) {
    try {
      const existingRequests = await AsyncStorage.getItem('pending_booking_requests');
      const requests = existingRequests ? JSON.parse(existingRequests) : [];
      
      requests.push({
        ...data,
        receivedAt: new Date().toISOString(),
      });

      await AsyncStorage.setItem('pending_booking_requests', JSON.stringify(requests));
      console.log('💾 [FCM] Booking request stored');
    } catch (error) {
      console.error('❌ [FCM] Failed to store booking request:', error);
    }
  }

  /**
   * Update chat state
   */
  async updateChatState(data) {
    try {
      // Update unread count
      const currentCount = await AsyncStorage.getItem('unread_chat_count');
      const count = currentCount ? parseInt(currentCount) : 0;
      await AsyncStorage.setItem('unread_chat_count', (count + 1).toString());
      
      console.log('💬 [FCM] Chat state updated');
    } catch (error) {
      console.error('❌ [FCM] Failed to update chat state:', error);
    }
  }

  /**
   * Update payment state
   */
  async updatePaymentState(data) {
    try {
      // Store payment notification for wallet refresh
      await AsyncStorage.setItem('payment_update_pending', 'true');
      console.log('💳 [FCM] Payment state updated');
    } catch (error) {
      console.error('❌ [FCM] Failed to update payment state:', error);
    }
  }

  /**
   * Open notification settings
   */
  openNotificationSettings() {
    // This would open the device's notification settings
    // Implementation depends on your navigation/linking setup
    console.log('⚙️ [FCM] Opening notification settings');
  }

  /**
   * Get current FCM token
   */
  async getToken() {
    if (this.token) {
      return this.token;
    }

    try {
      const storedToken = await AsyncStorage.getItem('fcm_token');
      if (storedToken) {
        this.token = storedToken;
        return storedToken;
      }
    } catch (error) {
      console.error('❌ [FCM] Failed to get stored token:', error);
    }

    return null;
  }

  /**
   * Refresh FCM token
   */
  async refreshToken() {
    try {
      console.log('🔄 [FCM] Refreshing FCM token...');
      await this.getFCMToken();
      console.log('✅ [FCM] FCM token refreshed');
    } catch (error) {
      console.error('❌ [FCM] Failed to refresh FCM token:', error);
    }
  }

  /**
   * Clear FCM token (for logout)
   */
  async clearToken() {
    try {
      console.log('🗑️ [FCM] Clearing FCM token...');
      
      // Unregister token from backend
      if (this.token) {
        await authAPI.post('/auth/unregister-fcm-token', {
          fcmToken: this.token,
        });
      }

      // Clear local storage
      await AsyncStorage.removeItem('fcm_token');
      await AsyncStorage.removeItem('fcm_token_registered');
      await AsyncStorage.removeItem('pending_notifications');
      await AsyncStorage.removeItem('pending_booking_requests');
      await AsyncStorage.removeItem('unread_chat_count');
      await AsyncStorage.removeItem('payment_update_pending');

      this.token = null;
      console.log('✅ [FCM] FCM token cleared');
    } catch (error) {
      console.error('❌ [FCM] Failed to clear FCM token:', error);
    }
  }

  /**
   * Cleanup listeners
   */
  cleanup() {
    if (this.unsubscribeTokenRefresh) {
      this.unsubscribeTokenRefresh();
    }
    if (this.unsubscribeForeground) {
      this.unsubscribeForeground();
    }
    if (this.unsubscribeBackground) {
      this.unsubscribeBackground();
    }
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }
    
    console.log('🧹 [FCM] FCM Service cleaned up');
  }

  /**
   * Check if FCM is properly initialized
   */
  isReady() {
    return this.isInitialized && this.token !== null;
  }

  /**
   * Get FCM service status
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      hasToken: !!this.token,
      token: this.token,
    };
  }
}

// Export singleton instance
export default new FCMService();
