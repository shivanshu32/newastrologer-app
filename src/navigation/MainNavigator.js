import React, { useContext, useState, useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { SocketContext } from '../context/SocketContext';
import navigationConfig from './NavigationConfig';
import BookingRequestHandler from '../components/BookingRequestHandler';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Temporary test component
const TestHomeScreen = () => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <Text>Test Home Screen</Text>
  </View>
);

// Import screens
import HomeScreen from '../screens/main/HomeScreen';
import BookingsScreen from '../screens/main/BookingsScreen';
import WalletScreen from '../screens/main/WalletScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import ChatScreen from '../screens/session/ChatScreen';
import FixedChatScreen from '../screens/session/FixedChatScreen';
import FixedFreeChatScreen from '../screens/session/FixedFreeChatScreen';
import TransactionHistoryScreen from '../screens/main/TransactionHistoryScreen';
import TransactionDetailScreen from '../screens/main/TransactionDetailScreen';
import ChatHistoryScreen from '../screens/ChatHistoryScreen';

import RatingScreen from '../screens/session/RatingScreen';
import AvailabilityScreen from '../screens/main/AvailabilityScreen';
import WaitingRoomScreen from '../screens/WaitingRoomScreen';
import UpdateScreen from '../screens/UpdateScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Stack navigator for Home tab
const HomeStack = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  
  return (
    <Stack.Navigator
      screenOptions={{
        ...navigationConfig.stack.screenOptions,
        headerShown: false,
      }}
      screenListeners={{
        state: (e) => {
          // Get the current route name in the stack
          const routeName = e.data.state.routes[e.data.state.index].name;
          // Hide tab bar for EnhancedChatScreen
          if (routeName === 'HomeEnhancedChat') {
            navigation.setOptions({
              tabBarStyle: { display: 'none' }
            });
          } else {
            navigation.setOptions({
              tabBarStyle: {
                ...navigationConfig.tab.screenOptions.tabBarStyle,
                paddingBottom: Platform.OS === 'android' ? Math.max(insets.bottom, 5) : 5,
                paddingTop: 5,
                height: Platform.OS === 'android' ? 60 + Math.max(insets.bottom, 0) : 60,
              }
            });
          }
        },
      }}
    >
      <Stack.Screen name="HomeMain" component={HomeScreen} />
      <Stack.Screen name="HomeChat" component={ChatScreen} options={{ headerShown: false }} />
      <Stack.Screen name="HomeEnhancedChat" component={FixedChatScreen} options={{ headerShown: false }} />
      <Stack.Screen name="FixedFreeChatScreen" component={FixedFreeChatScreen} options={{ headerShown: false }} />
      <Stack.Screen name="HomeRating" component={RatingScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Availability" component={AvailabilityScreen} options={{ headerShown: false }} />
      <Stack.Screen name="UpdateScreen" component={UpdateScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
};

// Stack navigator for Bookings tab
const BookingsStack = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  // Track current tab bar state to prevent unnecessary setOptions calls
  const [currentTabBarState, setCurrentTabBarState] = React.useState(null);
  
  // Memoize navigation options to prevent unnecessary re-renders
  const screenOptions = React.useMemo(() => ({
    ...navigationConfig.stack.screenOptions,
    headerShown: false,
  }), []);
  
  const hiddenTabBarStyle = React.useMemo(() => ({
    tabBarStyle: { display: 'none' }
  }), []);
  
  const visibleTabBarStyle = React.useMemo(() => ({
    tabBarStyle: {
      ...navigationConfig.tab.screenOptions.tabBarStyle,
      paddingBottom: Platform.OS === 'android' ? Math.max(insets.bottom, 5) : 5,
      paddingTop: 5,
      height: Platform.OS === 'android' ? 60 + Math.max(insets.bottom, 0) : 60,
    }
  }), [insets.bottom]);
  
  // Memoize screen listeners to prevent recreation on every render
  const screenListeners = React.useMemo(() => ({
    state: (e) => {
      // Get the current route name in the stack
      const routeName = e.data.state.routes[e.data.state.index].name;
      
      // Determine if tab bar should be hidden
      const shouldHideTabBar = routeName === 'BookingsChat' || routeName === 'BookingsEnhancedChat';
      
      // Only call setOptions if the state actually changed
      if (currentTabBarState !== shouldHideTabBar) {
        console.log('🔄 [NAVIGATION] Tab bar state changing:', { routeName, shouldHideTabBar, previousState: currentTabBarState });
        setCurrentTabBarState(shouldHideTabBar);
        
        if (shouldHideTabBar) {
          navigation.setOptions(hiddenTabBarStyle);
        } else {
          navigation.setOptions(visibleTabBarStyle);
        }
      }
    },
  }), [currentTabBarState, navigation, hiddenTabBarStyle, visibleTabBarStyle]);
  
  return (
    <Stack.Navigator
      screenOptions={screenOptions}
      screenListeners={screenListeners}
    >
      <Stack.Screen name="BookingsMain" component={BookingsScreen} />
      <Stack.Screen name="BookingsChat" component={FixedChatScreen} />
      <Stack.Screen name="BookingsEnhancedChat" component={FixedChatScreen} />


      <Stack.Screen name="BookingsRating" component={RatingScreen} />
      <Stack.Screen name="WaitingRoom" component={WaitingRoomScreen} />
    </Stack.Navigator>
  );
};

// Main tab navigator
const TabNavigator = () => {
  const insets = useSafeAreaInsets();
  
  return (
    <>
      {/* This component will listen for booking requests regardless of which screen is active */}
      <BookingRequestHandler />
      
      <Tab.Navigator
        screenOptions={({ route }) => ({
          ...navigationConfig.tab.screenOptions,
          headerShown: false,
          tabBarIcon: ({ focused, color, size }) => {
            let iconName;

            if (route.name === 'Home') {
              iconName = focused ? 'home' : 'home-outline';
            } else if (route.name === 'Bookings') {
              iconName = focused ? 'calendar' : 'calendar-outline';
            } else if (route.name === 'Wallet') {
              iconName = focused ? 'wallet' : 'wallet-outline';
            } else if (route.name === 'Profile') {
              iconName = focused ? 'person' : 'person-outline';
            }

            return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: '#F97316',
          tabBarInactiveTintColor: 'gray',
          tabBarStyle: {
            ...navigationConfig.tab.screenOptions.tabBarStyle,
            paddingBottom: Platform.OS === 'android' ? Math.max(insets.bottom, 5) : 5,
            paddingTop: 5,
            height: Platform.OS === 'android' ? 60 + Math.max(insets.bottom, 0) : 60,
          },
        })}
      >
        <Tab.Screen name="Home" component={HomeStack} />
        <Tab.Screen name="Bookings" component={BookingsStack} />
        <Tab.Screen name="Wallet" component={WalletScreen} />
        <Tab.Screen name="Profile" component={ProfileScreen} />
      </Tab.Navigator>
    </>
  );
};

// Root stack navigator that includes the tab navigator and modal screens
const MainNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="Main" component={TabNavigator} />
      <Stack.Screen 
        name="TransactionHistory" 
        component={TransactionHistoryScreen} 
        options={{ headerShown: true, title: 'Earnings History' }}
      />
      <Stack.Screen 
        name="TransactionDetail" 
        component={TransactionDetailScreen} 
        options={{ headerShown: true, title: 'Transaction Details' }}
      />
      <Stack.Screen 
        name="ChatHistory" 
        component={ChatHistoryScreen} 
        options={{ headerShown: true, title: 'Chat History' }}
      />
    </Stack.Navigator>
  );
};

export default MainNavigator;
