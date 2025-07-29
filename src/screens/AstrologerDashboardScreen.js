import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Switch,
  SafeAreaView,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSocket } from '../context/SocketContext';
import BookingRequestHandler from '../components/BookingRequestHandler';
import { getPendingBookings, listenForPendingBookingUpdates } from '../services/socketService';
import { sessionsAPI } from '../services/api';
import RejoinChatBottomSheet from '../components/RejoinChatBottomSheet';
import { MaterialIcons } from '@expo/vector-icons';

// Direct import for MaterialIcons
const Icon = MaterialIcons;

/**
 * Main dashboard screen for astrologers
 * Includes status toggle, upcoming bookings, and earnings summary
 * Also integrates the BookingRequestHandler to listen for real-time booking requests
 */
const AstrologerDashboardScreen = () => {
  const navigation = useNavigation();
  const { socket, isConnected } = useSocket();
  
  const [astrologer, setAstrologer] = useState(null);
  const [isOnline, setIsOnline] = useState(false);
  const [upcomingBookings, setUpcomingBookings] = useState([]);
  const [pendingBookings, setPendingBookings] = useState([]);
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [weeklyEarnings, setWeeklyEarnings] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusUpdating, setStatusUpdating] = useState(false);
  
  // Rejoin Chat Bottom Sheet State
  const [showRejoinBottomSheet, setShowRejoinBottomSheet] = useState(false);
  const [activeSessionData, setActiveSessionData] = useState(null);
  const [remainingTime, setRemainingTime] = useState(null);
  const [timerInterval, setTimerInterval] = useState(null);

  // Fetch astrologer data and stats
  useEffect(() => {
    const fetchAstrologerData = async () => {
      try {
        setLoading(true);
        
        // Get astrologer ID from storage
        const astrologerId = await AsyncStorage.getItem('astrologerId');
        if (!astrologerId) {
          throw new Error('Astrologer ID not found');
        }
        
        // Fetch astrologer profile
        const profileResponse = await axios.get(`${API_URL}/api/astrologers/${astrologerId}`);
        setAstrologer(profileResponse.data);
        setIsOnline(profileResponse.data.status === 'online');
        
        // Fetch real-time pending bookings from pendingBookingMap via socket
        if (socket && isConnected) {
          try {
            console.log('📋 [DASHBOARD] Fetching pending bookings from pendingBookingMap...');
            const realTimePendingBookings = await getPendingBookings(socket);
            console.log('📋 [DASHBOARD] Received pending bookings:', realTimePendingBookings);
            setPendingBookings(realTimePendingBookings);
            // Use pending bookings as upcoming bookings for now
            setUpcomingBookings(realTimePendingBookings.slice(0, 5));
          } catch (error) {
            console.error('📋 [DASHBOARD] Failed to fetch pending bookings:', error);
            setPendingBookings([]);
            setUpcomingBookings([]);
          }
        } else {
          console.log('📋 [DASHBOARD] Socket not connected, skipping pending bookings fetch');
          setPendingBookings([]);
          setUpcomingBookings([]);
        }
        
        // Fetch earnings stats
        const earningsResponse = await axios.get(`${API_URL}/api/astrologers/${astrologerId}/earnings`);
        setTodayEarnings(earningsResponse.data.today || 0);
        setWeeklyEarnings(earningsResponse.data.weekly || 0);
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching astrologer data:', error);
        setLoading(false);
      }
    };
    
    fetchAstrologerData();
    
    // Refresh data every 2 minutes
    const refreshInterval = setInterval(fetchAstrologerData, 120000);
    
    return () => clearInterval(refreshInterval);
  }, []);

  // Check for active session (for rejoin functionality)
  const checkActiveSession = async () => {
    try {
      console.log('🔄 [DASHBOARD] Checking for active session...');
      console.log('🔄 [DASHBOARD] Current state - showRejoinBottomSheet:', showRejoinBottomSheet);
      console.log('🔄 [DASHBOARD] Current state - activeSessionData:', activeSessionData);
      
      const response = await sessionsAPI.checkActiveSession();
      console.log('📋 [DASHBOARD] Active session response:', JSON.stringify(response, null, 2));
      console.log('📋 [DASHBOARD] Response type:', typeof response);
      console.log('📋 [DASHBOARD] Response.success:', response?.success);
      console.log('📋 [DASHBOARD] Response.hasActiveSession:', response?.hasActiveSession);
      console.log('📋 [DASHBOARD] Response.data:', response?.data);
      
      if (response && response.success && response.hasActiveSession && response.data) {
        const sessionData = response.data;
        console.log('✅ [DASHBOARD] Found active session:', JSON.stringify(sessionData, null, 2));
        console.log('✅ [DASHBOARD] Session type:', sessionData.type);
        console.log('✅ [DASHBOARD] Session status:', sessionData.status);
        console.log('✅ [DASHBOARD] Is free chat:', sessionData.isFreeChat);
        console.log('✅ [DASHBOARD] User info:', sessionData.user);
        
        console.log('🎯 [DASHBOARD] Setting active session data and showing bottom sheet...');
        setActiveSessionData(sessionData);
        setShowRejoinBottomSheet(true);
        console.log('🎯 [DASHBOARD] Bottom sheet should now be visible');
        
        // Start timer for free chat sessions
        if (sessionData.isFreeChat && sessionData.remainingTime !== null) {
          console.log('⏱️ [DASHBOARD] Starting timer for free chat session:', sessionData.remainingTime);
          setRemainingTime(sessionData.remainingTime);
          startRemainingTimeTimer(sessionData.remainingTime);
        }
      } else {
        console.log('ℹ️ [DASHBOARD] No active session found or invalid response');
        console.log('ℹ️ [DASHBOARD] Response success:', response?.success);
        console.log('ℹ️ [DASHBOARD] Has active session:', response?.hasActiveSession);
        console.log('ℹ️ [DASHBOARD] Data present:', !!response?.data);
        setActiveSessionData(null);
        setShowRejoinBottomSheet(false);
        clearRemainingTimeTimer();
      }
    } catch (error) {
      console.error('❌ [DASHBOARD] Error checking active session:', error);
      console.error('❌ [DASHBOARD] Error details:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });
      
      // Don't show error to user, just hide the bottom sheet
      setActiveSessionData(null);
      setShowRejoinBottomSheet(false);
      clearRemainingTimeTimer();
    }
  };

  // Start timer for remaining time countdown
  const startRemainingTimeTimer = (initialTime) => {
    // Clear existing timer
    clearRemainingTimeTimer();
    
    if (initialTime <= 0) {
      setRemainingTime(0);
      return;
    }
    
    let currentTime = initialTime;
    const interval = setInterval(() => {
      currentTime -= 1;
      setRemainingTime(currentTime);
      
      if (currentTime <= 0) {
        clearInterval(interval);
        setTimerInterval(null);
        // Hide bottom sheet when time expires
        setShowRejoinBottomSheet(false);
        setActiveSessionData(null);
        
        Alert.alert(
          'Session Expired',
          'Your free chat session has ended.',
          [{ text: 'OK' }]
        );
      }
    }, 1000);
    
    setTimerInterval(interval);
  };

  // Clear remaining time timer
  const clearRemainingTimeTimer = () => {
    if (timerInterval) {
      clearInterval(timerInterval);
      setTimerInterval(null);
    }
  };

  // Handle rejoin chat button press
  const handleRejoinChat = (sessionData) => {
    console.log('🔄 [DASHBOARD] Rejoining chat session:', sessionData);
    
    // Hide bottom sheet
    setShowRejoinBottomSheet(false);
    clearRemainingTimeTimer();
    
    try {
      if (sessionData.isFreeChat) {
        // Navigate to free chat screen
        navigation.navigate('FixedFreeChatScreen', {
          sessionId: sessionData.sessionIdentifier,
          userName: sessionData.user?.name,
          rejoin: true
        });
      } else {
        // Navigate to enhanced chat screen for paid consultations
        navigation.navigate('EnhancedChatScreen', {
          bookingId: sessionData.bookingId,
          sessionId: sessionData.sessionId,
          userName: sessionData.user?.name,
          rejoin: true
        });
      }
      
      Alert.alert(
        'Rejoining Session',
        'Connecting you back to your consultation...',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('❌ [DASHBOARD] Error rejoining session:', error);
      Alert.alert(
        'Navigation Error',
        'Unable to rejoin the session. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  // Handle bottom sheet close
  const handleBottomSheetClose = () => {
    setShowRejoinBottomSheet(false);
    clearRemainingTimeTimer();
  };

  // Check for active sessions when component mounts and when data refreshes
  useEffect(() => {
    if (!loading) {
      checkActiveSession();
    }
  }, [loading]);

  // Check for active sessions when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      console.log('🔄 [DASHBOARD] Screen focused, checking for active session...');
      checkActiveSession();
    }, [])
  );

  // Cleanup timer on component unmount
  useEffect(() => {
    return () => {
      clearRemainingTimeTimer();
    };
  }, []);
  
  // Set up real-time listener for pending booking updates
  useEffect(() => {
    if (!socket || !isConnected) {
      console.log('📋 [DASHBOARD] Socket not connected, skipping pending booking updates listener');
      return;
    }
    
    console.log('📋 [DASHBOARD] Setting up real-time pending booking updates listener');
    
    // Set up listener for pending booking updates
    const cleanupPendingUpdates = listenForPendingBookingUpdates(socket, (updatedPendingBookings) => {
      console.log('📋 [DASHBOARD] Received pending bookings update:', updatedPendingBookings);
      setPendingBookings(updatedPendingBookings);
      // Update upcoming bookings display with latest pending bookings
      setUpcomingBookings(updatedPendingBookings.slice(0, 5));
    });
    
    return cleanupPendingUpdates;
  }, [socket, isConnected]);

  // Toggle online status
  const toggleOnlineStatus = async () => {
    try {
      setStatusUpdating(true);
      
      const newStatus = !isOnline ? 'online' : 'offline';
      
      // Get auth token
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }
      
      // Update status on server with correct endpoint and auth
      const response = await axios.put(`${API_URL}/api/v1/astrologers/update-status`, {
        status: newStatus
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Status updated successfully:', response.data);
      
      // Update local state
      setIsOnline(!isOnline);
      
      // Update astrologer object with new status
      setAstrologer(prev => ({
        ...prev,
        status: newStatus,
        lastActive: new Date().toISOString()
      }));
      
      // Emit socket event for real-time status update to user-app
      if (socket && isConnected) {
        socket.emit('astrologer_status_changed', {
          astrologerId: astrologer._id,
          status: newStatus,
          lastActive: new Date().toISOString()
        });
        console.log('Emitted astrologer_status_changed event:', {
          astrologerId: astrologer._id,
          status: newStatus
        });
      } else {
        console.warn('Socket not connected, status change not broadcasted');
      }
      
      setStatusUpdating(false);
    } catch (error) {
      console.error('Error updating status:', error.response?.data || error.message);
      setStatusUpdating(false);
      
      // Show error to user
      alert('Failed to update status. Please try again.');
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Format currency for display
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  // Navigate to booking details
  const navigateToBookingDetails = (booking) => {
    navigation.navigate('BookingDetails', { booking });
  };

  // Show loading state
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
      {/* Invisible BookingRequestHandler to listen for real-time booking requests */}
      <BookingRequestHandler />
      
      <ScrollView>
        {/* Status Section */}
        <View style={styles.statusSection}>
          <View style={styles.statusHeader}>
            <Text style={styles.statusTitle}>Your Status</Text>
            {statusUpdating ? (
              <ActivityIndicator size="small" color="#4CAF50" />
            ) : (
              <Switch
                value={isOnline}
                onValueChange={toggleOnlineStatus}
                trackColor={{ false: '#E0E0E0', true: '#A5D6A7' }}
                thumbColor={isOnline ? '#4CAF50' : '#9E9E9E'}
              />
            )}
          </View>
          
          <View style={styles.statusInfo}>
            <View style={[styles.statusIndicator, isOnline ? styles.onlineIndicator : styles.offlineIndicator]} />
            <Text style={styles.statusText}>
              You are currently {isOnline ? 'Online' : 'Offline'}
            </Text>
          </View>
          
          <Text style={styles.statusDescription}>
            {isOnline
              ? 'You are visible to users and can receive instant consultation requests.'
              : 'You are not visible to users and will not receive instant consultation requests.'}
          </Text>
        </View>
        
        {/* Earnings Summary */}
        <View style={styles.earningsSection}>
          <Text style={styles.sectionTitle}>Earnings Summary</Text>
          
          <View style={styles.earningsCards}>
            <View style={styles.earningsCard}>
              <Text style={styles.earningsLabel}>Today</Text>
              <Text style={styles.earningsAmount}>{formatCurrency(todayEarnings)}</Text>
            </View>
            
            <View style={styles.earningsCard}>
              <Text style={styles.earningsLabel}>This Week</Text>
              <Text style={styles.earningsAmount}>{formatCurrency(weeklyEarnings)}</Text>
            </View>
          </View>
          
          <TouchableOpacity
            style={styles.viewMoreButton}
            onPress={() => navigation.navigate('EarningsHistory')}
          >
            <Text style={styles.viewMoreText}>View Detailed Earnings</Text>
            <Icon name="chevron-right" size={20} color="#4CAF50" />
          </TouchableOpacity>
        </View>
        
        {/* Upcoming Bookings */}
        <View style={styles.bookingsSection}>
          <Text style={styles.sectionTitle}>Upcoming Consultations</Text>
          
          {upcomingBookings.length === 0 ? (
            <View style={styles.emptyBookings}>
              <Icon name="event-busy" size={48} color="#E0E0E0" />
              <Text style={styles.emptyBookingsText}>No upcoming consultations</Text>
            </View>
          ) : (
            <>
              {upcomingBookings.map((booking) => (
                <TouchableOpacity
                  key={booking._id}
                  style={styles.bookingCard}
                  onPress={() => navigateToBookingDetails(booking)}
                >
                  <View style={styles.bookingHeader}>
                    <Text style={styles.bookingType}>
                      {booking.type.charAt(0).toUpperCase() + booking.type.slice(1)} Consultation
                    </Text>
                    <View style={[styles.bookingStatus, styles[`${booking.status}Status`]]}>
                      <Text style={styles.bookingStatusText}>
                        {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.bookingDetails}>
                    <View style={styles.bookingDetail}>
                      <Icon name="person" size={16} color="#673AB7" />
                      <Text style={styles.bookingDetailText}>
                        {booking.user ? booking.user.name : 'User'}
                      </Text>
                    </View>
                    
                    <View style={styles.bookingDetail}>
                      <Icon name="schedule" size={16} color="#673AB7" />
                      <Text style={styles.bookingDetailText}>
                        {booking.scheduledAt ? formatDate(booking.scheduledAt) : 'Instant Request'}
                      </Text>
                    </View>
                    
                    <View style={styles.bookingDetail}>
                      <Icon name="payments" size={16} color="#673AB7" />
                      <Text style={styles.bookingDetailText}>
                        {formatCurrency(booking.rate)} / minute
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
              
              <TouchableOpacity
                style={styles.viewMoreButton}
                onPress={() => navigation.navigate('BookingsList')}
              >
                <Text style={styles.viewMoreText}>View All Bookings</Text>
                <Icon name="chevron-right" size={20} color="#4CAF50" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
      </View>
      
      {/* Rejoin Chat Bottom Sheet */}
      <RejoinChatBottomSheet
        visible={showRejoinBottomSheet}
        onClose={handleBottomSheetClose}
        sessionData={activeSessionData}
        onRejoinPress={handleRejoinChat}
        remainingTime={remainingTime}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
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
    color: '#4CAF50',
  },
  statusSection: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    marginBottom: 8,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212121',
  },
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  onlineIndicator: {
    backgroundColor: '#4CAF50',
  },
  offlineIndicator: {
    backgroundColor: '#9E9E9E',
  },
  statusText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#212121',
  },
  statusDescription: {
    fontSize: 14,
    color: '#757575',
    lineHeight: 20,
  },
  earningsSection: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212121',
    marginBottom: 16,
  },
  earningsCards: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  earningsCard: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  earningsLabel: {
    fontSize: 14,
    color: '#757575',
    marginBottom: 8,
  },
  earningsAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  viewMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  viewMoreText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
    marginRight: 4,
  },
  bookingsSection: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    marginBottom: 20,
  },
  emptyBookings: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  emptyBookingsText: {
    marginTop: 16,
    fontSize: 16,
    color: '#9E9E9E',
  },
  bookingCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  bookingType: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#212121',
  },
  bookingStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  pendingStatus: {
    backgroundColor: '#FFF9C4',
  },
  acceptedStatus: {
    backgroundColor: '#C8E6C9',
  },
  bookingStatusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  bookingDetails: {
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingTop: 12,
  },
  bookingDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  bookingDetailText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#757575',
  },
});

export default AstrologerDashboardScreen;
