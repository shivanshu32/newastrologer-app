import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const RatingScreen = ({ route, navigation }) => {
  const { bookingId, sessionDuration, charges } = route.params || {};
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [rating, setRating] = useState(0);
  
  useEffect(() => {
    // In a real app, you might want to fetch additional booking details
    // if they weren't passed through navigation params
  }, []);

  const handleRatingSelect = (value) => {
    setRating(value);
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      
      // In a real app, this would call your backend API
      // await axios.post(`${API_URL}/bookings/${bookingId}/complete`, {
      //   sessionDuration,
      //   charges,
      // });
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setSubmitting(false);
      
      // Show success message
      Alert.alert(
        'Session Completed',
        'The consultation session has been completed successfully.',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('BookingsMain'),
          },
        ]
      );
    } catch (error) {
      console.log('Error completing session:', error);
      setSubmitting(false);
      Alert.alert('Error', 'Failed to complete session. Please try again.');
    }
  };

  const handleSkip = () => {
    navigation.navigate('BookingsMain');
  };

  const getRatingLabel = () => {
    switch (rating) {
      case 1:
        return 'Poor';
      case 2:
        return 'Fair';
      case 3:
        return 'Good';
      case 4:
        return 'Very Good';
      case 5:
        return 'Excellent';
      default:
        return '';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Session Complete</Text>
      </View>
      
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.sessionSummary}>
          <Text style={styles.summaryTitle}>Session Summary</Text>
          
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Duration</Text>
            <Text style={styles.summaryValue}>{sessionDuration} minutes</Text>
          </View>
          
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Earnings</Text>
            <Text style={styles.summaryValue}>₹{charges}</Text>
          </View>
        </View>
        
        <View style={styles.ratingContainer}>
          <Text style={styles.ratingTitle}>
            Your session has been completed successfully
          </Text>
          <Text style={styles.ratingSubtitle}>
            The user may leave you a rating and review
          </Text>
          
          <View style={styles.starsContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                style={styles.starButton}
                disabled={true}
              >
                <Ionicons
                  name="star"
                  size={40}
                  color="#ccc"
                />
              </TouchableOpacity>
            ))}
          </View>
          
          <Text style={styles.ratingInfo}>
            User ratings help improve your profile visibility
          </Text>
        </View>
        
        <TouchableOpacity
          style={styles.submitButton}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Complete Session</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
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
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    padding: 20,
  },
  sessionSummary: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  ratingContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  ratingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
    textAlign: 'center',
  },
  ratingSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  starButton: {
    padding: 5,
  },
  ratingLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F97316',
    marginTop: 10,
    marginBottom: 20,
  },
  ratingInfo: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  submitButton: {
    backgroundColor: '#F97316',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  skipButton: {
    paddingVertical: 15,
    alignItems: 'center',
  },
  skipButtonText: {
    color: '#666',
    fontSize: 14,
  },
});

export default RatingScreen;
