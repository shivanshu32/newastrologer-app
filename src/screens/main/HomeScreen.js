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
import { bookingsAPI } from '../../services/api';
import { listenForBookingRequests, respondToBookingRequest } from '../../services/socketService';
import { SocketContext } from '../../context/SocketContext';

const HomeScreen = ({ navigation }) => {
  const [pendingBookings, setPendingBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);
  const { user, updateStatus } = useAuth();
  const { socket, isConnected } = useContext(SocketContext);
  
  useEffect(() => {
    fetchPendingBookings();
    
    // Set up socket listener for real-time booking requests
    let cleanup;
    if (socket && isConnected) {
      console.log('Socket connected, setting up booking request listener');
      cleanup = listenForBookingRequests(socket, (newBooking) => {
        console.log('Received new booking request:', newBooking);
        
        // Validate booking data before processing
        if (!newBooking) {
          console.error('Received null or undefined booking data');
          return;
        }
        
        try {
          // Create a sanitized booking object with all required fields and fallbacks
          const sanitizedBooking = {
            // Use optional chaining and nullish coalescing for safety
            id: newBooking._id || newBooking.id || `temp-${Date.now()}`,
            userId: (newBooking.user && newBooking.user._id) || newBooking.userId || 'unknown',
            userName: (newBooking.user && newBooking.user.name) || newBooking.userName || 'User',
            userImage: (newBooking.user && newBooking.user.profileImage) || 'https://via.placeholder.com/100',
            type: newBooking.type || 'chat',
            status: newBooking.status || 'pending',
            requestedTime: newBooking.createdAt || new Date().toISOString()
          };
          
          // Add the sanitized booking to the pending bookings list
          setPendingBookings(prevBookings => [...prevBookings, sanitizedBooking]);
        } catch (error) {
          console.error('Error processing booking request:', error);
        }
      });
    }
    
    return () => {
      if (cleanup) cleanup();
    };
  }, [socket, isConnected]);

  const fetchPendingBookings = async () => {
    try {
      setLoading(true);
      
      // Call backend API to fetch pending bookings
      const response = await bookingsAPI.getAll('pending');
      
      if (response.data && response.data.data && Array.isArray(response.data.data)) {
        // Transform the data to match the expected format with robust validation
        const bookings = response.data.data.map(booking => {
          // Skip invalid bookings
          if (!booking) return null;
          
          try {
            return {
              id: booking._id || `temp-${Date.now()}`,
              userId: (booking.user && booking.user._id) || 'unknown',
              userName: (booking.user && booking.user.name) || 'User',
              userImage: (booking.user && booking.user.profileImage) || 'https://via.placeholder.com/100',
              type: booking.type || 'chat',
              status: booking.status || 'pending',
              requestedTime: booking.createdAt || new Date().toISOString(),
            };
          } catch (err) {
            console.error('Error processing booking item:', err);
            return null;
          }
        }).filter(booking => booking !== null); // Remove any null entries
        
        setPendingBookings(bookings);
      } else {
        // If no bookings found or invalid data structure, set empty array
        console.log('No valid bookings data found in response');
        setPendingBookings([]);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching pending bookings:', error);
      setLoading(false);
      // In case of error, set empty bookings array
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
    try {
      setLoading(true);
      
      // Call the API to accept the booking
      await bookingsAPI.accept(booking.id);
      
      // If socket is available, also respond via socket for real-time updates
      if (socket) {
        try {
          await respondToBookingRequest(socket, booking.id, true);
        } catch (socketError) {
          console.log('Socket error when accepting booking:', socketError);
          // Continue even if socket fails, as we've already updated via API
        }
      }
      
      // Remove the booking from the list
      setPendingBookings(prevBookings => 
        prevBookings.filter(item => item.id !== booking.id)
      );
      
      setLoading(false);
      
      // Navigate to the appropriate screen based on booking type
      if (booking.type === 'chat') {
        navigation.navigate('HomeChat', { bookingId: booking.id });
      } else if (booking.type === 'video') {
        navigation.navigate('HomeVideoCall', { bookingId: booking.id });
      } else if (booking.type === 'voice') {
        navigation.navigate('HomeVoiceCall', { bookingId: booking.id });
      }
    } catch (error) {
      console.log('Error accepting booking:', error);
      setLoading(false);
      Alert.alert('Error', 'Failed to accept booking. Please try again.');
    }
  };

  const handleRejectBooking = async (booking) => {
    try {
      setLoading(true);
      
      // Call the API to reject the booking
      await bookingsAPI.reject(booking.id);
      
      // If socket is available, also respond via socket for real-time updates
      if (socket) {
        try {
          await respondToBookingRequest(socket, booking.id, false);
        } catch (socketError) {
          console.log('Socket error when rejecting booking:', socketError);
          // Continue even if socket fails, as we've already updated via API
        }
      }
      
      // Remove the booking from the list
      setPendingBookings(prevBookings => 
        prevBookings.filter(item => item.id !== booking.id)
      );
      
      setLoading(false);
    } catch (error) {
      console.log('Error rejecting booking:', error);
      setLoading(false);
      Alert.alert('Error', 'Failed to reject booking. Please try again.');
    }
  };

  const handleManageAvailability = () => {
    navigation.navigate('Availability');
  };

  const renderBookingItem = ({ item }) => {
    const requestedTime = new Date(item.requestedTime);
    const scheduledTime = item.scheduledAt ? new Date(item.scheduledAt) : null;
    
    return (
      <View style={styles.bookingCard}>
        <View style={styles.bookingHeader}>
          <View style={styles.userInfo}>
            <Image source={{ uri: item.userImage }} style={styles.userImage} />
            <View style={styles.userDetails}>
              <Text style={styles.userName}>{item.userName}</Text>
              <View style={styles.bookingType}>
                <Ionicons
                  name={
                    item.type === 'chat' ? 'chatbubble' : 
                    item.type === 'video' ? 'videocam' : 
                    item.type === 'voice' ? 'call' : 'help-circle'
                  }
                  size={16}
                  color={
                    item.type === 'chat' ? '#4CAF50' : 
                    item.type === 'video' ? '#2196F3' : 
                    item.type === 'voice' ? '#FF9800' : '#666'
                  }
                />
                <Text style={styles.bookingTypeText}>
                  {item.type.charAt(0).toUpperCase() + item.type.slice(1)} Consultation
                </Text>
              </View>
              <Text style={styles.timeAgo}>
                Requested {Math.floor((new Date() - requestedTime) / 60000)} min ago
              </Text>
            </View>
          </View>
          <View style={styles.bookingBadge}>
            <Text style={styles.badgeText}>NEW</Text>
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
            <Text style={styles.detailLabel}>Amount:</Text>
            <Text style={styles.detailValue}>₹{item.amount || item.rate || 'N/A'}</Text>
          </View>
          
          {item.duration && (
            <View style={styles.detailRow}>
              <Ionicons name="time" size={16} color="#FF9800" />
              <Text style={styles.detailLabel}>Duration:</Text>
              <Text style={styles.detailValue}>{item.duration} minutes</Text>
            </View>
          )}
          
          {item.message && (
            <View style={styles.messageContainer}>
              <Ionicons name="chatbubble-outline" size={16} color="#666" />
              <Text style={styles.messageLabel}>Message:</Text>
              <Text style={styles.messageText} numberOfLines={2}>{item.message}</Text>
            </View>
          )}
        </View>
        
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => handleRejectBooking(item)}
            disabled={loading}
          >
            <Ionicons name="close-circle" size={18} color="#FF5252" />
            <Text style={styles.rejectButtonText}>Decline</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.acceptButton]}
            onPress={() => handleAcceptBooking(item)}
            disabled={loading}
          >
            <Ionicons name="checkmark-circle" size={18} color="#fff" />
            <Text style={styles.acceptButtonText}>Accept</Text>
          </TouchableOpacity>
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
            <Text style={styles.astrologerName}>{user?.name || 'Astrologer'}</Text>
          </View>
          
          <View style={styles.statusContainer}>
            <Text style={styles.statusLabel}>
              {user?.online ? 'Online' : 'Offline'}
            </Text>
            <Switch
              value={user?.online}
              onValueChange={handleStatusChange}
              disabled={statusLoading}
              trackColor={{ false: '#ccc', true: '#8A2BE2' }}
              thumbColor="#fff"
            />
          </View>
        </View>
      </View>
      
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>₹{user?.walletBalance || 0}</Text>
          <Text style={styles.statLabel}>Earnings</Text>
        </View>
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
      <Button title='Try!' onPress={ () => { Sentry.captureException(new Error('First error')) }}/>
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
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  statusLabel: {
    color: '#fff',
    marginRight: 10,
    fontWeight: 'bold',
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
});

export default HomeScreen;
