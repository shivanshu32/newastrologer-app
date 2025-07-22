import React, { useEffect, useRef } from 'react';
import { View, AppState } from 'react-native';
import { useNotification } from '../context/NotificationContext';
import { useNavigation } from '@react-navigation/native';
import { provideNotificationFeedback } from '../utils/notificationUtils';

/**
 * NotificationHandler component
 * 
 * This component handles push notifications and navigation based on notification data.
 * It should be placed at the root level of the app to ensure it's always mounted.
 */
const NotificationHandler = () => {
  const { notification } = useNotification();
  const navigation = useNavigation();
  const appState = useRef(AppState.currentState);
  const lastNotificationRef = useRef(null);
  // We're now using the centralized notification utility functions

  // Handle notification navigation and feedback when app is in foreground
  useEffect(() => {
    if (notification && notification !== lastNotificationRef.current) {
      lastNotificationRef.current = notification;
      const notificationData = notification.request.content.data;
      
      // Check if this is a booking request notification that requires feedback
      if (notificationData && 
          (notificationData.type === 'new_booking' || 
           notificationData.type === 'free_chat_request' || 
           notificationData.notificationType === 'booking_request' || 
           notificationData.requiresFeedback === 'true')) {
        
        console.log('📬 Booking request notification received - triggering feedback');
        
        // Trigger vibration and sound feedback using utility function (respects user preferences)
        provideNotificationFeedback().catch(error => {
          console.error('Error providing notification feedback:', error);
        });
      }
      
      // Handle navigation based on notification data
      handleNotificationNavigation(notificationData);
    }
  }, [notification]);

  // Listen for app state changes to handle notifications when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) && 
        nextAppState === 'active' &&
        notification
      ) {
        // App has come to the foreground
        handleNotificationNavigation(notification.request.content.data);
      }
      
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [notification]);

  // Handle navigation based on notification data
  const handleNotificationNavigation = (data) => {
    if (!data) return;

    try {
      console.log('Handling notification navigation:', data);
      
      switch (data.type) {
        case 'new_booking':
          if (data.bookingId) {
            navigation.navigate('BookingsMain');
          }
          break;
          
        case 'booking_accepted':
        case 'booking_rejected':
        case 'booking_cancelled':
          if (data.bookingId) {
            navigation.navigate('BookingsMain');
          }
          break;
          
        case 'session_reminder':
          if (data.bookingId) {
            navigation.navigate('BookingsMain', {
              screen: 'BookingDetails',
              params: { bookingId: data.bookingId }
            });
          }
          break;
          
        case 'payment_received':
          navigation.navigate('Wallet');
          break;
          
        case 'new_rating':
          if (data.bookingId) {
            navigation.navigate('BookingsMain', {
              screen: 'BookingDetails',
              params: { bookingId: data.bookingId }
            });
          }
          break;
          
        default:
          // For unknown notification types, navigate to home
          console.log('Unknown notification type:', data.type);
      }
    } catch (error) {
      console.log('Error handling notification navigation:', error);
    }
  };

  // This component doesn't render anything
  return null;
};

export default NotificationHandler;
