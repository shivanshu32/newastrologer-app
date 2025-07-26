import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, BackHandler, Alert, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useSocket } from '../context/SocketContext';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Waiting room screen for astrologers after accepting a booking
 * Shows a waiting state until the user joins the consultation
 */
const WaitingRoomScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { socket, isConnected } = useSocket();
  const [waitingTime, setWaitingTime] = useState(0);
  const [isCancelling, setIsCancelling] = useState(false);
  const hasNavigated = useRef(false); // Use useRef for immediate updates
  
  // Extract booking details from route params
  const { bookingId, bookingDetails } = route.params || {};

  // Cancel booking function
  const cancelBooking = async () => {
    try {
      setIsCancelling(true);
      
      // Get astrologer token
      const token = await AsyncStorage.getItem('astrologerToken');
      if (!token) {
        Alert.alert('Error', 'Authentication required. Please login again.');
        return;
      }

      // Call backend API to cancel booking
      const response = await fetch(`https://jyotishcallbackend-2uxrv.ondigitalocean.app/api/v1/bookings/${bookingId}/cancel`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          reason: 'Cancelled by astrologer from waiting room'
        }),
      });

      // Check if response is JSON
      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error('Failed to parse response as JSON:', parseError);
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }
      
      if (response.ok && data.success) {
        // Emit socket event to notify user immediately
        if (socket && isConnected) {
          socket.emit('booking_cancelled_by_astrologer', {
            bookingId: bookingId,
            astrologerId: bookingDetails?.astrologer?._id,
            userId: bookingDetails?.user?._id,
            reason: 'Cancelled by astrologer'
          });
        }
        
        Alert.alert(
          'Booking Cancelled',
          'The booking has been cancelled successfully. The user has been notified.',
          [{
            text: 'OK',
            onPress: () => navigation.navigate('Home')
          }]
        );
      } else {
        throw new Error(data.message || 'Failed to cancel booking');
      }
    } catch (error) {
      console.error('Error cancelling booking:', error);
      Alert.alert(
        'Error',
        'Failed to cancel booking. Please try again or contact support.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsCancelling(false);
    }
  };

  // Show cancel confirmation
  const showCancelConfirmation = () => {
    Alert.alert(
      'Cancel Booking',
      'Are you sure you want to cancel this booking? The user will be notified and refunded.',
      [
        { text: 'No', style: 'cancel' },
        { 
          text: 'Yes, Cancel', 
          style: 'destructive',
          onPress: cancelBooking
        }
      ]
    );
  };

  // Timer to track waiting time
  useEffect(() => {
    const timer = setInterval(() => {
      setWaitingTime(prev => prev + 1);
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);

  // Format waiting time as mm:ss
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Listen for user join event
  useEffect(() => {
    if (!socket || !isConnected || !bookingId) return;

    // Join the consultation room for this booking
    const roomId = `consultation:${bookingId}`;
    console.log('🔄 [ASTROLOGER-APP] Joining consultation room:', roomId);
    
    socket.emit('join_consultation_room', { 
      bookingId, 
      roomId,
      userType: 'astrologer',
      sessionId: bookingDetails?.sessionId || null
    }, (response) => {
      if (response && response.success) {
        console.log('✅ [ASTROLOGER-APP] Successfully joined consultation room for booking:', bookingId);
        console.log('✅ [ASTROLOGER-APP] Room ID:', roomId);
      } else {
        console.error('❌ [ASTROLOGER-APP] Failed to join consultation room:', response?.error || 'Unknown error');
      }
    });

    const handleUserJoined = (data) => {
      console.log('🔍 [ASTROLOGER-APP] handleUserJoined called with data:', JSON.stringify(data));
      console.log('🔍 [ASTROLOGER-APP] Current booking ID:', bookingId);
      console.log('🔍 [ASTROLOGER-APP] Current booking details:', JSON.stringify(bookingDetails));
      
      // Prevent multiple navigations using ref for immediate check
      if (hasNavigated.current) {
        console.log('⚠️ [ASTROLOGER-APP] Navigation already occurred, ignoring duplicate event');
        return;
      }
      
      // Set navigation guard immediately
      hasNavigated.current = true;
      console.log('🔒 [ASTROLOGER-APP] Navigation guard set, preventing further navigation');
      
      // Determine consultation type - log each potential source
      console.log('🔍 [ASTROLOGER-APP] data.type:', data?.type);
      console.log('🔍 [ASTROLOGER-APP] data.consultationType:', data?.consultationType);
      console.log('🔍 [ASTROLOGER-APP] bookingDetails.type:', bookingDetails?.type);
      
      // Extract consultation type with fallback chain
      const consultationType = data?.type || data?.consultationType || bookingDetails?.type || 'chat';
      console.log('🔍 [ASTROLOGER-APP] Final determined consultation type:', consultationType);
      
      const isVideoCall = consultationType === 'video';
      const isVoiceCall = consultationType === 'voice';
      
      console.log('🔍 [ASTROLOGER-APP] Is video call?', isVideoCall);
      console.log('🔍 [ASTROLOGER-APP] Is voice call?', isVoiceCall);
      
      // Enhanced booking details with session information
      const enhancedBookingDetails = {
        ...bookingDetails,
        sessionId: data.sessionId || bookingDetails?.sessionId
      };
      
      console.log('🔍 [ASTROLOGER-APP] Navigation params:', {
        booking: bookingDetails,
        bookingId: bookingId,
        roomId: data.roomId,
        sessionId: enhancedBookingDetails.sessionId || bookingDetails?.sessionId || data.sessionId,
        userJoinData: data // Pass the entire user join event data
      });
      
      if (isVoiceCall) {
        console.log('✅ [ASTROLOGER-APP] Voice consultation - using Exotel call');
        // For voice calls, show message and let Exotel handle the call
        // No navigation to legacy WebRTC screen needed
        Alert.alert(
          'Voice Call Connected! 📞',
          'The user has joined the voice consultation. You will receive a phone call shortly from our system. Please answer the call to connect with the user.',
          [
            {
              text: 'OK',
              onPress: () => {
                // Navigate back to dashboard since Exotel will handle the call
                navigation.navigate('Home');
              }
            }
          ]
        );
        
        // Note: Backend should have already triggered Exotel two-way call
        // Both user and astrologer will receive actual phone calls
        console.log('✅ [ASTROLOGER-APP] Exotel voice call flow initiated');
      } else if (isVideoCall) {
        console.log('✅ [ASTROLOGER-APP] Video consultation - feature unavailable');
        Alert.alert(
          'Video Call Feature Unavailable',
          'Video calling is currently not available. Please use chat or voice call instead.',
          [{ text: 'OK', style: 'default' }]
        );
      } else {
        console.log('✅ [ASTROLOGER-APP] Navigating to enhanced chat consultation');
        
        // Check if we're already on the EnhancedChatScreen to prevent remounts
        const currentRoute = navigation.getState()?.routes?.[navigation.getState()?.index];
        if (currentRoute?.name === 'BookingsEnhancedChat') {
          console.log('⚠️ [ASTROLOGER-APP] Already on FixedChatScreen, skipping navigation to prevent remount');
          return;
        }
        
        const navigationParams = {
          bookingId: bookingId,
          sessionId: enhancedBookingDetails.sessionId || bookingDetails?.sessionId || data.sessionId,
          roomId: data.roomId,
          consultationType: 'chat',
          astrologerId: bookingDetails?.astrologer?._id || bookingDetails?.astrologer,
          bookingDetails: bookingDetails
        };
        
        console.log('✅ [ASTROLOGER-APP] Navigation params with complete booking details:', navigationParams);
        
        // Use replace instead of navigate to prevent creating multiple route instances
        console.log('🚀🚀🚀 [ASTROLOGER-APP] ABOUT TO CALL navigation.replace(\'BookingsEnhancedChat\') 🚀🚀🚀');
        console.log('🚀🚀🚀 [ASTROLOGER-APP] Navigation object available:', !!navigation);
        console.log('🚀🚀🚀 [ASTROLOGER-APP] Navigation.replace function available:', typeof navigation.replace);
        
        try {
          navigation.replace('BookingsEnhancedChat', navigationParams);
          console.log('✅✅✅ [ASTROLOGER-APP] navigation.replace() call completed successfully! ✅✅✅');
        } catch (error) {
          console.error('❌❌❌ [ASTROLOGER-APP] navigation.replace() failed with error:', error);
        }
        
        console.log('✅ [ASTROLOGER-APP] Used navigation.replace to prevent route duplication');
      }
    };

    // Listen for user joining the consultation
    console.log('🔄 [ASTROLOGER-APP] Setting up socket listener for "user_joined_consultation"');
    const userJoinedHandler = (data) => {
      console.log('📩 [ASTROLOGER-APP] Received "user_joined_consultation" event with data:', JSON.stringify(data));
      console.log('🔍 [ASTROLOGER-APP] Expected bookingId:', bookingId);
      console.log('🔍 [ASTROLOGER-APP] Received bookingId:', data?.bookingId);
      
      if (data && data.bookingId === bookingId) {
        console.log('✅ [ASTROLOGER-APP] BookingId matches, calling handleUserJoined');
        handleUserJoined(data);
      } else {
        console.log('❌ [ASTROLOGER-APP] BookingId mismatch, ignoring event');
      }
    };
    
    socket.on('user_joined_consultation', userJoinedHandler);

    // Also listen for the alternate event name as a fallback
    console.log('🔄 [ASTROLOGER-APP] Setting up socket listener for "join_consultation"');
    const joinConsultationHandler = (data) => {
      console.log('📩 [ASTROLOGER-APP] Received "join_consultation" event with data:', JSON.stringify(data));
      console.log('🔍 [ASTROLOGER-APP] Expected bookingId:', bookingId);
      console.log('🔍 [ASTROLOGER-APP] Received bookingId:', data?.bookingId);
      
      if (data && data.bookingId === bookingId) {
        console.log('✅ [ASTROLOGER-APP] BookingId matches, calling handleUserJoined');
        handleUserJoined(data);
      } else {
        console.log('❌ [ASTROLOGER-APP] BookingId mismatch, ignoring event');
      }
    };
    
    socket.on('join_consultation', joinConsultationHandler);

    // Listen for direct notifications
    const directNotificationHandler = (data) => {
      console.log('🔔 [ASTROLOGER-APP] Direct notification received:', data);
      // Handle any direct notifications here if needed
    };

    // Handle booking cancellation by user
    const bookingCancelledHandler = (data) => {
      console.log('🚫 [ASTROLOGER-APP] Booking cancelled by user:', data);
      
      // Check if this cancellation is for the current booking
      if (data && data.bookingId === bookingId) {
        console.log('✅ [ASTROLOGER-APP] Booking cancellation matches current booking, handling...');
        
        // Prevent multiple navigations
        if (hasNavigated.current) {
          console.log('⚠️ [ASTROLOGER-APP] Navigation already occurred, ignoring booking cancellation');
          return;
        }
        
        // Set navigation guard immediately
        hasNavigated.current = true;
        console.log('🔒 [ASTROLOGER-APP] Navigation guard set for booking cancellation');
        
        // Show alert and redirect to home screen
        Alert.alert(
          'Booking Cancelled',
          data.message || 'The user has cancelled this booking request.',
          [
            {
              text: 'OK',
              onPress: () => {
                console.log('✅ [ASTROLOGER-APP] Navigating to Home after booking cancellation');
                navigation.navigate('Home');
              }
            }
          ],
          { cancelable: false } // Prevent dismissing without action
        );
      } else {
        console.log('❌ [ASTROLOGER-APP] Booking cancellation bookingId mismatch, ignoring event');
      }
    };

    // Handle Exotel voice call events
    const voiceCallInitiatedHandler = (data) => {
      console.log('📞 [ASTROLOGER-APP] Voice call initiated:', data);
      Alert.alert(
        'Voice Call Connecting! 📞',
        `The system is connecting you with the user. You will receive a phone call shortly. Please answer to start the consultation.\n\nCall Duration: ${data.totalMinutes || 'N/A'} minutes`,
        [{ text: 'OK' }]
      );
    };

    const voiceCallFailedHandler = (data) => {
      console.log('❌ [ASTROLOGER-APP] Voice call failed:', data);
      Alert.alert(
        'Voice Call Failed',
        data.message || 'Unable to initiate voice call. Please try again or contact support.',
        [
          { text: 'OK' },
          {
            text: 'Go Back',
            onPress: () => {
              // Navigate back to dashboard when call fails
              navigation.navigate('Home');
            }
          }
        ]
      );
    };

    // Set up event listeners
    socket.on('user_joined_consultation', userJoinedHandler);
    socket.on('join_consultation', joinConsultationHandler);
    socket.on('direct_notification', directNotificationHandler);
    socket.on('booking_cancelled', bookingCancelledHandler);
    socket.on('voice_call_initiated', voiceCallInitiatedHandler);
    socket.on('voice_call_failed', voiceCallFailedHandler);

    // Cleanup listeners
    return () => {
      console.log('🔌 [ASTROLOGER-APP] Cleaning up WaitingRoomScreen listeners');
      
      // Add null checks to prevent ReferenceError
      if (socket) {
        socket.off('user_joined_consultation', userJoinedHandler);
        socket.off('join_consultation', joinConsultationHandler);
        socket.off('direct_notification', directNotificationHandler);
        socket.off('booking_cancelled', bookingCancelledHandler);
        socket.off('voice_call_initiated', voiceCallInitiatedHandler);
        socket.off('voice_call_failed', voiceCallFailedHandler);
        
        // Leave the room when component unmounts
        socket.emit('leave_room', { bookingId });
      } else {
        console.log('⚠️ [ASTROLOGER-APP] Socket not available during cleanup');
      }
    };
  }, [socket, isConnected, bookingId, bookingDetails, navigation]);

  // Handle back button press
  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        Alert.alert(
          'Leave Waiting Room',
          'Are you sure you want to leave? The user might be joining soon.',
          [
            { text: 'Stay', style: 'cancel' },
            { 
              text: 'Leave', 
              style: 'destructive',
              onPress: () => {
                // Notify backend that astrologer left the waiting room
                if (socket && isConnected && bookingId) {
                  socket.emit('astrologer_left_waiting_room', { bookingId });
                }
                navigation.goBack();
              }
            }
          ]
        );
        return true; // Prevent default behavior
      };

      // Add back button listener using the correct API
      const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);

      return () => {
        // Remove back button listener on cleanup using the subscription
        backHandler.remove();
      };
    }, [navigation, socket, isConnected, bookingId])
  );

  // If missing required params, show error and go back
  if (!bookingId || !bookingDetails) {
    Alert.alert(
      'Error',
      'Missing required information for waiting room',
      [{ text: 'Go Back', onPress: () => navigation.goBack() }]
    );
    return null;
  }

  // Helper function to format date and time
  const formatDateTime = (dateString) => {
    if (!dateString) return 'Not specified';
    const date = new Date(dateString);
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  // Helper function to get consultation type with icon
  const getConsultationType = () => {
    const type = bookingDetails?.consultationType;
    switch (type) {
      case 'video':
        return { icon: 'videocam', text: 'Video Call', color: '#FF6B6B' };
      case 'voice':
        return { icon: 'call', text: 'Voice Call', color: '#4ECDC4' };
      case 'chat':
        return { icon: 'chatbubbles', text: 'Chat Consultation', color: '#45B7D1' };
      default:
        return { icon: 'help-circle', text: 'Unknown', color: '#95A5A6' };
    }
  };

  const consultationType = getConsultationType();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Header Section */}
      <View style={styles.headerContainer}>
        <View style={styles.iconContainer}>
          <Ionicons name="hourglass-outline" size={60} color="#F97316" />
        </View>
        <Text style={styles.title}>Waiting for User to Join</Text>
        <Text style={styles.subtitle}>You'll be connected automatically when they join</Text>
      </View>

      {/* Waiting Timer */}
      <View style={styles.waitingContainer}>
        <ActivityIndicator size="large" color="#F97316" />
        <Text style={styles.waitingText}>Waiting: {formatTime(waitingTime)}</Text>
      </View>

      {/* Enhanced Booking Information */}
      <View style={styles.bookingInfoContainer}>
        <View style={styles.bookingHeader}>
          <Ionicons name="document-text" size={24} color="#F97316" />
          <Text style={styles.bookingInfoTitle}>Booking Details</Text>
        </View>

        {/* User Information */}
        <View style={styles.infoRow}>
          <View style={styles.infoIconContainer}>
            <Ionicons name="person" size={20} color="#666" />
          </View>
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoLabel}>User</Text>
            <Text style={styles.infoValue}>{bookingDetails?.user?.name || 'Unknown User'}</Text>
            {bookingDetails?.user?.phone && (
              <Text style={styles.infoSubValue}>📱 {bookingDetails.user.phone}</Text>
            )}
          </View>
        </View>

        {/* Consultation Type */}
        <View style={styles.infoRow}>
          <View style={styles.infoIconContainer}>
            <Ionicons name={consultationType.icon} size={20} color={consultationType.color} />
          </View>
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoLabel}>Consultation Type</Text>
            <Text style={[styles.infoValue, { color: consultationType.color }]}>
              {consultationType.text}
            </Text>
          </View>
        </View>

        {/* Duration */}
        <View style={styles.infoRow}>
          <View style={styles.infoIconContainer}>
            <Ionicons name="time" size={20} color="#666" />
          </View>
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoLabel}>Duration</Text>
            <Text style={styles.infoValue}>{bookingDetails?.durationMinutes || 30} minutes</Text>
          </View>
        </View>

        {/* Amount */}
        {bookingDetails?.amount && (
          <View style={styles.infoRow}>
            <View style={styles.infoIconContainer}>
              <Ionicons name="cash" size={20} color="#27AE60" />
            </View>
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>Amount</Text>
              <Text style={[styles.infoValue, { color: '#27AE60', fontWeight: 'bold' }]}>₹{bookingDetails.amount}</Text>
            </View>
          </View>
        )}

        {/* Booking Time */}
        <View style={styles.infoRow}>
          <View style={styles.infoIconContainer}>
            <Ionicons name="calendar" size={20} color="#666" />
          </View>
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoLabel}>Booked At</Text>
            <Text style={styles.infoValue}>{formatDateTime(bookingDetails?.createdAt)}</Text>
          </View>
        </View>

        {/* Booking ID */}
        <View style={styles.infoRow}>
          <View style={styles.infoIconContainer}>
            <Ionicons name="barcode" size={20} color="#666" />
          </View>
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoLabel}>Booking ID</Text>
            <Text style={styles.infoValue}>{bookingId}</Text>
          </View>
        </View>

        {/* User's Question/Topic */}
        {bookingDetails?.question && (
          <View style={styles.infoRow}>
            <View style={styles.infoIconContainer}>
              <Ionicons name="help-circle" size={20} color="#666" />
            </View>
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>User's Question</Text>
              <Text style={styles.infoValue}>{bookingDetails.question}</Text>
            </View>
          </View>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.actionContainer}>
        <TouchableOpacity 
          style={[styles.cancelButton, isCancelling && styles.disabledButton]} 
          onPress={showCancelConfirmation}
          disabled={isCancelling}
        >
          {isCancelling ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Ionicons name="close-circle" size={24} color="white" />
          )}
          <Text style={styles.cancelButtonText}>
            {isCancelling ? 'Cancelling...' : 'Cancel Booking'}
          </Text>
        </TouchableOpacity>

        <View style={styles.helpContainer}>
          <Ionicons name="information-circle" size={16} color="#666" />
          <Text style={styles.helpText}>
            The user will be notified if you cancel this booking
          </Text>
        </View>
      </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  iconContainer: {
    marginBottom: 15,
    backgroundColor: '#FEF3E2',
    padding: 20,
    borderRadius: 50,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  waitingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
    backgroundColor: '#FEF3E2',
    padding: 20,
    borderRadius: 15,
    justifyContent: 'center',
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  waitingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#F97316',
    marginLeft: 15,
  },
  bookingInfoContainer: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 15,
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  bookingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  bookingInfoTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 18,
    paddingVertical: 5,
  },
  infoIconContainer: {
    width: 40,
    alignItems: 'center',
    marginTop: 2,
  },
  infoTextContainer: {
    flex: 1,
    marginLeft: 10,
  },
  infoLabel: {
    fontSize: 14,
    color: '#888',
    marginBottom: 4,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
    lineHeight: 22,
  },
  infoSubValue: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  actionContainer: {
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#E74C3C',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    marginBottom: 15,
    minWidth: 200,
    shadowColor: '#E74C3C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  disabledButton: {
    backgroundColor: '#BDC3C7',
    shadowOpacity: 0.1,
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  helpContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3CD',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FFC107',
    maxWidth: '90%',
  },
  helpText: {
    fontSize: 12,
    color: '#856404',
    marginLeft: 8,
    flex: 1,
    lineHeight: 16,
  },
});

export default WaitingRoomScreen;
