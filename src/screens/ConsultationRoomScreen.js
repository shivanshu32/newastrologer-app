import React from 'react';
import { View, StyleSheet, BackHandler, Alert, SafeAreaView } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import ConsultationRoom from '../components/ConsultationRoom';

/**
 * Screen that hosts the consultation room component for astrologers
 * This screen handles navigation and back button behavior
 */
const ConsultationRoomScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  
  // Extract params from route
  const { booking, roomId, sessionId } = route.params || {};

  // Handle session end
  const handleSessionEnd = (data) => {
    console.log('Session ended:', data);
    
    // Navigate to session summary or back to home
    navigation.navigate('SessionSummary', {
      sessionId: sessionId,
      bookingId: booking._id,
      userId: booking.user._id,
      duration: data.durationSeconds,
      earnings: data.earnings || 0
    });
  };

  // Handle hardware back button
  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        Alert.alert(
          'End Consultation',
          'Are you sure you want to leave this consultation? This will end your session.',
          [
            { text: 'Stay', style: 'cancel' },
            { 
              text: 'Leave', 
              style: 'destructive',
              onPress: () => {
                // This will trigger the onSessionEnd callback in ConsultationRoom
                // which will handle the proper cleanup
                navigation.goBack();
              }
            }
          ]
        );
        return true; // Prevent default behavior
      };

      // Add back button listener
      BackHandler.addEventListener('hardwareBackPress', onBackPress);

      return () => {
        // Remove back button listener on cleanup
        BackHandler.removeEventListener('hardwareBackPress', onBackPress);
      };
    }, [navigation])
  );

  // If missing required params, show error and go back
  if (!booking || !roomId || !sessionId) {
    Alert.alert(
      'Error',
      'Missing required information for consultation',
      [{ text: 'Go Back', onPress: () => navigation.goBack() }]
    );
    return null;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
      <ConsultationRoom
        booking={booking}
        roomId={roomId}
        sessionId={sessionId}
        onSessionEnd={handleSessionEnd}
      />
      </View>
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
});

export default ConsultationRoomScreen;
