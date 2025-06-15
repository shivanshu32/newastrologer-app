import React, { useState, useEffect, useCallback } from 'react';
import { View, Alert } from 'react-native';
import * as socketService from '../services/socketService';
import { useSocket } from '../context/SocketContext';
import BookingRequestPopup from './BookingRequestPopup';

/**
 * Component to handle real-time booking requests for astrologers
 * This component should be included in the app's main layout/navigation
 * to ensure it's always active and listening for booking requests
 */
const BookingRequestHandler = () => {
  const [bookingRequest, setBookingRequest] = useState(null);
  const [isPopupVisible, setIsPopupVisible] = useState(false);

  // Handle incoming booking request
  const handleBookingRequest = useCallback((request) => {
    console.log('New booking request received:', request);
    setBookingRequest(request);
    setIsPopupVisible(true);
  }, []);

  // Handle booking acceptance
  const handleAccept = useCallback(async (response) => {
    console.log('Booking accepted:', response);
    setIsPopupVisible(false);
    
    if (socket && isConnected && bookingRequest) {
      try {
        console.log('Sending booking acceptance for booking ID:', bookingRequest.bookingId);
        await socketService.respondToBookingRequest(socket, bookingRequest.bookingId, true);
        console.log('Booking acceptance sent successfully');
      } catch (error) {
        console.error('Error accepting booking request:', error);
      }
    } else {
      console.error('Cannot accept booking: Socket not connected or booking request missing');
    }
    
    setBookingRequest(null);
    
    // Additional logic can be added here, such as:
    // - Navigate to consultation screen
    // - Show preparation instructions
    // - Update astrologer status
  }, [socket, isConnected, bookingRequest]);

  // Handle booking rejection
  const handleReject = useCallback(async (response) => {
    console.log('Booking rejected:', response);
    setIsPopupVisible(false);
    
    if (socket && isConnected && bookingRequest) {
      try {
        console.log('Sending booking rejection for booking ID:', bookingRequest.bookingId);
        await socketService.respondToBookingRequest(socket, bookingRequest.bookingId, false);
        console.log('Booking rejection sent successfully');
      } catch (error) {
        console.error('Error rejecting booking request:', error);
      }
    } else {
      console.error('Cannot reject booking: Socket not connected or booking request missing');
    }
    
    setBookingRequest(null);
  }, [socket, isConnected, bookingRequest]);

  // Close popup without responding (should be used carefully)
  const handleClose = useCallback(() => {
    console.log('Booking request popup closed without response');
    setIsPopupVisible(false);
    
    // Note: This should be used carefully as it doesn't respond to the request
    // Consider auto-rejecting if popup is closed without a response
  }, []);

  // Get socket from context
  const { socket, isConnected } = useSocket();
  
  // Set up socket listener for booking requests
  useEffect(() => {
    if (!socket) {
      console.log('BookingRequestHandler: Socket not connected, cannot listen for booking requests');
      return;
    }

    console.log(`BookingRequestHandler: Setting up listener for booking requests on socket: ${socket.id}`);
    console.log(`Setting up listener for booking requests on socket: ${socket.id}`);
    
    // Listen for new booking requests
    socket.on('new_booking_request', (bookingData) => {
      console.log('=== NEW BOOKING REQUEST RECEIVED IN ASTROLOGER APP ===');
      console.log('BookingRequestHandler: Received new_booking_request event with data:', JSON.stringify(bookingData));
      
      // Show an alert for debugging purposes
      Alert.alert(
        'New Booking Request',
        `Received booking request from ${bookingData.userName} for ${bookingData.type} consultation`,
        [{ text: 'OK' }]
      );
      
      handleBookingRequest(bookingData);
    });

    // Also listen for any socket errors
    socket.on('error', (error) => {
      console.error('BookingRequestHandler: Socket error received:', error);
    });

    return () => {
      socket.off('new_booking_request');
      socket.off('error');
    };
  }, [socket]);

  return (
    <View>
      <BookingRequestPopup
        visible={isPopupVisible}
        bookingRequest={bookingRequest}
        onAccept={handleAccept}
        onReject={handleReject}
        onClose={handleClose}
      />
    </View>
  );
};

export default BookingRequestHandler;
