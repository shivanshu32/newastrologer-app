import React, { useState, useEffect, useCallback } from 'react';
import { View, Alert } from 'react-native';
import { useSocket } from '../context/SocketContext';
import * as socketService from '../services/socketService';
import BookingRequestPopup from './BookingRequestPopup';
import { useNavigation } from '@react-navigation/native';

/**
 * Component to handle real-time booking requests for astrologers
 * This component should be included in the app's main layout/navigation
 * to ensure it's always active and listening for booking requests
 */
const BookingRequestHandler = () => {
  const [bookingRequest, setBookingRequest] = useState(null);
  const [isPopupVisible, setIsPopupVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Get socket from context and navigation
  const { socket, isConnected } = useSocket();
  const navigation = useNavigation();

  // Handle incoming booking request
  const handleBookingRequest = useCallback((request) => {
    console.log('New booking request received:', request);
    setBookingRequest(request);
    setIsPopupVisible(true);
    setError(null); // Clear any previous errors
  }, []);

  // Handle accept booking request
  const handleAcceptBooking = useCallback(async () => {
    if (!bookingRequest || !bookingRequest.bookingId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await socketService.respondToBookingRequest(socket, bookingRequest.bookingId, true);
      console.log('Booking accepted successfully:', response);
      
      // Close the popup and reset state on success
      setIsPopupVisible(false);
      
      // Store booking details before resetting state
      const currentBookingRequest = {...bookingRequest};
      setBookingRequest(null);
      
      // Navigate to the waiting room screen using nested navigation
      navigation.navigate('Bookings', {
        screen: 'WaitingRoom',
        params: {
          bookingId: currentBookingRequest.bookingId,
          bookingDetails: currentBookingRequest
        }
      });
      
      // Show success toast or alert
      Alert.alert('Success', 'Booking accepted successfully. Redirecting to waiting room...');
    } catch (error) {
      console.error('Error accepting booking:', error);
      setError(error.message || 'Failed to accept booking');
    } finally {
      setLoading(false);
    }
  }, [socket, bookingRequest, navigation]);

  // Handle reject booking request
  const handleRejectBooking = useCallback(async () => {
    if (!bookingRequest || !bookingRequest.bookingId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await socketService.respondToBookingRequest(socket, bookingRequest.bookingId, false);
      console.log('Booking rejected successfully:', response);
      
      // Close the popup and reset state on success
      setIsPopupVisible(false);
      setBookingRequest(null);
      
      // Show success toast or alert
      Alert.alert('Success', 'Booking rejected successfully');
    } catch (error) {
      console.error('Error rejecting booking:', error);
      setError(error.message || 'Failed to reject booking');
    } finally {
      setLoading(false);
    }
  }, [socket, bookingRequest]);

  // Close popup without responding (should be used carefully)
  const handleClose = useCallback(() => {
    console.log('Booking request popup closed without response');
    setIsPopupVisible(false);
    setError(null);
    
    // Note: This should be used carefully as it doesn't respond to the request
    // Consider auto-rejecting if popup is closed without a response
  }, []);


  
  // Set up socket listener for booking requests
  useEffect(() => {
    if (!socket || !isConnected) {
      console.log('Socket not connected, skipping booking request listener setup');
      return;
    }

    console.log('Setting up booking request listener');
    
    // Listen for new booking requests
    socket.on('new_booking_request', (bookingData) => {
      handleBookingRequest(bookingData);
    });

    // Clean up listener on unmount
    return () => {
      console.log('Cleaning up booking request listener');
      socket.off('new_booking_request');
    };
  }, [socket, isConnected, handleBookingRequest]);

  
  return (
    <View>
      <BookingRequestPopup
        visible={isPopupVisible}
        bookingRequest={bookingRequest}
        onAccept={handleAcceptBooking}
        onReject={handleRejectBooking}
        onClose={handleClose}
        loading={loading}
        error={error}
      />
    </View>
  );
};

export default BookingRequestHandler;
