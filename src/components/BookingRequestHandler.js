import React, { useState, useEffect, useCallback } from 'react';
import { View, Alert } from 'react-native';
import { useSocket } from '../context/SocketContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BookingRequestPopup from './BookingRequestPopup';
import { useNavigation } from '@react-navigation/native';

const API_BASE_URL = 'https://jyotishcallbackend-2uxrv.ondigitalocean.app/api/v1';

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
  const [isAccepting, setIsAccepting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  
  // Get socket from context and navigation
  const { socket, isConnected } = useSocket();
  const navigation = useNavigation();

  // Handle incoming booking request
  const handleBookingRequest = useCallback((request) => {
    console.log(' [DEBUG] Raw booking request received:', request);
    console.log(' [DEBUG] request.booking:', request.booking);
    console.log(' [DEBUG] request.user:', request.user);
    console.log(' [DEBUG] request.type:', request.type);
    console.log(' [DEBUG] request.rate:', request.rate);
    
    // Extract booking data from the nested structure sent by backend
    const bookingData = request.booking;
    
    if (!bookingData || !bookingData._id) {
      console.error(' [ERROR] Invalid booking data received:', bookingData);
      Alert.alert('Error', 'Invalid booking request received');
      return;
    }
    
    // Create a properly structured booking request object
    const structuredBookingRequest = {
      _id: bookingData._id,
      id: bookingData._id, // Fallback for compatibility
      user: request.user,
      type: request.type,
      rate: request.rate,
      notes: request.notes,
      expiresAt: request.expiresAt,
      // Include all original booking fields
      ...bookingData,
      // Override with user data from the request for display
      userName: request.user?.name || bookingData.userName,
      userImage: request.user?.profileImage || bookingData.userImage,
    };
    
    console.log(' [DEBUG] Structured booking request:', structuredBookingRequest);
    console.log(' [DEBUG] Booking ID available:', structuredBookingRequest._id);
    
    setBookingRequest(structuredBookingRequest);
    setIsPopupVisible(true);
    setError(null); // Clear any previous errors
  }, []);

  // Handle accept booking request using socket event
  const handleAcceptBooking = useCallback(async () => {
    console.log(' [DEBUG] handleAcceptBooking called - START');
    console.log(' [DEBUG] Current booking request:', bookingRequest);
    console.log(' [DEBUG] Socket available:', !!socket);
    console.log(' [DEBUG] Socket connected:', socket?.connected);
    
    // Store booking request data locally to prevent state clearing issues
    const currentBookingRequest = bookingRequest;
    console.log(' [DEBUG] Stored booking request locally:', currentBookingRequest);
    
    if (!socket) {
      console.error(' [ERROR] Socket is not available');
      Alert.alert('Error', 'Connection not available. Please try again.');
      return;
    }

    if (!socket.connected) {
      console.error(' [ERROR] Socket is not connected');
      Alert.alert('Error', 'Not connected to server. Please try again.');
      return;
    }

    if (!currentBookingRequest?._id) {
      console.error(' [ERROR] No booking request ID available');
      console.error(' [ERROR] currentBookingRequest:', currentBookingRequest);
      Alert.alert('Error', 'Invalid booking request.');
      return;
    }

    try {
      setIsAccepting(true);
      console.log(' [DEBUG] About to emit booking_response event');
      console.log(' [DEBUG] Payload:', { bookingId: currentBookingRequest._id, status: 'accepted' });
      
      socket.emit('booking_response', 
        { bookingId: currentBookingRequest._id, status: 'accepted' },
        (response) => {
          console.log('🔥🔥🔥 [ASTROLOGER-APP] booking_response callback received! 🔥🔥🔥');
          console.log(' [DEBUG] Raw callback response:', JSON.stringify(response, null, 2));
          console.log(' [DEBUG] Socket ID:', socket?.id);
          console.log(' [DEBUG] Socket connected:', socket?.connected);
          console.log(' [DEBUG] Callback timestamp:', new Date().toISOString());
          console.log(' [DEBUG] Socket callback received:', response);
          console.log(' [DEBUG] Response type:', typeof response);
          console.log(' [DEBUG] Response.success:', response?.success);
          console.log(' [DEBUG] Navigation object available:', !!navigation);
          setIsAccepting(false);
          
          if (response?.success) {
            console.log(' [SUCCESS] Booking accepted successfully');
            Alert.alert('DEBUG', 'Socket callback success - about to navigate to WaitingRoom');
            setIsPopupVisible(false);
            setBookingRequest(null);
            
            // Navigate to WaitingRoom using nested navigation
            // First navigate to Bookings tab, then to WaitingRoom screen within that stack
            try {
              navigation.navigate('Bookings', {
                screen: 'WaitingRoom',
                params: { 
                  bookingId: currentBookingRequest._id,
                  bookingDetails: currentBookingRequest 
                }
              });
              console.log(' [SUCCESS] Navigation.navigate called successfully');
              Alert.alert('DEBUG', 'Nested navigation called - Bookings->WaitingRoom');
            } catch (navError) {
              console.error(' [ERROR] Navigation failed:', navError);
              Alert.alert('Navigation Error', 'Failed to navigate to waiting room: ' + navError.message);
            }
          } else {
            console.error(' [ERROR] Backend rejected acceptance:', response);
            Alert.alert('DEBUG', 'Socket callback failed: ' + JSON.stringify(response));
          }
        }
      );
      
      console.log(' [DEBUG] booking_response event emitted successfully');
      
    } catch (error) {
      console.error(' [ERROR] Exception in handleAcceptBooking:', error);
      setIsAccepting(false);
      Alert.alert('Error', 'Failed to accept booking. Please try again.');
    }
  }, [socket, bookingRequest, navigation]);

  // Handle reject booking request using socket event
  const handleRejectBooking = useCallback(async () => {
    console.log(' [DEBUG] handleRejectBooking called - START');
    console.log(' [DEBUG] Current booking request:', bookingRequest);
    console.log(' [DEBUG] Socket available:', !!socket);
    console.log(' [DEBUG] Socket connected:', socket?.connected);
    
    // Store booking request data locally to prevent state clearing issues
    const currentBookingRequest = bookingRequest;
    console.log(' [DEBUG] Stored booking request locally:', currentBookingRequest);
    
    if (!socket) {
      console.error(' [ERROR] Socket is not available');
      Alert.alert('Error', 'Connection not available. Please try again.');
      return;
    }

    if (!socket.connected) {
      console.error(' [ERROR] Socket is not connected');
      Alert.alert('Error', 'Not connected to server. Please try again.');
      return;
    }

    if (!currentBookingRequest?._id) {
      console.error(' [ERROR] No booking request ID available');
      console.error(' [ERROR] currentBookingRequest:', currentBookingRequest);
      Alert.alert('Error', 'Invalid booking request.');
      return;
    }

    try {
      setIsRejecting(true);
      console.log(' [DEBUG] About to emit booking_response event');
      console.log(' [DEBUG] Payload:', { bookingId: currentBookingRequest._id, status: 'rejected' });
      
      socket.emit('booking_response', 
        { bookingId: currentBookingRequest._id, status: 'rejected' },
        (response) => {
          console.log(' [DEBUG] Socket callback received:', response);
          setIsRejecting(false);
          
          if (response?.success) {
            console.log(' [SUCCESS] Booking rejected successfully');
            setIsPopupVisible(false);
            setBookingRequest(null);
            Alert.alert('Success', 'Booking rejected successfully');
          } else {
            console.error(' [ERROR] Backend rejected rejection:', response);
            Alert.alert('Error', response?.message || 'Failed to reject booking');
          }
        }
      );
      
      console.log(' [DEBUG] booking_response event emitted successfully');
      
    } catch (error) {
      console.error(' [ERROR] Exception in handleRejectBooking:', error);
      setIsRejecting(false);
      Alert.alert('Error', 'Failed to reject booking. Please try again.');
    }
  }, [socket, bookingRequest]);

  // Close popup without responding (should be used carefully)
  const handleClose = useCallback(() => {
    console.log('Booking request popup closed without response');
    setIsPopupVisible(false);
    setError(null);
    setBookingRequest(null);
    
    // Note: This should be used carefully as it doesn't respond to the request
    // Consider auto-rejecting if popup is closed without a response
  }, []);

  
  // Set up socket listener for booking requests and lifecycle events
  useEffect(() => {
    if (!socket || !isConnected) {
      console.log('Socket not connected, skipping booking request listener setup');
      return;
    }

    console.log('Setting up booking request and lifecycle listeners');
    
    // Listen for new booking requests
    socket.on('booking_request', (bookingData) => {
      handleBookingRequest(bookingData);
    });

    // Listen for booking lifecycle events
    socket.on('booking_expired', (data) => {
      console.log('Booking expired:', data);
      if (bookingRequest && bookingRequest._id === data.bookingId) {
        setIsPopupVisible(false);
        setBookingRequest(null);
        Alert.alert('Booking Expired', 'The booking request has expired.');
      }
    });

    // Listen for booking response confirmation
    socket.on('booking_response_confirmed', (data) => {
      console.log(' [DEBUG] Booking response confirmed:', data);
      if (data.success) {
        console.log(`Booking ${data.bookingId} ${data.status} confirmed by backend`);
      }
    });

    // Listen for booking status updates - navigate to WaitingRoom when accepted
    socket.on('booking_status_update', (data) => {
      console.log('🔥🔥🔥 [ASTROLOGER-APP] booking_status_update event received! 🔥🔥🔥');
      console.log(' [DEBUG] Raw event data:', JSON.stringify(data, null, 2));
      console.log(' [DEBUG] Socket ID:', socket?.id);
      console.log(' [DEBUG] Socket connected:', socket?.connected);
      console.log(' [DEBUG] Event timestamp:', new Date().toISOString());
      console.log(' [DEBUG] Status:', data.status);
      console.log(' [DEBUG] Booking ID:', data.bookingId);
      
      try {
        // Navigate to WaitingRoom when booking is accepted by astrologer
        if (data.status === 'accepted' && data.bookingId) {
          console.log(' [DEBUG] Booking accepted - navigating to WaitingRoom');
          navigation.navigate('WaitingRoom', {
            bookingId: data.bookingId,
            sessionId: data.sessionId,
            roomId: data.roomId,
            consultationType: data.consultationType || 'video',
            bookingDetails: data.bookingDetails || data
          });
        }
      } catch (error) {
        console.error(' [ERROR] Failed to navigate to WaitingRoom:', error);
      }
    });

    // Listen for user joining consultation - navigate to session screen
    socket.on('user_joined_consultation', (data) => {
      console.log('🔥🔥🔥 [ASTROLOGER-APP] user_joined_consultation event received! 🔥🔥🔥');
      console.log(' [DEBUG] Raw event data:', JSON.stringify(data, null, 2));
      console.log(' [DEBUG] Socket ID:', socket?.id);
      console.log(' [DEBUG] Socket connected:', socket?.connected);
      console.log(' [DEBUG] Event timestamp:', new Date().toISOString());
      console.log(' [DEBUG] Consultation type:', data.consultationType);
      console.log(' [DEBUG] Booking details:', data.bookingDetails);
      
      try {
        // Navigate to appropriate session screen based on consultation type
        if (data.consultationType === 'video') {
          console.log(' [DEBUG] Navigating to VideoConsultation screen');
          navigation.navigate('BookingsVideoCall', {
            bookingId: data.bookingId,
            sessionId: data.sessionId,
            roomId: data.roomId,
            consultationType: 'video',
            bookingDetails: data.bookingDetails
          });
        } else if (data.consultationType === 'voice') {
          console.log(' [DEBUG] Navigating to VoiceCall screen');
          navigation.navigate('BookingsVoiceCall', {
            bookingId: data.bookingId,
            sessionId: data.sessionId,
            roomId: data.roomId,
            consultationType: 'voice',
            bookingDetails: data.bookingDetails
          });
        } else if (data.consultationType === 'chat') {
          console.log(' [DEBUG] Navigating to Chat screen');
          navigation.navigate('BookingsEnhancedChat', {
            bookingId: data.bookingId,
            sessionId: data.sessionId,
            roomId: data.roomId,
            consultationType: 'chat',
            bookingDetails: data.bookingDetails
          });
        } else {
          console.error(' [ERROR] Unknown consultation type:', data.consultationType);
          Alert.alert('Error', 'Unknown consultation type: ' + data.consultationType);
        }
      } catch (navError) {
        console.error(' [ERROR] Navigation to session screen failed:', navError);
        Alert.alert('Navigation Error', 'Failed to navigate to session screen: ' + navError.message);
      }
    });

    socket.on('booking_cancelled', (data) => {
      console.log('Booking cancelled:', data);
      if (bookingRequest && bookingRequest._id === data.bookingId) {
        setIsPopupVisible(false);
        setBookingRequest(null);
        Alert.alert('Booking Cancelled', 'The booking has been cancelled.');
      }
    });

    // Clean up listeners on unmount
    return () => {
      console.log('Cleaning up booking request and lifecycle listeners');
      socket.off('booking_request');
      socket.off('booking_expired');
      socket.off('booking_response_confirmed');
      socket.off('booking_status_update');
      socket.off('user_joined_consultation');
      socket.off('booking_cancelled');
    };
  }, [socket, isConnected, handleBookingRequest, bookingRequest, navigation]);

  
  return (
    <View>
      <BookingRequestPopup
        visible={isPopupVisible}
        bookingRequest={bookingRequest}
        onAccept={handleAcceptBooking}
        onReject={handleRejectBooking}
        onClose={handleClose}
        loading={isAccepting || isRejecting}
        error={error}
      />
    </View>
  );
};

export default BookingRequestHandler;
