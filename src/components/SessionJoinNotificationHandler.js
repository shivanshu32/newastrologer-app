import React, { useEffect, useState } from 'react';
import { Alert, Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSocket } from '../context/SocketContext';
import { listenForSessionJoinNotifications, respondToSessionJoinRequest } from '../services/socketService';
import { useNavigation } from '@react-navigation/native';

/**
 * Global Session Join Notification Handler
 * 
 * This component handles real-time session join notifications from users
 * and provides a modal interface for astrologers to accept or decline
 * session join requests immediately from any screen.
 */
const SessionJoinNotificationHandler = () => {
  const { socket } = useSocket();
  const navigation = useNavigation();
  const [sessionJoinRequest, setSessionJoinRequest] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isResponding, setIsResponding] = useState(false);

  useEffect(() => {
    if (!socket || !socket.connected) {
      console.log('🔔 [SESSION_JOIN] Socket not connected, skipping notification setup');
      return;
    }

    console.log('🔔 [SESSION_JOIN] Setting up global session join notification handler');

    // Handle session join requests from users
    const handleSessionJoinRequest = (data) => {
      console.log('🔔 [SESSION_JOIN] Received session join request:', data);
      
      const { bookingId, sessionId, consultationType, userName, userDetails } = data;
      
      // Set the request data and show modal
      setSessionJoinRequest({
        bookingId,
        sessionId,
        consultationType,
        userName: userName || userDetails?.name || 'User',
        userDetails,
        timestamp: new Date().toISOString()
      });
      setIsVisible(true);
      
      // Also show a system alert as backup
      Alert.alert(
        '🔔 Session Join Request',
        `${userName || 'A user'} wants to join a ${consultationType} consultation. Please respond.`,
        [{ text: 'OK' }]
      );
    };

    // Set up listener
    const cleanup = listenForSessionJoinNotifications(socket, handleSessionJoinRequest);

    // Cleanup on unmount
    return () => {
      console.log('🔔 [SESSION_JOIN] Cleaning up global session join notification handler');
      cleanup();
    };
  }, [socket]);

  // Handle accepting the session join request
  const handleAccept = async () => {
    if (!sessionJoinRequest || isResponding) return;

    setIsResponding(true);
    
    try {
      console.log('🔔 [SESSION_JOIN] Accepting session join request:', sessionJoinRequest.bookingId);
      
      await respondToSessionJoinRequest(socket, sessionJoinRequest.bookingId, true);
      
      // Close modal
      setIsVisible(false);
      setSessionJoinRequest(null);
      
      // Navigate to appropriate screen based on consultation type
      setTimeout(() => {
        if (sessionJoinRequest.consultationType === 'video') {
          navigation.navigate('VideoConsultation', {
            sessionId: sessionJoinRequest.sessionId,
            bookingId: sessionJoinRequest.bookingId
          });
        } else if (sessionJoinRequest.consultationType === 'chat') {
          navigation.navigate('BookingsChat', {
            sessionId: sessionJoinRequest.sessionId,
            bookingId: sessionJoinRequest.bookingId
          });
        } else if (sessionJoinRequest.consultationType === 'voice') {
          // For voice calls, stay on current screen - Exotel will handle the call
          Alert.alert(
            'Voice Call Accepted! 📞',
            'You have accepted the voice consultation. You should receive a phone call shortly.',
            [{ text: 'OK' }]
          );
        }
      }, 500);
      
    } catch (error) {
      console.error('🔔 [SESSION_JOIN] Error accepting session join request:', error);
      Alert.alert(
        'Error',
        'Failed to accept session join request. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsResponding(false);
    }
  };

  // Handle declining the session join request
  const handleDecline = async () => {
    if (!sessionJoinRequest || isResponding) return;

    setIsResponding(true);
    
    try {
      console.log('🔔 [SESSION_JOIN] Declining session join request:', sessionJoinRequest.bookingId);
      
      await respondToSessionJoinRequest(
        socket, 
        sessionJoinRequest.bookingId, 
        false, 
        'Astrologer is currently unavailable'
      );
      
      // Close modal
      setIsVisible(false);
      setSessionJoinRequest(null);
      
      Alert.alert(
        'Session Declined',
        'You have declined the session join request. The user has been notified.',
        [{ text: 'OK' }]
      );
      
    } catch (error) {
      console.error('🔔 [SESSION_JOIN] Error declining session join request:', error);
      Alert.alert(
        'Error',
        'Failed to decline session join request. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsResponding(false);
    }
  };

  // Handle modal dismiss (same as decline)
  const handleDismiss = () => {
    if (isResponding) return;
    handleDecline();
  };

  if (!sessionJoinRequest) {
    return null;
  }

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleDismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>🔔 Session Join Request</Text>
            <Text style={styles.subtitle}>
              {sessionJoinRequest.userName} wants to join a {sessionJoinRequest.consultationType} consultation
            </Text>
          </View>
          
          <View style={styles.content}>
            <Text style={styles.infoText}>
              The user is ready to start the session. Would you like to join now?
            </Text>
            
            <View style={styles.consultationTypeContainer}>
              <Text style={styles.consultationTypeLabel}>Consultation Type:</Text>
              <Text style={[styles.consultationType, getConsultationTypeStyle(sessionJoinRequest.consultationType)]}>
                {sessionJoinRequest.consultationType.toUpperCase()}
              </Text>
            </View>
          </View>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.declineButton]}
              onPress={handleDecline}
              disabled={isResponding}
            >
              <Text style={styles.declineButtonText}>
                {isResponding ? 'Processing...' : 'Decline'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.button, styles.acceptButton]}
              onPress={handleAccept}
              disabled={isResponding}
            >
              <Text style={styles.acceptButtonText}>
                {isResponding ? 'Processing...' : 'Accept & Join'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Helper function to get consultation type styling
const getConsultationTypeStyle = (type) => {
  switch (type) {
    case 'video':
      return { backgroundColor: '#4CAF50', color: 'white' };
    case 'voice':
      return { backgroundColor: '#2196F3', color: 'white' };
    case 'chat':
      return { backgroundColor: '#FF9800', color: 'white' };
    default:
      return { backgroundColor: '#9E9E9E', color: 'white' };
  }
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  content: {
    marginBottom: 25,
  },
  infoText: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
    marginBottom: 15,
    lineHeight: 20,
  },
  consultationTypeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  consultationTypeLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 10,
  },
  consultationType: {
    fontSize: 12,
    fontWeight: 'bold',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    overflow: 'hidden',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 15,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
  },
  declineButton: {
    backgroundColor: '#f44336',
  },
  acceptButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  declineButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default SessionJoinNotificationHandler;
