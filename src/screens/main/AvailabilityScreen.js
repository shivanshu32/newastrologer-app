import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
  ToastAndroid,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';

const AvailabilityScreen = ({ navigation }) => {
  const { user, userToken } = useAuth();
  const { socket } = useSocket();
  const [chatAvailable, setChatAvailable] = useState(false);
  const [callAvailable, setCallAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState({ chat: false, call: false });

  useEffect(() => {
    loadOnlineStatus();
  }, []);

  const loadOnlineStatus = async () => {
    try {
      setLoading(true);
      
      // Fetch current online status from backend
      const response = await axios.get(
        'http://localhost:5000/api/v1/astrologers/profile',
        {
          headers: { Authorization: `Bearer ${userToken}` }
        }
      );
      
      if (response.data.success && response.data.astrologer.onlineStatus) {
        const { chat, call } = response.data.astrologer.onlineStatus;
        setChatAvailable(chat === 1);
        setCallAvailable(call === 1);
      } else {
        // Default to offline if no onlineStatus found
        setChatAvailable(false);
        setCallAvailable(false);
      }
    } catch (error) {
      console.error('Error loading online status:', error);
      showToast('Failed to load availability status');
      // Set defaults on error
      setChatAvailable(false);
      setCallAvailable(false);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    } else {
      Alert.alert('Info', message);
    }
  };

  const updateAvailabilityStatus = async (type, value) => {
    try {
      setUpdating(prev => ({ ...prev, [type]: true }));
      
      // Optimistically update UI
      if (type === 'chat') {
        setChatAvailable(value);
      } else {
        setCallAvailable(value);
      }
      
      // Prepare the onlineStatus object
      const onlineStatus = {
        chat: type === 'chat' ? (value ? 1 : 0) : (chatAvailable ? 1 : 0),
        call: type === 'call' ? (value ? 1 : 0) : (callAvailable ? 1 : 0)
      };
      
      // Update backend via API
      const response = await axios.put(
        'http://localhost:5000/api/v1/astrologers/update-online-status',
        { onlineStatus },
        {
          headers: { Authorization: `Bearer ${userToken}` }
        }
      );
      
      if (response.data.success) {
        // Emit socket event for real-time sync
        if (socket && socket.connected) {
          socket.emit('astrologer_availability_updated', {
            astrologerId: user.id,
            onlineStatus
          });
        }
        
        // Show success toast
        const statusText = value ? 'enabled' : 'disabled';
        const serviceText = type === 'chat' ? 'Chat' : 'Call';
        showToast(`${serviceText} availability ${statusText}`);
      } else {
        throw new Error(response.data.message || 'Failed to update status');
      }
    } catch (error) {
      console.error(`Error updating ${type} availability:`, error);
      
      // Revert optimistic update on error
      if (type === 'chat') {
        setChatAvailable(!value);
      } else {
        setCallAvailable(!value);
      }
      
      showToast(`Failed to update ${type} availability`);
    } finally {
      setUpdating(prev => ({ ...prev, [type]: false }));
    }
  };

  const handleChatToggle = (value) => {
    if (updating.chat) return; // Prevent rapid toggling
    updateAvailabilityStatus('chat', value);
  };

  const handleCallToggle = (value) => {
    if (updating.call) return; // Prevent rapid toggling
    updateAvailabilityStatus('call', value);
  };

  const renderAvailabilityToggle = (type, title, description, value, onToggle, isUpdating) => {
    return (
      <View style={styles.toggleContainer}>
        <View style={styles.toggleHeader}>
          <View style={styles.toggleInfo}>
            <Text style={styles.toggleTitle}>{title}</Text>
            <Text style={styles.toggleDescription}>{description}</Text>
          </View>
          <View style={styles.toggleSwitchContainer}>
            {isUpdating ? (
              <ActivityIndicator size="small" color="#8A2BE2" style={styles.toggleLoader} />
            ) : (
              <Switch
                value={value}
                onValueChange={onToggle}
                trackColor={{ false: '#E5E5E5', true: '#8A2BE2' }}
                thumbColor={value ? '#FFFFFF' : '#FFFFFF'}
                ios_backgroundColor="#E5E5E5"
                disabled={isUpdating}
              />
            )}
          </View>
        </View>
        <View style={styles.toggleStatus}>
          <View style={[
            styles.statusIndicator,
            { backgroundColor: value ? '#4CAF50' : '#F44336' }
          ]} />
          <Text style={[
            styles.statusText,
            { color: value ? '#4CAF50' : '#F44336' }
          ]}>
            {value ? 'Available' : 'Unavailable'}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manage Availability</Text>
      </View>
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8A2BE2" />
          <Text style={styles.loadingText}>Loading availability...</Text>
        </View>
      ) : (
        <View style={styles.content}>
          <Text style={styles.subtitle}>
            Control your availability for consultations in real-time
          </Text>
          
          <View style={styles.togglesContainer}>
            {renderAvailabilityToggle(
              'chat',
              'Chat Consultations',
              'Accept text-based consultation requests',
              chatAvailable,
              handleChatToggle,
              updating.chat
            )}
            
            {renderAvailabilityToggle(
              'call',
              'Voice/Video Calls',
              'Accept voice and video call requests',
              callAvailable,
              handleCallToggle,
              updating.call
            )}
          </View>
          
          <View style={styles.infoContainer}>
            <View style={styles.infoHeader}>
              <Ionicons name="information-circle" size={20} color="#8A2BE2" />
              <Text style={styles.infoTitle}>How it works</Text>
            </View>
            <Text style={styles.infoText}>
              • Toggle availability in real-time{"\n"}
              • Users see your status instantly{"\n"}
              • Only available services show booking options{"\n"}
              • Changes sync across all devices
            </Text>
          </View>
        </View>
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
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 15,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
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
  content: {
    flex: 1,
    padding: 20,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
  },
  togglesContainer: {
    marginBottom: 30,
  },
  toggleContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  toggleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  toggleInfo: {
    flex: 1,
    marginRight: 15,
  },
  toggleTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  toggleDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  toggleSwitchContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleLoader: {
    width: 51,
    height: 31,
  },
  toggleStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  infoContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#8A2BE2',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#8A2BE2',
    marginLeft: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
  },
});

export default AvailabilityScreen;
