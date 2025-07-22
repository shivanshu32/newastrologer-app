import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Switch,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Platform,
  Vibration
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNotification } from '../context/NotificationContext';
import * as Notifications from 'expo-notifications';

const EnhancedNotificationSettings = () => {
  const {
    permissionStatus,
    tokenStatus,
    lastTokenError,
    retryCount,
    requestPermissions,
    refreshPermissionStatus,
    retryTokenGeneration
  } = useNotification();

  const [isLoading, setIsLoading] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [vibrationEnabled, setVibrationEnabled] = useState(false);
  const [audioPermissionStatus, setAudioPermissionStatus] = useState('undetermined');
  const [sound, setSound] = useState(null);

  // Storage keys for settings
  const SOUND_ENABLED_KEY = '@notification_sound_enabled';
  const VIBRATION_ENABLED_KEY = '@notification_vibration_enabled';

  // Load settings from storage
  useEffect(() => {
    loadSettings();
    checkAudioPermissions();
    refreshPermissionStatus();
    
    // Cleanup sound on unmount
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, []);

  const loadSettings = async () => {
    try {
      const soundSetting = await AsyncStorage.getItem(SOUND_ENABLED_KEY);
      const vibrationSetting = await AsyncStorage.getItem(VIBRATION_ENABLED_KEY);
      
      setSoundEnabled(soundSetting === 'true');
      setVibrationEnabled(vibrationSetting === 'true');
    } catch (error) {
      console.error('Error loading notification settings:', error);
    }
  };

  const checkAudioPermissions = async () => {
    try {
      const { status } = await Audio.getPermissionsAsync();
      setAudioPermissionStatus(status);
    } catch (error) {
      console.error('Error checking audio permissions:', error);
      setAudioPermissionStatus('error');
    }
  };

  const requestAudioPermissions = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      setAudioPermissionStatus(status);
      return status === 'granted';
    } catch (error) {
      console.error('Error requesting audio permissions:', error);
      setAudioPermissionStatus('error');
      return false;
    }
  };

  const getPermissionStatusText = () => {
    switch (permissionStatus) {
      case 'granted':
        return 'Enabled';
      case 'denied':
        return 'Disabled';
      case 'undetermined':
        return 'Not Set';
      case 'unavailable':
        return 'Unavailable';
      case 'error':
        return 'Error';
      default:
        return 'Unknown';
    }
  };

  const getPermissionStatusColor = () => {
    switch (permissionStatus) {
      case 'granted':
        return '#4CAF50';
      case 'denied':
        return '#F44336';
      case 'undetermined':
        return '#FF9800';
      case 'unavailable':
      case 'error':
        return '#9E9E9E';
      default:
        return '#9E9E9E';
    }
  };

  const handleNotificationToggle = async () => {
    if (permissionStatus === 'granted') {
      // If already granted, show settings
      showPermissionSettings();
    } else if (permissionStatus === 'denied') {
      // If denied, show settings to manually enable
      showPermissionSettings();
    } else {
      // Request permissions
      setIsLoading(true);
      await requestPermissions();
      setIsLoading(false);
    }
  };

  const handleSoundToggle = async (value) => {
    if (value && audioPermissionStatus !== 'granted') {
      // Request audio permissions first
      const granted = await requestAudioPermissions();
      if (!granted) {
        Alert.alert(
          'Audio Permission Required',
          'Please enable audio permissions to use notification sounds.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Settings', onPress: () => Linking.openSettings() }
          ]
        );
        return;
      }
    }

    if (value) {
      // Test play the notification sound
      await playNotificationSound();
    }

    setSoundEnabled(value);
    await AsyncStorage.setItem(SOUND_ENABLED_KEY, value.toString());
  };

  const handleVibrationToggle = async (value) => {
    if (value) {
      // Test vibration
      Vibration.vibrate(200);
    }

    setVibrationEnabled(value);
    await AsyncStorage.setItem(VIBRATION_ENABLED_KEY, value.toString());
  };

  const playNotificationSound = async () => {
    try {
      // Unload previous sound if exists
      if (sound) {
        await sound.unloadAsync();
      }

      // Load and play notification sound
      const { sound: newSound } = await Audio.Sound.createAsync(
        require('../../assets/sounds/notification.mp3'),
        { shouldPlay: true, volume: 0.8 }
      );
      
      setSound(newSound);
      
      // Auto-unload after playing
      setTimeout(async () => {
        try {
          await newSound.unloadAsync();
        } catch (error) {
          console.error('Error unloading sound:', error);
        }
      }, 3000);
      
    } catch (error) {
      console.error('Error playing notification sound:', error);
      Alert.alert('Error', 'Failed to play notification sound');
    }
  };

  const testNotification = async () => {
    try {
      if (soundEnabled) {
        await playNotificationSound();
      }
      
      if (vibrationEnabled) {
        Vibration.vibrate(200);
      }
      
      Alert.alert('Test Notification', 'Notification settings tested successfully!');
    } catch (error) {
      console.error('Error testing notification:', error);
      Alert.alert('Error', 'Failed to test notification');
    }
  };

  const showPermissionSettings = () => {
    Alert.alert(
      'Notification Settings',
      'To change notification permissions, please go to your device settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() }
      ]
    );
  };

  const showRetryOptions = () => {
    Alert.alert(
      'Notification Setup',
      `Token generation failed (${retryCount} attempts). Would you like to retry or get help?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Retry', onPress: retryTokenGeneration },
        { text: 'Help', onPress: showTroubleshootingHelp }
      ]
    );
  };

  const showTroubleshootingHelp = () => {
    const helpMessage = `Notification troubleshooting:

1. Check device notification settings
2. Ensure app has notification permissions
3. Check internet connection
4. Restart the app
5. Update the app if available

Error: ${lastTokenError || 'Unknown error'}`;

    Alert.alert('Troubleshooting Help', helpMessage);
  };

  return (
    <View style={styles.container}>
      {/* Main Notification Permission */}
      <View style={styles.settingItem}>
        <View style={styles.settingHeader}>
          <View style={styles.settingLeft}>
            <Ionicons name="notifications-outline" size={24} color="#F97316" />
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingTitle}>Push Notifications</Text>
              <Text style={styles.settingSubtitle}>
                Receive booking requests and updates
              </Text>
            </View>
          </View>
          <View style={styles.settingRight}>
            <View style={styles.statusContainer}>
              <View style={[styles.statusDot, { backgroundColor: getPermissionStatusColor() }]} />
              <Text style={[styles.statusText, { color: getPermissionStatusColor() }]}>
                {getPermissionStatusText()}
              </Text>
            </View>
            {isLoading ? (
              <ActivityIndicator size="small" color="#F97316" style={styles.loader} />
            ) : (
              <TouchableOpacity
                style={styles.settingsButton}
                onPress={handleNotificationToggle}
              >
                <Ionicons name="settings-outline" size={20} color="#F97316" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Token Status */}
        {permissionStatus === 'granted' && (
          <View style={styles.tokenStatus}>
            <Text style={styles.tokenStatusText}>
              Token Status: {tokenStatus === 'success' ? '✅ Active' : '❌ Failed'}
            </Text>
            {tokenStatus === 'error' && (
              <TouchableOpacity onPress={showRetryOptions} style={styles.retryButton}>
                <Text style={styles.retryButtonText}>Retry ({retryCount})</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Sound Settings */}
      <View style={styles.settingItem}>
        <View style={styles.settingHeader}>
          <View style={styles.settingLeft}>
            <Ionicons name="volume-high-outline" size={24} color="#F97316" />
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingTitle}>Notification Sound</Text>
              <Text style={styles.settingSubtitle}>
                Play sound for new notifications
              </Text>
            </View>
          </View>
          <View style={styles.settingRight}>
            <Switch
              value={soundEnabled && audioPermissionStatus === 'granted'}
              onValueChange={handleSoundToggle}
              trackColor={{ false: '#E0E0E0', true: '#F97316' }}
              thumbColor={soundEnabled ? '#FFFFFF' : '#FFFFFF'}
              disabled={audioPermissionStatus !== 'granted' && !soundEnabled}
            />
          </View>
        </View>
        
        {audioPermissionStatus !== 'granted' && (
          <Text style={styles.permissionWarning}>
            Audio permission required for notification sounds
          </Text>
        )}
      </View>

      {/* Vibration Settings */}
      <View style={styles.settingItem}>
        <View style={styles.settingHeader}>
          <View style={styles.settingLeft}>
            <Ionicons name="phone-portrait-outline" size={24} color="#F97316" />
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingTitle}>Vibration</Text>
              <Text style={styles.settingSubtitle}>
                Vibrate for new notifications
              </Text>
            </View>
          </View>
          <View style={styles.settingRight}>
            <Switch
              value={vibrationEnabled}
              onValueChange={handleVibrationToggle}
              trackColor={{ false: '#E0E0E0', true: '#F97316' }}
              thumbColor={vibrationEnabled ? '#FFFFFF' : '#FFFFFF'}
            />
          </View>
        </View>
      </View>

      {/* Test Notification */}
      {(soundEnabled || vibrationEnabled) && (
        <TouchableOpacity style={styles.testButton} onPress={testNotification}>
          <Ionicons name="play-outline" size={20} color="#FFFFFF" />
          <Text style={styles.testButtonText}>Test Notification</Text>
        </TouchableOpacity>
      )}

      {/* Help Text */}
      <Text style={styles.helpText}>
        Configure your notification preferences. Sound and vibration will work only if the respective permissions are granted.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  settingItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  settingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 14,
    color: '#666666',
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  settingsButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#FFF7ED',
  },
  loader: {
    marginRight: 8,
  },
  tokenStatus: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tokenStatusText: {
    fontSize: 14,
    color: '#666666',
  },
  retryButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F97316',
    borderRadius: 6,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  permissionWarning: {
    marginTop: 8,
    fontSize: 12,
    color: '#FF9800',
    fontStyle: 'italic',
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F97316',
    margin: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  testButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  helpText: {
    fontSize: 12,
    color: '#999999',
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    lineHeight: 18,
  },
});

export default EnhancedNotificationSettings;
