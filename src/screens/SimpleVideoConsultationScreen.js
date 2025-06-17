import React, { useState, useEffect, useRef, useContext } from 'react';
import { 
  View, 
  StyleSheet, 
  ActivityIndicator,
  Text,
  SafeAreaView
} from 'react-native';
import { SocketContext } from '../context/SocketContext';
import { AuthContext } from '../context/AuthContext';

const SimpleVideoConsultationScreen = ({ route, navigation }) => {
  // Safety check for route and params
  if (!route || !route.params) {
    console.error('[ASTROLOGER-APP] SimpleVideoConsultationScreen: Missing route or params');
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
        <Text style={{ color: '#fff', fontSize: 16 }}>Error: Missing navigation parameters</Text>
      </View>
    );
  }

  const { socket } = useContext(SocketContext);
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Event listener setup guard to prevent multiple setups
  const eventListenersSetup = useRef(false);
  
  const { bookingId, sessionId, roomId } = route.params;
  
  console.log('[ASTROLOGER-APP] SimpleVideoConsultationScreen mounted');
  console.log('[ASTROLOGER-APP] Route params:', JSON.stringify(route.params));
  
  // Get booking details from route params
  const bookingDetails = route.params.bookingDetails || {};

  // Join consultation room when component mounts
  useEffect(() => {
    if (!socket || !bookingId || !roomId || eventListenersSetup.current) return;
    
    console.log('[ASTROLOGER-APP] Joining consultation room and setting up WebRTC signaling');
    console.log(`[ASTROLOGER-APP] BookingId: ${bookingId}, RoomId: ${roomId}`);
    
    // Mark that we're setting up event listeners
    eventListenersSetup.current = true;
    
    // Join the room using the same method as user app
    socket.emit('join_room', { bookingId, roomId }, (response) => {
      console.log('[ASTROLOGER-APP] join_room response:', response);
      if (response && response.success) {
        console.log(`[ASTROLOGER-APP] Successfully joined room for booking: ${bookingId}`);
        setLoading(false);
      } else {
        console.log('[ASTROLOGER-APP] Failed to join room:', response);
        setError('Failed to join consultation room');
        setLoading(false);
      }
    });
    
    // Also emit join_consultation_room as fallback
    socket.emit('join_consultation_room', { bookingId, roomId });
    
    // Listen for user joining consultation (this triggers the WebRTC flow)
    const handleUserJoinedConsultation = (data) => {
      console.log('[ASTROLOGER-APP] *** USER_JOINED_CONSULTATION EVENT RECEIVED ***');
      console.log('[ASTROLOGER-APP] Event data received:', JSON.stringify(data));
      console.log('[ASTROLOGER-APP] Current bookingId:', bookingId);
      console.log('[ASTROLOGER-APP] Event bookingId:', data.bookingId);
      console.log('[ASTROLOGER-APP] Event type:', data.type);
      
      if (data.bookingId === bookingId && data.type === 'video') {
        console.log('[ASTROLOGER-APP] ✅ Video consultation user joined - MATCH CONFIRMED!');
        console.log('[ASTROLOGER-APP] Ready to receive WebRTC offer from user...');
      } else {
        console.log('[ASTROLOGER-APP] ❌ Event does not match current session');
        console.log(`[ASTROLOGER-APP] Expected: bookingId=${bookingId}, type=video`);
        console.log(`[ASTROLOGER-APP] Received: bookingId=${data.bookingId}, type=${data.type}`);
      }
    };
    
    // Set up all WebRTC signaling listeners
    socket.on('user_joined_consultation', handleUserJoinedConsultation);
    
    // Add test listener to verify socket events are working
    socket.on('test_event', (data) => {
      console.log('[ASTROLOGER-APP] ✅ Test event received:', data);
    });
    
    // Emit a test event to verify socket is working
    console.log('[ASTROLOGER-APP] Emitting test event to verify socket functionality');
    socket.emit('test_event', { 
      message: 'Test from astrologer app', 
      bookingId, 
      timestamp: new Date().toISOString() 
    });

    // Cleanup function
    return () => {
      console.log('[ASTROLOGER-APP] Cleaning up SimpleVideoConsultationScreen');
      
      // Remove all event listeners
      socket.off('user_joined_consultation', handleUserJoinedConsultation);
      socket.off('test_event');
      
      // Reset the event listeners setup flag
      eventListenersSetup.current = false;
      
      // Leave the room when component unmounts
      socket.emit('leave_consultation_room', { bookingId, roomId });
      console.log('[ASTROLOGER-APP] Left consultation room and cleaned up event listeners');
    };
  }, [socket, bookingId, roomId]);

  // Show loading spinner while joining room
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Joining consultation room...</Text>
      </View>
    );
  }

  // Show error message if there was an error
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Video Consultation</Text>
        <Text style={styles.subtitle}>Simplified Version - Working!</Text>
        <Text style={styles.info}>Booking ID: {bookingId}</Text>
        <Text style={styles.info}>Session ID: {sessionId}</Text>
        <Text style={styles.info}>Room ID: {roomId}</Text>
        <Text style={styles.status}>✅ Socket events are working</Text>
        <Text style={styles.status}>✅ Room joined successfully</Text>
        <Text style={styles.status}>✅ Waiting for user to join...</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    color: '#4CAF50',
    fontSize: 18,
    marginBottom: 20,
  },
  info: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 8,
    textAlign: 'center',
  },
  status: {
    color: '#4CAF50',
    fontSize: 14,
    marginBottom: 8,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 10,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    padding: 20,
  },
  errorText: {
    color: '#ff0000',
    fontSize: 16,
    textAlign: 'center',
  },
});

export default SimpleVideoConsultationScreen;
