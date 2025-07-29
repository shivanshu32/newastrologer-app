import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  Alert,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSocket } from '../context/SocketContext';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const BOTTOM_SHEET_HEIGHT = SCREEN_HEIGHT * 0.4;

/**
 * FreeChatBottomSheet - Displays pending free chat requests for astrologers
 * Shows real-time updates when requests come in and handles acceptance/rejection
 */
const FreeChatBottomSheet = ({ visible, onClose, navigation }) => {
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processingRequest, setProcessingRequest] = useState(null);
  const slideAnim = useRef(new Animated.Value(BOTTOM_SHEET_HEIGHT)).current;
  const { socket } = useSocket();

  // Animation for showing/hiding bottom sheet
  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    } else {
      Animated.spring(slideAnim, {
        toValue: BOTTOM_SHEET_HEIGHT,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    }
  }, [visible, slideAnim]);

  // Socket event listeners for real-time updates
  useEffect(() => {
    if (!socket) return;

    console.log('🔌 [FREE_CHAT_SHEET] Setting up socket listeners');

    // Listen for new free chat requests
    const handleFreeChatAvailable = (data) => {
      console.log('🆓 [FREE_CHAT_SHEET] New free chat request received:', data);
      
      const newRequest = {
        freeChatId: data.freeChatId,
        sessionId: data.sessionId,
        user: data.user,
        userProfile: data.userProfile,
        createdAt: new Date(),
        message: data.message
      };

      setPendingRequests(prev => {
        // Check if request already exists to prevent duplicates
        const exists = prev.find(req => req.freeChatId === data.freeChatId);
        if (exists) {
          console.log('🆓 [FREE_CHAT_SHEET] Request already exists, skipping duplicate');
          return prev;
        }
        
        console.log('🆓 [FREE_CHAT_SHEET] Adding new request to list');
        return [...prev, newRequest];
      });
    };

    // Listen for request removal (when accepted by another astrologer)
    const handleFreeChatTaken = (data) => {
      console.log('🚫 [FREE_CHAT_SHEET] Free chat request taken by another astrologer:', data);
      
      setPendingRequests(prev => {
        const filtered = prev.filter(req => req.freeChatId !== data.freeChatId);
        console.log(`🚫 [FREE_CHAT_SHEET] Removed request ${data.freeChatId}. Remaining: ${filtered.length}`);
        return filtered;
      });

      // Stop processing if this was the request being processed
      if (processingRequest === data.freeChatId) {
        setProcessingRequest(null);
        Alert.alert(
          'Request Taken',
          'This free chat request has been accepted by another astrologer.',
          [{ text: 'OK' }]
        );
      }
    };

    // Listen for request removal events
    const handleFreeChatRequestRemoved = (data) => {
      console.log('🗑️ [FREE_CHAT_SHEET] Free chat request removed:', data);
      
      setPendingRequests(prev => {
        const filtered = prev.filter(req => req.freeChatId !== data.freeChatId);
        console.log(`🗑️ [FREE_CHAT_SHEET] Removed request ${data.freeChatId}. Remaining: ${filtered.length}`);
        return filtered;
      });
    };

    // Listen for expired requests
    const handleFreeChatExpired = (data) => {
      console.log('⏰ [FREE_CHAT_SHEET] Free chat request expired:', data);
      
      setPendingRequests(prev => {
        const filtered = prev.filter(req => req.freeChatId !== data.freeChatId);
        console.log(`⏰ [FREE_CHAT_SHEET] Removed expired request ${data.freeChatId}. Remaining: ${filtered.length}`);
        return filtered;
      });
    };

    // Register socket listeners
    socket.on('free_chat_available', handleFreeChatAvailable);
    socket.on('free_chat_taken', handleFreeChatTaken);
    socket.on('free_chat_request_removed', handleFreeChatRequestRemoved);
    socket.on('free_chat_expired', handleFreeChatExpired);

    // Cleanup listeners
    return () => {
      console.log('🧹 [FREE_CHAT_SHEET] Cleaning up socket listeners');
      socket.off('free_chat_available', handleFreeChatAvailable);
      socket.off('free_chat_taken', handleFreeChatTaken);
      socket.off('free_chat_request_removed', handleFreeChatRequestRemoved);
      socket.off('free_chat_expired', handleFreeChatExpired);
    };
  }, [socket, processingRequest]);

  // Handle accepting a free chat request
  const handleAcceptRequest = async (request) => {
    if (processingRequest) {
      console.log('🚫 [FREE_CHAT_SHEET] Already processing a request, ignoring');
      return;
    }

    console.log('✅ [FREE_CHAT_SHEET] Accepting free chat request:', request.freeChatId);
    setProcessingRequest(request.freeChatId);

    try {
      // Emit acceptance to backend with callback
      socket.emit('accept_free_chat', {
        freeChatId: request.freeChatId
      }, (response) => {
        console.log('✅ [FREE_CHAT_SHEET] Accept response:', response);
        
        if (response && response.success) {
          console.log('✅ [FREE_CHAT_SHEET] Free chat accepted successfully');
          
          // Remove the accepted request from the list
          setPendingRequests(prev => 
            prev.filter(req => req.freeChatId !== request.freeChatId)
          );
          
          // Close the bottom sheet
          onClose();
          
          // Navigate to the free chat screen
          navigation.navigate('FixedFreeChatScreen', {
            freeChatId: request.freeChatId,
            sessionId: response.sessionId || request.sessionId,
            userId: request.user.id,
            astrologerId: socket.user?.id,
            sessionDuration: 180 // 3 minutes for free chat
          });
          
          Alert.alert(
            'Free Chat Accepted',
            'You have successfully accepted the free chat request. The session will begin now.',
            [{ text: 'OK' }]
          );
        } else {
          console.error('❌ [FREE_CHAT_SHEET] Failed to accept free chat:', response?.message);
          
          // Show appropriate error message
          const errorMessage = response?.alreadyAccepted 
            ? 'This request has already been accepted by another astrologer.'
            : response?.message || 'Failed to accept free chat request. Please try again.';
          
          Alert.alert('Error', errorMessage, [{ text: 'OK' }]);
          
          // If already accepted, remove from list
          if (response?.alreadyAccepted) {
            setPendingRequests(prev => 
              prev.filter(req => req.freeChatId !== request.freeChatId)
            );
          }
        }
        
        setProcessingRequest(null);
      });
    } catch (error) {
      console.error('❌ [FREE_CHAT_SHEET] Error accepting free chat:', error);
      Alert.alert('Error', 'Failed to accept free chat request. Please try again.');
      setProcessingRequest(null);
    }
  };

  // Handle rejecting/dismissing a free chat request
  const handleRejectRequest = (request) => {
    Alert.alert(
      'Dismiss Request',
      'Are you sure you want to dismiss this free chat request?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Dismiss',
          style: 'destructive',
          onPress: () => {
            console.log('🚫 [FREE_CHAT_SHEET] Dismissing free chat request:', request.freeChatId);
            
            // Remove from local list (this is just a local dismissal, not a server action)
            setPendingRequests(prev => 
              prev.filter(req => req.freeChatId !== request.freeChatId)
            );
          }
        }
      ]
    );
  };

  // Format time since request was created
  const formatTimeAgo = (createdAt) => {
    const now = new Date();
    const diff = Math.floor((now - new Date(createdAt)) / 1000);
    
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  // Render individual request item
  const renderRequestItem = ({ item }) => (
    <View style={styles.requestItem}>
      <View style={styles.requestHeader}>
        <View style={styles.userInfo}>
          <View style={styles.avatarContainer}>
            <Ionicons name="person" size={24} color="#666" />
          </View>
          <View style={styles.userDetails}>
            <Text style={styles.userName}>{item.user.name}</Text>
            <Text style={styles.requestTime}>{formatTimeAgo(item.createdAt)}</Text>
          </View>
        </View>
        <View style={styles.urgencyBadge}>
          <Text style={styles.urgencyText}>Free Chat</Text>
        </View>
      </View>
      
      {item.userProfile && (
        <View style={styles.profileInfo}>
          <Text style={styles.profileText}>
            Born: {new Date(item.userProfile.birthDate).toLocaleDateString()}
          </Text>
          {item.userProfile.birthTime && (
            <Text style={styles.profileText}>
              Time: {item.userProfile.birthTime}
            </Text>
          )}
          {item.userProfile.birthLocation && (
            <Text style={styles.profileText}>
              Location: {item.userProfile.birthLocation}
            </Text>
          )}
        </View>
      )}
      
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, styles.rejectButton]}
          onPress={() => handleRejectRequest(item)}
          disabled={processingRequest === item.freeChatId}
        >
          <Ionicons name="close" size={20} color="#fff" />
          <Text style={styles.rejectButtonText}>Dismiss</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, styles.acceptButton]}
          onPress={() => handleAcceptRequest(item)}
          disabled={processingRequest !== null}
        >
          {processingRequest === item.freeChatId ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="checkmark" size={20} color="#fff" />
          )}
          <Text style={styles.acceptButtonText}>
            {processingRequest === item.freeChatId ? 'Accepting...' : 'Accept'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.overlayTouch}
          activeOpacity={1}
          onPress={onClose}
        />
        
        <Animated.View
          style={[
            styles.bottomSheet,
            {
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.header}>
            <View style={styles.dragIndicator} />
            <Text style={styles.title}>Free Chat Requests</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.content}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#4A90E2" />
                <Text style={styles.loadingText}>Loading requests...</Text>
              </View>
            ) : pendingRequests.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="chatbubbles-outline" size={64} color="#ccc" />
                <Text style={styles.emptyTitle}>No Free Chat Requests</Text>
                <Text style={styles.emptySubtitle}>
                  When users request free consultations, they will appear here
                </Text>
              </View>
            ) : (
              <FlatList
                data={pendingRequests}
                renderItem={renderRequestItem}
                keyExtractor={(item) => item.freeChatId}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listContainer}
              />
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  overlayTouch: {
    flex: 1,
  },
  bottomSheet: {
    height: BOTTOM_SHEET_HEIGHT,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dragIndicator: {
    position: 'absolute',
    top: 8,
    left: '50%',
    marginLeft: -20,
    width: 40,
    height: 4,
    backgroundColor: '#ddd',
    borderRadius: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  listContainer: {
    paddingVertical: 10,
  },
  requestItem: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#4A90E2',
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e9ecef',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  requestTime: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  urgencyBadge: {
    backgroundColor: '#28a745',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  urgencyText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: 'bold',
  },
  profileInfo: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  profileText: {
    fontSize: 13,
    color: '#555',
    marginBottom: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  acceptButton: {
    backgroundColor: '#28a745',
  },
  rejectButton: {
    backgroundColor: '#dc3545',
  },
  acceptButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  rejectButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
});

export default FreeChatBottomSheet;
