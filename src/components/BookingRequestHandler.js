import React, { useState, useEffect, useCallback } from 'react';
import { View, Alert } from 'react-native';
import { useSocket } from '../context/SocketContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BookingRequestPopup from './BookingRequestPopup';
import { useNavigation } from '@react-navigation/native';
import { getPendingBookings, listenForPendingBookingUpdates } from '../services/socketService';

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
  
  // Real-time pending bookings state
  const [pendingBookings, setPendingBookings] = useState([]);
  const [pendingBookingsLoading, setPendingBookingsLoading] = useState(false);
  
  // Get socket from context and navigation
  const { socket, isConnected } = useSocket();
  const navigation = useNavigation();
  
  // Debug state changes
  useEffect(() => {
    console.log(' [DEBUG] BookingRequestHandler state changed:');
    console.log(' [DEBUG] - bookingRequest:', bookingRequest);
    console.log(' [DEBUG] - isPopupVisible:', isPopupVisible);
    console.log(' [DEBUG] - loading:', loading);
    console.log(' [DEBUG] - error:', error);
  }, [bookingRequest, isPopupVisible, loading, error]);

  // Handle incoming booking request
  const handleBookingRequest = useCallback((request) => {
    console.log(' [DEBUG] Raw booking request received:', request);
    console.log(' [DEBUG] request.booking:', request.booking);
    console.log(' [DEBUG] request.user:', request.user);
    console.log(' [DEBUG] request.type:', request.type);
    console.log(' [DEBUG] request.rate:', request.rate);
    
    // Handle both data structures:
    // 1. Online bookings: data is nested under request.booking
    // 2. Offline/queued bookings: data is directly in request object
    let bookingData;
    let bookingId;
    
    if (request.booking && request.booking._id) {
      // Online booking - nested structure
      console.log(' [DEBUG] Processing online booking request');
      bookingData = request.booking;
      bookingId = request.booking._id;
    } else if (request.bookingId) {
      // Offline/queued booking - flat structure
      console.log(' [DEBUG] Processing offline/queued booking request');
      bookingData = {
        _id: request.bookingId,
        type: request.type,
        rate: request.rate,
        notes: request.notes,
        createdAt: request.createdAt,
        expiresAt: request.expiresAt,
        astrologer: request.astrologer,
        user: request.user,
        userInfo: request.userInfo,
        wasQueued: request.wasQueued,
        queuedAt: request.queuedAt
      };
      bookingId = request.bookingId;
    } else {
      console.error(' [ERROR] Invalid booking data - no booking ID found');
      console.error(' [ERROR] Request structure:', Object.keys(request));
      Alert.alert('Error', 'Invalid booking request received - missing booking ID');
      return;
    }
    
    if (!bookingId) {
      console.error(' [ERROR] No booking ID available');
      Alert.alert('Error', 'Invalid booking request received - no booking ID');
      return;
    }
    
    console.log(' [DEBUG] Extracted booking data:', bookingData);
    console.log(' [DEBUG] Booking ID:', bookingId);
    
    // Create a properly structured booking request object
    const structuredBookingRequest = {
      _id: bookingId,
      id: bookingId, // Fallback for compatibility
      user: request.user,
      type: request.type || bookingData.type,
      rate: request.rate || bookingData.rate,
      notes: request.notes || bookingData.notes,
      expiresAt: request.expiresAt || bookingData.expiresAt,
      createdAt: request.createdAt || bookingData.createdAt,
      // Include all booking fields
      ...bookingData,
      // Override with user data from the request for display
      userName: request.user?.name || bookingData.userName,
      userImage: request.user?.profileImage || bookingData.userImage,
      // Add queued booking specific fields
      wasQueued: request.wasQueued || false,
      queuedAt: request.queuedAt,
      userInfo: request.userInfo || bookingData.userInfo
    };
    
    console.log(' [DEBUG] Structured booking request:', structuredBookingRequest);
    console.log(' [DEBUG] Booking ID available:', structuredBookingRequest._id);
    
    console.log(' [DEBUG] About to set booking request state');
    console.log(' [DEBUG] Current bookingRequest state before update:', bookingRequest);
    console.log(' [DEBUG] Current isPopupVisible state before update:', isPopupVisible);
    
    setBookingRequest(structuredBookingRequest);
    setIsPopupVisible(true);
    setError(null); // Clear any previous errors
    
    console.log(' [DEBUG] State update calls completed');
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
            setIsPopupVisible(false);
            setBookingRequest(null);
            
            // Handle different consultation types
            const consultationType = currentBookingRequest.type;
            console.log(' [DEBUG] Consultation type:', consultationType);
            
            if (consultationType === 'voice') {
              // For voice consultations, Exotel call should be triggered automatically by backend
              // Show success message and stay on current screen
              console.log(' [VOICE] Voice consultation accepted - Exotel call should be triggered by backend');
              Alert.alert(
                'Voice Call Accepted', 
                'The voice consultation has been accepted. The call will be initiated shortly via Exotel. Please wait for the incoming call.',
                [{ text: 'OK' }]
              );
              
              // Stay on current screen for voice calls - no navigation needed
              console.log(' [SUCCESS] Voice consultation accepted - staying on current screen');
              
            } else {
              // For chat and video consultations, use the traditional WaitingRoom flow
              console.log(' [DEBUG] Non-voice consultation - navigating to WaitingRoom');
              try {
                navigation.navigate('Bookings', {
                  screen: 'WaitingRoom',
                  params: { 
                    bookingId: currentBookingRequest._id,
                    bookingDetails: currentBookingRequest 
                  }
                });
                console.log(' [SUCCESS] Navigation.navigate called successfully');
              } catch (navError) {
                console.error(' [ERROR] Navigation failed:', navError);
                Alert.alert('Navigation Error', 'Failed to navigate to waiting room: ' + navError.message);
              }
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

  
  // Fetch initial pending bookings when socket connects
  useEffect(() => {
    const fetchInitialPendingBookings = async () => {
      if (!socket || !isConnected) {
        console.log('📋 [PENDING] Socket not connected, skipping initial pending bookings fetch');
        return;
      }
      
      try {
        setPendingBookingsLoading(true);
        console.log('📋 [PENDING] Fetching initial pending bookings...');
        const initialPendingBookings = await getPendingBookings(socket);
        console.log('📋 [PENDING] Initial pending bookings:', initialPendingBookings);
        setPendingBookings(initialPendingBookings);
      } catch (error) {
        console.error('📋 [PENDING] Failed to fetch initial pending bookings:', error);
      } finally {
        setPendingBookingsLoading(false);
      }
    };
    
    fetchInitialPendingBookings();
  }, [socket, isConnected]);
  
  // Set up socket listener for real-time pending booking updates
  useEffect(() => {
    if (!socket || !isConnected) {
      console.log('📋 [PENDING] Socket not connected, skipping pending booking updates listener');
      return;
    }
    
    console.log('📋 [PENDING] Setting up real-time pending booking updates listener');
    
    // Set up listener for pending booking updates
    const cleanupPendingUpdates = listenForPendingBookingUpdates(socket, (updatedPendingBookings) => {
      console.log('📋 [PENDING] Received pending bookings update:', updatedPendingBookings);
      setPendingBookings(updatedPendingBookings);
    });
    
    return cleanupPendingUpdates;
  }, [socket, isConnected]);

  // Set up socket listener for booking requests and lifecycle events
  useEffect(() => {
    if (!socket || !isConnected) {
      console.log('Socket not connected, skipping booking request listener setup');
      return;
    }

    console.log('Setting up booking request and lifecycle listeners');
    
    // Listen for new booking requests
    socket.on('booking_request', (bookingData) => {
      console.log(' [DEBUG] BookingRequestHandler received booking_request:', bookingData);
      
      // Handle reliable socket message format
      let actualBookingData = bookingData;
      if (bookingData.meta && bookingData.payload) {
        // This is a reliable socket message, extract the actual booking data
        actualBookingData = bookingData.payload;
        console.log(' [DEBUG] Extracted booking data from reliable socket message:', actualBookingData);
        
        // Send ACK if required
        if (bookingData.meta.requiresAck && bookingData.meta.messageId) {
          console.log(`✅ [BookingRequestHandler] Sending ACK for message ${bookingData.meta.messageId}`);
          socket.emit('ack', {
            messageId: bookingData.meta.messageId,
            status: 'received',
            timestamp: new Date().toISOString(),
            clientType: 'astrologer-app'
          });
        }
      }
      
      handleBookingRequest(actualBookingData);
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
          navigation.navigate('Bookings', {
            screen: 'WaitingRoom',
            params: {
              bookingId: data.bookingId,
              sessionId: data.sessionId,
              roomId: data.roomId,
              consultationType: data.consultationType || 'video',
              bookingDetails: data.bookingDetails || data
            }
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
      console.log(' [DEBUG] Booking details from data.bookingDetails:', data.bookingDetails);
      console.log(' [DEBUG] Available data keys:', Object.keys(data));
      console.log(' [DEBUG] User info:', data.userInfo);
      console.log(' [DEBUG] Astrologer ID:', data.astrologerId);
      
      // Extract booking details - the data object itself contains the booking info
      const bookingDetails = data.bookingDetails || {
        _id: data.bookingId,
        user: data.user,
        userInfo: data.userInfo,
        astrologer: data.astrologerId,
        type: data.consultationType,
        sessionId: data.sessionId,
        roomId: data.roomId,
        ...data // Include all other fields from the event
      };
      
      console.log(' [DEBUG] Constructed booking details:', bookingDetails);
      
      try {
        // Navigate to appropriate session screen based on consultation type
        if (data.consultationType === 'video') {
          console.log(' [DEBUG] Video consultation - feature unavailable');
          Alert.alert(
            'Video Call Feature Unavailable',
            'Video calling is currently not available. Please use chat or voice call instead.',
            [{ text: 'OK', style: 'default' }]
          );
        } else if (data.consultationType === 'voice') {
          console.log(' [DEBUG] Voice consultation - triggering Exotel call');
          // For voice calls, trigger Exotel call directly
          // The call will be handled by the backend/Exotel system
          Alert.alert(
            'Voice Call Accepted! 📞',
            'You will receive a phone call shortly from our system. Please answer the call to connect with the user.',
            [{ text: 'OK', style: 'default' }]
          );
        } else if (data.consultationType === 'chat') {
          console.log(' [DEBUG] Chat consultation detected - WaitingRoomScreen will handle navigation');
          console.log(' [DEBUG] Skipping navigation from BookingRequestHandler to prevent conflict');
          console.log(' [DEBUG] WaitingRoomScreen has complete booking details with userInfo and astrologerId');
          // Note: WaitingRoomScreen handles chat navigation with complete booking details
          // This prevents navigation conflict and ensures userInfo is available
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
  }, [socket, isConnected]); // Removed unstable dependencies that cause listener churn

  
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
