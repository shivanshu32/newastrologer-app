import { Vibration } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Utility functions for handling notification feedback (sound and vibration)
 */

// Sound object reference to prevent garbage collection during playback
let soundObject = null;

/**
 * Play notification sound with error handling
 * @param {string} soundFile - Optional path to sound file (defaults to built-in notification sound)
 * @param {boolean} forcePlay - Force play sound regardless of user settings
 * @returns {Promise<void>}
 */
export const playNotificationSound = async (soundFile = null, forcePlay = false) => {
  try {
    // Check user preference unless forced
    if (!forcePlay) {
      const soundEnabled = await AsyncStorage.getItem('@notification_sound_enabled');
      if (soundEnabled !== 'true') {
        console.log('🔔 Notification sound disabled by user preference');
        return;
      }
      
      // Check audio permissions
      const { status } = await Audio.getPermissionsAsync();
      if (status !== 'granted') {
        console.log('🔔 Audio permission not granted, skipping sound');
        return;
      }
    }
    
    console.log('🔔 Playing notification sound');
    
    // Unload any existing sound to prevent memory leaks
    if (soundObject) {
      await soundObject.unloadAsync();
      soundObject = null;
    }
    
    // Create and play the sound
    const { sound } = await Audio.Sound.createAsync(
      require('../../assets/sounds/notification.mp3'),
      { shouldPlay: true, volume: 0.8 }
    );
    
    soundObject = sound;
    
    // Clean up sound after playing
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.didJustFinish) {
        sound.unloadAsync().then(() => {
          soundObject = null;
        }).catch(error => {
          console.error('Error unloading sound:', error);
        });
      }
    });
  } catch (error) {
    console.error('Error playing notification sound:', error);
  }
};

/**
 * Trigger device vibration with a specific pattern
 * @param {Array<number>} pattern - Optional vibration pattern (defaults to short double vibration)
 * @param {boolean} forceVibrate - Force vibration regardless of user settings
 * @returns {Promise<void>}
 */
export const triggerVibration = async (pattern = [0, 300, 100, 200], forceVibrate = false) => {
  try {
    // Check user preference unless forced
    if (!forceVibrate) {
      const vibrationEnabled = await AsyncStorage.getItem('@notification_vibration_enabled');
      if (vibrationEnabled !== 'true') {
        console.log('📳 Vibration disabled by user preference');
        return;
      }
    }
    
    console.log('📳 Triggering vibration');
    Vibration.vibrate(pattern);
  } catch (error) {
    console.error('Error triggering vibration:', error);
  }
};

/**
 * Provide notification feedback (sound and vibration)
 * @param {boolean} forcePlay - Force feedback regardless of user settings
 * @returns {Promise<void>}
 */
export const provideNotificationFeedback = async (forcePlay = false) => {
  try {
    // Run both sound and vibration concurrently
    await Promise.allSettled([
      triggerVibration([0, 300, 100, 200], forcePlay),
      playNotificationSound(null, forcePlay)
    ]);
  } catch (error) {
    console.error('Error providing notification feedback:', error);
  }
};

export default {
  playNotificationSound,
  triggerVibration,
  provideNotificationFeedback
};
