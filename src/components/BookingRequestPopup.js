import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Modal, ActivityIndicator } from 'react-native';

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

  // Format consultation type for display
  const formatType = (type) => {
    return type ? type.charAt(0).toUpperCase() + type.slice(1) : '';
  };

  // Simple handlers that call the parent component's callbacks
  const handleAccept = () => {
    if (onAccept) {
      onAccept(bookingRequest);
    }
  };
  
  const handleReject = () => {
    if (onReject) {
      onReject(bookingRequest);
    }
  };

  // If no booking request data, don't render anything
  if (!bookingRequest) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={() => onClose && onClose()}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.headerText}>New Booking Request</Text>
          </View>
          
          <View style={styles.content}>
            <View style={styles.userInfo}>
              <Image
                source={
                  bookingRequest.user && bookingRequest.user.profileImage
                    ? { uri: bookingRequest.user.profileImage }
                    : require('../../assets/default-avatar.png')
                }
                style={styles.userImage}
              />
              <View style={styles.userDetails}>
                <Text style={styles.userName}>
                  {bookingRequest.user ? bookingRequest.user.name : 'User'}
                </Text>
                <Text style={styles.consultationType}>
                  {`Requesting ${formatType(bookingRequest.type)} Consultation`}
                </Text>
              </View>
            </View>
            
            {error && (
              <Text style={styles.errorText}>{error}</Text>
            )}
            
            <View style={styles.timerContainer}>
              <Text style={styles.timerText}>
                This request will expire in 2:00 minutes
              </Text>
              {/* Timer component could be added here */}
            </View>
            
            <View style={styles.actions}>
              {loading ? (
                <ActivityIndicator size="large" color="#4CAF50" />
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.rejectButton]}
                    onPress={handleReject}
                  >
                    <Text style={styles.buttonText}>Reject</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.acceptButton]}
                    onPress={handleAccept}
                  >
                    <Text style={styles.buttonText}>Accept</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  header: {
    backgroundColor: '#673AB7',
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  headerText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
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
    fontWeight: 'bold',
    marginBottom: 4,
  },
  consultationType: {
    fontSize: 16,
    color: '#666666',
  },
  timerContainer: {
    alignItems: 'center',
    marginVertical: 15,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#EEEEEE',
  },
  timerText: {
    fontSize: 16,
    color: '#FF5722',
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 5,
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
  },
  rejectButton: {
    backgroundColor: '#F44336',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  errorText: {
    color: '#F44336',
    textAlign: 'center',
    marginVertical: 10,
  },
});

export default BookingRequestPopup;
