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
  const [activeTab, setActiveTab] = useState('active');
  
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

  // Render booking item
  const renderBookingItem = ({ item: booking }) => {
    const statusInfo = getStatusInfo(booking.status);
    const isVideoCall = booking.type === 'video';
    const isVoiceCall = booking.type === 'voice';
    const canJoin = ['confirmed', 'waiting_for_user'].includes(booking.status);
    const canComplete = booking.status === 'in-progress';
    const canCancel = ['pending', 'confirmed'].includes(booking.status);

    return (
      <View style={styles.bookingCard}>
        <View style={styles.bookingHeader}>
          <View style={styles.userInfo}>
            <Image
              source={{ 
                uri: booking.user?.profileImage || 'https://via.placeholder.com/50'
              }}
              style={styles.userImage}
            />
            <View style={styles.userDetails}>
              <Text style={styles.userName}>
                {booking.user?.name || 'User'}
              </Text>
              <View style={styles.typeContainer}>
                {isVideoCall && (
                  <MaterialIcons name="videocam" size={16} color="#2196F3" />
                )}
                {isVoiceCall && (
                  <MaterialIcons name="phone" size={16} color="#4CAF50" />
                )}
                <Text style={styles.typeText}>
                  {booking.type?.charAt(0).toUpperCase() + booking.type?.slice(1)} Call
                </Text>
              </View>
            </View>
          </View>
          
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.color }]}>
            <Ionicons name={statusInfo.icon} size={14} color="#fff" />
            <Text style={styles.statusText}>{statusInfo.text}</Text>
          </View>
        </View>

        <View style={styles.bookingDetails}>
          <View style={styles.detailRow}>
            <Ionicons name="calendar-outline" size={16} color="#666" />
            <Text style={styles.detailText}>
              {formatDateTime(booking.scheduledAt)}
            </Text>
          </View>
          
          <View style={styles.detailRow}>
            <Ionicons name="cash-outline" size={16} color="#666" />
            <Text style={styles.detailText}>
              ₹{booking.rate || booking.amount || 0}
            </Text>
          </View>

          {booking.duration && (
            <View style={styles.detailRow}>
              <Ionicons name="time-outline" size={16} color="#666" />
              <Text style={styles.detailText}>
                {booking.duration} minutes
              </Text>
            </View>
          )}
        </View>

        {(canJoin || canComplete || canCancel) && (
          <View style={styles.actionButtons}>
            {canJoin && (
              <TouchableOpacity
                style={[styles.actionButton, styles.joinButton]}
                onPress={() => handleBookingAction(booking, 'join')}
              >
                <Ionicons name="videocam" size={16} color="#fff" />
                <Text style={styles.actionButtonText}>Join Session</Text>
              </TouchableOpacity>
            )}
            
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
      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        {[
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
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
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
  typeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
    marginLeft: 4,
  },
  bookingDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    flex: 1,
  },
  joinButton: {
    backgroundColor: '#4CAF50',
  },
  completeButton: {
    backgroundColor: '#2196F3',
  },
  cancelButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#F44336',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 4,
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
