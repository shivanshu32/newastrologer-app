import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const BookingsScreen = ({ navigation }) => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('upcoming');

  useEffect(() => {
    fetchBookings();
  }, [activeTab]);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      
      // In a real app, this would call your backend API
      // const response = await axios.get(`${API_URL}/astrologer/bookings?status=${activeTab}`);
      // setBookings(response.data);
      
      // Simulate API call with dummy data
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      let dummyBookings = [];
      
      if (activeTab === 'upcoming') {
        dummyBookings = [
          {
            id: '1',
            userId: '101',
            userName: 'Rahul Sharma',
            userImage: 'https://via.placeholder.com/100',
            type: 'chat',
            status: 'confirmed',
            scheduledTime: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
            duration: 30,
            amount: 500,
          },
          {
            id: '2',
            userId: '102',
            userName: 'Priya Patel',
            userImage: 'https://via.placeholder.com/100',
            type: 'video',
            status: 'confirmed',
            scheduledTime: new Date(Date.now() + 7200000).toISOString(), // 2 hours from now
            duration: 15,
            amount: 750,
          },
        ];
      } else if (activeTab === 'completed') {
        dummyBookings = [
          {
            id: '3',
            userId: '103',
            userName: 'Amit Kumar',
            userImage: 'https://via.placeholder.com/100',
            type: 'chat',
            status: 'completed',
            scheduledTime: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
            actualDuration: 25,
            amount: 400,
            rating: 4.5,
          },
          {
            id: '4',
            userId: '104',
            userName: 'Neha Singh',
            userImage: 'https://via.placeholder.com/100',
            type: 'video',
            status: 'completed',
            scheduledTime: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
            actualDuration: 18,
            amount: 900,
            rating: 5,
          },
        ];
      } else if (activeTab === 'cancelled') {
        dummyBookings = [
          {
            id: '5',
            userId: '105',
            userName: 'Vikram Malhotra',
            userImage: 'https://via.placeholder.com/100',
            type: 'chat',
            status: 'cancelled',
            scheduledTime: new Date(Date.now() - 259200000).toISOString(), // 3 days ago
            cancellationReason: 'User cancelled the booking',
          },
        ];
      }
      
      setBookings(dummyBookings);
      setLoading(false);
    } catch (error) {
      console.log('Error fetching bookings:', error);
      setLoading(false);
    }
  };

  const handleStartSession = (booking) => {
    if (booking.type === 'chat') {
      navigation.navigate('Chat', { bookingId: booking.id });
    } else if (booking.type === 'video') {
      navigation.navigate('VideoCall', { bookingId: booking.id });
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getStatusBadge = (status) => {
    let backgroundColor, textColor, label;
    
    switch (status) {
      case 'confirmed':
        backgroundColor = '#e6f7ff';
        textColor = '#0070f3';
        label = 'Confirmed';
        break;
      case 'completed':
        backgroundColor = '#e6fff0';
        textColor = '#00a854';
        label = 'Completed';
        break;
      case 'cancelled':
        backgroundColor = '#fff1f0';
        textColor = '#f5222d';
        label = 'Cancelled';
        break;
      default:
        backgroundColor = '#f0f0f0';
        textColor = '#666';
        label = status.charAt(0).toUpperCase() + status.slice(1);
    }
    
    return (
      <View style={[styles.statusBadge, { backgroundColor }]}>
        <Text style={[styles.statusText, { color: textColor }]}>{label}</Text>
      </View>
    );
  };

  const renderBookingItem = ({ item }) => {
    const isUpcoming = activeTab === 'upcoming';
    const scheduledDate = new Date(item.scheduledTime);
    const now = new Date();
    const canStartSession = isUpcoming && (scheduledDate <= now || scheduledDate - now < 300000); // Can start if scheduled time is now or within 5 minutes
    
    return (
      <View style={styles.bookingCard}>
        <View style={styles.bookingHeader}>
          <View style={styles.userInfo}>
            <Image source={{ uri: item.userImage }} style={styles.userImage} />
            <View>
              <Text style={styles.userName}>{item.userName}</Text>
              <View style={styles.bookingType}>
                <Ionicons
                  name={item.type === 'chat' ? 'chatbubble-outline' : 'videocam-outline'}
                  size={14}
                  color="#666"
                />
                <Text style={styles.bookingTypeText}>
                  {item.type.charAt(0).toUpperCase() + item.type.slice(1)} Consultation
                </Text>
              </View>
            </View>
          </View>
          {getStatusBadge(item.status)}
        </View>
        
        <View style={styles.bookingDetails}>
          <View style={styles.detailItem}>
            <Ionicons name="calendar-outline" size={16} color="#666" />
            <Text style={styles.detailText}>{formatDate(item.scheduledTime)}</Text>
          </View>
          <View style={styles.detailItem}>
            <Ionicons name="time-outline" size={16} color="#666" />
            <Text style={styles.detailText}>{formatTime(item.scheduledTime)}</Text>
          </View>
          {item.duration && (
            <View style={styles.detailItem}>
              <Ionicons name="hourglass-outline" size={16} color="#666" />
              <Text style={styles.detailText}>{item.duration} min</Text>
            </View>
          )}
          {item.actualDuration && (
            <View style={styles.detailItem}>
              <Ionicons name="hourglass-outline" size={16} color="#666" />
              <Text style={styles.detailText}>{item.actualDuration} min (actual)</Text>
            </View>
          )}
          {item.amount && (
            <View style={styles.detailItem}>
              <Ionicons name="cash-outline" size={16} color="#666" />
              <Text style={styles.detailText}>₹{item.amount}</Text>
            </View>
          )}
          {item.rating && (
            <View style={styles.detailItem}>
              <Ionicons name="star" size={16} color="#FFD700" />
              <Text style={styles.detailText}>{item.rating}</Text>
            </View>
          )}
          {item.cancellationReason && (
            <View style={styles.detailItem}>
              <Ionicons name="information-circle-outline" size={16} color="#f5222d" />
              <Text style={[styles.detailText, { color: '#f5222d' }]}>
                {item.cancellationReason}
              </Text>
            </View>
          )}
        </View>
        
        {isUpcoming && (
          <TouchableOpacity
            style={[
              styles.startButton,
              !canStartSession && styles.startButtonDisabled,
            ]}
            onPress={() => handleStartSession(item)}
            disabled={!canStartSession}
          >
            <Text style={[
              styles.startButtonText,
              !canStartSession && styles.startButtonTextDisabled,
            ]}>
              {canStartSession ? 'Start Session' : 'Session Not Ready'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="calendar-outline" size={60} color="#ccc" />
      <Text style={styles.emptyText}>No bookings found</Text>
      <Text style={styles.emptySubtext}>
        {activeTab === 'upcoming'
          ? 'You have no upcoming bookings'
          : activeTab === 'completed'
          ? 'You have no completed consultations yet'
          : 'You have no cancelled bookings'}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Bookings</Text>
      </View>
      
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'upcoming' && styles.activeTab]}
          onPress={() => setActiveTab('upcoming')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'upcoming' && styles.activeTabText,
            ]}
          >
            Upcoming
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'completed' && styles.activeTab]}
          onPress={() => setActiveTab('completed')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'completed' && styles.activeTabText,
            ]}
          >
            Completed
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'cancelled' && styles.activeTab]}
          onPress={() => setActiveTab('cancelled')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'cancelled' && styles.activeTabText,
            ]}
          >
            Cancelled
          </Text>
        </TouchableOpacity>
      </View>
      
      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color="#8A2BE2" />
      ) : (
        <FlatList
          data={bookings}
          renderItem={renderBookingItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.bookingsList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyList}
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
    backgroundColor: '#8A2BE2',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginTop: -15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#8A2BE2',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
  },
  activeTabText: {
    color: '#8A2BE2',
    fontWeight: 'bold',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookingsList: {
    padding: 20,
    paddingTop: 30,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
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
  userImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
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
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  bookingDetails: {
    marginBottom: 15,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 10,
  },
  startButton: {
    backgroundColor: '#8A2BE2',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  startButtonDisabled: {
    backgroundColor: '#f0f0f0',
  },
  startButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  startButtonTextDisabled: {
    color: '#999',
  },
});

export default BookingsScreen;
