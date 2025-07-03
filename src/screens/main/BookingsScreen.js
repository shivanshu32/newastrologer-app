import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSocket } from '../../context/SocketContext';

const API_BASE_URL = 'https://jyotishcallbackend-2uxrv.ondigitalocean.app/api/v1';

const BookingsScreen = ({ navigation }) => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  
  const { socket } = useSocket();

  // Fetch bookings from API
  const fetchBookings = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('astrologerToken');
      if (!token) {
        console.log('No auth token found');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/bookings`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch bookings');
      }

      const data = await response.json();
      console.log('Fetched bookings:', data);
      
      if (data.success) {
        setBookings(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
      Alert.alert('Error', 'Failed to fetch bookings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Filter bookings based on active tab
  const getFilteredBookings = useCallback(() => {
    if (!bookings || bookings.length === 0) return [];

    switch (activeTab) {
      case 'all':
        return bookings; // Show all bookings
      case 'active':
        return bookings.filter(booking => 
          ['pending', 'confirmed', 'waiting_for_user', 'in-progress'].includes(booking.status)
        );
      case 'completed':
        return bookings.filter(booking => 
          ['completed', 'no_show'].includes(booking.status)
        );
      case 'cancelled':
        return bookings.filter(booking => 
          ['cancelled', 'rejected', 'expired'].includes(booking.status)
        );
      default:
        return bookings;
    }
  }, [bookings, activeTab]);

  // Handle pull to refresh
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchBookings();
  }, [fetchBookings]);

  // Handle booking action (join session, complete, etc.)
  const handleBookingAction = useCallback(async (booking, action) => {
    try {
      const token = await AsyncStorage.getItem('astrologerToken');
      if (!token) {
        Alert.alert('Error', 'Authentication token not found');
        return;
      }

      let endpoint = '';
      let method = 'POST';
      
      switch (action) {
        case 'join':
          endpoint = `${API_BASE_URL}/bookings/${booking._id}/join-astrologer`;
          break;
        case 'complete':
          endpoint = `${API_BASE_URL}/bookings/${booking._id}/complete`;
          break;
        case 'cancel':
          endpoint = `${API_BASE_URL}/bookings/${booking._id}/cancel`;
          break;
        default:
          return;
      }

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `Failed to ${action} booking`);
      }

      Alert.alert('Success', `Booking ${action}ed successfully`);
      fetchBookings(); // Refresh bookings list
      
      // Navigate to appropriate screen for join action
      if (action === 'join') {
        if (booking.type === 'video') {
          navigation.navigate('VideoConsultation', { bookingId: booking._id });
        } else if (booking.type === 'voice') {
          navigation.navigate('VoiceCall', { bookingId: booking._id });
        }
      }
    } catch (error) {
      console.error(`Error ${action}ing booking:`, error);
      Alert.alert('Error', error.message || `Failed to ${action} booking`);
    }
  }, [navigation, fetchBookings]);

  // Get status color and display text
  const getStatusInfo = (status) => {
    switch (status) {
      case 'pending':
        return { color: '#FF9800', text: 'Pending', icon: 'time-outline' };
      case 'confirmed':
        return { color: '#4CAF50', text: 'Confirmed', icon: 'checkmark-circle-outline' };
      case 'waiting_for_user':
        return { color: '#2196F3', text: 'Waiting for User', icon: 'person-outline' };
      case 'in-progress':
        return { color: '#9C27B0', text: 'In Progress', icon: 'play-circle-outline' };
      case 'completed':
        return { color: '#4CAF50', text: 'Completed', icon: 'checkmark-done-outline' };
      case 'cancelled':
        return { color: '#F44336', text: 'Cancelled', icon: 'close-circle-outline' };
      case 'rejected':
        return { color: '#F44336', text: 'Rejected', icon: 'close-outline' };
      case 'expired':
        return { color: '#9E9E9E', text: 'Expired', icon: 'time-outline' };
      case 'no_show':
        return { color: '#FF5722', text: 'No Show', icon: 'person-remove-outline' };
      case 'rescheduled':
        return { color: '#FF9800', text: 'Rescheduled', icon: 'calendar-outline' };
      default:
        return { color: '#9E9E9E', text: status, icon: 'help-outline' };
    }
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

  // Get booking type icon
  const getBookingTypeIcon = (type) => {
    switch (type) {
      case 'chat':
        return 'chatbubble-outline';
      case 'video':
        return 'videocam-outline';
      case 'voice':
        return 'call-outline';
      default:
        return 'help-circle-outline';
    }
  };

  // Format date for better display
  const formatDate = (booking) => {
    try {
      // Try multiple possible date fields
      const dateValue = booking.scheduledAt || booking.createdAt || booking.updatedAt;
      if (!dateValue) return 'Date not set';
      
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) return 'Date not set';
      
      return date.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      console.log('Error formatting date:', error);
      return 'Date not set';
    }
  };

  // Format time for better display
  const formatTime = (booking) => {
    try {
      // Try multiple possible date fields
      const dateValue = booking.scheduledAt || booking.createdAt || booking.updatedAt;
      if (!dateValue) return 'Time not set';
      
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) return 'Time not set';
      
      return date.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      console.log('Error formatting time:', error);
      return 'Time not set';
    }
  };

  // Get action button text
  const getActionButtonText = (booking) => {
    switch (booking.status) {
      case 'confirmed':
      case 'waiting_for_user':
        return 'Join Session';
      case 'in-progress':
        return 'Continue Session';
      case 'pending':
        return 'View Details';
      case 'completed':
        return 'View Details';
      default:
        return 'View Details';
    }
  };

  // Render booking item with enhanced details
  const renderBookingItem = ({ item: booking }) => {
    const statusInfo = getStatusInfo(booking.status);
    const typeIcon = getBookingTypeIcon(booking.type);
    const canJoin = ['confirmed', 'waiting_for_user'].includes(booking.status);
    const canComplete = booking.status === 'in-progress';
    const canCancel = ['pending', 'confirmed'].includes(booking.status);
    
    // Check if we have any valid date
    const hasValidDate = booking.scheduledAt || booking.createdAt || booking.updatedAt;

    return (
      <View style={styles.bookingCard}>
        <View style={styles.bookingHeader}>
          <View style={styles.userInfo}>
            <Image
              source={{ 
                uri: 'https://freesvg.org/img/abstract-user-flat-4.png'
              }}
              style={styles.userImage}
            />
            <View style={styles.userDetails}>
              <Text style={styles.userName}>
                {booking.userInfo?.name || booking.user?.displayName || booking.user?.name || 'User'}
              </Text>
              <View style={styles.bookingType}>
                <Ionicons name={typeIcon} size={14} color="#666" />
                <Text style={styles.bookingTypeText}>
                  {booking.type?.charAt(0).toUpperCase() + booking.type?.slice(1)} Consultation
                </Text>
              </View>
            </View>
          </View>
          
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.color }]}>
            <Text style={styles.statusText}>
              {statusInfo.text}
            </Text>
          </View>
        </View>

        <View style={styles.bookingDetails}>
          <View style={styles.detailItem}>
            <Ionicons name="calendar-outline" size={16} color="#666" />
            <Text style={styles.detailText}>
              {formatDate(booking)}
            </Text>
          </View>
          
          <View style={styles.detailItem}>
            <Ionicons name="time-outline" size={16} color="#666" />
            <Text style={styles.detailText}>
              {formatTime(booking)}
            </Text>
          </View>

          {booking.duration > 0 && (
            <View style={styles.detailItem}>
              <Ionicons name="hourglass-outline" size={16} color="#666" />
              <Text style={styles.detailText}>{booking.duration} mins</Text>
            </View>
          )}

          {(booking.totalAmount > 0 || booking.rate > 0 || booking.amount > 0) && (
            <View style={styles.detailItem}>
              <Ionicons name="cash-outline" size={16} color="#666" />
              <Text style={styles.detailText}>
                ₹{booking.totalAmount || booking.rate || booking.amount || 0}
              </Text>
            </View>
          )}
        </View>

        {/* Join Button for confirmed bookings */}
        {canJoin ? (
          <TouchableOpacity 
            style={styles.joinButton}
            onPress={() => handleBookingAction(booking, 'join')}
          >
            <Ionicons name="videocam" size={20} color="#fff" style={styles.joinButtonIcon} />
            <Text style={styles.joinButtonText}>Join Session</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </TouchableOpacity>
        ) : (
          <View style={styles.actionContainer}>
            {canComplete && (
              <TouchableOpacity
                style={[styles.actionButton, styles.completeButton]}
                onPress={() => handleBookingAction(booking, 'complete')}
              >
                <Ionicons name="checkmark" size={16} color="#fff" />
                <Text style={styles.actionButtonText}>Complete</Text>
              </TouchableOpacity>
            )}
            
            {canCancel && (
              <TouchableOpacity
                style={[styles.actionButton, styles.cancelButton]}
                onPress={() => {
                  Alert.alert(
                    'Cancel Booking',
                    'Are you sure you want to cancel this booking?',
                    [
                      { text: 'No', style: 'cancel' },
                      { text: 'Yes', onPress: () => handleBookingAction(booking, 'cancel') }
                    ]
                  );
                }}
              >
                <Ionicons name="close" size={16} color="#F44336" />
                <Text style={[styles.actionButtonText, { color: '#F44336' }]}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  // Set up socket listeners for real-time updates
  useEffect(() => {
    if (!socket) return;

    const handleBookingUpdate = (data) => {
      console.log('Booking update received:', data);
      fetchBookings(); // Refresh bookings list
    };

    // Listen for various booking lifecycle events
    socket.on('booking_accepted', handleBookingUpdate);
    socket.on('booking_rejected', handleBookingUpdate);
    socket.on('booking_expired', handleBookingUpdate);
    socket.on('booking_cancelled', handleBookingUpdate);
    socket.on('session_started', handleBookingUpdate);
    socket.on('session_completed', handleBookingUpdate);
    socket.on('user_joined_session', handleBookingUpdate);
    socket.on('no_show_detected', handleBookingUpdate);

    return () => {
      socket.off('booking_accepted', handleBookingUpdate);
      socket.off('booking_rejected', handleBookingUpdate);
      socket.off('booking_expired', handleBookingUpdate);
      socket.off('booking_cancelled', handleBookingUpdate);
      socket.off('session_started', handleBookingUpdate);
      socket.off('session_completed', handleBookingUpdate);
      socket.off('user_joined_session', handleBookingUpdate);
      socket.off('no_show_detected', handleBookingUpdate);
    };
  }, [socket, fetchBookings]);

  // Fetch bookings when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchBookings();
    }, [fetchBookings])
  );

  const filteredBookings = getFilteredBookings();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Bookings</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        {[
          { key: 'all', label: 'All', icon: 'list-outline' },
          { key: 'active', label: 'Active', icon: 'play-circle-outline' },
          { key: 'completed', label: 'Completed', icon: 'checkmark-circle-outline' },
          { key: 'cancelled', label: 'Cancelled', icon: 'close-circle-outline' }
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tab,
              activeTab === tab.key && styles.activeTab
            ]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Ionicons 
              name={tab.icon} 
              size={20} 
              color={activeTab === tab.key ? '#673AB7' : '#666'} 
            />
            <Text style={[
              styles.tabText,
              activeTab === tab.key && styles.activeTabText
            ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Bookings List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#673AB7" />
          <Text style={styles.loadingText}>Loading bookings...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredBookings}
          renderItem={renderBookingItem}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#673AB7']}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>
                No {activeTab} bookings found
              </Text>
              <Text style={styles.emptySubtext}>
                Pull down to refresh
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  header: {
    backgroundColor: '#673AB7',
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40, // Same width as back button to center the title
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  activeTab: {
    backgroundColor: '#f3e5f5',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
    fontWeight: '500',
  },
  activeTabText: {
    color: '#673AB7',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  listContainer: {
    padding: 16,
  },
  bookingCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  bookingType: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bookingTypeText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  bookingDetails: {
    marginBottom: 16,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
  joinButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 8,
  },
  joinButtonIcon: {
    marginRight: 8,
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  actionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 4,
  },
  completeButton: {
    backgroundColor: '#2196F3',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#F44336',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 6,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 18,
    color: '#999',
    marginTop: 16,
    fontWeight: '500',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#ccc',
    marginTop: 8,
  },
});

export default BookingsScreen;
