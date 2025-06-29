import React, { useContext } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { View, Text } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { SocketContext } from '../context/SocketContext';
import navigationConfig from './NavigationConfig';
import BookingRequestHandler from '../components/BookingRequestHandler';

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
import EnhancedChatScreen from '../screens/session/EnhancedChatScreen';
import VideoCallScreen from '../screens/VideoConsultationScreen';
import VoiceCallScreen from '../screens/VoiceCallScreen';
import RatingScreen from '../screens/session/RatingScreen';
import AvailabilityScreen from '../screens/main/AvailabilityScreen';
import WaitingRoomScreen from '../screens/WaitingRoomScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Stack navigator for Home tab
const HomeStack = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        ...navigationConfig.stack.screenOptions,
        headerShown: false,
      }}
    >
      <Stack.Screen name="HomeMain" component={HomeScreen} />
      <Stack.Screen name="HomeChat" component={ChatScreen} />
      <Stack.Screen name="HomeEnhancedChat" component={EnhancedChatScreen} />
      <Stack.Screen name="HomeVideoCall" component={VideoCallScreen} />
      <Stack.Screen name="HomeVoiceCall" component={VoiceCallScreen} />
      <Stack.Screen name="HomeRating" component={RatingScreen} />
      <Stack.Screen name="Availability" component={AvailabilityScreen} />
    </Stack.Navigator>
  );
};

// Stack navigator for Bookings tab
const BookingsStack = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        ...navigationConfig.stack.screenOptions,
        headerShown: false,
      }}
    >
      <Stack.Screen name="BookingsMain" component={BookingsScreen} />
      <Stack.Screen name="BookingsChat" component={EnhancedChatScreen} />
      <Stack.Screen name="BookingsEnhancedChat" component={EnhancedChatScreen} />
      <Stack.Screen name="BookingsVideoCall" component={VideoCallScreen} />
      <Stack.Screen name="BookingsVoiceCall" component={VoiceCallScreen} />
      <Stack.Screen name="BookingsRating" component={RatingScreen} />
      <Stack.Screen name="WaitingRoom" component={WaitingRoomScreen} />
    </Stack.Navigator>
  );
};

// Main tab navigator
const MainNavigator = () => {
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
          tabBarActiveTintColor: '#8A2BE2',
          tabBarInactiveTintColor: 'gray',
          tabBarStyle: {
            ...navigationConfig.tab.screenOptions.tabBarStyle,
            paddingBottom: 5,
            paddingTop: 5,
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

export default MainNavigator;
