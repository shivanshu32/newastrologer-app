import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { 
  joinConsultationRoom, 
  leaveConsultationRoom, 
  listenForParticipantEvents, 
  listenForTimerUpdates, 
  listenForStatusUpdates 
} from '../services/socketService';

/**
 * Consultation room component for astrologers
 * @param {Object} props
 * @param {Object} props.booking - Booking data
 * @param {String} props.roomId - Room ID for the consultation
 * @param {String} props.sessionId - Session ID
 * @param {Function} props.onSessionEnd - Callback when session ends
 */
const ConsultationRoom = ({ booking, roomId, sessionId, onSessionEnd }) => {
  const [status, setStatus] = useState('connecting'); // connecting, connected, disconnected, completed
  const [userPresent, setUserPresent] = useState(false);
  const [timer, setTimer] = useState({
    durationSeconds: 0,
    durationMinutes: 0,
    currentAmount: 0,
    currency: 'INR'
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [earnings, setEarnings] = useState(0);

  // Format time for display (MM:SS)
  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Format currency for display
  const formatCurrency = (amount, currency) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR'
    }).format(amount);
  };

  // Calculate astrologer's earnings (typically a percentage of the total amount)
  const calculateEarnings = useCallback((totalAmount) => {
    // Assuming astrologer gets 80% of the total amount
    // This percentage should be configured based on your business model
    const commissionRate = 0.8;
    return totalAmount * commissionRate;
  }, []);

  // Handle participant joined event
  const handleParticipantJoined = useCallback((data) => {
    if (data.role === 'user') {
      setUserPresent(true);
      setStatus('connected');
      
      Alert.alert(
        'User Joined',
        'The user has joined the consultation.',
        [{ text: 'OK' }]
      );
    }
  }, []);

  // Handle participant left event
  const handleParticipantLeft = useCallback((data) => {
    if (data.role === 'user') {
      setUserPresent(false);
      setStatus('disconnected');
      
      Alert.alert(
        'User Disconnected',
        'The user has disconnected from the session. They may reconnect shortly.',
        [{ text: 'OK' }]
      );
    }
  }, []);

  // Handle timer updates
  const handleTimerUpdate = useCallback((data) => {
    setTimer({
      durationSeconds: data.durationSeconds,
      durationMinutes: data.durationMinutes,
      currentAmount: data.currentAmount,
      currency: data.currency
    });
    
    // Update earnings based on current amount
    setEarnings(calculateEarnings(data.currentAmount));
  }, [calculateEarnings]);

  // Handle status updates
  const handleStatusUpdate = useCallback((data) => {
    setStatus(data.status);
    
    if (data.status === 'completed') {
      const finalEarnings = calculateEarnings(data.currentAmount);
      setEarnings(finalEarnings);
      
      Alert.alert(
        'Session Completed',
        `Consultation has ended. Total duration: ${formatTime(data.durationSeconds)}. Your earnings: ${formatCurrency(finalEarnings, data.currency)}`,
        [{ text: 'OK', onPress: () => onSessionEnd && onSessionEnd(data) }]
      );
    }
  }, [calculateEarnings, onSessionEnd]);

  // End consultation
  const endConsultation = async () => {
    try {
      await leaveConsultationRoom(booking._id, roomId);
      
      if (onSessionEnd) {
        onSessionEnd({
          status: 'completed',
          message: 'You ended the consultation',
          durationSeconds: timer.durationSeconds,
          currentAmount: timer.currentAmount,
          earnings: earnings
        });
      }
    } catch (error) {
      console.error('Error ending consultation:', error);
      setError('Failed to end consultation');
    }
  };

  // Confirm before ending consultation
  const confirmEndConsultation = () => {
    Alert.alert(
      'End Consultation',
      'Are you sure you want to end this consultation?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'End', style: 'destructive', onPress: endConsultation }
      ]
    );
  };

  // Join consultation room on component mount
  useEffect(() => {
    const setupConsultation = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Join consultation room
        await joinConsultationRoom(booking._id, roomId);
        
        // Set up event listeners
        const participantCleanup = await listenForParticipantEvents(
          handleParticipantJoined,
          handleParticipantLeft
        );
        
        const timerCleanup = await listenForTimerUpdates(handleTimerUpdate);
        const statusCleanup = await listenForStatusUpdates(handleStatusUpdate);
        
        setLoading(false);
        
        // Clean up listeners on unmount
        return () => {
          if (participantCleanup) participantCleanup();
          if (timerCleanup) timerCleanup();
          if (statusCleanup) statusCleanup();
        };
      } catch (error) {
        console.error('Error setting up consultation:', error);
        setLoading(false);
        setError('Failed to join consultation room');
      }
    };
    
    setupConsultation();
    
    // Leave consultation room on component unmount
    return () => {
      leaveConsultationRoom(booking._id, roomId).catch(console.error);
    };
  }, [booking._id, roomId, handleParticipantJoined, handleParticipantLeft, handleTimerUpdate, handleStatusUpdate]);

  // Show loading state
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#673AB7" />
        <Text style={styles.loadingText}>Joining consultation room...</Text>
      </View>
    );
  }

  // Show error state
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.button} onPress={onSessionEnd}>
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with status and timer */}
      <View style={styles.header}>
        <View style={styles.statusContainer}>
          <View style={[styles.statusIndicator, styles[`${status}Indicator`]]} />
          <Text style={styles.statusText}>
            {status === 'connecting' && 'Connecting...'}
            {status === 'connected' && 'Connected'}
            {status === 'disconnected' && 'User Disconnected'}
            {status === 'completed' && 'Session Completed'}
          </Text>
        </View>
        
        <View style={styles.timerContainer}>
          <Text style={styles.timerLabel}>Duration</Text>
          <Text style={styles.timerText}>{formatTime(timer.durationSeconds)}</Text>
        </View>
      </View>
      
      {/* Earnings information */}
      <View style={styles.earningsContainer}>
        <Text style={styles.earningsLabel}>Your Earnings</Text>
        <Text style={styles.earningsAmount}>
          {formatCurrency(earnings, timer.currency)}
        </Text>
        <Text style={styles.earningsRate}>
          ({formatCurrency(booking.rate * 0.8, timer.currency)}/minute)
        </Text>
      </View>
      
      {/* Main consultation content area */}
      <View style={styles.contentArea}>
        {/* This is where chat, voice, or video UI would be rendered */}
        {/* For now, just showing a placeholder */}
        <Text style={styles.placeholderText}>
          {!userPresent ? 
            'Waiting for user to join...' : 
            `${booking.type.toUpperCase()} consultation in progress`
          }
        </Text>
      </View>
      
      {/* User information */}
      <View style={styles.userInfoContainer}>
        <Text style={styles.userInfoTitle}>User Information</Text>
        <Text style={styles.userInfoText}>
          Name: {booking.user ? booking.user.name : 'User'}
        </Text>
        <Text style={styles.userInfoText}>
          Consultation Type: {booking.type.charAt(0).toUpperCase() + booking.type.slice(1)}
        </Text>
        {booking.notes && (
          <Text style={styles.userInfoText}>
            Notes: {booking.notes}
          </Text>
        )}
      </View>
      
      {/* Action buttons */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity 
          style={[styles.button, styles.endButton]} 
          onPress={confirmEndConsultation}
        >
          <Text style={styles.buttonText}>End Consultation</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#673AB7',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F5F5F5',
  },
  errorText: {
    fontSize: 16,
    color: '#F44336',
    marginBottom: 20,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  connectingIndicator: {
    backgroundColor: '#FFA000',
  },
  connectedIndicator: {
    backgroundColor: '#4CAF50',
  },
  disconnectedIndicator: {
    backgroundColor: '#F44336',
  },
  completedIndicator: {
    backgroundColor: '#9E9E9E',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  timerContainer: {
    alignItems: 'center',
  },
  timerLabel: {
    fontSize: 12,
    color: '#757575',
  },
  timerText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#212121',
  },
  earningsContainer: {
    padding: 16,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
  },
  earningsLabel: {
    fontSize: 14,
    color: '#C8E6C9',
    marginBottom: 4,
  },
  earningsAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  earningsRate: {
    fontSize: 12,
    color: '#C8E6C9',
  },
  contentArea: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 16,
    color: '#9E9E9E',
    textAlign: 'center',
  },
  userInfoContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  userInfoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#212121',
  },
  userInfoText: {
    fontSize: 14,
    color: '#757575',
    marginBottom: 4,
  },
  actionsContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  button: {
    backgroundColor: '#673AB7',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  endButton: {
    backgroundColor: '#F44336',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default ConsultationRoom;
