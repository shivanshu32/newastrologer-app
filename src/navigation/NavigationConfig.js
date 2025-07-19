// NavigationConfig.js
// This file configures React Navigation to avoid using SafeAreaProvider

import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Override the default options for all navigators
const defaultScreenOptions = {
  // Disable safe area insets handling
  safeAreaInsets: { top: 0, right: 0, bottom: 0, left: 0 },
  // Use regular View instead of SafeAreaView
  headerStyle: {
    elevation: 0,
    shadowOpacity: 0,
  },
};

// Export configuration objects for use in navigation components
export const navigationConfig = {
  // Configuration for NavigationContainer
  container: {
    // Disable safe area handling
    theme: {
      colors: {
        background: '#ffffff',
        border: '#d0d0d0',
        card: '#ffffff',
        notification: '#ff3b30',
        primary: '#F97316',
        text: '#000000',
      },
    },
  },
  
  // Configuration for Stack Navigator
  stack: {
    screenOptions: {
      ...defaultScreenOptions,
      headerShown: false,
    },
  },
  
  // Configuration for Tab Navigator
  tab: {
    screenOptions: {
      ...defaultScreenOptions,
      tabBarStyle: {
        elevation: 0,
        shadowOpacity: 0,
        height: 60,
        paddingBottom: 10,
      },
    },
  },
};

export default navigationConfig;
