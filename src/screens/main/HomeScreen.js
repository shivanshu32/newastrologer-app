import React, { useState, useEffect, useContext } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Switch,
  FlatList,
  Alert,
  ActivityIndicator,
  Image,
  Button,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Sentry from '@sentry/react-native';
import { useAuth } from '../../context/AuthContext';
import { bookingsAPI, walletAPI, sessionsAPI } from '../../services/api';
import { respondToBookingRequest, getPendingBookings, listenForPendingBookingUpdates } from '../../services/socketService';
import { SocketContext } from '../../context/SocketContext';
import { useFocusEffect } from '@react-navigation/native';

const HomeScreen = ({ navigation }) => {
  const [pendingBookings, setPendingBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [loadingWallet, setLoadingWallet] = useState(false);
  const { user, updateStatus } = useAuth();
  const { socket, isConnected } = useContext(SocketContext);
  
  // Fetch wallet balance
  const fetchWalletBalance = async () => {
    try {
      setLoadingWallet(true);
      const response = await walletAPI.getBalance();
      console.log('Wallet balance response:', response.data);
      
      if (response.data && response.data.success) {
        const balance = response.data.data?.balance || 0;
        setWalletBalance(balance);
        console.log('Wallet balance updated:', balance);
      } else {
        console.log('Invalid wallet response, setting balance to 0');
        setWalletBalance(0);
      }
    } catch (error) {
      console.error('Error fetching wallet balance:', error);
      setWalletBalance(0);
    } finally {
      setLoadingWallet(false);
    }
  };
  
  useEffect(() => {
    fetchPendingBookings();
    fetchWalletBalance();
    
    // NOTE: Booking request handling is now done globally by BookingRequestHandler component
    // This prevents conflicts and ACK timeout issues from duplicate event listeners
    console.log('HomeScreen useEffect - BookingRequestHandler handles booking requests globally');
    
    // Set up real-time listener for pending booking updates
    if (socket && isConnected) {
      console.log('🏠 [HOME] Setting up real-time pending booking updates listener');
      
      const cleanupPendingUpdates = listenForPendingBookingUpdates(socket, (updatedPendingBookings) => {
        console.log('🏠 [HOME] Received pending bookings update:', updatedPendingBookings);
        // Re-fetch and process the updated pending bookings
        fetchPendingBookings();
      });
      
      return cleanupPendingUpdates;
    }
    
    return () => {
      // No cleanup needed when socket not connected
    };
  }, [socket, isConnected]);
  
  // Refresh wallet balance when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      console.log('HomeScreen focused, refreshing wallet balance');
      fetchWalletBalance();
    }, [])
  );

  const fetchPendingBookings = async () => {
    try {
      setLoading(true);
      
      // Fetch real-time pending bookings from pendingBookingMap via socket
      let realTimePendingBookings = [];
      if (socket && isConnected) {
        try {
          console.log('🏠 [HOME] Fetching pending bookings from pendingBookingMap...');
          realTimePendingBookings = await getPendingBookings(socket);
          console.log('🏠 [HOME] Received pending bookings:', realTimePendingBookings);
        } catch (error) {
          console.error('🏠 [HOME] Failed to fetch pending bookings:', error);
          realTimePendingBookings = [];
        }
      } else {
        console.log('🏠 [HOME] Socket not connected, skipping pending bookings fetch');
      }
      
      // Fetch active sessions
      const sessionsResponse = await sessionsAPI.getActive();
      
      let chatItems = [];
      
      // Process real-time pending bookings - ONLY CHAT consultations with refined logic
      if (realTimePendingBookings && Array.isArray(realTimePendingBookings)) {
        const chatBookings = realTimePendingBookings
          .filter(booking => {
            // Filter out invalid bookings and only show relevant statuses
            if (!booking || !booking.status) return false;
            
            // Filter out expired bookings (client-side backup)
            if (booking.expiresAt) {
              const now = new Date();
              const expiresAt = new Date(booking.expiresAt);
              if (expiresAt <= now) {
                console.log(`🏠 [HOME] Filtering out expired booking: ${booking.bookingId || booking._id}`);
                return false;
              }
            }
            
            // Only show bookings that are:
            // 1. User-initiated awaiting astrologer response: 'confirmed', 'pending'
            // 2. Astrologer accepted ongoing: 'accepted'
            const validStatuses = ['pending', 'confirmed', 'accepted'];
            return validStatuses.includes(booking.status);
          })
          .map(booking => {
            if (!booking) return null;
            
            try {
              // Determine display state based on status
              const isAwaitingResponse = ['pending', 'confirmed'].includes(booking.status);
              const isAcceptedChat = booking.status === 'accepted';
              
              return {
                id: booking.bookingId || booking._id || `temp-${Date.now()}`,
                userId: (booking.user && booking.user._id) || 'unknown',
                userName: (booking.user && booking.user.name) || 'User',
                userImage: 'https://freesvg.org/img/abstract-user-flat-4.png',
                type: 'chat', // Always chat for this section
                status: booking.status,
                requestedTime: booking.createdAt || new Date().toISOString(),
                itemType: 'booking',
                rate: booking.rate || 0,
                // New fields for refined display logic
                isAwaitingResponse,
                isAcceptedChat,
                displayState: isAwaitingResponse ? 'awaiting_response' : 'accepted_chat'
              };
            } catch (err) {
              console.error('Error processing chat booking item:', err);
              return null;
            }
          }).filter(booking => booking !== null);
        
        chatItems = [...chatItems, ...chatBookings];
      }
      
      // Process active sessions - ONLY CHAT sessions that are truly in progress
      if (sessionsResponse.data && sessionsResponse.data.data && Array.isArray(sessionsResponse.data.data)) {
        const chatSessions = sessionsResponse.data.data
          .filter(session => {
            // Only include CHAT sessions that are truly in progress
            if (!session || !session.booking || session.booking.type !== 'chat') return false;
            
            const validStatuses = ['in_progress', 'active', 'ongoing'];
            return validStatuses.includes(session.status);
          })
          .map(session => {
            if (!session || !session.booking) return null;
            
            try {
              const booking = session.booking;
              return {
                id: session._id || `session-${Date.now()}`,
                sessionId: session._id,
                userId: (booking.user && booking.user._id) || 'unknown',
                userName: (booking.user && booking.user.name) || 'User',
                userImage: 'https://freesvg.org/img/abstract-user-flat-4.png',
                type: 'chat',
                status: session.status,
                requestedTime: session.startTime || session.createdAt || new Date().toISOString(),
                itemType: 'session',
                duration: session.duration || 0,
                // Mark as active session for join button
                isAwaitingResponse: false,
                isAcceptedChat: false,
                displayState: 'active_session'
              };
            } catch (err) {
              console.error('Error processing chat session item:', err);
              return null;
            }
          }).filter(session => session !== null);
        
        chatItems = [...chatItems, ...chatSessions];
      }
      
      // Sort by requested time (newest first)
      chatItems.sort((a, b) => new Date(b.requestedTime) - new Date(a.requestedTime));
      
      console.log('Filtered chat items:', chatItems.map(item => ({
        id: item.id,
        status: item.status,
        displayState: item.displayState,
        type: item.type
      })));
      
      setPendingBookings(chatItems);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching pending chat bookings and active sessions:', error);
      setLoading(false);
      setPendingBookings([]);
    }
  };

  const handleStatusChange = async (value) => {
    setStatusLoading(true);
    
    const result = await updateStatus(value ? 'online' : 'offline');
    
    if (!result.success) {
      Alert.alert('Error', result.message || 'Failed to update status. Please try again.');
      // Revert switch if update failed
      setStatusLoading(false);
      return;
    }
    
    setStatusLoading(false);
  };

  const handleAcceptBooking = async (booking) => {
    console.log('🏠 [HOME] Accepting booking request:', booking.id);
    console.log('🏠 [HOME] Booking details:', booking);
    
    if (!socket) {
      console.error('🏠 [HOME] Socket is not available');
      Alert.alert('Error', 'Connection not available. Please try again.');
      return;
    }

    if (!socket.connected) {
      console.error('🏠 [HOME] Socket is not connected');
      Alert.alert('Error', 'Connection lost. Please try again.');
      return;
    }

    if (!booking?.id) {
      console.error('🏠 [HOME] No booking ID available');
      Alert.alert('Error', 'Invalid booking request.');
      return;
    }

    try {
      setLoading(true);
      console.log('🏠 [HOME] About to emit booking_response event');
      console.log('🏠 [HOME] Payload:', { bookingId: booking.id, status: 'accepted' });
      
      socket.emit('booking_response', 
        { bookingId: booking.id, status: 'accepted' },
        (response) => {
          console.log('🏠 [HOME] booking_response callback received:', response);
          setLoading(false);
          
          if (response?.success) {
            console.log('🏠 [HOME] Booking accepted successfully');
            
            // Remove the booking from the list
            setPendingBookings(prevBookings => 
              prevBookings.filter(item => item.id !== booking.id)
            );
            
            // Handle different consultation types - use same logic as popup
            const consultationType = booking.type;
            console.log('🏠 [HOME] Consultation type:', consultationType);
            
            if (consultationType === 'voice') {
              // For voice consultations, Exotel call should be triggered automatically by backend
              console.log('🏠 [HOME] Voice consultation accepted - Exotel call should be triggered by backend');
              Alert.alert(
                'Voice Call Accepted', 
                'The voice consultation has been accepted. The call will be initiated shortly via Exotel. Please wait for the incoming call.',
                [{ text: 'OK' }]
              );
              
              // Stay on Home for voice calls
              console.log('🏠 [HOME] Staying on Home for voice consultation');
              
            } else {
              // For chat and video consultations, use the WaitingRoom flow
              console.log('🏠 [HOME] Non-voice consultation - navigating to WaitingRoom');
              try {
                navigation.navigate('Bookings', {
                  screen: 'WaitingRoom',
                  params: { 
                    bookingId: booking.id,
                    bookingDetails: booking 
                  }
                });
                console.log('🏠 [HOME] Navigation to WaitingRoom successful');
              } catch (navError) {
                console.error('🏠 [HOME] Navigation failed:', navError);
                Alert.alert('Navigation Error', 'Failed to navigate to waiting room: ' + navError.message);
              }
            }
          } else {
            console.error('🏠 [HOME] Backend rejected acceptance:', response);
            Alert.alert('Error', 'Failed to accept booking. Please try again.');
          }
        }
      );
      
      console.log('🏠 [HOME] booking_response event emitted successfully');
      
    } catch (error) {
      console.error('🏠 [HOME] Exception in handleAcceptBooking:', error);
      setLoading(false);
      Alert.alert('Error', 'Failed to accept booking. Please try again.');
    }
  };

  const handleRejectBooking = async (booking) => {
    console.log('🏠 [HOME] Rejecting booking request:', booking.id);
    console.log('🏠 [HOME] Booking details:', booking);
    
    if (!socket) {
      console.error('🏠 [HOME] Socket is not available');
      Alert.alert('Error', 'Connection not available. Please try again.');
      return;
    }

    if (!socket.connected) {
      console.error('🏠 [HOME] Socket is not connected');
      Alert.alert('Error', 'Connection lost. Please try again.');
      return;
    }

    if (!booking?.id) {
      console.error('🏠 [HOME] No booking ID available');
      Alert.alert('Error', 'Invalid booking request.');
      return;
    }

    try {
      setLoading(true);
      console.log('🏠 [HOME] About to emit booking_response event for rejection');
      console.log('🏠 [HOME] Payload:', { bookingId: booking.id, status: 'rejected' });
      
      socket.emit('booking_response', 
        { bookingId: booking.id, status: 'rejected' },
        (response) => {
          console.log('🏠 [HOME] booking_response callback received for rejection:', response);
          setLoading(false);
          
          if (response?.success) {
            console.log('🏠 [HOME] Booking rejected successfully');
            
            // Remove the booking from the list
            setPendingBookings(prevBookings => 
              prevBookings.filter(item => item.id !== booking.id)
            );
            
            console.log('🏠 [HOME] Booking removed from pending list');
          } else {
            console.error('🏠 [HOME] Backend rejected the rejection:', response);
            Alert.alert('Error', 'Failed to reject booking. Please try again.');
          }
        }
      );
      
      console.log('🏠 [HOME] booking_response event emitted successfully for rejection');
      
    } catch (error) {
      console.error('🏠 [HOME] Exception in handleRejectBooking:', error);
      setLoading(false);
      Alert.alert('Error', 'Failed to reject booking. Please try again.');
    }
  };

  const handleManageAvailability = () => {
    navigation.navigate('Availability');
  };

  const handleJoinSession = (item) => {
    // Navigate to the appropriate screen based on session type
    if (item.type === 'chat') {
      navigation.navigate('HomeChat', { bookingId: item.id, sessionId: item.sessionId });
    } else if (item.type === 'video') {
      navigation.navigate('HomeVideoCall', { bookingId: item.id, sessionId: item.sessionId });
    } else if (item.type === 'voice') {
      navigation.navigate('HomeVoiceCall', { bookingId: item.id, sessionId: item.sessionId });
    }
  };

  const renderBookingItem = ({ item }) => {
    const requestedTime = new Date(item.requestedTime);
    const scheduledTime = item.scheduledAt ? new Date(item.scheduledAt) : null;
    const elapsedMinutes = Math.floor((new Date() - requestedTime) / 60000);
    
    // Determine display context based on new display states
    const getDisplayContext = () => {
      switch (item.displayState) {
        case 'awaiting_response':
          return {
            badge: 'PENDING',
            badgeColor: '#FF9800',
            contextLabel: 'User is waiting for your response',
            timeLabel: `Requested ${elapsedMinutes} min ago`,
            showActions: true,
            actionType: 'accept_reject' // Show Accept/Reject buttons
          };
        case 'accepted_chat':
          return {
            badge: 'ACCEPTED',
            badgeColor: '#4CAF50',
            contextLabel: 'Ready to start chat session',
            timeLabel: `Accepted ${elapsedMinutes} min ago`,
            showActions: true,
            actionType: 'join'
          };
        case 'active_session':
          return {
            badge: 'ACTIVE',
            badgeColor: '#2196F3',
            contextLabel: 'Chat session in progress',
            timeLabel: `Started ${elapsedMinutes} min ago`,
            showActions: true,
            actionType: 'rejoin'
          };
        default:
          return {
            badge: 'NEW',
            badgeColor: '#666',
            contextLabel: 'New chat request',
            timeLabel: `Requested ${elapsedMinutes} min ago`,
            showActions: false
          };
      }
    };
    
    const displayContext = getDisplayContext();
    
    return (
      <View style={styles.bookingCard}>
        <View style={styles.bookingHeader}>
          <View style={styles.userInfo}>
            <Image source={{ uri: item.userImage }} style={styles.userImage} />
            <View style={styles.userDetails}>
              <Text style={styles.userName}>{item.userName}</Text>
              <View style={styles.bookingType}>
                <Ionicons
                  name="chatbubble"
                  size={16}
                  color="#4CAF50"
                />
                <Text style={styles.bookingTypeText}>
                  Chat Consultation
                </Text>
              </View>
              <Text style={styles.timeAgo}>
                {displayContext.timeLabel}
              </Text>
              {/* Context label for user guidance */}
              <View style={styles.contextContainer}>
                <Ionicons 
                  name={item.displayState === 'awaiting_response' ? 'hourglass-outline' : 
                        item.displayState === 'accepted_chat' ? 'checkmark-circle-outline' : 
                        'chatbubbles-outline'} 
                  size={14} 
                  color={displayContext.badgeColor} 
                />
                <Text style={[styles.contextLabel, { color: displayContext.badgeColor }]}>
                  {displayContext.contextLabel}
                </Text>
              </View>
            </View>
          </View>
          <View style={[styles.bookingBadge, { backgroundColor: displayContext.badgeColor }]}>
            <Text style={styles.badgeText}>
              {displayContext.badge}
            </Text>
          </View>
        </View>
        
        {/* Enhanced booking details */}
        <View style={styles.bookingDetails}>
          {scheduledTime && (
            <View style={styles.detailRow}>
              <Ionicons name="calendar" size={16} color="#666" />
              <Text style={styles.detailLabel}>Scheduled:</Text>
              <Text style={styles.detailValue}>
                {scheduledTime.toLocaleDateString()} at {scheduledTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </Text>
            </View>
          )}
          
          <View style={styles.detailRow}>
            <Ionicons name="cash" size={16} color="#4CAF50" />
            <Text style={styles.detailLabel}>Rate:</Text>
            <Text style={styles.detailValue}>₹{item.rate || item.amount || 'N/A'} / min</Text>
          </View>
          
          {item.duration && (
            <View style={styles.detailRow}>
              <Ionicons name="time" size={16} color="#FF9800" />
              <Text style={styles.detailLabel}>Duration:</Text>
              <Text style={styles.detailValue}>{item.duration} minutes</Text>
            </View>
          )}
          
          {/* Show elapsed time for urgency */}
          {item.displayState === 'awaiting_response' && elapsedMinutes > 2 && (
            <View style={styles.urgencyContainer}>
              <Ionicons name="time-outline" size={16} color="#FF5722" />
              <Text style={styles.urgencyText}>
                User waiting for {elapsedMinutes} minutes
              </Text>
            </View>
          )}
        </View>
        
        {/* Refined action buttons based on display state */}
        <View style={styles.actionButtons}>
          {displayContext.showActions ? (
            displayContext.actionType === 'accept_reject' ? (
              // Accept and Reject buttons for pending booking requests
              <View style={styles.acceptRejectContainer}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.rejectButton]}
                  onPress={() => {
                    console.log('Rejecting booking request:', item.id);
                    handleRejectBooking(item);
                  }}
                >
                  <Ionicons name="close-circle" size={18} color="#fff" />
                  <Text style={styles.rejectButtonText}>Reject</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.actionButton, styles.acceptButton]}
                  onPress={() => {
                    console.log('Accepting booking request:', item.id);
                    handleAcceptBooking(item);
                  }}
                >
                  <Ionicons name="checkmark-circle" size={18} color="#fff" />
                  <Text style={styles.acceptButtonText}>Accept</Text>
                </TouchableOpacity>
              </View>
            ) : displayContext.actionType === 'join' || displayContext.actionType === 'rejoin' ? (
              <TouchableOpacity
                style={[styles.actionButton, styles.joinButton]}
                onPress={() => {
                  console.log('Joining chat session:', item.id);
                  // Navigate to EnhancedChatScreen for chat consultations
                  navigation.navigate('HomeEnhancedChat', { 
                    bookingId: item.id, 
                    sessionId: item.sessionId,
                    userId: item.userId,
                    userName: item.userName
                  });
                }}
              >
                <Ionicons name="chatbubbles" size={18} color="#fff" />
                <Text style={styles.joinButtonText}>
                  {displayContext.actionType === 'rejoin' ? 'Rejoin Chat' : 'Join Session'}
                </Text>
              </TouchableOpacity>
            ) : null
          ) : (
            // Passive display - no action buttons
            <View style={styles.passiveInfo}>
              <Ionicons name="information-circle-outline" size={16} color="#666" />
              <Text style={styles.passiveText}>
                This request is waiting silently. No action needed from you right now.
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.welcomeText}>Welcome back,</Text>
            <Text style={styles.astrologerName}>{user?.displayName || user?.name || 'Astrologer'}</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.headerWalletContainer} 
            onPress={() => navigation.navigate('Wallet')}
            activeOpacity={0.7}
          >
            <View style={styles.headerWalletContent}>
              <Ionicons name="wallet-outline" size={24} color="#F97316" />
              <View style={styles.headerWalletText}>
                <Text style={styles.headerWalletBalance}>
                  ₹{loadingWallet ? '...' : walletBalance.toFixed(2)}
                </Text>
                <Text style={styles.headerWalletLabel}>Wallet</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </View>
      
      <View style={styles.statsContainer}>
        <TouchableOpacity 
          style={[styles.statCard, styles.walletCard]} 
          onPress={() => navigation.navigate('Wallet')}
          activeOpacity={0.7}
        >
          <View style={styles.walletContainer}>
            <Ionicons name="wallet-outline" size={20} color="#F97316" />
            <Text style={styles.walletBalance}>
              ₹{loadingWallet ? '...' : walletBalance.toFixed(2)}
            </Text>
          </View>
          <Text style={styles.statLabel}>Wallet Balance</Text>
        </TouchableOpacity>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{typeof user?.rating === 'object' ? (user?.rating?.average || 0) : (user?.rating || 0)}</Text>
          <Text style={styles.statLabel}>Rating</Text>
        </View>
        <View style={styles.statCard}>
          <TouchableOpacity
            style={styles.availabilityButton}
            onPress={handleManageAvailability}
          >
            <Ionicons name="calendar-outline" size={20} color="#8A2BE2" />
            <Text style={styles.availabilityText}>Manage Availability</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      <View style={styles.bookingsContainer}>
        <Text style={styles.sectionTitle}>Pending Requests</Text>
        
        {loading ? (
          <ActivityIndicator style={styles.loader} size="large" color="#8A2BE2" />
        ) : pendingBookings.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={60} color="#ccc" />
            <Text style={styles.emptyText}>No pending requests</Text>
            <Text style={styles.emptySubtext}>
              New consultation requests will appear here
            </Text>
          </View>
        ) : (
          <FlatList
            data={pendingBookings}
            renderItem={renderBookingItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.bookingsList}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
      
      {loading && pendingBookings.length > 0 && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#8A2BE2" />
        </View>
      )}
      {/* <Button title='Try!' onPress={ () => { Sentry.captureException(new Error('First error')) }}/> */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  header: {
    backgroundColor: '#8A2BE2',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  astrologerName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerWalletContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  headerWalletContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerWalletText: {
    marginLeft: 8,
  },
  headerWalletBalance: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerWalletLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
  },
  statsContainer: {
    flexDirection: 'row',
    marginTop: -10,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  walletCard: {
    borderColor: '#F97316',
    borderWidth: 1,
  },
  walletContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  walletBalance: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F97316',
    marginLeft: 8,
  },
  availabilityButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  availabilityText: {
    color: '#8A2BE2',
    fontWeight: 'bold',
    marginLeft: 5,
    fontSize: 12,
  },
  bookingsContainer: {
    flex: 1,
    padding: 20,
    paddingTop: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  loader: {
    marginTop: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  bookingsList: {
    paddingBottom: 20,
  },
  bookingCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userDetails: {
    marginLeft: 10,
  },
  userImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  bookingType: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  bookingTypeText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 5,
  },
  timeAgo: {
    fontSize: 12,
    color: '#666',
  },
  bookingBadge: {
    backgroundColor: '#8A2BE2',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: 'bold',
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
    marginLeft: 5,
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    marginLeft: 5,
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  messageLabel: {
    fontSize: 14,
    color: '#666',
    marginLeft: 5,
  },
  messageText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 5,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  acceptRejectContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 5,
    alignItems: 'center',
    marginHorizontal: 5,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  rejectButton: {
    backgroundColor: '#f0f0f0',
    borderColor: '#FF5252',
    borderWidth: 1,
  },
  rejectButtonText: {
    color: '#FF5252',
    fontWeight: 'bold',
    marginLeft: 5,
  },
  acceptButton: {
    backgroundColor: '#8A2BE2',
  },
  acceptButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 5,
  },
  activeBadge: {
    backgroundColor: '#4CAF50',
  },
  activeBadgeText: {
    color: '#fff',
  },
  joinButton: {
    backgroundColor: '#F97316',
    flex: 1,
  },
  joinButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 5,
  },
  voiceSessionInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: '#FFF3E0',
    borderRadius: 5,
    borderColor: '#FF9800',
    borderWidth: 1,
  },
  voiceSessionText: {
    color: '#FF9800',
    fontWeight: 'bold',
    marginLeft: 5,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // New styles for enhanced chat request UI
  contextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    paddingVertical: 3,
  },
  contextLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  urgencyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#FFEBEE',
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#FF5722',
  },
  urgencyText: {
    fontSize: 12,
    color: '#FF5722',
    fontWeight: '500',
    marginLeft: 4,
  },
  passiveInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    borderColor: '#E0E0E0',
    borderWidth: 1,
  },
  passiveText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginLeft: 6,
    textAlign: 'center',
    flex: 1,
  },
});

export default HomeScreen;
