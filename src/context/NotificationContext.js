import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { Platform, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import FCMService from '../services/FCMService';

// Create context
const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const [fcmToken, setFcmToken] = useState('');
  const [notification, setNotification] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [bookingRequests, setBookingRequests] = useState([]);
  const appStateRef = useRef(AppState.currentState);
  const { token, user } = useAuth();

  // Request notification permissions immediately on app start
  useEffect(() => {
    requestNotificationPermissions();
  }, []);

  // Initialize FCM service when user is authenticated
  useEffect(() => {
    if (token && user && !isInitialized) {
      initializeFCMService();
    }
  }, [token, user, isInitialized]);

  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('📱 [NotificationContext] App has come to the foreground');
        // Process any pending notifications
        FCMService.processPendingNotifications();
        // Update unread count and booking requests
        updateUnreadCount();
        loadBookingRequests();
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      FCMService.cleanup();
    };
  }, []);

  /**
   * Request notification permissions immediately on app start
   */
  const requestNotificationPermissions = async () => {
    try {
      console.log('🔐 [NotificationContext] Requesting notification permissions at app start...');
      
      // Use FCMService's requestPermissions method
      const permissionGranted = await FCMService.requestPermissions();
      
      if (permissionGranted) {
        console.log('✅ [NotificationContext] Notification permissions granted at startup');
        return true;
      } else {
        console.log('❌ [NotificationContext] Notification permissions denied at startup');
        return false;
      }
    } catch (error) {
      console.error('❌ [NotificationContext] Failed to request permissions at startup:', error);
      return false;
    }
  };

  /**
   * Initialize FCM service
   */
  const initializeFCMService = async () => {
    try {
      console.log('🚀 [NotificationContext] Initializing FCM service for Astrologer App...');
      
      const success = await FCMService.initialize();
      
      if (success) {
        const token = await FCMService.getToken();
        if (token) {
          setFcmToken(token);
          console.log('✅ [NotificationContext] FCM service initialized with token');
        }
        setIsInitialized(true);
        
        // Load initial data
        await updateUnreadCount();
        await loadBookingRequests();
      } else {
        console.error('❌ [NotificationContext] Failed to initialize FCM service');
      }
    } catch (error) {
      console.error('❌ [NotificationContext] FCM initialization error:', error);
    }
  };

  /**
   * Update unread notification count
   */
  const updateUnreadCount = async () => {
    try {
      const storedCount = await AsyncStorage.getItem('unread_notification_count');
      const count = storedCount ? parseInt(storedCount) : 0;
      setUnreadCount(count);
    } catch (error) {
      console.error('❌ [NotificationContext] Failed to update unread count:', error);
    }
  };

  /**
   * Load booking requests from storage
   */
  const loadBookingRequests = async () => {
    try {
      const storedRequests = await AsyncStorage.getItem('pending_booking_requests');
      const requests = storedRequests ? JSON.parse(storedRequests) : [];
      setBookingRequests(requests);
    } catch (error) {
      console.error('❌ [NotificationContext] Failed to load booking requests:', error);
    }
  };

  /**
   * Mark notification as read
   */
  const markAsRead = async (notificationId) => {
    try {
      console.log('✅ [NotificationContext] Marking notification as read:', notificationId);
      
      const newCount = Math.max(0, unreadCount - 1);
      setUnreadCount(newCount);
      await AsyncStorage.setItem('unread_notification_count', newCount.toString());
    } catch (error) {
      console.error('❌ [NotificationContext] Failed to mark notification as read:', error);
    }
  };

  /**
   * Mark all notifications as read
   */
  const markAllAsRead = async () => {
    try {
      console.log('✅ [NotificationContext] Marking all notifications as read');
      
      setUnreadCount(0);
      await AsyncStorage.setItem('unread_notification_count', '0');
      
      // Clear badge count
      await FCMService.updateBadgeCount();
    } catch (error) {
      console.error('❌ [NotificationContext] Failed to mark all notifications as read:', error);
    }
  };

  /**
   * Handle booking request notifications
   */
  const handleBookingRequest = async (bookingData) => {
    try {
      console.log('📅 [NotificationContext] Handling booking request:', bookingData);
      
      // Update unread count
      const newCount = unreadCount + 1;
      setUnreadCount(newCount);
      await AsyncStorage.setItem('unread_notification_count', newCount.toString());
      
      // Add to booking requests
      const newRequest = {
        ...bookingData,
        receivedAt: new Date().toISOString(),
        read: false,
        id: bookingData.bookingId || Date.now().toString(),
      };
      
      const updatedRequests = [newRequest, ...bookingRequests];
      setBookingRequests(updatedRequests);
      
      // Store in AsyncStorage
      await AsyncStorage.setItem('pending_booking_requests', JSON.stringify(updatedRequests));
      
      // Show local notification if app is in foreground
      setNotification({
        title: 'New Booking Request',
        body: `${bookingData.userName} wants to book a consultation`,
        data: bookingData,
        timestamp: new Date().toISOString(),
      });
      
    } catch (error) {
      console.error('❌ [NotificationContext] Failed to handle booking request:', error);
    }
  };

  /**
   * Handle chat message notifications
   */
  const handleChatMessage = async (messageData) => {
    try {
      console.log('💬 [NotificationContext] Handling chat message:', messageData);
      
      // Update unread count
      const newCount = unreadCount + 1;
      setUnreadCount(newCount);
      await AsyncStorage.setItem('unread_notification_count', newCount.toString());
      
      // Update chat-specific unread count
      const chatId = messageData.chatId;
      if (chatId) {
        const chatUnreadKey = `chat_unread_${chatId}`;
        const currentChatUnread = await AsyncStorage.getItem(chatUnreadKey);
        const chatCount = currentChatUnread ? parseInt(currentChatUnread) : 0;
        await AsyncStorage.setItem(chatUnreadKey, (chatCount + 1).toString());
      }
      
      // Show local notification
      setNotification({
        title: 'New Message',
        body: messageData.message || 'You have a new message',
        data: messageData,
        timestamp: new Date().toISOString(),
      });
      
    } catch (error) {
      console.error('❌ [NotificationContext] Failed to handle chat message:', error);
    }
  };

  /**
   * Handle payment notifications
   */
  const handlePaymentNotification = async (paymentData) => {
    try {
      console.log('💳 [NotificationContext] Handling payment notification:', paymentData);
      
      // Update unread count
      const newCount = unreadCount + 1;
      setUnreadCount(newCount);
      await AsyncStorage.setItem('unread_notification_count', newCount.toString());
      
      // Mark payment update as pending
      await AsyncStorage.setItem('payment_update_pending', 'true');
      
      // Show local notification
      setNotification({
        title: 'Payment Update',
        body: paymentData.message || 'Your payment has been processed',
        data: paymentData,
        timestamp: new Date().toISOString(),
      });
      
    } catch (error) {
      console.error('❌ [NotificationContext] Failed to handle payment notification:', error);
    }
  };

  /**
   * Accept booking request
   */
  const acceptBookingRequest = async (bookingId) => {
    try {
      console.log('✅ [NotificationContext] Accepting booking request:', bookingId);
      
      // Update booking request status
      const updatedRequests = bookingRequests.map(request => 
        request.id === bookingId 
          ? { ...request, status: 'accepted', read: true }
          : request
      );
      
      setBookingRequests(updatedRequests);
      await AsyncStorage.setItem('pending_booking_requests', JSON.stringify(updatedRequests));
      
      // This would typically make an API call to accept the booking
      // await bookingAPI.acceptBooking(bookingId);
      
    } catch (error) {
      console.error('❌ [NotificationContext] Failed to accept booking request:', error);
    }
  };

  /**
   * Decline booking request
   */
  const declineBookingRequest = async (bookingId) => {
    try {
      console.log('❌ [NotificationContext] Declining booking request:', bookingId);
      
      // Update booking request status
      const updatedRequests = bookingRequests.map(request => 
        request.id === bookingId 
          ? { ...request, status: 'declined', read: true }
          : request
      );
      
      setBookingRequests(updatedRequests);
      await AsyncStorage.setItem('pending_booking_requests', JSON.stringify(updatedRequests));
      
      // This would typically make an API call to decline the booking
      // await bookingAPI.declineBooking(bookingId);
      
    } catch (error) {
      console.error('❌ [NotificationContext] Failed to decline booking request:', error);
    }
  };

  /**
   * Clear notification
   */
  const clearNotification = () => {
    setNotification(null);
  };

  /**
   * Refresh FCM token
   */
  const refreshToken = async () => {
    try {
      console.log('🔄 [NotificationContext] Refreshing FCM token...');
      
      await FCMService.refreshToken();
      const newToken = await FCMService.getToken();
      
      if (newToken) {
        setFcmToken(newToken);
        console.log('✅ [NotificationContext] FCM token refreshed');
      }
    } catch (error) {
      console.error('❌ [NotificationContext] Failed to refresh FCM token:', error);
    }
  };

  /**
   * Clear FCM token (for logout)
   */
  const clearToken = async () => {
    try {
      console.log('🗑️ [NotificationContext] Clearing FCM token...');
      
      await FCMService.clearToken();
      setFcmToken('');
      setIsInitialized(false);
      setUnreadCount(0);
      setBookingRequests([]);
      setNotification(null);
      
      console.log('✅ [NotificationContext] FCM token cleared');
    } catch (error) {
      console.error('❌ [NotificationContext] Failed to clear FCM token:', error);
    }
  };

  /**
   * Get FCM service status
   */
  const getStatus = () => {
    return {
      isInitialized,
      hasToken: !!fcmToken,
      token: fcmToken,
      unreadCount,
      bookingRequestsCount: bookingRequests.length,
      fcmServiceStatus: FCMService.getStatus(),
    };
  };

  /**
   * Handle notification navigation
   */
  const handleNotificationNavigation = (data) => {
    console.log('🧭 [NotificationContext] Handling notification navigation:', data);
    
    const type = data?.type;
    
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
  };

  // Context value
  const value = {
    // State
    fcmToken,
    notification,
    isInitialized,
    unreadCount,
    bookingRequests,
    
    // Methods
    requestNotificationPermissions,
    initializeFCMService,
    updateUnreadCount,
    loadBookingRequests,
    markAsRead,
    markAllAsRead,
    handleBookingRequest,
    handleChatMessage,
    handlePaymentNotification,
    acceptBookingRequest,
    declineBookingRequest,
    clearNotification,
    refreshToken,
    clearToken,
    getStatus,
    handleNotificationNavigation,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

// Hook to use notification context
export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

export default NotificationContext;
