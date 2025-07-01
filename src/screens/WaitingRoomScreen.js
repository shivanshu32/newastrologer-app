import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, BackHandler, Alert } from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useSocket } from '../context/SocketContext';
import { Ionicons } from '@expo/vector-icons';

/**
 * Waiting room screen for astrologers after accepting a booking
 * Shows a waiting state until the user joins the consultation
 */
const WaitingRoomScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { socket, isConnected } = useSocket();
  const [waitingTime, setWaitingTime] = useState(0);
  const hasNavigated = useRef(false); // Use useRef for immediate updates
  
  // Extract booking details from route params
  const { bookingId, bookingDetails } = route.params || {};

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

    // Join the room for this booking
    socket.emit('join_room', { bookingId }, (response) => {
      if (response && response.success) {
        console.log('Successfully joined room for booking:', bookingId);
      } else {
        console.error('Failed to join room:', response?.error || 'Unknown error');
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
                navigation.navigate('Dashboard');
              }
            }
          ]
        );
        
        // Note: Backend should have already triggered Exotel two-way call
        // Both user and astrologer will receive actual phone calls
        console.log('✅ [ASTROLOGER-APP] Exotel voice call flow initiated');
      } else if (isVideoCall) {
        console.log('✅ [ASTROLOGER-APP] Navigating to video consultation');
        navigation.navigate('BookingsVideoCall', {
          booking: bookingDetails,
          bookingId: bookingId,
          roomId: data.roomId,
          sessionId: data.sessionId,
          userJoinData: data // Pass the user join data to VideoCallScreen as well
        });
        console.log('✅ [ASTROLOGER-APP] VideoCall navigation initiated successfully');
      } else {
        console.log('✅ [ASTROLOGER-APP] Navigating to chat consultation');
        navigation.navigate('BookingsChat', {
          booking: bookingDetails,
          bookingId: bookingId,
          roomId: data.roomId,
          sessionId: enhancedBookingDetails.sessionId || bookingDetails?.sessionId || data.sessionId,
        });
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
              navigation.navigate('Dashboard');
            }
          }
        ]
      );
    };

    // Set up event listeners
    socket.on('user_joined_consultation', userJoinedHandler);
    socket.on('join_consultation', joinConsultationHandler);
    socket.on('direct_notification', directNotificationHandler);
    socket.on('voice_call_initiated', voiceCallInitiatedHandler);
    socket.on('voice_call_failed', voiceCallFailedHandler);

    // Cleanup listeners
    return () => {
      console.log('🔌 [ASTROLOGER-APP] Cleaning up WaitingRoomScreen listeners');
      socket.off('user_joined_consultation', userJoinedHandler);
      socket.off('join_consultation', joinConsultationHandler);
      socket.off('direct_notification', directNotificationHandler);
      socket.off('voice_call_initiated', voiceCallInitiatedHandler);
      socket.off('voice_call_failed', voiceCallFailedHandler);
      
      // Leave the room when component unmounts
      socket.emit('leave_room', { bookingId });
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

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons name="hourglass-outline" size={80} color="#8A2BE2" />
      </View>
      
      <Text style={styles.title}>Waiting for User to Join</Text>
      
      <View style={styles.infoContainer}>
        <Text style={styles.infoText}>
          The user has been notified that you're ready for the consultation.
        </Text>
        <Text style={styles.infoText}>
          You'll be automatically connected when they join.
        </Text>
      </View>
      
      <View style={styles.waitingContainer}>
        <ActivityIndicator size="large" color="#8A2BE2" />
        <Text style={styles.waitingText}>Waiting time: {formatTime(waitingTime)}</Text>
      </View>
      
      <View style={styles.bookingInfoContainer}>
        <Text style={styles.bookingInfoTitle}>Booking Details:</Text>
        <Text style={styles.bookingInfoText}>
          User: {bookingDetails?.user?.name || 'Unknown User'}
        </Text>
        <Text style={styles.bookingInfoText}>
          Type: {bookingDetails?.consultationType === 'video' ? 'Video Call' : 'Chat'}
        </Text>
        <Text style={styles.bookingInfoText}>
          Duration: {bookingDetails?.durationMinutes || 30} minutes
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  iconContainer: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  infoContainer: {
    marginBottom: 30,
    width: '100%',
  },
  infoText: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    marginBottom: 10,
  },
  waitingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 40,
    backgroundColor: '#F0E6FF',
    padding: 15,
    borderRadius: 10,
    width: '100%',
    justifyContent: 'center',
  },
  waitingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#8A2BE2',
    marginLeft: 15,
  },
  bookingInfoContainer: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  bookingInfoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  bookingInfoText: {
    fontSize: 16,
    color: '#555',
    marginBottom: 5,
  },
});

export default WaitingRoomScreen;
