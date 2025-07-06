import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Modal, ActivityIndicator } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

/**
 * Popup component for displaying real-time booking requests to astrologers
 * @param {Object} props
 * @param {Boolean} props.visible - Whether the popup is visible
 * @param {Object} props.bookingRequest - Booking request data
 * @param {Function} props.onAccept - Callback when booking is accepted
 * @param {Function} props.onReject - Callback when booking is rejected
 * @param {Function} props.onClose - Callback when popup is closed
 */
const BookingRequestPopup = ({ visible, bookingRequest, onAccept, onReject, onClose, loading, error }) => {
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [isExpired, setIsExpired] = useState(false);
  
  // Debug logging for props
  console.log(' [DEBUG] BookingRequestPopup render - Props received:');
  console.log(' [DEBUG] - visible:', visible);
  console.log(' [DEBUG] - bookingRequest:', bookingRequest);
  console.log(' [DEBUG] - loading:', loading);
  console.log(' [DEBUG] - error:', error);

  // Calculate time remaining for the booking request
  useEffect(() => {
    if (visible && bookingRequest?.expiresAt) {
      const updateTimer = () => {
        const now = new Date().getTime();
        const expiry = new Date(bookingRequest.expiresAt).getTime();
        const remaining = expiry - now;

        if (remaining <= 0) {
          setIsExpired(true);
          setTimeRemaining(null);
        } else {
          setIsExpired(false);
          const minutes = Math.floor(remaining / (1000 * 60));
          const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
          setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, '0')}`);
        }
      };

      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    } else {
      setTimeRemaining(null);
      setIsExpired(false);
    }
  }, [visible, bookingRequest?.expiresAt]);

  // Format consultation type for display
  const formatType = (type) => {
    return type ? type.charAt(0).toUpperCase() + type.slice(1) : '';
  };

  // Format date and time
  const formatDateTime = (dateString) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Not specified';
      
      return date.toLocaleString('en-IN', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      return 'Not specified';
    }
  };

  // Simple handlers that call the parent component's callbacks
  const handleAccept = () => {
    if (onAccept && !isExpired) {
      onAccept(bookingRequest);
    }
  };
  
  const handleReject = () => {
    if (onReject && !isExpired) {
      onReject(bookingRequest);
    }
  };

  // If no booking request data, don't render anything
  if (!bookingRequest) {
    console.log(' [DEBUG] BookingRequestPopup: No booking request data, returning null');
    return null;
  }
  
  console.log(' [DEBUG] BookingRequestPopup: Rendering popup with booking request:', bookingRequest._id);

  const isVideoCall = bookingRequest.type === 'video';
  const isVoiceCall = bookingRequest.type === 'voice';
  const isChatCall = bookingRequest.type === 'chat';

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={() => onClose && onClose()}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="notifications" size={24} color="#4CAF50" />
              <Text style={styles.headerText}>New Booking Request</Text>
            </View>
            <View style={styles.headerRight}>
              {timeRemaining && !isExpired && (
                <View style={styles.timerContainer}>
                  <Ionicons name="time-outline" size={16} color="#FF9800" />
                  <Text style={styles.timerText}>{timeRemaining}</Text>
                </View>
              )}
              {isExpired && (
                <View style={styles.expiredContainer}>
                  <Ionicons name="time-outline" size={16} color="#FF6B6B" />
                  <Text style={styles.expiredText}>Expired</Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => onClose && onClose()}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
          </View>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
          
          <View style={styles.content}>
            <View style={styles.userInfo}>
              <Image
                source={{ 
                  uri: bookingRequest.user?.profileImage || 'https://via.placeholder.com/60'
                }}
                style={styles.userImage}
              />
              <View style={styles.userDetails}>
                <Text style={styles.userName}>
                  {bookingRequest.user?.name || 'User'}
                </Text>
                <View style={styles.typeContainer}>
                  {isVideoCall && (
                    <MaterialIcons name="videocam" size={18} color="#2196F3" />
                  )}
                  {isVoiceCall && (
                    <MaterialIcons name="phone" size={18} color="#4CAF50" />
                  )}
                  {isChatCall && (
                    <MaterialIcons name="chat" size={18} color="#FF9800" />
                  )}
                  <Text style={styles.typeText}>
                    {isChatCall ? 'Chat Consultation' : `${formatType(bookingRequest.type)} Call`}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.bookingDetails}>
              <View style={styles.detailRow}>
                <Ionicons name="calendar-outline" size={18} color="#666" />
                <Text style={styles.detailLabel}>Scheduled:</Text>
                <Text style={styles.detailValue}>
                  {formatDateTime(bookingRequest.scheduledAt)}
                </Text>
              </View>
              
              <View style={styles.detailRow}>
                <Ionicons name="cash-outline" size={18} color="#666" />
                <Text style={styles.detailLabel}>Amount:</Text>
                <Text style={styles.detailValue}>
                  ₹{bookingRequest.rate || bookingRequest.amount || 0}
                </Text>
              </View>

              {bookingRequest.duration && (
                <View style={styles.detailRow}>
                  <Ionicons name="time-outline" size={18} color="#666" />
                  <Text style={styles.detailLabel}>Duration:</Text>
                  <Text style={styles.detailValue}>
                    {bookingRequest.duration} minutes
                  </Text>
                </View>
              )}
            </View>

            {bookingRequest.message && (
              <View style={styles.messageContainer}>
                <Text style={styles.messageLabel}>Message:</Text>
                <Text style={styles.messageText}>{bookingRequest.message}</Text>
              </View>
            )}
          </View>
          
          <View style={styles.actions}>
            {!isExpired ? (
              <>
                <TouchableOpacity 
                  style={[styles.button, styles.rejectButton]} 
                  onPress={() => {
                    console.log('🔍 [DEBUG] Reject button clicked in popup');
                    console.log('🔍 [DEBUG] bookingRequest in popup:', bookingRequest);
                    console.log('🔍 [DEBUG] bookingRequest._id:', bookingRequest?._id);
                    console.log('🔍 [DEBUG] onReject function available:', !!onReject);
                    onReject && onReject();
                  }}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#FF6B6B" />
                  ) : (
                    <>
                      <Ionicons name="close" size={20} color="#FF6B6B" />
                      <Text style={styles.rejectButtonText}>Decline</Text>
                    </>
                  )}
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.button, styles.acceptButton]} 
                  onPress={() => {
                    console.log('🔍 [DEBUG] Accept button clicked in popup');
                    console.log('🔍 [DEBUG] bookingRequest in popup:', bookingRequest);
                    console.log('🔍 [DEBUG] bookingRequest._id:', bookingRequest?._id);
                    console.log('🔍 [DEBUG] onAccept function available:', !!onAccept);
                    onAccept && onAccept();
                  }}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={20} color="#fff" />
                      <Text style={styles.acceptButtonText}>Accept</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity 
                style={[styles.button, styles.closeButton]} 
                onPress={() => onClose && onClose()}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  closeButton: {
    padding: 4,
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  headerText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  timerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF9800',
    marginLeft: 4,
  },
  expiredContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  expiredText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF6B6B',
    marginLeft: 4,
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    padding: 12,
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 8,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 14,
    textAlign: 'center',
  },
  content: {
    padding: 20,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  userImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 15,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  typeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
  },
  bookingDetails: {
    marginBottom: 15,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    marginRight: 8,
    minWidth: 70,
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    flex: 1,
  },
  messageContainer: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  messageLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 6,
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  rejectButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#FF6B6B',
  },
  rejectButtonText: {
    color: '#FF6B6B',
    fontSize: 16,
    fontWeight: '600',
  },
  closeButton: {
    backgroundColor: '#f0f0f0',
  },
  closeButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default BookingRequestPopup;
