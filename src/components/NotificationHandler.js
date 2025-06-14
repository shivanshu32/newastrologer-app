import React, { useEffect, useRef } from 'react';
import { View, AppState } from 'react-native';
import { useNotification } from '../context/NotificationContext';
import { useNavigation } from '@react-navigation/native';

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

  // Handle notification navigation when app is in foreground
  useEffect(() => {
    if (notification && notification !== lastNotificationRef.current) {
      lastNotificationRef.current = notification;
      handleNotificationNavigation(notification.request.content.data);
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
