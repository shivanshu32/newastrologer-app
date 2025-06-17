import React, { useEffect, useState } from 'react';
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

    // Navigation guard to prevent multiple rapid navigations
    let hasNavigated = false;

    const handleUserJoined = (data) => {
      console.log('🔍 [ASTROLOGER-APP] handleUserJoined called with data:', JSON.stringify(data));
      console.log('🔍 [ASTROLOGER-APP] Current booking ID:', bookingId);
      console.log('🔍 [ASTROLOGER-APP] Current booking details:', JSON.stringify(bookingDetails));
      
      // Prevent multiple navigations
      if (hasNavigated) {
        console.log('⚠️ [ASTROLOGER-APP] Navigation already occurred, ignoring duplicate event');
        return;
      }
      
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
      
      const navigationParams = {
        booking: bookingDetails,
        bookingId: bookingId,
        roomId: data.roomId,
        sessionId: enhancedBookingDetails.sessionId || bookingDetails?.sessionId || data.sessionId,
      };
      
      console.log('🔍 [ASTROLOGER-APP] Navigation params:', JSON.stringify(navigationParams));
      
      // Set navigation guard
      hasNavigated = true;
      
      if (isVideoCall) {
        console.log('✅ [ASTROLOGER-APP] Navigating to video consultation');
        navigation.navigate('VideoCall', navigationParams);
      } else if (isVoiceCall) {
        console.log('✅ [ASTROLOGER-APP] Navigating to voice consultation');
        try {
          navigation.navigate('VoiceCall', navigationParams);
          console.log('✅ [ASTROLOGER-APP] VoiceCall navigation initiated successfully');
        } catch (error) {
          console.error('❌ [ASTROLOGER-APP] Error navigating to VoiceCall:', error);
        }
      } else {
        console.log('✅ [ASTROLOGER-APP] Navigating to chat consultation');
        navigation.navigate('Chat', navigationParams);
      }
    };

    // Listen for user joining the consultation
    console.log('🔄 [ASTROLOGER-APP] Setting up socket listener for "user_joined_consultation"');
    socket.on('user_joined_consultation', (data) => {
      console.log('📩 [ASTROLOGER-APP] Received "user_joined_consultation" event with data:', JSON.stringify(data));
      console.log('🔍 [ASTROLOGER-APP] Expected bookingId:', bookingId);
      console.log('🔍 [ASTROLOGER-APP] Received bookingId:', data?.bookingId);
      
      if (data && data.bookingId === bookingId) {
        console.log('✅ [ASTROLOGER-APP] BookingId matches, calling handleUserJoined');
        handleUserJoined(data);
      } else {
        console.log('❌ [ASTROLOGER-APP] BookingId does not match or data is missing, ignoring event');
      }
    });
    
    // Also listen for the alternate event name as a fallback
    console.log('🔄 [ASTROLOGER-APP] Setting up socket listener for "join_consultation"');
    socket.on('join_consultation', (data) => {
      console.log('📩 [ASTROLOGER-APP] Received "join_consultation" event with data:', JSON.stringify(data));
      console.log('🔍 [ASTROLOGER-APP] Expected bookingId:', bookingId);
      console.log('🔍 [ASTROLOGER-APP] Received bookingId:', data?.bookingId);
      
      if (data && data.bookingId === bookingId) {
        console.log('✅ [ASTROLOGER-APP] BookingId matches, calling handleUserJoined');
        handleUserJoined(data);
      } else {
        console.log('❌ [ASTROLOGER-APP] BookingId does not match or data is missing, ignoring event');
      }
    });
    
    // Debug socket connection status
    console.log('🔌 [ASTROLOGER-APP] Socket connected status:', socket?.connected);
    console.log('🔌 [ASTROLOGER-APP] Socket ID:', socket?.id);
    
    // Listen for direct notifications
    socket.on('direct_astrologer_notification', (data) => {
      if (data && data.bookingId === bookingId) {
        handleUserJoined(data);
      }
    });

    // Clean up listeners on unmount
    return () => {
      socket.off('user_joined_consultation');
      socket.off('join_consultation');
      socket.off('direct_astrologer_notification');
      
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
