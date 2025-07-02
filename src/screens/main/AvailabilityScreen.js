import React, { useState, useEffect, useContext } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { SocketContext } from '../../context/SocketContext';
import api from '../../services/api';

const AvailabilityScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [consultationAvailability, setConsultationAvailability] = useState({
    chat: true,
    voiceCall: true,
  });
  
  const { user } = useAuth();
  const { socket } = useContext(SocketContext);

  useEffect(() => {
    fetchConsultationAvailability();
    
    // Set up socket event listeners for availability updates
    if (socket) {
      const handleAvailabilityUpdated = (data) => {
        console.log('Consultation availability updated confirmation:', data);
        if (data.success) {
          setSaving(false);
          // Update local state with confirmed data
          setConsultationAvailability(data.consultationAvailability);
        }
      };
      
      const handleError = (error) => {
        console.error('Socket error:', error);
        setSaving(false);
        Alert.alert('Error', error.message || 'Failed to update availability');
      };
      
      socket.on('consultation_availability_updated', handleAvailabilityUpdated);
      socket.on('error', handleError);
      
      // Cleanup listeners on unmount
      return () => {
        socket.off('consultation_availability_updated', handleAvailabilityUpdated);
        socket.off('error', handleError);
      };
    }
  }, [socket]);

  const fetchConsultationAvailability = async () => {
    try {
      setLoading(true);
      console.log('Fetching consultation availability for astrologer:', user?.id);
      
      // Get current astrologer data which includes consultationAvailability
      const response = await api.get(`/astrologers/${user.id}`);
      
      if (response.data.success && response.data.data.consultationAvailability) {
        setConsultationAvailability(response.data.data.consultationAvailability);
        console.log('Loaded consultation availability:', response.data.data.consultationAvailability);
      } else {
        // Default values if not set
        setConsultationAvailability({ chat: true, voiceCall: true });
        console.log('Using default consultation availability');
      }
    } catch (error) {
      console.log('Error fetching consultation availability:', error);
      Alert.alert('Error', 'Failed to load availability settings. Please try again.');
      // Use defaults on error
      setConsultationAvailability({ chat: true, voiceCall: true });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleConsultation = async (type) => {
    if (saving) return; // Prevent multiple simultaneous updates
    
    const newValue = !consultationAvailability[type];
    
    // Optimistically update UI
    setConsultationAvailability(prev => ({
      ...prev,
      [type]: newValue
    }));

    try {
      setSaving(true);
      console.log(`Toggling ${type} consultation to:`, newValue);
      
      const updatedAvailability = {
        ...consultationAvailability,
        [type]: newValue
      };

      // Use socket-first approach for real-time sync
      if (socket) {
        socket.emit('consultation_availability_changed', {
          astrologerId: user.id,
          consultationAvailability: updatedAvailability
        });
        console.log('Emitted consultation availability change event to socket');
        
        // Show success feedback (saving state will be cleared by socket response)
        Alert.alert(
          'Updated', 
          `${type === 'chat' ? 'Chat' : 'Voice Call'} consultation ${newValue ? 'enabled' : 'disabled'} successfully.`
        );
      } else {
        // Fallback to API if socket not available
        const response = await api.put('/astrologers/consultation-availability', updatedAvailability);
        
        if (response.data.success) {
          console.log('Successfully updated consultation availability via API:', response.data.data);
          setSaving(false);
          
          Alert.alert(
            'Updated', 
            `${type === 'chat' ? 'Chat' : 'Voice Call'} consultation ${newValue ? 'enabled' : 'disabled'} successfully.`
          );
        } else {
          throw new Error('Failed to update availability');
        }
      }
    } catch (error) {
      console.log('Error updating consultation availability:', error);
      setSaving(false);
      
      // Revert optimistic update on error
      setConsultationAvailability(prev => ({
        ...prev,
        [type]: !newValue
      }));
      
      Alert.alert(
        'Error', 
        'Failed to update availability. Please try again.'
      );
    }
  };

  const renderConsultationToggle = (type, title, description, icon) => {
    const isEnabled = consultationAvailability[type];
    
    return (
      <View style={styles.consultationCard}>
        <View style={styles.consultationHeader}>
          <View style={styles.consultationIconContainer}>
            <Ionicons name={icon} size={24} color="#F97316" />
          </View>
          <View style={styles.consultationInfo}>
            <Text style={styles.consultationTitle}>{title}</Text>
            <Text style={styles.consultationDescription}>{description}</Text>
          </View>
          <Switch
            value={isEnabled}
            onValueChange={() => handleToggleConsultation(type)}
            trackColor={{ false: '#e5e5e5', true: '#fef3e2' }}
            thumbColor={isEnabled ? '#F97316' : '#f4f3f4'}
            ios_backgroundColor="#e5e5e5"
          />
        </View>
        
        <View style={[styles.statusIndicator, isEnabled ? styles.statusEnabled : styles.statusDisabled]}>
          <Text style={[styles.statusText, isEnabled ? styles.statusTextEnabled : styles.statusTextDisabled]}>
            {isEnabled ? 'Available for bookings' : 'Not accepting bookings'}
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
          <ActivityIndicator size="large" color="#F97316" />
          <Text style={styles.loadingText}>Loading availability settings...</Text>
        </View>
      ) : (
        <View style={styles.content}>
          <Text style={styles.subtitle}>
            Control which consultation types you want to offer to clients
          </Text>
          
          {renderConsultationToggle(
            'chat',
            'Chat Consultation',
            'Text-based consultations with clients',
            'chatbubble-ellipses'
          )}
          
          {renderConsultationToggle(
            'voiceCall',
            'Voice Call Consultation', 
            'Voice-based consultations with clients',
            'call'
          )}
          
          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <Ionicons name="information-circle" size={20} color="#F97316" />
              <Text style={styles.infoTitle}>How it works</Text>
            </View>
            <Text style={styles.infoText}>
              • When you disable a consultation type, clients won't see that option on your profile{"\n"}
              • Changes are applied immediately and sync across all platforms{"\n"}
              • You can enable/disable these anytime based on your availability
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
    backgroundColor: '#F97316',
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
  consultationCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  consultationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  consultationIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fef3e2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  consultationInfo: {
    flex: 1,
  },
  consultationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  consultationDescription: {
    fontSize: 14,
    color: '#666',
  },
  statusIndicator: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignItems: 'center',
  },
  statusEnabled: {
    backgroundColor: '#e6fff0',
  },
  statusDisabled: {
    backgroundColor: '#fef2f2',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusTextEnabled: {
    color: '#059669',
  },
  statusTextDisabled: {
    color: '#dc2626',
  },
  infoCard: {
    backgroundColor: '#fef3e2',
    borderRadius: 12,
    padding: 20,
    marginTop: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#F97316',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F97316',
    marginLeft: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#92400e',
    lineHeight: 20,
  },
});

export default AvailabilityScreen;
