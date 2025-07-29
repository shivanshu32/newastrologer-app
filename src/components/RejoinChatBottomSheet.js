import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  Alert,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const RejoinChatBottomSheet = ({ 
  visible, 
  onClose, 
  sessionData, 
  onRejoinPress,
  remainingTime 
}) => {
  const [slideAnim] = useState(new Animated.Value(SCREEN_HEIGHT));
  
  // Debug prop changes
  useEffect(() => {
    console.log('🔍 [REJOIN_BOTTOM_SHEET] Props changed:');
    console.log('🔍 [REJOIN_BOTTOM_SHEET] - visible:', visible);
    console.log('🔍 [REJOIN_BOTTOM_SHEET] - sessionData present:', !!sessionData);
    console.log('🔍 [REJOIN_BOTTOM_SHEET] - remainingTime:', remainingTime);
    if (sessionData) {
      console.log('🔍 [REJOIN_BOTTOM_SHEET] - sessionData.type:', sessionData.type);
      console.log('🔍 [REJOIN_BOTTOM_SHEET] - sessionData.user:', sessionData.user?.name);
    }
  }, [visible, sessionData, remainingTime]);

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    } else {
      Animated.spring(slideAnim, {
        toValue: SCREEN_HEIGHT,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    }
  }, [visible]);

  const formatTime = (seconds) => {
    if (!seconds || seconds <= 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getSessionTypeIcon = (type) => {
    switch (type) {
      case 'chat':
        return 'chatbubble-ellipses';
      case 'voice':
        return 'call';
      case 'video':
        return 'videocam';
      default:
        return 'chatbubble-ellipses';
    }
  };

  const getSessionTypeText = (type) => {
    switch (type) {
      case 'chat':
        return 'Chat Consultation';
      case 'voice':
        return 'Voice Consultation';
      case 'video':
        return 'Video Consultation';
      default:
        return 'Consultation';
    }
  };

  const handleRejoin = () => {
    if (!sessionData) {
      Alert.alert('Error', 'Session data not available');
      return;
    }

    // Check if session is still valid
    if (remainingTime !== null && remainingTime <= 0) {
      Alert.alert(
        'Session Expired',
        'This session has already ended. You cannot rejoin.',
        [{ text: 'OK', onPress: onClose }]
      );
      return;
    }

    onRejoinPress(sessionData);
  };

  console.log('🔍 [REJOIN_BOTTOM_SHEET] Render check - visible:', visible, 'sessionData:', !!sessionData);
  console.log('🔍 [REJOIN_BOTTOM_SHEET] SessionData details:', sessionData);
  
  if (!visible || !sessionData) {
    console.log('🔍 [REJOIN_BOTTOM_SHEET] Not rendering - visible:', visible, 'sessionData present:', !!sessionData);
    return null;
  }
  
  console.log('🔍 [REJOIN_BOTTOM_SHEET] Rendering bottom sheet with session:', sessionData.sessionId || sessionData.sessionIdentifier);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity 
          style={styles.backdrop} 
          activeOpacity={1} 
          onPress={onClose}
        />
        
        <Animated.View 
          style={[
            styles.bottomSheet,
            {
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          {/* Handle Bar */}
          <View style={styles.handleBar} />
          
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconContainer}>
                <Ionicons 
                  name={getSessionTypeIcon(sessionData.type)} 
                  size={24} 
                  color="#7C3AED" 
                />
              </View>
              <View>
                <Text style={styles.title}>Active Session</Text>
                <Text style={styles.subtitle}>
                  {getSessionTypeText(sessionData.type)}
                </Text>
              </View>
            </View>
            
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Session Info */}
          <View style={styles.sessionInfo}>
            <Text style={styles.messageText}>
              You have an active consultation session in progress
            </Text>
            
            {/* User Info */}
            <View style={styles.userInfo}>
              <View style={styles.userAvatar}>
                <Ionicons name="person" size={20} color="#7C3AED" />
              </View>
              <Text style={styles.userName}>
                with {sessionData.user?.name || 'User'}
              </Text>
            </View>

            {/* Timer for Free Chat */}
            {sessionData.isFreeChat && remainingTime !== null && (
              <View style={styles.timerContainer}>
                <MaterialIcons name="timer" size={20} color="#F59E0B" />
                <Text style={styles.timerText}>
                  Time remaining: {formatTime(remainingTime)}
                </Text>
              </View>
            )}

            {/* Session Status */}
            <View style={styles.statusContainer}>
              <View style={[
                styles.statusDot, 
                { backgroundColor: sessionData.status === 'connected' ? '#10B981' : '#F59E0B' }
              ]} />
              <Text style={styles.statusText}>
                {sessionData.status === 'connected' ? 'Connected' : 'Waiting to connect'}
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity 
              style={styles.dismissButton} 
              onPress={onClose}
            >
              <Text style={styles.dismissText}>Dismiss</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.rejoinButton} 
              onPress={handleRejoin}
            >
              <LinearGradient
                colors={['#7C3AED', '#6D28D9']}
                style={styles.rejoinGradient}
              >
                <Ionicons name="arrow-forward" size={20} color="#fff" />
                <Text style={styles.rejoinText}>Rejoin Session</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  bottomSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 34, // Safe area padding
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 12,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionInfo: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  messageText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 24,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  userName: {
    fontSize: 16,
    color: '#7C3AED',
    fontWeight: '600',
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  timerText: {
    fontSize: 14,
    color: '#92400E',
    fontWeight: '600',
    marginLeft: 6,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  dismissButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  rejoinButton: {
    flex: 2,
    borderRadius: 12,
    overflow: 'hidden',
  },
  rejoinGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 8,
  },
  rejoinText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});

export default RejoinChatBottomSheet;
