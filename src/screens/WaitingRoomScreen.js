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
    if (!socket || !isConnected || !bookingId) {
      console.log('WaitingRoomScreen: Socket not connected or missing bookingId', { isConnected, bookingId });
      return;
    }
    
    console.log('WaitingRoomScreen: Setting up socket event listeners for bookingId:', bookingId);
    
    // Join a room specific to this booking
    console.log('WaitingRoomScreen: Joining room for booking:', bookingId);
    socket.emit('join_room', { bookingId }, (response) => {
      if (response && response.success) {
        console.log('WaitingRoomScreen: Successfully joined room for booking:', bookingId);
      } else {
        console.error('WaitingRoomScreen: Failed to join room:', response?.error || 'Unknown error');
      }
    });
    
    // Listen for user joining the consultation
    const handleUserJoined = (data) => {
      // Check if booking type is video or chat
      if (bookingDetails?.consultationType === 'video') {
        navigation.navigate('VideoCall', {
          booking: bookingDetails,
          bookingId,
          roomId: data.roomId || `consultation:${bookingId}`,
          sessionId: data.sessionId,
        });
      } else {
        navigation.navigate('Chat', {
          booking: bookingDetails,
          bookingId,
          roomId: data.roomId || `consultation:${bookingId}`,
          sessionId: data.sessionId,
        });
      }
    };

    // Listen for user joining the consultation
    socket.on('user_joined_consultation', (data) => {
      if (data && data.bookingId === bookingId) {
        handleUserJoined(data);
      }
    });
    
    // Also listen for the alternate event name as a fallback
    socket.on('join_consultation', (data) => {
      if (data && data.bookingId === bookingId) {
        handleUserJoined(data);
      }
    });
    
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
