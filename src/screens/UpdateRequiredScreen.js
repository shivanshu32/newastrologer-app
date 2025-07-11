import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  BackHandler,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import versionService from '../services/versionService';

const UpdateRequiredScreen = ({ route }) => {
  const {
    currentVersion,
    latestVersion,
    updateMessage,
    forceUpdate = true,
  } = route?.params || {};

  // Disable back button for forced updates
  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        if (forceUpdate) {
          Alert.alert(
            'Update Required',
            'You must update the app to continue using it.',
            [{ text: 'OK' }]
          );
          return true; // Prevent default back action
        }
        return false; // Allow default back action
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription?.remove();
    }, [forceUpdate])
  );

  const handleUpdatePress = async () => {
    try {
      await versionService.openStore();
    } catch (error) {
      console.error('Failed to open store:', error);
      Alert.alert(
        'Error',
        'Unable to open the app store. Please search for "JyotishCall Astrologer" in your app store and update manually.'
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* App Icon/Logo */}
        <View style={styles.iconContainer}>
          <Ionicons name="refresh-circle" size={120} color="#8A2BE2" />
        </View>

        {/* Title */}
        <Text style={styles.title}>Update Required</Text>

        {/* Version Info */}
        <View style={styles.versionContainer}>
          <View style={styles.versionRow}>
            <Text style={styles.versionLabel}>Current Version:</Text>
            <Text style={styles.versionValue}>{currentVersion || '1.0.0'}</Text>
          </View>
          <View style={styles.versionRow}>
            <Text style={styles.versionLabel}>Latest Version:</Text>
            <Text style={styles.versionValueLatest}>{latestVersion || '1.1.0'}</Text>
          </View>
        </View>

        {/* Update Message */}
        <Text style={styles.message}>
          {updateMessage || 
            'A new version of JyotishCall Astrologer is available with improved features and bug fixes. Please update to continue providing consultations.'}
        </Text>

        {/* Features List */}
        <View style={styles.featuresContainer}>
          <Text style={styles.featuresTitle}>What's New:</Text>
          <View style={styles.featureItem}>
            <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
            <Text style={styles.featureText}>Enhanced consultation experience</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
            <Text style={styles.featureText}>Improved booking management</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
            <Text style={styles.featureText}>Better performance and stability</Text>
          </View>
        </View>

        {/* Update Button */}
        <TouchableOpacity style={styles.updateButton} onPress={handleUpdatePress}>
          <Ionicons name="download" size={24} color="#FFFFFF" />
          <Text style={styles.updateButtonText}>Update Now</Text>
        </TouchableOpacity>

        {/* Footer */}
        <Text style={styles.footer}>
          {forceUpdate 
            ? 'This update is required to continue providing consultations.'
            : 'You can skip this update, but we recommend updating for the best experience.'
          }
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginBottom: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 24,
    textAlign: 'center',
  },
  versionContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  versionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  versionLabel: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  versionValue: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '600',
  },
  versionValueLatest: {
    fontSize: 16,
    color: '#8A2BE2',
    fontWeight: '700',
  },
  message: {
    fontSize: 16,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  featuresContainer: {
    width: '100%',
    marginBottom: 32,
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureText: {
    fontSize: 16,
    color: '#4B5563',
    marginLeft: 12,
  },
  updateButton: {
    backgroundColor: '#8A2BE2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    marginBottom: 24,
    shadowColor: '#8A2BE2',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  updateButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  footer: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default UpdateRequiredScreen;
