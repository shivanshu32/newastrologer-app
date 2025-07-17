import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Alert,
  SafeAreaView,
  StatusBar,
  ScrollView,
  BackHandler,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const UpdateScreen = ({ route, navigation }) => {
  const { currentVersion, latestVersion } = route.params || {};

  // Prevent back navigation
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      return true; // Prevent back navigation
    });

    return () => backHandler.remove();
  }, []);

  const handleUpdatePress = () => {
    const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.jyotishcall.astrologer';
    const appStoreUrl = 'https://apps.apple.com/app/jyotishcall-astrologer/id123456790';
    
    Alert.alert(
      'Choose App Store',
      'Select your device platform to update the app',
      [
        {
          text: 'Google Play Store',
          onPress: () => {
            Linking.openURL(playStoreUrl).catch(err => {
              console.error('Error opening Play Store:', err);
              Alert.alert('Error', 'Could not open Play Store. Please update manually.');
            });
          },
        },
        {
          text: 'Apple App Store',
          onPress: () => {
            Linking.openURL(appStoreUrl).catch(err => {
              console.error('Error opening App Store:', err);
              Alert.alert('Error', 'Could not open App Store. Please update manually.');
            });
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1e3a8a" />
      
      <LinearGradient
        colors={['#1e3a8a', '#3b82f6', '#60a5fa']}
        style={styles.gradient}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Update Icon */}
          <View style={styles.iconContainer}>
            <Ionicons name="cloud-download" size={80} color="#fff" />
          </View>

          {/* Title */}
          <Text style={styles.title}>Update Available</Text>
          
          {/* Subtitle */}
          <Text style={styles.subtitle}>
            A new version of JyotishCall Astrologer is available
          </Text>

          {/* Version Info */}
          <View style={styles.versionContainer}>
            <View style={styles.versionRow}>
              <Text style={styles.versionLabel}>Current Version:</Text>
              <Text style={styles.versionValue}>{currentVersion || '1.0.0'}</Text>
            </View>
            <View style={styles.versionRow}>
              <Text style={styles.versionLabel}>Latest Version:</Text>
              <Text style={styles.versionValueLatest}>{latestVersion || '1.0.1'}</Text>
            </View>
          </View>

          {/* Features List */}
          <View style={styles.featuresContainer}>
            <Text style={styles.featuresTitle}>What's New:</Text>
            
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={20} color="#10b981" />
              <Text style={styles.featureText}>Enhanced booking management</Text>
            </View>
            
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={20} color="#10b981" />
              <Text style={styles.featureText}>Improved earnings tracking</Text>
            </View>
            
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={20} color="#10b981" />
              <Text style={styles.featureText}>Better notification system</Text>
            </View>
            
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={20} color="#10b981" />
              <Text style={styles.featureText}>Performance improvements</Text>
            </View>
            
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={20} color="#10b981" />
              <Text style={styles.featureText}>Bug fixes and stability</Text>
            </View>
          </View>

          {/* Update Button */}
          <TouchableOpacity 
            style={styles.updateButton}
            onPress={handleUpdatePress}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#10b981', '#059669']}
              style={styles.updateButtonGradient}
            >
              <Ionicons name="download" size={24} color="#fff" />
              <Text style={styles.updateButtonText}>Update Now</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Info Text */}
          <Text style={styles.infoText}>
            Please update to the latest version to continue using all features and ensure optimal performance.
          </Text>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  iconContainer: {
    marginBottom: 24,
    padding: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 50,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  versionContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 20,
    marginBottom: 32,
    width: '100%',
  },
  versionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  versionLabel: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  versionValue: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  versionValueLatest: {
    fontSize: 16,
    color: '#10b981',
    fontWeight: '600',
  },
  featuresContainer: {
    width: '100%',
    marginBottom: 32,
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginLeft: 12,
    flex: 1,
  },
  updateButton: {
    width: '100%',
    marginBottom: 24,
    borderRadius: 12,
    overflow: 'hidden',
  },
  updateButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  updateButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
  infoText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },
});

export default UpdateScreen;
