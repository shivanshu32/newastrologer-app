import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TIME_SLOTS = [
  '09:00 AM - 12:00 PM',
  '12:00 PM - 03:00 PM',
  '03:00 PM - 06:00 PM',
  '06:00 PM - 09:00 PM',
  '09:00 PM - 12:00 AM',
];

const AvailabilityScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [availability, setAvailability] = useState({});
  const { user } = useAuth();

  useEffect(() => {
    fetchAvailability();
  }, []);

  const fetchAvailability = async () => {
    try {
      // In a real app, this would call your backend API
      // const response = await axios.get(`${API_URL}/astrologer/availability`);
      // setAvailability(response.data);
      
      // Simulate API call with dummy data
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Generate dummy availability data
      const dummyAvailability = {};
      DAYS.forEach(day => {
        dummyAvailability[day] = {};
        TIME_SLOTS.forEach(slot => {
          // Randomly set some slots as available
          dummyAvailability[day][slot] = Math.random() > 0.5;
        });
      });
      
      setAvailability(dummyAvailability);
      setLoading(false);
    } catch (error) {
      console.log('Error fetching availability:', error);
      setLoading(false);
      Alert.alert('Error', 'Failed to load availability data. Please try again.');
    }
  };

  const handleToggleSlot = (day, slot) => {
    setAvailability(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [slot]: !prev[day][slot],
      },
    }));
  };

  const handleToggleDay = (day) => {
    const isAllAvailable = Object.values(availability[day]).every(Boolean);
    
    setAvailability(prev => ({
      ...prev,
      [day]: Object.keys(prev[day]).reduce((acc, slot) => {
        acc[slot] = !isAllAvailable;
        return acc;
      }, {}),
    }));
  };

  const handleSaveAvailability = async () => {
    try {
      setSaving(true);
      
      // In a real app, this would call your backend API
      // await axios.post(`${API_URL}/astrologer/availability`, availability);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setSaving(false);
      Alert.alert('Success', 'Your availability has been updated successfully.');
    } catch (error) {
      console.log('Error saving availability:', error);
      setSaving(false);
      Alert.alert('Error', 'Failed to save availability. Please try again.');
    }
  };

  const isDayAvailable = (day) => {
    return Object.values(availability[day] || {}).some(Boolean);
  };

  const renderTimeSlot = (day, slot) => {
    const isAvailable = availability[day]?.[slot] || false;
    
    return (
      <View key={slot} style={styles.slotContainer}>
        <Text style={styles.slotText}>{slot}</Text>
        <Switch
          value={isAvailable}
          onValueChange={() => handleToggleSlot(day, slot)}
          trackColor={{ false: '#ccc', true: '#8A2BE2' }}
          thumbColor="#fff"
        />
      </View>
    );
  };

  const renderDay = (day) => {
    return (
      <View key={day} style={styles.dayContainer}>
        <View style={styles.dayHeader}>
          <Text style={styles.dayTitle}>{day}</Text>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              isDayAvailable(day) ? styles.toggleButtonActive : {},
            ]}
            onPress={() => handleToggleDay(day)}
          >
            <Text style={[
              styles.toggleButtonText,
              isDayAvailable(day) ? styles.toggleButtonTextActive : {},
            ]}>
              {isDayAvailable(day) ? 'Available' : 'Unavailable'}
            </Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.slotsContainer}>
          {TIME_SLOTS.map(slot => renderTimeSlot(day, slot))}
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
        <>
          <ScrollView style={styles.content}>
            <Text style={styles.subtitle}>
              Set your weekly availability for consultations
            </Text>
            
            {DAYS.map(day => renderDay(day))}
            
            <View style={styles.spacer} />
          </ScrollView>
          
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSaveAvailability}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Save Availability</Text>
              )}
            </TouchableOpacity>
          </View>
        </>
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
    marginBottom: 20,
  },
  dayContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 15,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dayTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  toggleButton: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 15,
    backgroundColor: '#f0f0f0',
  },
  toggleButtonActive: {
    backgroundColor: '#e6fff0',
  },
  toggleButtonText: {
    fontSize: 12,
    color: '#666',
  },
  toggleButtonTextActive: {
    color: '#00a854',
    fontWeight: 'bold',
  },
  slotsContainer: {
    marginLeft: 10,
  },
  slotContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  slotText: {
    fontSize: 14,
    color: '#333',
  },
  spacer: {
    height: 80,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  saveButton: {
    backgroundColor: '#8A2BE2',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default AvailabilityScreen;
