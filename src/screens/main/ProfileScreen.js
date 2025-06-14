import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import {
  sendNewBookingNotification,
  sendSessionReminderNotification,
  sendPaymentReceivedNotification,
  sendNewRatingNotification,
  runAllNotificationTests
} from '../../utils/notificationTester';

const ProfileScreen = () => {
  const { user, logout, updateStatus } = useAuth();
  const { sendTestNotification } = useNotification();
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Format rating value to handle both number and object formats
  const formatRating = (rating) => {
    if (rating === undefined || rating === null) return 4.8; // Default value
    if (typeof rating === 'number') return rating;
    if (typeof rating === 'object' && rating.average !== undefined) return rating.average;
    return 4.8; // Fallback
  };

  // Dummy user data
  const astrologer = {
    name: user?.displayName || user?.name || 'Pandit Sharma',
    email: user?.email || 'pandit.sharma@example.com',
    phone: user?.mobile || '+91 9876543210',
    specialization: user?.specialization || 'Vedic Astrology, Palmistry',
    experience: user?.experience ? `${user.experience} years` : '15 years',
    languages: user?.languages ? user.languages.join(', ') : 'Hindi, English, Sanskrit',
    rating: formatRating(user?.rating),
    totalConsultations: 256,
    totalReviews: 198,
    walletBalance: user?.wallet?.balance || 12500,
    profileImage: user?.imageUrl || 'https://via.placeholder.com/150',
    online: user?.status === 'online' || false,
  };

  const handleStatusChange = async (value) => {
    setStatusLoading(true);
    
    const result = await updateStatus(value ? 'online' : 'offline');
    
    if (!result.success) {
      Alert.alert('Error', result.message || 'Failed to update status. Please try again.');
      setStatusLoading(false);
      return;
    }
    
    setStatusLoading(false);
  };

  const handleLogout = async () => {
    setLoading(true);
    await logout();
    setLoading(false);
    setShowLogoutConfirm(false);
  };

  const handleTestNotification = async () => {
    const result = await sendTestNotification();
    
    if (result.success) {
      Alert.alert('Success', 'Test notification sent successfully!');
    } else {
      Alert.alert('Error', result.message || 'Failed to send test notification.');
    }
  };

  const handleNewBookingTest = async () => {
    const result = await sendNewBookingNotification();
    if (result.success) {
      Alert.alert('Success', 'New booking notification sent!');
    } else {
      Alert.alert('Error', result.message || 'Failed to send notification.');
    }
  };

  const handleSessionReminderTest = async () => {
    const result = await sendSessionReminderNotification();
    if (result.success) {
      Alert.alert('Success', 'Session reminder notification sent!');
    } else {
      Alert.alert('Error', result.message || 'Failed to send notification.');
    }
  };

  const handlePaymentReceivedTest = async () => {
    const result = await sendPaymentReceivedNotification();
    if (result.success) {
      Alert.alert('Success', 'Payment received notification sent!');
    } else {
      Alert.alert('Error', result.message || 'Failed to send notification.');
    }
  };

  const handleNewRatingTest = async () => {
    const result = await sendNewRatingNotification();
    if (result.success) {
      Alert.alert('Success', 'New rating notification sent!');
    } else {
      Alert.alert('Error', result.message || 'Failed to send notification.');
    }
  };

  const handleRunAllTests = async () => {
    Alert.alert(
      'Run All Tests',
      'This will send multiple notifications in sequence. Continue?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Run Tests',
          onPress: async () => {
            const results = await runAllNotificationTests();
            const successful = results.filter(r => r.success).length;
            Alert.alert(
              'Test Results',
              `${successful} of ${results.length} notification tests completed successfully.`
            );
          }
        }
      ]
    );
  };

  const renderMenuItem = (icon, title, onPress, showArrow = true, rightElement = null) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <View style={styles.menuItemLeft}>
        <Ionicons name={icon} size={22} color="#8A2BE2" style={styles.menuIcon} />
        <Text style={styles.menuText}>{title}</Text>
      </View>
      {rightElement || (showArrow && <Ionicons name="chevron-forward" size={20} color="#ccc" />)}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Profile</Text>
      </View>
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.profileCard}>
          <Image source={{ uri: astrologer.profileImage }} style={styles.profileImage} />
          <Text style={styles.name}>{astrologer.name}</Text>
          <Text style={styles.specialization}>{astrologer.specialization}</Text>
          
          <View style={styles.statusContainer}>
            <Text style={styles.statusLabel}>
              {astrologer.online ? 'Online' : 'Offline'}
            </Text>
            <Switch
              value={astrologer.online}
              onValueChange={handleStatusChange}
              disabled={statusLoading}
              trackColor={{ false: '#ccc', true: '#8A2BE2' }}
              thumbColor="#fff"
            />
          </View>
          
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>₹{astrologer.walletBalance}</Text>
              <Text style={styles.statLabel}>Earnings</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{astrologer.totalConsultations}</Text>
              <Text style={styles.statLabel}>Consultations</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{astrologer.rating}</Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
          </View>
        </View>
        
        <View style={styles.sectionTitle}>
          <Text style={styles.sectionTitleText}>Personal Information</Text>
        </View>
        
        <View style={styles.infoCard}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{astrologer.email}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Phone</Text>
            <Text style={styles.infoValue}>{astrologer.phone}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Experience</Text>
            <Text style={styles.infoValue}>{astrologer.experience}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Languages</Text>
            <Text style={styles.infoValue}>{astrologer.languages}</Text>
          </View>
        </View>
        
        <View style={styles.sectionTitle}>
          <Text style={styles.sectionTitleText}>Account Settings</Text>
        </View>
        
        <View style={styles.menuCard}>
          {renderMenuItem('person-outline', 'Edit Profile', () => {})}
          {renderMenuItem('calendar-outline', 'Manage Availability', () => navigation.navigate('Availability'))}
          {renderMenuItem('notifications-outline', 'Notifications', () => {}, true, (
            <Switch
              value={true}
              onValueChange={() => {}}
              trackColor={{ false: '#ccc', true: '#8A2BE2' }}
              thumbColor="#fff"
            />
          ))}
          {renderMenuItem('card-outline', 'Bank Account Details', () => {})}
          {renderMenuItem('help-circle-outline', 'Help & Support', () => {})}
          {renderMenuItem('document-text-outline', 'Terms of Service', () => {})}
          {renderMenuItem('shield-outline', 'Privacy Policy', () => {})}
          {renderMenuItem('log-out-outline', 'Logout', () => setShowLogoutConfirm(true), false)}
        </View>
        
        <View style={styles.sectionTitle}>
          <Text style={styles.sectionTitleText}>Notification Testing</Text>
        </View>
        
        <View style={styles.menuCard}>
          {renderMenuItem('notifications-outline', 'Test Basic Notification', handleTestNotification)}
          {renderMenuItem('calendar-outline', 'Test New Booking', handleNewBookingTest)}
          {renderMenuItem('time-outline', 'Test Session Reminder', handleSessionReminderTest)}
          {renderMenuItem('cash-outline', 'Test Payment Received', handlePaymentReceivedTest)}
          {renderMenuItem('star-outline', 'Test New Rating', handleNewRatingTest)}
          {renderMenuItem('rocket-outline', 'Run All Tests', handleRunAllTests)}
        </View>
        
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>Version 1.0.0</Text>
        </View>
      </ScrollView>
      
      {/* Logout Confirmation Modal */}
      <Modal
        visible={showLogoutConfirm}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Logout</Text>
            <Text style={styles.modalText}>Are you sure you want to logout?</Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowLogoutConfirm(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.logoutButton]}
                onPress={handleLogout}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.logoutButtonText}>Logout</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  profileCard: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginTop: -10,
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 15,
  },
  name: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  specialization: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingVertical: 5,
    paddingHorizontal: 15,
    borderRadius: 20,
    marginBottom: 20,
  },
  statusLabel: {
    marginRight: 10,
    fontWeight: 'bold',
  },
  statsContainer: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-around',
    paddingVertical: 10,
  },
  statItem: {
    alignItems: 'center',
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
  statDivider: {
    width: 1,
    backgroundColor: '#eee',
  },
  sectionTitle: {
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  sectionTitleText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  infoCard: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    borderRadius: 10,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  infoItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  menuCard: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIcon: {
    marginRight: 15,
  },
  menuText: {
    fontSize: 14,
    fontWeight: '500',
  },
  versionContainer: {
    alignItems: 'center',
    padding: 20,
  },
  versionText: {
    fontSize: 12,
    color: '#999',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  modalText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: 'bold',
  },
  logoutButton: {
    backgroundColor: '#8A2BE2',
  },
  logoutButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default ProfileScreen;
